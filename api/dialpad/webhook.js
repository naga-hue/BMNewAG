import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    const conversationId = masterCallId || entryPointCallId || callId;

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
      callDispositions: payload.dispositions || payload.call_dispositions || [],
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

    let oldConversationIdToDelete = null;

    // 5. Merge Call Leg into dialpad_call_legs
    const legRef = firestore.collection('dialpad_call_legs').doc(callId);
    await firestore.runTransaction(async (transaction) => {
      const legSnap = await transaction.get(legRef);
      let existingData = null;
      if (legSnap.exists) {
        existingData = legSnap.data();
      }

      if (existingData && existingData.conversationId && existingData.conversationId !== conversationId) {
        oldConversationIdToDelete = existingData.conversationId;
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

      // Assemble merged properties
      const legData = {
        callId,
        masterCallId,
        entryPointCallId,
        operatorCallId,
        conversationId,
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
        durationMs: rawEventData.duration || existingData?.durationMs || 0,
        durationSeconds: Math.round((rawEventData.duration || existingData?.durationMs || 0) / 1000),
        totalDurationMs: rawEventData.totalDuration || existingData?.totalDurationMs || 0,
        talkTimeMs: rawEventData.talkTime || existingData?.talkTimeMs || 0,
        talkTimeSeconds: Math.round((rawEventData.talkTime || existingData?.talkTimeMs || 0) / 1000),
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

      // Determine leg status metrics
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

      transaction.set(legRef, legData, { merge: true });
    });
    console.log(`[Webhook] Call leg merged successfully for legId ${callId}`);

    // 6. Consolidate Legs & Update dialpad_calls
    const legsSnap = await firestore.collection('dialpad_call_legs')
      .where('conversationId', '==', conversationId)
      .get();

    const relatedLegs = [];
    legsSnap.forEach(snap => {
      relatedLegs.push(snap.data());
    });

    console.log(`[Webhook] Found ${relatedLegs.length} related legs for conversationId ${conversationId}`);

    // Identify user-facing primary leg (target.type === 'user')
    // Exclude group routing legs (target.type !== 'user' or operator call segments without entry-point markers)
    let primaryLeg = null;
    const userLegs = relatedLegs.filter(leg => {
      const targetType = (leg.target?.type || '').toLowerCase().trim();
      const isUser = targetType === 'user';
      const isRoutingGroup = leg.operatorCallId && !leg.entryPointCallId;
      return isUser && !isRoutingGroup;
    });

    if (userLegs.length > 0) {
      // Sort user legs by timestamp to get the most recent active leg
      userLegs.sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp);
      primaryLeg = userLegs[0];
      console.log(`[Webhook] Selected primary recruiter leg: callId=${primaryLeg.callId} (${primaryLeg.target?.name})`);
    } else {
      // Fallback: Use the leg with the highest priority or first created if no user leg exists
      relatedLegs.sort((a, b) => b.lastEventTimestamp - a.lastEventTimestamp);
      primaryLeg = relatedLegs[0];
      console.log(`[Webhook] No user-leg found. Using routing fallback leg: callId=${primaryLeg.callId}`);
    }

    // Filter routing logs diagnostic
    relatedLegs.forEach(leg => {
      if (leg.callId !== primaryLeg.callId) {
        console.log(`[Webhook] Routing call leg grouped: callId=${leg.callId} | Target Type=${leg.target?.type || 'unknown'}`);
      }
    });

    // Compile & enrich parameters across all related legs in the conversation
    const relatedCallIds = relatedLegs.map(l => l.callId);
    
    // Accumulate unique recordings, dispositions, voicemail links and transcripts
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

    // Match handlerId, handlerName, handlerEmail using staff database and email normalization
    let handlerId = '';
    let handlerName = '';
    let handlerEmail = '';
    let department = '';

    const targetEmail = primaryLeg.target?.email || '';
    if (targetEmail) {
      const normTargetEmail = normalizeEmail(targetEmail);
      const staffSnap = await firestore.collection('staff').get();
      
      let matchedStaff = null;
      staffSnap.forEach(sDoc => {
        const staffData = sDoc.data();
        const busEmail = normalizeEmail(staffData.businessEmail);
        const persEmail = normalizeEmail(staffData.personalEmail);
        
        if (busEmail === normTargetEmail || persEmail === normTargetEmail) {
          matchedStaff = { id: sDoc.id, ...staffData };
        } else if (staffData.additionalEmails) {
          const extraList = staffData.additionalEmails.split(',').map(e => normalizeEmail(e.trim())).filter(Boolean);
          if (extraList.includes(normTargetEmail)) {
            matchedStaff = { id: sDoc.id, ...staffData };
          }
        }
      });

      if (matchedStaff) {
        handlerId = matchedStaff.id;
        handlerName = matchedStaff.fullName;
        handlerEmail = matchedStaff.businessEmail || matchedStaff.personalEmail || '';
        department = matchedStaff.department || '';
        console.log(`[Webhook] Matched recruiter to staff directory: Name=${handlerName} | StaffID=${handlerId}`);
      } else {
        // Fallback to Dialpad profile metadata
        handlerName = primaryLeg.target?.name || '';
        handlerEmail = targetEmail;
        console.log(`[Webhook] Recruiter email "${targetEmail}" did not match staff profiles.`);
      }
    }

    // Build the final Logical Call document
    const callDocRef = firestore.collection('dialpad_calls').doc(conversationId);
    
    // Load existing logical call doc to preserve transcript status/API data
    const existingCallSnap = await callDocRef.get();
    const existingCallData = existingCallSnap.exists ? existingCallSnap.data() : null;

    const finalCallData = {
      conversationId,
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
      createdAt: existingCallData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Preserve transcript placeholder fields for separate background fetching
      transcript: existingCallData?.transcript || enrichedTranscription || '',
      transcriptStatus: existingCallData?.transcriptStatus || (enrichedTranscription ? 'fetched' : 'pending'),
      transcriptFetchedAt: existingCallData?.transcriptFetchedAt || (enrichedTranscription ? new Date().toISOString() : '')
    };

    await callDocRef.set(finalCallData);
    console.log(`[Webhook] Consolidated logical call saved successfully: ${conversationId}`);

    if (oldConversationIdToDelete) {
      const oldCallRef = firestore.collection('dialpad_calls').doc(oldConversationIdToDelete);
      const oldCallSnap = await oldCallRef.get();
      if (oldCallSnap.exists) {
        await oldCallRef.delete();
        console.log(`[Webhook] Cleaned up stale logical call document: ${oldConversationIdToDelete}`);
      }
    }

    return res.status(200).json({ success: true, conversationId, callId: primaryLeg.callId });
  } catch (error) {
    console.error('[Webhook] Failed to process Dialpad webhook event:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
