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
function getDialpadToken(companyId) {
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

  const { conversationId } = req.query;
  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversationId parameter' });
  }

  try {
    const firestore = initFirestore();
    const callRef = firestore.collection('dialpad_calls').doc(String(conversationId));
    const callSnap = await callRef.get();

    if (!callSnap.exists) {
      return res.status(404).json({ error: `Call with conversation ID ${conversationId} not found` });
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

    const token = getDialpadToken(companyId);
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
    const hasPrivateRecording = Array.isArray(callData.adminRecordingUrls) && callData.adminRecordingUrls.length > 0;
    const hasPublicRecordingUrl = callData.recordingUrl && callData.recordingUrl.startsWith('http') && !callData.recordingUrl.includes('dialpad.com/blob/');

    if (hasPrivateRecording && !hasPublicRecordingUrl) {
      const privateUrl = callData.adminRecordingUrls[0];
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
    }

    return res.status(200).json({ ...finalCallData, enriched: true });
  } catch (error) {
    console.error(`[Enrich] Exception caught:`, error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
