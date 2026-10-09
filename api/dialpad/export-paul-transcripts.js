import fs from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildCallTranscriptDocx, isPaulSethCall, autoUploadTranscriptToOneDrive } from '../utils/onedrive-export.js';

// Parse .env.local or .env
function loadEnv() {
  const envPaths = [
    '.env.local',
    '.env'
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) key = parsed.private_key.trim();
    } catch (e) {}
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
    for (let i = 0; i < base64Body.length; i += 64) lines.push(base64Body.substring(i, i + 64));
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
        } catch (e) {}
      }
      if (clientEmail && clientEmail.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(clientEmail.trim());
          if (parsed.client_email) clientEmail = parsed.client_email;
        } catch (e) {}
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
        throw new Error('Firebase credentials not set in environment.');
      }
    }
    db = getFirestore();
  }
  return db;
}

async function getDialpadTokens(firestore) {
  const tokens = [];
  if (process.env.DIALPAD_TOKEN_1) tokens.push(process.env.DIALPAD_TOKEN_1.trim());
  if (process.env.DIALPAD_TOKEN_2) tokens.push(process.env.DIALPAD_TOKEN_2.trim());
  if (process.env.DIALPAD_TOKEN) tokens.push(process.env.DIALPAD_TOKEN.trim());
  
  try {
    const compSnap = await firestore.collection('companies').get();
    compSnap.forEach(d => {
      const k = d.data()?.dialpadApiKey?.trim();
      if (k && !tokens.includes(k)) tokens.push(k);
    });
  } catch (e) {}

  return Array.from(new Set(tokens)).filter(Boolean);
}

async function fetchTranscriptFromDialpad(callData, tokens) {
  const candidateIds = Array.from(new Set([
    callData.primaryCallId,
    callData.dialpadCallId,
    callData.callId,
    callData.masterCallId,
    callData.entryPointCallId,
    callData.conversationId,
    ...(Array.isArray(callData.relatedCallIds) ? callData.relatedCallIds : []),
    callData.id
  ])).filter(Boolean).map(String);

  for (const candId of candidateIds) {
    for (const token of tokens) {
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
            const formatted = rawLines
              .map(line => {
                const speaker = line.name || line.speaker || line.speaker_name || (line.contact_id ? 'Contact' : 'Paul Seth');
                const text = (line.content || line.text || line.message || '').trim();
                return text ? `${speaker}: ${text}` : '';
              })
              .filter(Boolean);
            if (formatted.length > 0) return formatted.join('\n');
          }
        }
      } catch (e) {}
    }
  }

  // Fallback: check /call/{candId}
  for (const candId of candidateIds) {
    for (const token of tokens) {
      try {
        const callRes = await fetch(`https://dialpad.com/api/v2/call/${candId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        if (callRes.status === 200) {
          const details = await callRes.json();
          if (details?.transcription_text && details.transcription_text.trim()) {
            return details.transcription_text.trim();
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

async function runExport(days = 10, limit = 30, offset = 0, force = false) {
  console.log(`=== Starting Paul Seth ${days}-Day Transcript Export to OneDrive (offset: ${offset}, limit: ${limit}) ===`);
  const firestore = initFirestore();
  const tokens = await getDialpadTokens(firestore);
  console.log(`Loaded ${tokens.length} Dialpad API tokens.`);

  // Find Paul Seth in staff collection
  const staffSnap = await firestore.collection('staff').get();
  let paulStaff = null;
  staffSnap.forEach(doc => {
    const s = doc.data();
    const name = (s.fullName || '').toLowerCase();
    const email = (s.businessEmail || s.personalEmail || s.dialpadEmail || '').toLowerCase();
    if (name.includes('paul seth') || email.includes('pseth') || email.includes('paul.seth')) {
      paulStaff = { id: doc.id, ...s };
    }
  });

  if (paulStaff) {
    console.log(`Found Paul Seth profile: ID=${paulStaff.id}, Name=${paulStaff.fullName}, Email=${paulStaff.businessEmail || paulStaff.personalEmail}`);
  } else {
    console.log('Paul Seth staff profile not explicitly matched, will match dynamically on call handler data.');
  }

  // Cutoff date
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDateStr = cutoff.toISOString().substring(0, 10);
  console.log(`Querying calls starting from: ${cutoffDateStr}`);

  const callsSnap = await firestore.collection('dialpad_calls')
    .where('dateStarted', '>=', cutoffDateStr)
    .get();

  console.log(`Found ${callsSnap.size} total calls across all staff in last ${days} days.`);

  const paulCalls = [];
  callsSnap.forEach(docSnap => {
    const call = { id: docSnap.id, ...docSnap.data() };
    const matchesId = paulStaff && call.handlerId === paulStaff.id;
    const matchesHandler = isPaulSethCall(call);
    if (matchesId || matchesHandler) {
      paulCalls.push(call);
    }
  });

  // Sort newest first
  paulCalls.sort((a, b) => (b.dateStarted || '').localeCompare(a.dateStarted || ''));

  console.log(`Found ${paulCalls.length} calls belonging to Paul Seth in the last ${days} days.`);

  if (paulCalls.length === 0) {
    console.log('No calls found for Paul Seth in the selected date range.');
    return { total: 0, processed: 0, uploaded: 0, noTranscript: 0, offset, limit, hasMore: false, calls: [] };
  }

  let uploadedCount = 0;
  let noTranscriptCount = 0;
  const processedResults = [];

  const callsToProcess = paulCalls.slice(offset, offset + limit);

  for (let i = 0; i < callsToProcess.length; i++) {
    const call = callsToProcess[i];
    const callDate = (call.dateStarted || '').substring(0, 16);
    const contact = call.crmName || call.externalName || call.externalNumber || 'Unknown';
    const duration = `${Math.floor((call.durationSeconds || 0) / 60)}m ${(call.durationSeconds || 0) % 60}s`;

    console.log(`\n[${i + 1}/${callsToProcess.length}] Processing call ${call.id} (${callDate} | ${contact} | ${duration})...`);

    // 1. Check or fetch transcript
    let transcript = (call.transcript || '').trim();
    const isMissing = force || 
      !transcript || 
      transcript === 'No transcript generated yet.' || 
      transcript === 'Transcript is empty' ||
      transcript.startsWith('No transcript available');

    if (isMissing) {
      console.log(`  -> Transcript missing in database. Fetching from Dialpad API...`);
      const fetched = await fetchTranscriptFromDialpad(call, tokens);
      if (fetched) {
        transcript = fetched;
        call.transcript = fetched;
        call.transcriptStatus = 'completed';
        call.transcriptFetchedAt = new Date().toISOString();
        await firestore.collection('dialpad_calls').doc(call.id).update({
          transcript: fetched,
          transcriptStatus: 'completed',
          transcriptFetchedAt: new Date().toISOString()
        });
        console.log(`  -> Successfully retrieved transcript from Dialpad API (${fetched.length} chars)!`);
      } else {
        console.log(`  -> No transcript available from Dialpad AI (unrecorded or short call).`);
        noTranscriptCount++;
        processedResults.push({ id: call.id, contact, date: callDate, status: 'no_transcript' });
        continue;
      }
    }

    // 2. Upload to OneDrive
    console.log(`  -> Uploading transcript .docx to Paul Seth's OneDrive...`);
    const uploadRes = await autoUploadTranscriptToOneDrive(call);
    if (uploadRes.success) {
      await firestore.collection('dialpad_calls').doc(call.id).update({
        onedriveSynced: true,
        onedriveFileName: uploadRes.fileName,
        onedriveSyncedAt: uploadRes.deliveredAt
      });
      uploadedCount++;
      processedResults.push({ id: call.id, contact, date: callDate, status: 'uploaded', fileName: uploadRes.fileName });
      console.log(`  -> [SUCCESS] Archived to OneDrive: ${uploadRes.fileName}`);
    } else if (uploadRes.skipped) {
      console.log(`  -> Skipped: ${uploadRes.reason}`);
      noTranscriptCount++;
      processedResults.push({ id: call.id, contact, date: callDate, status: 'skipped', reason: uploadRes.reason });
    } else {
      console.error(`  -> [FAILED] ${uploadRes.error}`);
      processedResults.push({ id: call.id, contact, date: callDate, status: 'failed', error: uploadRes.error });
    }

    // Brief throttle to avoid hitting Power Automate concurrency limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n=== Paul Seth Transcript Export Summary ===');
  console.log(`Total Calls Processed: ${callsToProcess.length}`);
  console.log(`Transcripts Uploaded to OneDrive: ${uploadedCount}`);
  console.log(`Calls Without Transcript (Short/Unrecorded): ${noTranscriptCount}`);

  return {
    total: paulCalls.length,
    processed: callsToProcess.length,
    uploaded: uploadedCount,
    noTranscript: noTranscriptCount,
    offset,
    limit,
    hasMore: (offset + callsToProcess.length) < paulCalls.length,
    nextOffset: (offset + callsToProcess.length) < paulCalls.length ? (offset + callsToProcess.length) : null,
    results: processedResults
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.query.inspect === 'true') {
      const firestore = initFirestore();
      const days = Number(req.query.days || 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffDateStr = cutoff.toISOString().substring(0, 10);
      const callsSnap = await firestore.collection('dialpad_calls')
        .where('dateStarted', '>=', cutoffDateStr)
        .get();
      const paulCalls = [];
      callsSnap.forEach(d => {
        const c = { id: d.id, ...d.data() };
        if (isPaulSethCall(c)) paulCalls.push(c);
      });
      paulCalls.sort((a, b) => (b.dateStarted || '').localeCompare(a.dateStarted || ''));
      const summary = paulCalls.map(c => ({
        id: c.id,
        date: c.dateStarted,
        contact: c.crmName || c.externalName || c.externalNumber,
        duration: c.durationSeconds,
        talkTime: c.talkTime,
        direction: c.direction,
        state: c.state || c.webhookState,
        wasRecorded: !!(c.wasRecorded || c.hasRecording || c.recordingUrl),
        hasTranscript: !!(c.transcript && !c.transcript.startsWith('No transcript') && c.transcript !== 'Transcript is empty'),
        transcriptLen: c.transcript ? c.transcript.length : 0,
        recapSummaryLen: c.recapSummary ? c.recapSummary.length : 0,
        disposition: c.disposition || '',
        relatedCallIds: c.relatedCallIds || []
      }));
      const stats = {
        total: paulCalls.length,
        withDurationOver10s: paulCalls.filter(c => (c.durationSeconds || 0) > 10).length,
        withDurationOver60s: paulCalls.filter(c => (c.durationSeconds || 0) > 60).length,
        withRecording: paulCalls.filter(c => c.wasRecorded || c.hasRecording || c.recordingUrl).length,
        withTranscriptInDb: paulCalls.filter(c => c.transcript && !c.transcript.startsWith('No transcript') && c.transcript !== 'Transcript is empty').length,
        withRecapInDb: paulCalls.filter(c => c.recapSummary && c.recapSummary.trim().length > 0).length
      };
      return res.status(200).json({ stats, sample: summary.slice(0, 30) });
    }

    const days = Number(req.query.days || 10);
    const limit = Number(req.query.limit || 30);
    const offset = Number(req.query.offset || 0);
    const force = req.query.force === 'true';
    const result = await runExport(days, limit, offset, force);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Export Paul Seth] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

