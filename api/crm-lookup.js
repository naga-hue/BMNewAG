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
 * Loads all company tenants and staff mapping to route each employee to their respective CRM API Key.
 * Supports the 4 Recruitly tenants: Humres, Huntek, Totaco, and Strata.
 */
async function getTenantContext(firestoreDb) {
  try {
    const [compSnap, staffSnap] = await Promise.all([
      firestoreDb.collection('companies').get(),
      firestoreDb.collection('staff').get()
    ]);

    const companyKeyMap = new Map(); // companyId -> recruitlyApiKey
    const companyTenantMap = new Map(); // 'humres' | 'huntek' | 'totaco' | 'strata' -> recruitlyApiKey
    const allApiKeys = [];

    compSnap.forEach(doc => {
      const data = doc.data();
      if (data.recruitlyApiKey) {
        const key = data.recruitlyApiKey.trim();
        companyKeyMap.set(doc.id, key);
        if (!allApiKeys.includes(key)) allApiKeys.push(key);
        
        const name = (data.name || '').toLowerCase().trim();
        if (name.includes('humres')) companyTenantMap.set('humres', key);
        else if (name.includes('huntek')) companyTenantMap.set('huntek', key);
        else if (name.includes('totaco')) companyTenantMap.set('totaco', key);
        else if (name.includes('strata')) companyTenantMap.set('strata', key);
      }
    });

    const staffToCompanyMap = new Map(); // staffId / normalized email -> companyId
    staffSnap.forEach(doc => {
      const data = doc.data();
      const compId = data.companyId;
      if (compId) {
        staffToCompanyMap.set(doc.id, compId);
        if (data.businessEmail) staffToCompanyMap.set(data.businessEmail.toLowerCase().trim(), compId);
        if (data.dialpadEmail) staffToCompanyMap.set(data.dialpadEmail.toLowerCase().trim(), compId);
        if (data.recruitlyEmail) staffToCompanyMap.set(data.recruitlyEmail.toLowerCase().trim(), compId);
      }
    });

    return { companyKeyMap, companyTenantMap, staffToCompanyMap, allApiKeys };
  } catch (err) {
    console.error('[CRM Lookup] Error loading tenant context:', err);
    return { companyKeyMap: new Map(), companyTenantMap: new Map(), staffToCompanyMap: new Map(), allApiKeys: [] };
  }
}

/**
 * Resolve the correct company tenant API key for a given call or recruiter.
 * Routes Humres -> Humres, Huntek -> Huntek, Totaco -> Totaco, Strata -> Strata.
 */
function resolveTenantApiKey(callData, tenantContext, overrideCompanyId = null) {
  if (!tenantContext) return null;
  const { companyKeyMap, companyTenantMap, staffToCompanyMap, allApiKeys } = tenantContext;

  // 1. Explicit override passed from caller/client
  if (overrideCompanyId && companyKeyMap.has(overrideCompanyId)) {
    return companyKeyMap.get(overrideCompanyId);
  }

  // 2. Direct companyId on call record
  if (callData.companyId && companyKeyMap.has(callData.companyId)) {
    return companyKeyMap.get(callData.companyId);
  }

  // 3. Staff ID or handlerId mapping
  const staffId = callData.staffId || callData.handlerId;
  if (staffId && staffToCompanyMap.has(staffId)) {
    const compId = staffToCompanyMap.get(staffId);
    if (companyKeyMap.has(compId)) return companyKeyMap.get(compId);
  }

  // 4. Handler Email mapping
  const email = (callData.handlerEmail || '').toLowerCase().trim();
  if (email && staffToCompanyMap.has(email)) {
    const compId = staffToCompanyMap.get(email);
    if (companyKeyMap.has(compId)) return companyKeyMap.get(compId);
  }

  // 5. Department / email domain heuristic for the 4 tenants
  const dept = (callData.department || '').toLowerCase().trim();
  if (email.includes('huntek') || dept.includes('huntek')) return companyTenantMap.get('huntek') || companyTenantMap.get('humres');
  if (email.includes('totaco') || dept.includes('totaco')) return companyTenantMap.get('totaco') || companyTenantMap.get('humres');
  if (email.includes('strata') || dept.includes('strata')) return companyTenantMap.get('strata') || companyTenantMap.get('humres');
  if (email.includes('humres') || dept.includes('humres')) return companyTenantMap.get('humres');

  // 6. Default to Humres or first available tenant key
  return companyTenantMap.get('humres') || allApiKeys[0] || null;
}

/**
 * Search Recruitly CRM by phone variants across Candidates (ca-), Contacts (ct-), and Companies (cy-).
 */
const crmServerPhoneCache = new Map();

/**
 * Search Recruitly CRM by phone variants across Candidates (ca-), Contacts (ct-), and Companies (cy-).
 */
async function searchRecruitlyByPhone(phone, apiKey) {
  if (!phone || !apiKey) return null;
  const cleanPhone = String(phone).replace(/[^0-9+]/g, '').trim();
  if (crmServerPhoneCache.has(cleanPhone)) {
    return crmServerPhoneCache.get(cleanPhone);
  }

  const variants = getPhoneSearchVariants(phone);
  if (variants.length === 0) return null;

  for (const queryPhone of variants) {
    const encoded = encodeURIComponent(queryPhone);
    const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encoded}`;
    const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encoded}`;
    const companyUrl = `https://api.recruitly.io/api/company/search?apiKey=${apiKey}&query=${encoded}`;

    try {
      // Execute all 3 search requests in parallel instead of sequentially
      const [candRes, contactRes, compRes] = await Promise.all([
        fetchJson(candUrl).catch(e => { console.error(`[CRM Lookup] Cand error: ${e.message}`); return null; }),
        fetchJson(contactUrl).catch(e => { console.error(`[CRM Lookup] Contact error: ${e.message}`); return null; }),
        fetchJson(companyUrl).catch(e => { console.error(`[CRM Lookup] Company error: ${e.message}`); return null; })
      ]);

      if (candRes && Array.isArray(candRes.data) && candRes.data.length > 0) {
        const cand = candRes.data[0];
        const candId = cand.id || `ca-${cand._id || 'unknown'}`;
        const candCompany = typeof cand.company === 'object'
          ? (cand.company?.label || cand.company?.name || cand.companyName || '')
          : (cand.companyName || cand.company || '');
        const matched = {
          matched: true,
          type: 'CANDIDATE',
          targetType: 'Candidate',
          classificationSource: 'crm_ca',
          id: candId,
          name: cand.fullName || cand.name || 'Candidate',
          company: candCompany,
          matchedQuery: queryPhone
        };
        crmServerPhoneCache.set(cleanPhone, matched);
        return matched;
      }

      if (contactRes && Array.isArray(contactRes.data) && contactRes.data.length > 0) {
        const contact = contactRes.data[0];
        const contactId = contact.id || `ct-${contact._id || 'unknown'}`;
        const contactCompany = typeof contact.company === 'object'
          ? (contact.company?.label || contact.company?.name || contact.companyName || '')
          : (contact.companyName || contact.company || '');
        const matched = {
          matched: true,
          type: 'CONTACT',
          targetType: 'Client',
          classificationSource: 'crm_ct',
          id: contactId,
          name: contact.fullName || contact.name || 'Client Contact',
          company: contactCompany,
          matchedQuery: queryPhone
        };
        crmServerPhoneCache.set(cleanPhone, matched);
        return matched;
      }

      if (compRes && Array.isArray(compRes.data) && compRes.data.length > 0) {
        const comp = compRes.data[0];
        const compId = comp.id || `cy-${comp._id || 'unknown'}`;
        const compName = comp.name || comp.label || 'Client Company';
        const matched = {
          matched: true,
          type: 'COMPANY',
          targetType: 'Client',
          classificationSource: 'crm_cy',
          id: compId,
          name: compName,
          company: compName,
          matchedQuery: queryPhone
        };
        crmServerPhoneCache.set(cleanPhone, matched);
        return matched;
      }
    } catch (e) {
      console.error(`[CRM Lookup] Search error for ${queryPhone}:`, e.message);
    }
  }

  crmServerPhoneCache.set(cleanPhone, null);
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
export async function classifyCallRecord(callData, apiKey, firestoreDb, fallbackApiKeys = []) {
  const phone = callData.externalNumber || callData.phoneNumber || callData.contact?.phone_number || '';
  const transcript = callData.transcript || '';
  const recapSummary = callData.recapSummary || '';
  const recapOutcome = callData.recapOutcome || '';

  // 1. Try primary CRM tenant lookup first (Candidate ca-, Contact ct-, Company cy-)
  if (phone && apiKey) {
    let crmMatch = await searchRecruitlyByPhone(phone, apiKey);

    // If not found in primary tenant, search other company tenants as fallback
    if ((!crmMatch || !crmMatch.matched) && fallbackApiKeys && fallbackApiKeys.length > 0) {
      for (const fallbackKey of fallbackApiKeys) {
        if (fallbackKey && fallbackKey !== apiKey) {
          crmMatch = await searchRecruitlyByPhone(phone, fallbackKey);
          if (crmMatch && crmMatch.matched) break;
        }
      }
    }

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
    classificationSource: 'unmatched_default'
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
    const tenantContext = await getTenantContext(firestoreDb);

    // ==========================================
    // ACTION: BATCH CLASSIFY CALLS
    // ==========================================
    if (action === 'batch_classify') {
      const limit = Math.min(Number(queryLimit || 15), 50);
      const days = Number(query.days || 10);
      const forceAll = query.force === 'true' || query.force === true;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().substring(0, 10);

      console.log(`[CRM Lookup] Running batch classification across 4 tenants for last ${days} days (cutoff: ${cutoffStr}), limit ${limit}...`);

      const callsSnap = await firestoreDb.collection('dialpad_calls')
        .where('dateStarted', '>=', cutoffStr)
        .orderBy('dateStarted', 'desc')
        .limit(100)
        .get();

      const toProcess = [];
      let totalInWindow = callsSnap.size;
      let alreadyClassified = 0;

      callsSnap.forEach(doc => {
        const data = doc.data();
        const isProcessed = Boolean(data.classificationSource && data.classifiedAt);

        if (!isProcessed || forceAll) {
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
          const callApiKey = resolveTenantApiKey(call, tenantContext, companyId);
          const otherKeys = tenantContext.allApiKeys.filter(k => k !== callApiKey);
          const classification = await classifyCallRecord(call, callApiKey, firestoreDb, otherKeys);
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
      const callApiKey = resolveTenantApiKey(callData, tenantContext, companyId);
      const otherKeys = tenantContext.allApiKeys.filter(k => k !== callApiKey);
      const classification = await classifyCallRecord(callData, callApiKey, firestoreDb, otherKeys);

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

    let targetApiKey = null;
    if (companyId && tenantContext.companyKeyMap.has(companyId)) {
      targetApiKey = tenantContext.companyKeyMap.get(companyId);
    } else if (callId) {
      const callDoc = await firestoreDb.collection('dialpad_calls').doc(String(callId)).get();
      if (callDoc.exists) {
        targetApiKey = resolveTenantApiKey(callDoc.data(), tenantContext);
      }
    }
    if (!targetApiKey) {
      targetApiKey = tenantContext.companyTenantMap.get('humres') || tenantContext.allApiKeys[0];
    }

    const otherKeys = tenantContext.allApiKeys.filter(k => k !== targetApiKey);
    let result = null;
    if (targetApiKey) {
      result = await searchRecruitlyByPhone(cleanPhone, targetApiKey);
      if ((!result || !result.matched) && otherKeys.length > 0) {
        for (const fbKey of otherKeys) {
          result = await searchRecruitlyByPhone(cleanPhone, fbKey);
          if (result && result.matched) break;
        }
      }
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
