import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Normalize email local-part by removing dots
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

// Disable default Vercel body-parser so we can retrieve the raw string body for JWT validation
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read the raw request body stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', err => {
      reject(err);
    });
  });
}

// Manual JWT signature verification using HS256 to avoid large dependency footprints
function verifyDialpadJwt(jwtToken, secret) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format (must have 3 parts).');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify header algorithm is HS256
    const headerJson = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
    if (headerJson.alg !== 'HS256') {
      console.error('Invalid JWT algorithm:', headerJson.alg);
      return null;
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${headerB64}.${payloadB64}`);
    const calculatedSignature = hmac.digest('base64url');

    // Standardize signature representation to compare safely
    const expectedSig = signatureB64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (calculatedSignature !== expectedSig) {
      console.error('JWT Signature verification failed.');
      return null;
    }

    // Parse and return payload
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
    return JSON.parse(payloadStr);
  } catch (error) {
    console.error('Failed to verify JWT:', error);
    return null;
  }
}

// Helper to normalize Dialpad milliseconds epoch timestamps to ISO date strings
function formatDialpadDate(val) {
  if (!val) return '';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  const dateObj = new Date(num);
  return !isNaN(dateObj.getTime()) ? dateObj.toISOString() : String(val);
}

// Robust PEM private key formatter to handle double quotes, spaces, single lines, and escaped newlines
function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  
  // If the user pasted the entire JSON service account file into this variable, parse it!
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

  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  
  key = key.replace(/\\n/g, '\n');

  // Strip leading "n" which was part of "\n" copied from raw JSON fields
  if (key.startsWith('nMII')) {
    key = key.substring(1);
  }

  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';

  if (!key.includes(header)) {
    let base64Body = key;
    if (base64Body.includes(footer)) {
      base64Body = base64Body.split(footer)[0];
    }
    // Remove all non-base64 characters
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');

    const lines = [];
    for (let i = 0; i < base64Body.length; i += 64) {
      lines.push(base64Body.substring(i, i + 64));
    }
    
    key = `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  
  return key;
}

// Initialize Firestore Admin SDK on-demand
let db = null;
function initFirestore() {
  if (!db) {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'humres-management-hub';
      let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      // Extract from JSON if they pasted the whole JSON file into either variable
      if (privateKey && privateKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey.trim());
          if (parsed.private_key) privateKey = parsed.private_key;
          if (parsed.client_email && !clientEmail) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed to parse privateKey environment variable as JSON:', e);
        }
      }
      if (clientEmail && clientEmail.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(clientEmail.trim());
          if (parsed.client_email) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed to parse clientEmail environment variable as JSON:', e);
        }
      }

      if (clientEmail && privateKey) {
        const formattedKey = formatPrivateKey(privateKey);
        console.log(`[Diagnostic] clientEmail: "${clientEmail}"`);
        console.log(`[Diagnostic] raw privateKey length: ${privateKey.length}`);
        console.log(`[Diagnostic] raw privateKey startsWith: "${privateKey.substring(0, 40)}"`);
        console.log(`[Diagnostic] raw privateKey endsWith: "${privateKey.substring(privateKey.length - 40)}"`);
        console.log(`[Diagnostic] formattedKey length: ${formattedKey.length}`);
        console.log(`[Diagnostic] formattedKey startsWith: "${formattedKey.substring(0, 40)}"`);
        console.log(`[Diagnostic] formattedKey endsWith: "${formattedKey.substring(formattedKey.length - 40)}"`);

        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedKey,
          })
        });
        console.log('[Firestore] Admin SDK initialized with service account credentials.');
      } else {
        console.error('[Firestore] FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY is missing.');
        throw new Error('Firebase credentials are not configured. Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel environment variables.');
      }
    }
    db = getFirestore();
  }
  return db;
}

// Helper to normalize email local-part by removing dots
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET Method Health Check
  if (req.method === 'GET') {
    console.log('[Webhook] Diagnostic health check called.');
    return res.status(200).json({ ok: true, service: 'dialpad-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Read raw request payload
    const rawBody = await getRawBody(req);
    const bodyStr = rawBody.trim();
    let payload = null;

    const secret = process.env.DIALPAD_WEBHOOK_SECRET;

    // 3. JWT Signature Verification
    if (bodyStr.startsWith('eyJ')) {
      console.log('[Webhook] Received JWT-encoded webhook event.');
      if (!secret) {
        console.error('[Webhook] DIALPAD_WEBHOOK_SECRET is not configured. Rejecting request.');
        return res.status(500).json({ error: 'Webhook secret not configured on server.' });
      }
      payload = verifyDialpadJwt(bodyStr, secret);
      if (!payload) {
        return res.status(401).json({ error: 'Invalid JWT signature verification' });
      }
    } else {
      console.log('[Webhook] Received raw JSON webhook event.');
      // Reject raw JSON in production mode to enforce security
      if (process.env.NODE_ENV === 'production' && secret) {
        console.warn('[Webhook] Rejecting unencrypted JSON payload in production environment.');
        return res.status(401).json({ error: 'Secure JWT payload required in production' });
      }
      try {
        payload = JSON.parse(bodyStr);
      } catch (err) {
        console.error('[Webhook] Failed to parse raw JSON body:', err);
        return res.status(400).json({ error: 'Invalid JSON request payload' });
      }
    }

    if (!payload || !payload.call_id) {
      console.error('[Webhook] Event payload is missing call_id.');
      return res.status(400).json({ error: 'Missing call_id parameter' });
    }

    const callId = String(payload.call_id);
    const masterCallId = payload.master_call_id ? String(payload.master_call_id) : '';
    const entryPointCallId = payload.entry_point_call_id ? String(payload.entry_point_call_id) : '';
    const operatorCallId = payload.operator_call_id ? String(payload.operator_call_id) : '';
    const state = (payload.state || '').toLowerCase().trim();
    const eventTimestamp = Number(payload.event_timestamp || Date.now());

    // Logical root conversation identifier
    const conversationId = masterCallId || entryPointCallId || operatorCallId || callId;

    console.log(`[Webhook] Processing event: State="${state}" | Call ID="${callId}" | Conv ID="${conversationId}"`);

    // Initialize Firestore
    const firestore = initFirestore();

    // 4. Save Raw Event to dialpad_events (idempotency target doc)
    const eventDocId = `${callId}_${state}_${eventTimestamp}`;
    const rawEventData = {
      eventId: eventDocId,
      callId,
      masterCallId,
      entryPointCallId,
      operatorCallId,
      state,
      eventTimestamp,
      direction: payload.direction || '',
      externalNumber: payload.external_number || '',
      internalNumber: payload.internal_number || '',
      target: payload.target || null,
      contact: payload.contact || null,
      dateStarted: formatDialpadDate(payload.date_started),
      dateRang: formatDialpadDate(payload.date_rang),
      dateConnected: formatDialpadDate(payload.date_connected),
      dateEnded: formatDialpadDate(payload.date_ended),
      duration: Number(payload.duration || 0),
      totalDuration: Number(payload.total_duration || 0),
      talkTime: Number(payload.talk_time || 0),
      callDispositions: (() => {
        const rawDisp = payload.dispositions || payload.call_dispositions;
        if (!rawDisp) return [];
        const arr = Array.isArray(rawDisp) ? rawDisp : [rawDisp];
        return arr.map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            return item.name || item.disposition || item.label || JSON.stringify(item);
          }
          return String(item);
        }).filter(Boolean);
      })(),
      recapSummary: payload.recap_summary || '',
      recapOutcome: payload.recap_outcome || '',
      callRecordingIds: payload.call_recording_ids || [],
      recordingUrl: payload.recording_url || '',
      adminRecordingUrls: payload.admin_recording_urls || [],
      wasRecorded: !!payload.recording_url,
      voicemailLink: payload.voicemail_link || '',
      transcriptionText: payload.transcription_text || '',
      receivedAt: new Date().toISOString(),
      rawPayload: payload
    };

    await firestore.collection('dialpad_events').doc(eventDocId).set(rawEventData);
    console.log(`[Webhook] Raw event written to database: ${eventDocId}`);

    let finalConversationId = conversationId;

    // Resolve staff database first (outside the transaction)
    const staffSnap = await firestore.collection('staff').get();
    const staffList = [];
    staffSnap.forEach(sDoc => {
      staffList.push({ id: sDoc.id, ...sDoc.data() });
    });

    // 5. Merge Call Leg & Consolidate Logical Call inside transaction (Strongly Consistent!)
    const legRef = firestore.collection('dialpad_call_legs').doc(callId);
    let resolvedKPI = null;

    await firestore.runTransaction(async (transaction) => {
      const legSnap = await transaction.get(legRef);
      let existingData = null;
      if (legSnap.exists) {
        existingData = legSnap.data();
      }

      if (existingData && existingData.conversationId) {
        finalConversationId = existingData.conversationId;
      }

      // Check event timestamp to ensure out of order events do not overwrite newer information
      if (existingData && eventTimestamp < (existingData.lastEventTimestamp || 0)) {
        console.log(`[Webhook] Skipping out-of-order leg merge for callId ${callId}. Existing is newer.`);
        return;
      }

      const mergedDispositions = Array.from(new Set([
        ...(existingData?.callDispositions || []),
        ...(rawEventData.callDispositions || [])
      ]));

      const mergedRecordings = Array.from(new Set([
        ...(existingData?.callRecordingIds || []),
        ...(rawEventData.callRecordingIds || [])
      ]));

      // Clean millisecond duration parsing (always treat duration, talkTime, totalDuration as milliseconds)
      const rawDur = rawEventData.duration || existingData?.durationMs || 0;
      const durationMs = rawDur;
      const durationSeconds = Math.round(rawDur / 1000);

      const rawTalk = rawEventData.talkTime || existingData?.talkTimeMs || 0;
      const talkTimeMs = rawTalk;
      const talkTimeSeconds = Math.round(rawTalk / 1000);

      const rawTotalDur = rawEventData.totalDuration || existingData?.totalDurationMs || 0;
      const totalDurationMs = rawTotalDur;

      const legData = {
        callId,
        masterCallId,
        entryPointCallId,
        operatorCallId,
        conversationId: finalConversationId,
        state: rawEventData.state || existingData?.state || '',
        direction: rawEventData.direction || existingData?.direction || '',
        externalNumber: rawEventData.externalNumber || existingData?.externalNumber || '',
        internalNumber: rawEventData.internalNumber || existingData?.internalNumber || '',
        target: rawEventData.target || existingData?.target || null,
        contact: rawEventData.contact || existingData?.contact || null,
        dateStarted: rawEventData.dateStarted || existingData?.dateStarted || '',
        dateRang: rawEventData.dateRang || existingData?.dateRang || '',
        dateConnected: rawEventData.dateConnected || existingData?.dateConnected || '',
        dateEnded: rawEventData.dateEnded || existingData?.dateEnded || '',
        durationMs,
        durationSeconds,
        totalDurationMs,
        talkTimeMs,
        talkTimeSeconds,
        callDispositions: mergedDispositions,
        recapSummary: rawEventData.recapSummary || existingData?.recapSummary || '',
        recapOutcome: rawEventData.recapOutcome || existingData?.recapOutcome || '',
        callRecordingIds: mergedRecordings,
        recordingUrl: rawEventData.recordingUrl || rawEventData.adminRecordingUrls?.[0] || existingData?.recordingUrl || existingData?.adminRecordingUrls?.[0] || '',
        adminRecordingUrls: rawEventData.adminRecordingUrls || existingData?.adminRecordingUrls || [],
        wasRecorded: !!(rawEventData.recordingUrl || rawEventData.adminRecordingUrls?.length > 0 || existingData?.recordingUrl || existingData?.adminRecordingUrls?.length > 0),
        voicemailLink: rawEventData.voicemailLink || existingData?.voicemailLink || '',
        transcriptionText: rawEventData.transcriptionText || existingData?.transcriptionText || '',
        lastEventTimestamp: eventTimestamp
      };

      const hasVoicemail = legData.state === 'voicemail' || !!legData.voicemailLink;
      const isMissed = legData.state === 'missed';
      const isConnected = !!legData.dateConnected;

      legData.connected = isConnected;
      if (hasVoicemail) {
        legData.callStatus = 'Voicemail';
      } else if (isMissed) {
        legData.callStatus = 'Missed';
      } else if (isConnected) {
        legData.callStatus = 'Connected';
      } else {
        legData.callStatus = 'No Answer';
      }

      // 6. Transactional Consolidated Call Loading
      const callDocRef = firestore.collection('dialpad_calls').doc(finalConversationId);
      const callSnap = await transaction.get(callDocRef);
      const callData = callSnap.data() || {};
      let relatedCallIds = callData.relatedCallIds || [];
      if (!relatedCallIds.includes(callId)) {
        relatedCallIds.push(callId);
      }

      // Fetch other legs transactionally
      const otherLegRefs = relatedCallIds
        .filter(id => id !== callId)
        .map(id => firestore.collection('dialpad_call_legs').doc(id));
      
      const otherLegSnaps = otherLegRefs.length > 0 
        ? await Promise.all(otherLegRefs.map(ref => transaction.get(ref))) 
        : [];
      
      const relatedLegs = [legData];
      otherLegSnaps.forEach(snap => {
        if (snap.exists) {
          relatedLegs.push(snap.data());
        }
      });

      console.log(`[Webhook] Found ${relatedLegs.length} related legs transactionally for conversationId ${finalConversationId}`);

      // Identify user-facing primary leg
      let primaryLeg = null;
      const userLegs = relatedLegs.filter(leg => {
        const targetType = (leg.target?.type || '').toLowerCase().trim();
        const isUser = targetType === 'user';
        const isRoutingGroup = leg.operatorCallId && !leg.entryPointCallId;
        return isUser && !isRoutingGroup;
      });

      if (userLegs.length > 0) {
        userLegs.sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp);
        primaryLeg = userLegs[0];
      } else {
        relatedLegs.sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp);
        primaryLeg = relatedLegs[0];
      }

      // Compile parameters across all related legs
      const collectedRecordings = [];
      const collectedDispositions = [];
      let enrichedRecapSummary = '';
      let enrichedRecapOutcome = '';
      let enrichedRecordingUrl = '';
      let enrichedVoicemailLink = '';
      let enrichedTranscription = '';
      let enrichedCallStatus = primaryLeg.callStatus;

      relatedLegs.forEach(leg => {
        if (leg.recordingUrl) enrichedRecordingUrl = leg.recordingUrl;
        if (leg.voicemailLink) {
          enrichedVoicemailLink = leg.voicemailLink;
          enrichedCallStatus = 'Voicemail';
        }
        if (leg.recapSummary) enrichedRecapSummary = leg.recapSummary;
        if (leg.recapOutcome) enrichedRecapOutcome = leg.recapOutcome;
        if (leg.transcriptionText) enrichedTranscription = leg.transcriptionText;
        
        if (Array.isArray(leg.callRecordingIds)) {
          leg.callRecordingIds.forEach(id => {
            if (!collectedRecordings.includes(id)) collectedRecordings.push(id);
          });
        }
        if (Array.isArray(leg.callDispositions)) {
          leg.callDispositions.forEach(disp => {
            if (!collectedDispositions.includes(disp)) collectedDispositions.push(disp);
          });
        }
      });

      // Match handlerId, handlerName, handlerEmail using Resolved Staff List
      let handlerId = '';
      let handlerName = '';
      let handlerEmail = '';
      let department = '';

      const targetEmail = primaryLeg.target?.email || '';
      if (targetEmail) {
        const normTargetEmail = normalizeEmail(targetEmail);
        let matchedStaff = null;
        staffList.forEach(staffData => {
          const busEmail = normalizeEmail(staffData.businessEmail);
          const persEmail = normalizeEmail(staffData.personalEmail);
          
          if (busEmail === normTargetEmail || persEmail === normTargetEmail) {
            matchedStaff = staffData;
          } else if (staffData.additionalEmails) {
            const extraList = staffData.additionalEmails.split(',').map(e => normalizeEmail(e)).filter(Boolean);
            if (extraList.includes(normTargetEmail)) {
              matchedStaff = staffData;
            }
          }
        });

        if (matchedStaff) {
          handlerId = matchedStaff.id;
          handlerName = matchedStaff.fullName;
          handlerEmail = matchedStaff.businessEmail || matchedStaff.personalEmail || '';
          department = matchedStaff.department || '';
        } else {
          handlerName = primaryLeg.target?.name || '';
          handlerEmail = targetEmail;
        }
      }

      // Build the final logical call document data
      const finalCallData = {
        conversationId: finalConversationId,
        primaryCallId: primaryLeg.callId,
        relatedCallIds,
        masterCallId: primaryLeg.masterCallId || '',
        entryPointCallId: primaryLeg.entryPointCallId || '',
        
        dateStarted: primaryLeg.dateStarted || '',
        dateConnected: primaryLeg.dateConnected || '',
        dateEnded: primaryLeg.dateEnded || '',
        
        direction: primaryLeg.direction || '',
        
        handlerId,
        handlerName,
        handlerEmail,
        department,
        
        externalName: primaryLeg.contact?.name || '',
        externalNumber: primaryLeg.externalNumber || primaryLeg.contact?.phone_number || '',
        internalNumber: primaryLeg.internalNumber || '',
        
        connected: primaryLeg.connected || false,
        callStatus: enrichedCallStatus,
        
        durationMs: primaryLeg.durationMs || 0,
        durationSeconds: primaryLeg.durationSeconds || 0,
        totalDurationMs: primaryLeg.totalDurationMs || 0,
        talkTimeMs: primaryLeg.talkTimeMs || 0,
        talkTimeSeconds: primaryLeg.talkTimeSeconds || 0,
        
        disposition: collectedDispositions.join(', '),
        recapSummary: enrichedRecapSummary,
        recapOutcome: enrichedRecapOutcome,
        
        transcriptionId: collectedRecordings.length > 0 ? collectedRecordings[0] : '',
        recordingUrl: enrichedRecordingUrl,
        recordingUrls: enrichedRecordingUrl ? [enrichedRecordingUrl] : [],
        wasRecorded: !!enrichedRecordingUrl,
        adminRecordingUrls: Array.from(new Set(relatedLegs.flatMap(l => l.adminRecordingUrls || []))),
        voicemailLink: enrichedVoicemailLink,
        
        target: primaryLeg.target || null,
        contact: primaryLeg.contact || null,
        
        lastEventTimestamp: Math.max(primaryLeg.lastEventTimestamp, ...relatedLegs.map(l => l.lastEventTimestamp)),
        createdAt: callData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Preserve transcript placeholder fields for separate background fetching
        transcript: callData.transcript || enrichedTranscription || '',
        transcriptStatus: callData.transcriptStatus || (enrichedTranscription ? 'fetched' : 'pending'),
        transcriptFetchedAt: callData.transcriptFetchedAt || (enrichedTranscription ? new Date().toISOString() : '')
      };

      // Perform all transaction writes together
      transaction.set(legRef, legData, { merge: true });
      transaction.set(callDocRef, finalCallData, { merge: true });

      resolvedKPI = { handlerId, dateStarted: finalCallData.dateStarted };
    });

    console.log(`[Webhook] Consolidated logical call saved successfully under transaction: ${finalConversationId}`);

    // Update daily recruiter KPIs in real time
    if (resolvedKPI && resolvedKPI.handlerId) {
      await updateKpiDaily(firestore, resolvedKPI.handlerId, resolvedKPI.dateStarted);
    }

    return res.status(200).json({ success: true, conversationId: finalConversationId, callId: callId });
  } catch (error) {
    console.error('[Webhook] Failed to process Dialpad webhook event:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

/**
 * Recalculate daily KPI totals for a specific recruiter/date and write to kpiDaily.
 */
async function updateKpiDaily(firestore, handlerId, dateStarted) {
  if (!handlerId || !dateStarted) return;
  const dateKey = dateStarted.substring(0, 10); // "YYYY-MM-DD"
  const docId = `${handlerId}_${dateKey}`;

  console.log(`[KPI] Recalculating daily aggregate for recruiter ${handlerId} on ${dateKey}...`);
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

    dayCallsSnap.forEach(docSnap => {
      const call = docSnap.data();
      if (call.handlerId !== handlerId) return; // Filter by recruiter in-memory

      callsTotal++;
      if ((call.direction || '').toLowerCase() === 'inbound') {
        callsInbound++;
      } else {
        callsOutbound++;
      }
      
      const duration = Number(call.durationSeconds || call.talkTimeSeconds || 0);
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
    console.log(`[KPI] Updated kpiDaily document ${docId}`);
  } catch (err) {
    console.error(`[KPI] Error updating daily aggregates for ${handlerId} on ${dateKey}:`, err);
  }
}
