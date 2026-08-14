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

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, companyId } = req.query;
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone query parameter' });
  }

  // Clean the number (remove non-digits, keep formatting check safe)
  const cleanPhone = phone.replace(/[^0-9+]/g, '').trim();
  if (cleanPhone.length < 6) {
    return res.status(200).json({ success: true, matched: false, reason: 'Phone number too short' });
  }

  try {
    const firestoreDb = initFirestore();
    let apiKey = null;

    if (companyId) {
      const compDoc = await firestoreDb.collection('companies').doc(companyId).get();
      if (compDoc.exists) {
        apiKey = compDoc.data().recruitlyApiKey;
      }
    }
    
    if (!apiKey) {
      // Find Humres CRM API Key from companies collection
      const compSnap = await firestoreDb.collection('companies').get();
      compSnap.forEach((doc) => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('humres') && data.recruitlyApiKey) {
          apiKey = data.recruitlyApiKey;
        }
      });
    }

    if (!apiKey) {
      console.warn('[CRM Lookup] No recruitlyApiKey found in companies collection.');
      return res.status(500).json({ error: 'Recruitly API Key configuration not found in companies database.' });
    }

    // 1. Search Candidates
    const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encodeURIComponent(cleanPhone)}`;
    let candRes = null;
    try {
      candRes = await fetchJson(candUrl);
    } catch (e) {
      console.error('[CRM Lookup] Candidate search fetch failed:', e);
    }

    if (candRes && candRes.data && candRes.data.length > 0) {
      const cand = candRes.data[0];
      return res.status(200).json({
        success: true,
        matched: true,
        type: 'CANDIDATE',
        id: cand.id,
        name: cand.fullName || cand.name || 'Unknown Candidate',
        company: cand.companyName || cand.company || ''
      });
    }

    // 2. Search Contacts
    const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encodeURIComponent(cleanPhone)}`;
    let contactRes = null;
    try {
      contactRes = await fetchJson(contactUrl);
    } catch (e) {
      console.error('[CRM Lookup] Contact search fetch failed:', e);
    }

    if (contactRes && contactRes.data && contactRes.data.length > 0) {
      const contact = contactRes.data[0];
      return res.status(200).json({
        success: true,
        matched: true,
        type: 'CONTACT',
        id: contact.id,
        name: contact.fullName || contact.name || 'Unknown Contact',
        company: contact.companyName || contact.company || ''
      });
    }

    // 3. No Match Found
    return res.status(200).json({
      success: true,
      matched: false
    });

  } catch (error) {
    console.error('[CRM Lookup] Error during Recruitly lookup:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during CRM search' });
  }
}
