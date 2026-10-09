import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isPaulSethCall, autoUploadTranscriptToOneDrive } from '../utils/onedrive-export.js';

// Robust PEM private key formatter
function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        key = parsed.private_key.trim();
      }
    } catch (e) {
      console.error('[Firestore] Failed to parse private key as JSON:', e);
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
    if (base64Body.includes(footer)) {
      base64Body = base64Body.split(footer)[0];
    }
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');
    const lines = [];
    for (let i = 0; i < base64Body.length; i += 64) {
      lines.push(base64Body.substring(i, i + 64));
    }
    key = `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return key;
}

// Initialize Firestore Admin SDK
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

// Helper to resolve all candidate Dialpad tokens with company preferred token first
async function getDialpadTokens(firestore, companyId) {
  const tokens = [];
  let preferredToken = '';

  if (companyId) {
    try {
      const compDoc = await firestore.collection('companies').doc(companyId).get();
      if (compDoc.exists) {
        const data = compDoc.data();
        if (data.dialpadApiKey && data.dialpadApiKey.trim()) {
          preferredToken = data.dialpadApiKey.trim();
          tokens.push(preferredToken);
        }
      }
    } catch (e) {
      console.error('[getDialpadTokens] Error fetching company:', e);
    }
  }

  // Check companyId for Totaco Ltd slot mapping
  if (!preferredToken) {
    if (companyId === 'comp-1782806159650') {
      preferredToken = (process.env.DIALPAD_TOKEN_2 || process.env.DIALPAD_TOKEN || '').trim();
    } else {
      preferredToken = (process.env.DIALPAD_TOKEN_1 || process.env.DIALPAD_TOKEN || '').trim();
    }
    if (preferredToken) tokens.push(preferredToken);
  }

  // Add all other tokens from environment variables as fallbacks
  const envTokens = [
    process.env.DIALPAD_TOKEN_1,
    process.env.DIALPAD_TOKEN_2,
    process.env.DIALPAD_TOKEN
  ].filter(Boolean).map(t => t.trim());
  envTokens.forEach(t => {
    if (t && !tokens.includes(t)) tokens.push(t);
  });

  // Also read all companies that have dialpadApiKey configured in Firestore
  try {
    const compSnap = await firestore.collection('companies').get();
    compSnap.forEach(d => {
      const k = d.data()?.dialpadApiKey?.trim();
      if (k && !tokens.includes(k)) tokens.push(k);
    });
  } catch (e) {
    console.error('[getDialpadTokens] Error fetching all company keys:', e);
  }

  return {
    preferredToken: preferredToken || tokens[0] || '',
    allTokens: tokens
  };
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const inputCallId = req.query.callId || req.query.conversationId;
  if (!inputCallId) {
    return res.status(400).json({ error: 'Missing callId or conversationId parameter' });
  }

  try {
    const firestore = initFirestore();
    let callRef = firestore.collection('dialpad_calls').doc(String(inputCallId));
    let callSnap = await callRef.get();
    let callData = null;

    if (callSnap.exists) {
      callData = callSnap.data();
    } else {
      console.log(`[Enrich] Doc ${inputCallId} not found directly in dialpad_calls. Searching secondary indices...`);
      // Try finding by conversationId
      let qSnap = await firestore.collection('dialpad_calls').where('conversationId', '==', String(inputCallId)).limit(1).get();
      if (qSnap.empty) {
        qSnap = await firestore.collection('dialpad_calls').where('primaryCallId', '==', String(inputCallId)).limit(1).get();
      }
      if (qSnap.empty) {
        qSnap = await firestore.collection('dialpad_calls').where('masterCallId', '==', String(inputCallId)).limit(1).get();
      }
      if (qSnap.empty) {
        // Try looking up leg in dialpad_call_legs
        const legSnap = await firestore.collection('dialpad_call_legs').doc(String(inputCallId)).get();
        if (legSnap.exists) {
          const legData = legSnap.data();
          const targetConv = legData.conversationId || legData.masterCallId;
          if (targetConv) {
            qSnap = await firestore.collection('dialpad_calls').where('conversationId', '==', String(targetConv)).limit(1).get();
          }
        }
      }

      if (!qSnap || qSnap.empty) {
        return res.status(404).json({ error: `Call with ID ${inputCallId} not found in database` });
      }

      const foundDoc = qSnap.docs[0];
      callRef = foundDoc.ref;
      callData = foundDoc.data();
      console.log(`[Enrich] Found call record under document ID: ${foundDoc.id}`);
    }

    const conversationId = req.query.conversationId || callData.conversationId || callRef.id;
    const updates = {};
    let needsUpdate = false;

    // 1. Resolve Recruiter company to find the correct Dialpad token
    let companyId = '';
    if (callData.handlerId) {
      const staffSnap = await firestore.collection('staff').doc(callData.handlerId).get();
      if (staffSnap.exists) {
        companyId = staffSnap.data().companyId || '';
      }
    }

    const { preferredToken, allTokens } = await getDialpadTokens(firestore, companyId);
    if (!preferredToken && allTokens.length === 0) {
      console.warn(`[Enrich] No Dialpad Token configured. Returning cached data.`);
      return res.status(200).json({ ...callData, enriched: false, message: 'No Dialpad API token configured' });
    }

    // Candidate call IDs to query on Dialpad API (master call leg, individual call leg, routing leg)
    const candidateCallIds = Array.from(new Set([
      callData.primaryCallId,
      callData.dialpadCallId,
      callData.callId,
      inputCallId,
      req.query.callId,
      req.query.primaryCallId,
      req.query.masterCallId,
      req.query.conversationId,
      callData.masterCallId,
      callData.entryPointCallId,
      callData.conversationId,
      ...(Array.isArray(callData.relatedCallIds) ? callData.relatedCallIds : []),
      callRef.id
    ])).filter(Boolean).map(String);

    console.log(`[Enrich] Candidate call IDs for call ${callRef.id}: [${candidateCallIds.join(', ')}]`);

    // 2. Fetch Transcript if empty, pending, or force-refreshed
    const forceRefresh = req.query.force === 'true';
    const isTranscriptEmpty = forceRefresh || 
      !callData.transcript || 
      callData.transcriptStatus === 'pending' || 
      callData.transcript === 'PENDING' || 
      callData.transcript === 'No transcript generated yet.' ||
      callData.transcript === 'Transcript is empty';

    if (isTranscriptEmpty) {
      console.log(`[Enrich] Fetching transcript across candidate IDs [${candidateCallIds.join(', ')}]...`);
      let foundTranscript = '';

      // A. Try Dialpad Transcripts API: GET /api/v2/transcripts/{candId}
      for (const candId of candidateCallIds) {
        for (const token of allTokens) {
          try {
            const transRes = await fetch(`https://dialpad.com/api/v2/transcripts/${candId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            if (transRes.status === 200) {
              const transData = await transRes.json();
              const rawLines = Array.isArray(transData) ? transData : (transData?.lines || transData?.items || transData?.utterances || []);
              if (rawLines.length > 0) {
                const formattedLines = rawLines
                  .map(line => {
                    const speaker = line.name || line.speaker || line.speaker_name || (line.contact_id ? 'Contact' : 'Recruiter');
                    const text = (line.content || line.text || line.message || '').trim();
                    return text ? `${speaker}: ${text}` : '';
                  })
                  .filter(Boolean);

                if (formattedLines.length > 0) {
                  foundTranscript = formattedLines.join('\n');
                  console.log(`[Enrich] Retrieved transcript via /transcripts/${candId} (${foundTranscript.length} chars)`);
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`[Enrich] Error fetching /transcripts/${candId}:`, err.message);
          }
        }
        if (foundTranscript) break;
      }

      // B. Fallback: Check Dialpad Call Details API: GET /api/v2/call/{candId} for transcription_text
      if (!foundTranscript) {
        for (const candId of candidateCallIds) {
          for (const token of allTokens) {
            try {
              const callRes = await fetch(`https://dialpad.com/api/v2/call/${candId}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });

              if (callRes.status === 200) {
                const callDetails = await callRes.json();
                if (callDetails?.transcription_text && callDetails.transcription_text.trim()) {
                  foundTranscript = callDetails.transcription_text.trim();
                  console.log(`[Enrich] Retrieved transcript via /call/${candId} transcription_text (${foundTranscript.length} chars)`);
                  break;
                }
              }
            } catch (err) {
              console.error(`[Enrich] Error checking /call/${candId} for transcript:`, err.message);
            }
          }
          if (foundTranscript) break;
        }
      }

      if (foundTranscript) {
        updates.transcript = foundTranscript;
        updates.transcriptStatus = 'completed';
        updates.transcriptFetchedAt = new Date().toISOString();
        needsUpdate = true;
      } else {
        // Determine specific rationale for why transcript is absent
        const duration = Number(callData.durationSeconds || callData.duration || 0);
        const wasRecorded = callData.wasRecorded || !!callData.recordingUrl;
        const connected = callData.connected !== false && duration > 0;

        let explanation = '';
        if (!connected) {
          explanation = 'No transcript available: Call was not connected or answered.';
        } else if (!wasRecorded) {
          explanation = 'No transcript available: Call was not recorded.';
        } else if (duration < 20) {
          explanation = 'No transcript available: Call duration was too short (< 20s) for Dialpad AI transcription.';
        } else {
          explanation = 'No transcript generated by Dialpad AI for this call.';
        }

        updates.transcript = explanation;
        updates.transcriptStatus = 'not_available';
        updates.transcriptFetchedAt = new Date().toISOString();
        needsUpdate = true;
      }
    }

    // 3. Resolve Public Recording Link if call was recorded but has no public link
    let adminRecordingUrls = callData.adminRecordingUrls || [];
    if ((!adminRecordingUrls || adminRecordingUrls.length === 0) && !callData.recordingUrl) {
      console.log(`[Enrich] adminRecordingUrls missing from logical call. Checking dialpad_call_legs...`);
      try {
        const legsSnap = await firestore.collection('dialpad_call_legs')
          .where('conversationId', '==', String(conversationId))
          .get();
        
        const collected = [];
        legsSnap.forEach(legDoc => {
          const legData = legDoc.data();
          if (Array.isArray(legData.adminRecordingUrls)) {
            legData.adminRecordingUrls.forEach(url => {
              if (url && !collected.includes(url)) collected.push(url);
            });
          }
        });
        if (collected.length > 0) {
          adminRecordingUrls = collected;
          updates.adminRecordingUrls = collected;
          needsUpdate = true;
          console.log(`[Enrich] Found ${collected.length} admin recording URLs from call legs.`);
        }
      } catch (err) {
        console.error(`[Enrich] Error fetching call legs:`, err);
      }
    }

    // 4. Fetch Call Details from Dialpad API to self-heal duration/recordings/recap
    const needsDurationHeal = !callData.durationSeconds || callData.durationSeconds === 0;
    const isRecordedInDb = callData.wasRecorded || callData.hasRecording;
    const needsRecordingHeal = (!adminRecordingUrls || adminRecordingUrls.length === 0) && isRecordedInDb && !callData.recordingUrl;
    const needsRecapHeal = !callData.recapSummary && !callData.recapOutcome;

    if (needsDurationHeal || needsRecordingHeal || needsRecapHeal) {
      for (const candId of candidateCallIds) {
        for (const token of allTokens) {
          try {
            const callDetailsRes = await fetch(`https://dialpad.com/api/v2/call/${candId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            });

            if (callDetailsRes.status === 200) {
              const detailsData = await callDetailsRes.json();
              if (detailsData) {
                // Self-heal duration fields
                const durationMs = Number(detailsData.duration || 0);
                const durationSeconds = Math.round(durationMs / 1000);
                const talkTimeMs = Number(detailsData.talk_time || 0);
                const talkTimeSeconds = Math.round(talkTimeMs / 1000);
                const totalDurationMs = Number(detailsData.total_duration || 0);

                if (needsDurationHeal && durationSeconds > 0) {
                  updates.durationMs = durationMs;
                  updates.durationSeconds = durationSeconds;
                  updates.talkTimeMs = talkTimeMs;
                  updates.talkTimeSeconds = talkTimeSeconds;
                  updates.totalDurationMs = totalDurationMs;
                  
                  if (detailsData.date_ended) {
                    const epochEnded = Number(detailsData.date_ended);
                    updates.dateEnded = !isNaN(epochEnded) ? new Date(epochEnded).toISOString() : String(detailsData.date_ended);
                  }
                  if (detailsData.date_connected) {
                    const epochConn = Number(detailsData.date_connected);
                    updates.dateConnected = !isNaN(epochConn) ? new Date(epochConn).toISOString() : String(detailsData.date_connected);
                  }
                  updates.connected = detailsData.state === 'connected' || durationSeconds > 0;
                  needsUpdate = true;
                  console.log(`[Enrich] Self-healed call duration to ${durationSeconds}s, talkTime to ${talkTimeSeconds}s`);
                }

                // Self-heal AI Recap
                if (detailsData.recap_summary && !callData.recapSummary) {
                  updates.recapSummary = detailsData.recap_summary;
                  needsUpdate = true;
                }
                if (detailsData.recap_outcome && !callData.recapOutcome) {
                  updates.recapOutcome = detailsData.recap_outcome;
                  needsUpdate = true;
                }

                // Self-heal recording URLs
                let urls = detailsData.admin_recording_urls || [];
                if ((!urls || urls.length === 0) && Array.isArray(detailsData.recording_details)) {
                  urls = detailsData.recording_details.filter(rec => rec.url).map(rec => rec.url);
                }
                if (urls && urls.length > 0) {
                  adminRecordingUrls = urls;
                  updates.adminRecordingUrls = urls;
                  updates.wasRecorded = true;
                  needsUpdate = true;
                  console.log(`[Enrich] Self-healed adminRecordingUrls:`, urls);
                }
                break;
              }
            }
          } catch (err) {
            console.error(`[Enrich] Error calling Dialpad call details API for ${candId}:`, err);
          }
        }
        if (updates.durationSeconds || updates.adminRecordingUrls) break;
      }
    }

    // 5. Generate Public Audio Link from Private Blob Recording
    const hasPrivateRecording = Array.isArray(adminRecordingUrls) && adminRecordingUrls.length > 0;
    const hasPublicRecordingUrl = callData.recordingUrl && callData.recordingUrl.startsWith('http') && !callData.recordingUrl.includes('dialpad.com/blob/');

    if (hasPrivateRecording && !hasPublicRecordingUrl) {
      for (const privateUrl of adminRecordingUrls) {
        const match = privateUrl.match(/\/(\d+)\.mp3/);
        if (match) {
          const recordingId = match[1];
          let shareSuccess = false;
          for (const token of allTokens) {
            try {
              const shareRes = await fetch('https://dialpad.com/api/v2/recordingsharelink', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  privacy: 'public',
                  recording_type: 'admincallrecording',
                  recording_id: recordingId
                })
              });

              if (shareRes.status === 200) {
                const shareData = await shareRes.json();
                if (shareData.access_link) {
                  updates.recordingUrl = shareData.access_link;
                  updates.wasRecorded = true;
                  needsUpdate = true;
                  shareSuccess = true;
                  console.log(`[Enrich] Public recording access link generated successfully: ${shareData.access_link}`);
                  break;
                }
              }
            } catch (err) {
              console.error(`[Enrich] Error requesting recording share link:`, err);
            }
          }
          if (shareSuccess) break;
        }
      }
    }

    // 6. Classify Party Identity (Candidate ca- vs Client ct-/cy-, or AI Transcript classification)
    const isAlreadyClassified = callData.classificationSource && callData.classificationSource !== 'default_heuristic';
    if (!isAlreadyClassified) {
      try {
        const { classifyCallRecord } = await import('../crm-lookup.js');
        const compSnap = await firestore.collection('companies').get();
        let recruitlyApiKey = null;
        compSnap.forEach(d => {
          const cData = d.data();
          if ((d.id === companyId || (cData.name && cData.name.toLowerCase().includes('humres'))) && cData.recruitlyApiKey && !recruitlyApiKey) {
            recruitlyApiKey = cData.recruitlyApiKey.trim();
          }
        });

        const mergedCallData = { ...callData, ...updates };
        const classification = await classifyCallRecord(mergedCallData, recruitlyApiKey, firestore);
        if (classification && classification.targetType) {
          updates.targetType = classification.targetType;
          updates.classificationSource = classification.classificationSource;
          updates.classifiedAt = new Date().toISOString();
          if (classification.matched) {
            updates.crmId = classification.id || '';
            updates.crmName = classification.name || '';
            updates.crmType = classification.type || '';
            updates.crmCompany = classification.company || '';
          }
          if (classification.aiReason) {
            updates.aiClassificationReason = classification.aiReason;
          }
          needsUpdate = true;
          console.log(`[Enrich] Successfully classified call ${callRef.id} as ${classification.targetType} (${classification.classificationSource})`);
        }
      } catch (classErr) {
        console.warn(`[Enrich] Classification failed for call ${callRef.id}:`, classErr.message);
      }
    }

    // Apply updates if any
    let finalCallData = { ...callData };
    if (needsUpdate) {
      await callRef.update(updates);
      finalCallData = { ...callData, ...updates };
      console.log(`[Enrich] Firestore document updated for call ${callRef.id}`);

      // If call duration has been self-healed, trigger daily KPI recalculation
      if (updates.durationSeconds && finalCallData.handlerId && finalCallData.dateStarted) {
        await updateKpiDaily(firestore, finalCallData.handlerId, finalCallData.dateStarted);
      }
    }

    // Auto-archive transcript to Paul Seth's OneDrive folder if applicable
    const shouldUploadOneDrive = isPaulSethCall(finalCallData) || req.query.exportOneDrive === 'true';
    if (shouldUploadOneDrive && finalCallData.transcript && !finalCallData.onedriveSynced) {
      try {
        console.log(`[Enrich] Triggering auto-upload to Paul Seth's OneDrive for call ${callRef.id}...`);
        const oneDriveRes = await autoUploadTranscriptToOneDrive(finalCallData);
        if (oneDriveRes.success) {
          const syncUpdates = {
            onedriveSynced: true,
            onedriveFileName: oneDriveRes.fileName,
            onedriveSyncedAt: oneDriveRes.deliveredAt
          };
          await callRef.update(syncUpdates);
          finalCallData = { ...finalCallData, ...syncUpdates };
          console.log(`[Enrich] Successfully archived transcript to OneDrive: ${oneDriveRes.fileName}`);
        }
      } catch (oneDriveErr) {
        console.error('[Enrich] Error auto-archiving to OneDrive:', oneDriveErr);
      }
    }

    return res.status(200).json({ ...finalCallData, enriched: true });
  } catch (error) {
    console.error(`[Enrich] Exception caught:`, error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// Consolidate duplicate call legs of the same call
function consolidateCalls(calls) {
  const groups = [];
  for (const call of calls) {
    let matchedGroup = null;
    const callTime = call.dateStarted ? new Date(call.dateStarted).getTime() : 0;
    
    for (const group of groups) {
      // Check ID links
      const masterLink = call.masterCallId && group.masterCallIds.has(call.masterCallId);
      const entryLink = call.entryPointCallId && group.entryPointCallIds.has(call.entryPointCallId);
      const directIdLink = (call.masterCallId && group.callIds.has(call.masterCallId)) || 
                           (call.entryPointCallId && group.callIds.has(call.entryPointCallId)) ||
                           (call.conversationId && (group.masterCallIds.has(call.conversationId) || group.entryPointCallIds.has(call.conversationId)));
      
      // Only consolidate legs of the same call sharing exact ID links (e.g. transfers, routing legs)
      if (masterLink || entryLink || directIdLink) {
        matchedGroup = group;
        break;
      }
    }
    
    if (matchedGroup) {
      matchedGroup.callIds.add(call.conversationId || call.primaryCallId || call.id);
      if (call.masterCallId) matchedGroup.masterCallIds.add(call.masterCallId);
      if (call.entryPointCallId) matchedGroup.entryPointCallIds.add(call.entryPointCallId);
      if (call.externalNumber) matchedGroup.externalNumbers.add(call.externalNumber);
      matchedGroup.legs.push(call);
    } else {
      groups.push({
        baseTime: callTime,
        callIds: new Set([call.conversationId || call.primaryCallId || call.id].filter(Boolean)),
        masterCallIds: new Set(call.masterCallId ? [call.masterCallId] : []),
        entryPointCallIds: new Set(call.entryPointCallId ? [call.entryPointCallId] : []),
        externalNumbers: new Set(call.externalNumber ? [call.externalNumber] : []),
        legs: [call]
      });
    }
  }

  return groups.map(group => {
    // Prefer legs that are connected or have longer talk time
    group.legs.sort((a, b) => {
      const talkA = Number(a.durationSeconds || a.talkTimeSeconds || 0);
      const talkB = Number(b.durationSeconds || b.talkTimeSeconds || 0);
      return talkB - talkA;
    });
    
    const primary = group.legs[0];
    const duration = Math.max(...group.legs.map(l => Number(l.durationSeconds || l.talkTimeSeconds || 0)));
    const connected = group.legs.some(l => l.connected === true);
    
    return {
      ...primary,
      durationSeconds: duration,
      connected
    };
  });
}

/**
 * Recalculate daily KPI totals for a specific recruiter/date and write to kpiDaily.
 */
async function updateKpiDaily(firestore, handlerId, dateStarted) {
  if (!handlerId || !dateStarted) return;
  const dateKey = dateStarted.substring(0, 10); // "YYYY-MM-DD"
  const docId = `${handlerId}_${dateKey}`;

  console.log(`[KPI Enrich] Recalculating daily aggregate for recruiter ${handlerId} on ${dateKey}...`);
  try {
    const staffDoc = await firestore.collection('staff').doc(handlerId).get();
    if (!staffDoc.exists) return;
    const staff = staffDoc.data();

    // Query all calls on this day from dialpad_calls and filter by handlerId in-memory to bypass composite index constraints
    const dayCallsSnap = await firestore.collection('dialpad_calls')
      .where('dateStarted', '>=', `${dateKey}T00:00:00`)
      .where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
      .get();

    let callsInbound = 0;
    let callsOutbound = 0;
    let callsTotal = 0;
    let totalTalkTimeSeconds = 0;
    let callsOver5Min = 0;
    let callsOver10Min = 0;

    const rawCalls = [];
    dayCallsSnap.forEach(docSnap => {
      const call = docSnap.data();
      if (call.handlerId === handlerId) {
        rawCalls.push(call);
      }
    });

    const consolidated = consolidateCalls(rawCalls);

    consolidated.forEach(call => {
      callsTotal++;
      if ((call.direction || '').toLowerCase() === 'inbound') {
        callsInbound++;
      } else {
        callsOutbound++;
      }
      
      const duration = Number(call.durationSeconds || 0);
      totalTalkTimeSeconds += duration;
      if (duration >= 300) {
        callsOver5Min++;
      }
      if (duration >= 600) {
        callsOver10Min++;
      }
    });

    const kpiData = {
      staffId: handlerId,
      staffName: staff.fullName || '',
      department: staff.department || '',
      email: staff.businessEmail || staff.personalEmail || '',
      date: dateKey,
      callsInbound,
      callsOutbound,
      callsTotal,
      totalTalkTimeSeconds,
      callsOver5Min,
      callsOver10Min,
      lastUpdated: new Date().toISOString()
    };

    await firestore.collection('kpiDaily').doc(docId).set(kpiData, { merge: true });
    console.log(`[KPI Enrich] Updated kpiDaily document ${docId}`);
  } catch (err) {
    console.error(`[KPI Enrich] Error updating daily aggregates for ${handlerId} on ${dateKey}:`, err);
  }
}
