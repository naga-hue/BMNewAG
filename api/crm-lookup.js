import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import https from 'https';

function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) key = parsed.private_key.trim();
    } catch (e) {
      console.error('[Firestore] Failed parsing privateKey JSON:', e);
    }
  }
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
  key = key.replace(/\\n/g, '\n');
  if (key.startsWith('nMII')) key = key.substring(1);
  
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  if (!key.includes(header)) {
    let base64Body = key;
    if (base64Body.includes(footer)) base64Body = base64Body.split(footer)[0];
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');
    const lines = [];
    for (let i = 0; i < base64Body.length; i += 64) {
      lines.push(base64Body.substring(i, i + 64));
    }
    key = `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return key;
}

let db = null;
function initFirestore() {
  if (!db) {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'humres-management-hub';
      let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (privateKey && privateKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey.trim());
          if (parsed.private_key) privateKey = parsed.private_key;
          if (parsed.client_email && !clientEmail) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed parsing privateKey JSON:', e);
        }
      }

      if (clientEmail && clientEmail.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(clientEmail.trim());
          if (parsed.client_email) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed parsing clientEmail JSON:', e);
        }
      }

      if (clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formatPrivateKey(privateKey),
          })
        });
      } else {
        throw new Error('Firebase credentials not set in Vercel environment variables.');
      }
    }
    db = getFirestore();
  }
  return db;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            resolve({ error: true, statusCode: res.statusCode, body });
          }
        } catch (e) {
          resolve({ error: true, statusCode: res.statusCode, message: e.message, body });
        }
      });
    }).on('error', (err) => reject(err));
  });
}

/**
 * Generate phone variants for CRM lookup (e.g. +447123456789, 07123456789, 7123456789)
 */
function getPhoneSearchVariants(rawPhone) {
  if (!rawPhone) return [];
  const clean = String(rawPhone).replace(/[^0-9+]/g, '').trim();
  if (clean.length < 6) return [];

  const variants = new Set();
  variants.add(clean);

  if (clean.startsWith('+')) {
    variants.add(clean.substring(1));
  }

  if (clean.startsWith('+44')) {
    const rest = clean.substring(3);
    variants.add(`0${rest}`);
    variants.add(rest);
  } else if (clean.startsWith('44') && clean.length >= 11) {
    const rest = clean.substring(2);
    variants.add(`+44${rest}`);
    variants.add(`0${rest}`);
    variants.add(rest);
  } else if (clean.startsWith('0') && clean.length >= 10) {
    const rest = clean.substring(1);
    variants.add(`+44${rest}`);
    variants.add(rest);
  }

  return Array.from(variants);
}

/**
 * Resolve the Recruitly CRM API Key from the companies collection.
 */
async function getRecruitlyApiKey(firestoreDb, companyId) {
  if (companyId) {
    try {
      const compDoc = await firestoreDb.collection('companies').doc(companyId).get();
      if (compDoc.exists && compDoc.data().recruitlyApiKey) {
        return compDoc.data().recruitlyApiKey.trim();
      }
    } catch (err) {
      console.warn('[CRM Lookup] Error fetching company by ID:', err);
    }
  }

  // Find Humres CRM API Key from companies collection
  try {
    const compSnap = await firestoreDb.collection('companies').get();
    let apiKey = null;
    compSnap.forEach((doc) => {
      const data = doc.data();
      if (data.name && data.name.toLowerCase().includes('humres') && data.recruitlyApiKey) {
        apiKey = data.recruitlyApiKey.trim();
      }
    });

    if (!apiKey) {
      compSnap.forEach((doc) => {
        const data = doc.data();
        if (data.recruitlyApiKey && !apiKey) {
          apiKey = data.recruitlyApiKey.trim();
        }
      });
    }

    return apiKey;
  } catch (err) {
    console.error('[CRM Lookup] Error fetching companies collection:', err);
    return null;
  }
}

/**
 * Search Recruitly CRM by phone variants across Candidates (ca-), Contacts (ct-), and Companies (cy-).
 */
async function searchRecruitlyByPhone(phone, apiKey) {
  const variants = getPhoneSearchVariants(phone);
  if (variants.length === 0) return null;

  for (const queryPhone of variants) {
    // 1. Search Candidates (Recruitly IDs start with ca-)
    try {
      const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encodeURIComponent(queryPhone)}`;
      const candRes = await fetchJson(candUrl);
      if (candRes && Array.isArray(candRes.data) && candRes.data.length > 0) {
        const cand = candRes.data[0];
        const candId = cand.id || `ca-${cand._id || 'unknown'}`;
        return {
          matched: true,
          type: 'CANDIDATE',
          targetType: 'Candidate',
          classificationSource: 'crm_ca',
          id: candId,
          name: cand.fullName || cand.name || 'Candidate',
          company: cand.companyName || cand.company || '',
          matchedQuery: queryPhone
        };
      }
    } catch (e) {
      console.error(`[CRM Lookup] Candidate search error for ${queryPhone}:`, e.message);
    }

    // 2. Search Contacts (Client contacts; Recruitly IDs start with ct-)
    try {
      const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encodeURIComponent(queryPhone)}`;
      const contactRes = await fetchJson(contactUrl);
      if (contactRes && Array.isArray(contactRes.data) && contactRes.data.length > 0) {
        const contact = contactRes.data[0];
        const contactId = contact.id || `ct-${contact._id || 'unknown'}`;
        return {
          matched: true,
          type: 'CONTACT',
          targetType: 'Client',
          classificationSource: 'crm_ct',
          id: contactId,
          name: contact.fullName || contact.name || 'Client Contact',
          company: contact.companyName || contact.company || '',
          matchedQuery: queryPhone
        };
      }
    } catch (e) {
      console.error(`[CRM Lookup] Contact search error for ${queryPhone}:`, e.message);
    }

    // 3. Search Companies (Client company accounts; Recruitly IDs start with cy-)
    try {
      const companyUrl = `https://api.recruitly.io/api/company/search?apiKey=${apiKey}&query=${encodeURIComponent(queryPhone)}`;
      const compRes = await fetchJson(companyUrl);
      if (compRes && Array.isArray(compRes.data) && compRes.data.length > 0) {
        const comp = compRes.data[0];
        const compId = comp.id || `cy-${comp._id || 'unknown'}`;
        return {
          matched: true,
          type: 'COMPANY',
          targetType: 'Client',
          classificationSource: 'crm_cy',
          id: compId,
          name: comp.name || 'Client Company',
          company: comp.name || '',
          matchedQuery: queryPhone
        };
      }
    } catch (e) {
      console.error(`[CRM Lookup] Company search error for ${queryPhone}:`, e.message);
    }
  }

  return null;
}

/**
 * Classify a call's conversation via DeepSeek AI when external phone is not found in CRM.
 */
async function classifyTranscriptWithAi(transcript, recapSummary = '', recapOutcome = '') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('[AI Classifier] DEEPSEEK_API_KEY not configured.');
    return null;
  }

  const textToAnalyze = [
    recapSummary ? `Recap Summary: ${recapSummary}` : '',
    recapOutcome ? `Recap Outcome: ${recapOutcome}` : '',
    transcript && transcript !== 'No transcript generated yet.' && transcript !== 'Transcript is empty' 
      ? `Call Transcript:\n${transcript.slice(0, 3000)}` 
      : ''
  ].filter(Boolean).join('\n\n');

  if (!textToAnalyze || textToAnalyze.trim().length < 25) {
    return null;
  }

  const prompt = `You are an expert recruitment operations auditor for Humres Technical Recruitment.
Analyze the following phone conversation between a recruitment consultant and an external caller/callee.
Determine whether the external party is a:
1. "Candidate": Job seeker, interviewee, contractor looking for placements, candidate discussing qualifications, CV, pay rate, notice period, or job openings.
2. "Client": Hiring manager, HR manager, commercial business partner, client company representative, procurement, or business development lead discussing company vacancies, hiring requirements, terms of business, or commercial projects.

Respond ONLY with a valid JSON object in this format (no markdown fences, no explanatory text):
{"type": "Candidate" | "Client", "reason": "1-sentence concise reason", "confidence": 0.8}`;

  const payload = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You classify recruitment call transcripts as Candidate or Client. Output pure JSON only.' },
      { role: 'user', content: `${prompt}\n\nCall Content:\n${textToAnalyze}` }
    ],
    temperature: 0.1
  });

  const options = {
    hostname: 'api.deepseek.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const rawResult = await new Promise((resolve, reject) => {
      const apiReq = https.request(options, (apiRes) => {
        let body = '';
        apiRes.on('data', chunk => body += chunk);
        apiRes.on('end', () => {
          if (apiRes.statusCode === 200) {
            resolve(body);
          } else {
            reject(new Error(`DeepSeek API returned status ${apiRes.statusCode}: ${body}`));
          }
        });
      });
      apiReq.on('error', e => reject(e));
      apiReq.setTimeout(12000, () => {
        apiReq.destroy();
        reject(new Error('DeepSeek API request timed out'));
      });
      apiReq.write(payload);
      apiReq.end();
    });

    const parsedData = JSON.parse(rawResult);
    const contentText = parsedData.choices?.[0]?.message?.content?.trim() || '';
    const cleanJson = contentText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const resultObj = JSON.parse(cleanJson);

    const isCandidate = (resultObj.type || '').toLowerCase().includes('cand');
    return {
      type: isCandidate ? 'Candidate' : 'Client',
      reason: resultObj.reason || '',
      confidence: typeof resultObj.confidence === 'number' ? resultObj.confidence : 0.85
    };
  } catch (err) {
    console.error('[AI Classifier] DeepSeek classification failed:', err.message);
    return null;
  }
}

/**
 * Classify a call by checking CRM first, then falling back to AI transcript analysis.
 */
export async function classifyCallRecord(callData, apiKey, firestoreDb) {
  const phone = callData.externalNumber || callData.phoneNumber || callData.contact?.phone_number || '';
  const transcript = callData.transcript || '';
  const recapSummary = callData.recapSummary || '';
  const recapOutcome = callData.recapOutcome || '';

  // 1. Try CRM lookup first (Candidate ca-, Contact ct-, Company cy-)
  if (phone && apiKey) {
    const crmMatch = await searchRecruitlyByPhone(phone, apiKey);
    if (crmMatch && crmMatch.matched) {
      return {
        matched: true,
        type: crmMatch.type,
        targetType: crmMatch.targetType,
        classificationSource: crmMatch.classificationSource,
        id: crmMatch.id,
        name: crmMatch.name,
        company: crmMatch.company
      };
    }
  }

  // 2. Unmatched in CRM -> Analyze transcript/recap with DeepSeek AI
  if (transcript || recapSummary || recapOutcome) {
    const aiResult = await classifyTranscriptWithAi(transcript, recapSummary, recapOutcome);
    if (aiResult && aiResult.type) {
      return {
        matched: false,
        targetType: aiResult.type,
        classificationSource: 'ai_transcript',
        aiReason: aiResult.reason,
        confidence: aiResult.confidence
      };
    }
  }

  // 3. Fallback to default heuristic if neither CRM nor AI was conclusive
  const defaultTargetType = (callData.target?.type || 'external').toLowerCase().trim() === 'user'
    ? 'Candidate'
    : 'Client';

  return {
    matched: false,
    targetType: defaultTargetType,
    classificationSource: 'default_heuristic'
  };
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const { phone, companyId, callId, action, limit: queryLimit } = query;

  try {
    const firestoreDb = initFirestore();
    const apiKey = await getRecruitlyApiKey(firestoreDb, companyId);

    // ==========================================
    // ACTION: BATCH CLASSIFY CALLS
    // ==========================================
    if (action === 'batch_classify') {
      const limit = Math.min(Number(queryLimit || 30), 100);
      const days = Number(query.days || 10);
      const forceAll = query.force === 'true' || query.force === true;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().substring(0, 10);

      console.log(`[CRM Lookup] Running batch classification for last ${days} days (cutoff: ${cutoffStr}), limit ${limit}...`);

      const callsSnap = await firestoreDb.collection('dialpad_calls')
        .where('dateStarted', '>=', cutoffStr)
        .orderBy('dateStarted', 'desc')
        .get();

      const toProcess = [];
      let totalInWindow = callsSnap.size;
      let alreadyClassified = 0;

      callsSnap.forEach(doc => {
        const data = doc.data();
        const hasHighConfidence = data.classificationSource && 
          (data.classificationSource.startsWith('crm_') || data.classificationSource === 'ai_transcript');

        if (!hasHighConfidence || forceAll) {
          if (toProcess.length < limit) {
            toProcess.push({ id: doc.id, ...data });
          }
        } else {
          alreadyClassified++;
        }
      });

      const remainingUnclassified = totalInWindow - alreadyClassified - toProcess.length;
      console.log(`[CRM Lookup] Total in window: ${totalInWindow}, already classified: ${alreadyClassified}, processing: ${toProcess.length}, remaining: ${remainingUnclassified}`);

      let crmCount = 0;
      let aiCount = 0;
      let defaultCount = 0;
      const results = [];

      for (const call of toProcess) {
        try {
          const classification = await classifyCallRecord(call, apiKey, firestoreDb);
          const updates = {
            targetType: classification.targetType,
            classificationSource: classification.classificationSource,
            classifiedAt: new Date().toISOString()
          };

          if (classification.matched) {
            crmCount++;
            updates.crmId = classification.id || '';
            updates.crmName = classification.name || '';
            updates.crmType = classification.type || '';
            updates.crmCompany = classification.company || '';
          } else if (classification.classificationSource === 'ai_transcript') {
            aiCount++;
            updates.aiClassificationReason = classification.aiReason || '';
          } else {
            defaultCount++;
          }

          await firestoreDb.collection('dialpad_calls').doc(call.id).update(updates);
          results.push({ id: call.id, ...updates });
        } catch (callErr) {
          console.error(`[CRM Lookup] Failed to classify call ${call.id}:`, callErr);
        }
      }

      return res.status(200).json({
        success: true,
        processed: results.length,
        totalInWindow,
        alreadyClassified,
        remainingUnclassified: Math.max(0, remainingUnclassified),
        crmMatches: crmCount,
        aiClassified: aiCount,
        defaultFallback: defaultCount,
        results
      });
    }

    // ==========================================
    // ACTION: CLASSIFY SPECIFIC CALL BY CALLID
    // ==========================================
    if (callId && (action === 'classify_call' || !phone)) {
      const callDoc = await firestoreDb.collection('dialpad_calls').doc(String(callId)).get();
      if (!callDoc.exists) {
        return res.status(404).json({ error: `Call with ID ${callId} not found` });
      }

      const callData = callDoc.data();
      const classification = await classifyCallRecord(callData, apiKey, firestoreDb);

      const updates = {
        targetType: classification.targetType,
        classificationSource: classification.classificationSource,
        classifiedAt: new Date().toISOString()
      };

      if (classification.matched) {
        updates.crmId = classification.id || '';
        updates.crmName = classification.name || '';
        updates.crmType = classification.type || '';
        updates.crmCompany = classification.company || '';
      }
      if (classification.aiReason) {
        updates.aiClassificationReason = classification.aiReason;
      }

      await firestoreDb.collection('dialpad_calls').doc(String(callId)).update(updates);
      return res.status(200).json({ success: true, ...classification, ...updates });
    }

    // ==========================================
    // ACTION: SINGLE PHONE NUMBER LOOKUP
    // ==========================================
    if (!phone) {
      return res.status(400).json({ error: 'Missing phone query parameter or callId' });
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '').trim();
    if (cleanPhone.length < 6) {
      return res.status(200).json({ success: true, matched: false, reason: 'Phone number too short' });
    }

    if (!apiKey) {
      console.warn('[CRM Lookup] No recruitlyApiKey found in companies collection.');
    }

    let result = null;
    if (apiKey) {
      result = await searchRecruitlyByPhone(cleanPhone, apiKey);
    }

    // If matched in CRM (ca-, ct-, or cy-)
    if (result && result.matched) {
      // If callId provided, persist to Firestore
      if (callId) {
        try {
          await firestoreDb.collection('dialpad_calls').doc(String(callId)).update({
            targetType: result.targetType,
            classificationSource: result.classificationSource,
            crmId: result.id,
            crmName: result.name,
            crmType: result.type,
            crmCompany: result.company || '',
            classifiedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error('[CRM Lookup] Error updating call document with CRM match:', e);
        }
      }

      return res.status(200).json({
        success: true,
        ...result
      });
    }

    // Not matched in CRM: Check if transcript is available for AI classification
    let transcriptText = query.transcript || '';
    let recapSummaryText = query.recapSummary || '';
    let recapOutcomeText = query.recapOutcome || '';

    if (!transcriptText && callId) {
      try {
        const callDoc = await firestoreDb.collection('dialpad_calls').doc(String(callId)).get();
        if (callDoc.exists) {
          const callData = callDoc.data();
          transcriptText = callData.transcript || '';
          recapSummaryText = callData.recapSummary || '';
          recapOutcomeText = callData.recapOutcome || '';
        }
      } catch (e) {
        console.error('[CRM Lookup] Error fetching transcript from call doc:', e);
      }
    }

    if (transcriptText || recapSummaryText || recapOutcomeText) {
      const aiResult = await classifyTranscriptWithAi(transcriptText, recapSummaryText, recapOutcomeText);
      if (aiResult && aiResult.type) {
        if (callId) {
          try {
            await firestoreDb.collection('dialpad_calls').doc(String(callId)).update({
              targetType: aiResult.type,
              classificationSource: 'ai_transcript',
              aiClassificationReason: aiResult.reason || '',
              classifiedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error('[CRM Lookup] Error updating call document with AI classification:', e);
          }
        }

        return res.status(200).json({
          success: true,
          matched: false,
          targetType: aiResult.type,
          classificationSource: 'ai_transcript',
          aiReason: aiResult.reason,
          confidence: aiResult.confidence
        });
      }
    }

    // Unmatched and no AI classification possible
    return res.status(200).json({
      success: true,
      matched: false,
      targetType: 'Unknown',
      classificationSource: 'unmatched'
    });

  } catch (error) {
    console.error('[CRM Lookup] Error during CRM / AI lookup:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during CRM search' });
  }
}
