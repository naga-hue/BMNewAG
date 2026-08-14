import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

// Helper to resolve the correct Dialpad token based on company ID
async function getDialpadToken(firestore, companyId) {
  if (companyId) {
    try {
      const compDoc = await firestore.collection('companies').doc(companyId).get();
      if (compDoc.exists) {
        const data = compDoc.data();
        if (data.dialpadApiKey) {
          return data.dialpadApiKey.trim();
        }
      }
    } catch (e) {
      console.error('[getDialpadToken] Error fetching company:', e);
    }
  }
  // comp-1782806159650 is Totaco Ltd
  if (companyId === 'comp-1782806159650') {
    return process.env.DIALPAD_TOKEN_2 || process.env.DIALPAD_TOKEN || '';
  }
  // Default to Slot 1 (Humres / Huntek)
  return process.env.DIALPAD_TOKEN_1 || process.env.DIALPAD_TOKEN || '';
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

  const callId = req.query.callId || req.query.conversationId;
  if (!callId) {
    return res.status(400).json({ error: 'Missing callId or conversationId parameter' });
  }

  try {
    const firestore = initFirestore();
    const callRef = firestore.collection('dialpad_calls').doc(String(callId));
    const callSnap = await callRef.get();

    if (!callSnap.exists) {
      return res.status(404).json({ error: `Call with ID ${callId} not found` });
    }

    const callData = callSnap.data();
    const updates = {};
    let needsUpdate = false;

    // 1. Resolve Recruiter company to find the correct token
    let companyId = '';
    if (callData.handlerId) {
      const staffSnap = await firestore.collection('staff').doc(callData.handlerId).get();
      if (staffSnap.exists) {
        companyId = staffSnap.data().companyId || '';
      }
    }

    const token = await getDialpadToken(firestore, companyId);
    if (!token) {
      console.warn(`[Enrich] No Dialpad Token configured for company ${companyId || 'default'}. Returning cached data.`);
      return res.status(200).json({ ...callData, enriched: false, message: 'No Dialpad API token configured' });
    }

    const primaryCallId = callData.primaryCallId || conversationId;

    // 2. Fetch Transcript if empty/pending
    const isTranscriptEmpty = !callData.transcript || callData.transcriptStatus === 'pending' || callData.transcript === 'PENDING';
    if (isTranscriptEmpty) {
      console.log(`[Enrich] Fetching transcript for callId ${primaryCallId}...`);
      try {
        const transRes = await fetch(`https://dialpad.com/api/v2/transcripts/${primaryCallId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (transRes.status === 200) {
          const transData = await transRes.json();
          if (transData && transData.lines) {
            const lines = transData.lines || [];
            const transcriptText = lines
              .filter(line => line.type === 'transcript' && line.content)
              .map(line => `${line.name || 'Unknown'}: ${line.content}`)
              .join('\n');

            updates.transcript = transcriptText || 'Transcript is empty';
            updates.transcriptStatus = 'completed';
            updates.transcriptFetchedAt = new Date().toISOString();
            needsUpdate = true;
            console.log(`[Enrich] Successfully retrieved and formatted transcript (${updates.transcript.length} chars)`);
          }
        } else if (transRes.status === 404 || transRes.status === 400) {
          console.log(`[Enrich] Dialpad transcript API returned ${transRes.status}. Still pending.`);
        } else {
          console.error(`[Enrich] Dialpad transcript API error: ${transRes.status}`);
        }
      } catch (err) {
        console.error(`[Enrich] Error fetching transcript:`, err);
      }
    }

    // 3. Resolve Public Recording Link if call was recorded but has no public link
    // The adminRecordingUrls typically hold private links like https://dialpad.com/blob/adminrecording/5762892484714496.mp3
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

    // 2.5. Fetch Call Details from Dialpad API to self-heal duration/recordings if they are zero or missing
    const needsDurationHeal = !callData.durationSeconds || callData.durationSeconds === 0;
    const isRecordedInDb = callData.wasRecorded || callData.hasRecording;
    const needsRecordingHeal = (!adminRecordingUrls || adminRecordingUrls.length === 0) && isRecordedInDb && !callData.recordingUrl;

    if (needsDurationHeal || needsRecordingHeal) {
      console.log(`[Enrich] Call needs enrichment/self-healing. durationSeconds: ${callData.durationSeconds || 0}, needsRecordingHeal: ${needsRecordingHeal}. Fetching call details from Dialpad API...`);
      try {
        const callDetailsRes = await fetch(`https://dialpad.com/api/v2/call/${primaryCallId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (callDetailsRes.status === 200) {
          const detailsData = await callDetailsRes.json();
          if (detailsData) {
            console.log(`[Enrich] Retrieved call details from Dialpad: state="${detailsData.state}", duration=${detailsData.duration}ms`);
            
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
          }
        } else {
          console.error(`[Enrich] Dialpad call details API returned status ${callDetailsRes.status}`);
        }
      } catch (err) {
        console.error(`[Enrich] Error calling Dialpad call details API:`, err);
      }
    }

    const hasPrivateRecording = Array.isArray(adminRecordingUrls) && adminRecordingUrls.length > 0;
    const hasPublicRecordingUrl = callData.recordingUrl && callData.recordingUrl.startsWith('http') && !callData.recordingUrl.includes('dialpad.com/blob/');

    if (hasPrivateRecording && !hasPublicRecordingUrl) {
      const privateUrl = adminRecordingUrls[0];
      console.log(`[Enrich] Private recording URL found: ${privateUrl}. Fetching public share link...`);
      
      const match = privateUrl.match(/\/(\d+)\.mp3/);
      if (match) {
        const recordingId = match[1];
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
              console.log(`[Enrich] Public recording access link generated successfully: ${shareData.access_link}`);
            }
          } else {
            console.error(`[Enrich] recordingsharelink API returned ${shareRes.status}:`, await shareRes.text());
          }
        } catch (err) {
          console.error(`[Enrich] Error requesting recording share link:`, err);
        }
      }
    }

    // Apply updates if any
    let finalCallData = { ...callData };
    if (needsUpdate) {
      await callRef.update(updates);
      finalCallData = { ...callData, ...updates };
      console.log(`[Enrich] Firestore document updated for conversationId ${conversationId}`);

      // If call duration has been self-healed, trigger daily KPI recalculation
      if (updates.durationSeconds && finalCallData.handlerId && finalCallData.dateStarted) {
        await updateKpiDaily(firestore, finalCallData.handlerId, finalCallData.dateStarted);
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
