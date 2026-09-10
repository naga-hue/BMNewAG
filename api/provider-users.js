import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
        throw new Error('Firebase credentials not set in environment variables.');
      }
    }
    db = getFirestore();
  }
  return db;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let firestore = null;
  try {
    firestore = initFirestore();
  } catch (err) {
    console.warn('[Provider Users] Firestore initialization unavailable, proceeding in standalone mode:', err.message);
  }

  const shouldRefresh = req.query?.refresh === 'true' || req.query?.force === 'true';

  // 1. Check Firestore Cache (1 hour TTL)
  const cacheRef = firestore ? firestore.collection('metadata').doc('provider_users_cache') : null;
  if (!shouldRefresh && cacheRef) {
    try {
      const cacheSnap = await cacheRef.get();
      if (cacheSnap.exists) {
        const data = cacheSnap.data();
        const cachedAt = data.cachedAt ? new Date(data.cachedAt).getTime() : 0;
        const now = Date.now();
        // 1 hour cache TTL
        if (now - cachedAt < 3600 * 1000) {
          return res.status(200).json({
            success: true,
            fromCache: true,
            cachedAt: data.cachedAt,
            qandle: data.qandle || [],
            dialpad: data.dialpad || [],
            recruitly: data.recruitly || []
          });
        }
      }
    } catch (cacheErr) {
      console.warn('[Provider Users] Cache read failed, proceeding with fresh fetch:', cacheErr.message);
    }
  }

  // 2. Fetch Qandle Users
  const fetchQandle = async () => {
    try {
      const CLIENT_ID = process.env.QANDLE_CLIENT_ID || "87654456789231";
      const CLIENT_SECRET = process.env.QANDLE_CLIENT_SECRET || "ghru4545gjdf8f5fff0ff6se5";
      const BASE_URL = process.env.QANDLE_BASE_URL || "https://talent.qandle.com";

      const authRes = await fetch(BASE_URL + "/oauth/access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        })
      });
      const tokenData = await authRes.json();
      if (!tokenData.access_token) {
        console.error('[Provider Users] Qandle auth token missing:', tokenData);
        return [];
      }

      const userRes = await fetch(BASE_URL + "/client-api/users-preview", {
        headers: { Authorization: "Bearer " + tokenData.access_token }
      });
      const userData = await userRes.json();
      if (userData.status === "success" && Array.isArray(userData.data)) {
        return userData.data
          .filter(u => u.full_name && !u.full_name.toLowerCase().includes('team  humres'))
          .map(u => ({
            id: u._id,
            name: (u.full_name || '').trim(),
            code: (u.employee_code || '').trim().toUpperCase(),
            email: (u.personal_email_id || u.work_email_id || u.email || '').trim().toLowerCase(),
            department: u.display_detail?.[1] || '',
            company: u.display_detail?.[2] || ''
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      return [];
    } catch (e) {
      console.error('[Provider Users] Error fetching Qandle users:', e.message);
      return [];
    }
  };

  // 3. Fetch Recruitly Users
  const fetchRecruitly = async () => {
    try {
      // Find apiKey from query/body, env, or companies collection
      let apiKey = req.query?.recruitlyApiKey || req.body?.recruitlyApiKey || process.env.RECRUITLY_API_KEY || process.env.CRM_API_KEY;
      if (!apiKey && firestore) {
        const compSnap = await firestore.collection('companies').get();
        compSnap.forEach(doc => {
          const d = doc.data();
          if (d.recruitlyApiKey && (!apiKey || (d.name && d.name.toLowerCase().includes('humres')))) {
            apiKey = d.recruitlyApiKey.trim();
          }
        });
      }

      if (!apiKey) {
        console.warn('[Provider Users] No Recruitly API key found in companies or env.');
        return [];
      }

      const res = await fetch(`https://api.recruitly.io/api/user/list?apiKey=${apiKey}`);
      if (res.status === 200) {
        const payload = await res.json();
        const rawList = Array.isArray(payload) ? payload : (payload.data && Array.isArray(payload.data) ? payload.data : []);
        return rawList
          .filter(u => u.fullName && !u.disabled && !u.archived)
          .map(u => ({
            id: u.id,
            name: (u.fullName || '').trim(),
            email: (u.email || '').trim().toLowerCase(),
            role: u.role || '',
            teamName: u.teamName || ''
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      return [];
    } catch (e) {
      console.error('[Provider Users] Error fetching Recruitly users:', e.message);
      return [];
    }
  };

  // 4. Fetch Dialpad Users (combines API users + historical active callers)
  const fetchDialpad = async () => {
    try {
      const dialpadUsersMap = new Map();

      // Collect tokens
      const tokens = [];
      if (firestore) {
        try {
          const compSnap = await firestore.collection('companies').get();
          compSnap.forEach(doc => {
            const d = doc.data();
            if (d.dialpadApiKey && d.dialpadApiKey.trim()) {
              tokens.push(d.dialpadApiKey.trim());
            }
          });
        } catch (compErr) {
          console.warn('[Provider Users] Error reading company dialpad keys:', compErr.message);
        }
      }
      if (req.query?.dialpadApiKey) tokens.push(req.query.dialpadApiKey.trim());
      if (req.body?.dialpadApiKey) tokens.push(req.body.dialpadApiKey.trim());
      if (process.env.DIALPAD_TOKEN_1) tokens.push(process.env.DIALPAD_TOKEN_1.trim());
      if (process.env.DIALPAD_TOKEN_2) tokens.push(process.env.DIALPAD_TOKEN_2.trim());
      if (process.env.DIALPAD_TOKEN) tokens.push(process.env.DIALPAD_TOKEN.trim());
      const uniqueTokens = Array.from(new Set(tokens)).filter(Boolean);

      // Check if knownDialpadUsers were provided in request body
      if (req.body?.knownDialpadUsers && Array.isArray(req.body.knownDialpadUsers)) {
        req.body.knownDialpadUsers.forEach(u => {
          const email = (typeof u === 'string' ? u : u.email || '').trim().toLowerCase();
          if (email && email.includes('@') && !dialpadUsersMap.has(email)) {
            let name = (typeof u === 'object' && u.name) ? u.name.trim() : '';
            if (!name) {
              const prefix = email.split('@')[0];
              name = prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            }
            dialpadUsersMap.set(email, {
              id: email,
              name,
              email,
              phone: ''
            });
          }
        });
      }

      // Try Dialpad API
      for (const token of uniqueTokens) {
        try {
          const res = await fetch('https://dialpad.com/api/v2/users?limit=100', {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
          });
          if (res.status === 200) {
            const data = await res.json();
            const items = data.items || data.entries || [];
            items.forEach(u => {
              const email = (u.email || (u.emails && u.emails[0]) || '').trim().toLowerCase();
              if (email && email.includes('@')) {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || email.split('@')[0];
                dialpadUsersMap.set(email, {
                  id: String(u.id || email),
                  name,
                  email,
                  phone: u.phone_numbers?.[0] || ''
                });
              }
            });
          }
        } catch (tokErr) {
          console.warn('[Provider Users] Dialpad token fetch error:', tokErr.message);
        }
      }

      // Also pull active Dialpad callers from dialpad_calls to capture all known accounts
      // Also pull active Dialpad callers from dialpad_calls to capture all known accounts
      if (firestore) {
        try {
          const callsSnap = await firestore.collection('dialpad_calls')
            .orderBy('date_started', 'desc')
            .limit(300)
            .get();

          callsSnap.forEach(doc => {
            const d = doc.data();
            const email = (d.dialpadUser || d.targetEmail || d.user_email || d.email || '').trim().toLowerCase();
            if (email && email.includes('@') && !dialpadUsersMap.has(email)) {
              let name = (d.caller_name || d.userName || d.staffName || d.name || '').trim();
              if (!name) {
                const prefix = email.split('@')[0];
                name = prefix.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
              }
              dialpadUsersMap.set(email, {
                id: email,
                name,
                email,
                phone: ''
              });
            }
          });
        } catch (callErr) {
          console.warn('[Provider Users] Error extracting dialpad users from calls:', callErr.message);
        }

        // Also include active staff who already have dialpadEmail or businessEmail configured
        try {
          const staffSnap = await firestore.collection('staff').get();
          staffSnap.forEach(sDoc => {
            const s = sDoc.data();
            if (s.dialpadEmail && s.dialpadEmail.includes('@') && !dialpadUsersMap.has(s.dialpadEmail.trim().toLowerCase())) {
              dialpadUsersMap.set(s.dialpadEmail.trim().toLowerCase(), {
                id: s.id,
                name: s.fullName || s.dialpadEmail,
                email: s.dialpadEmail.trim().toLowerCase(),
                phone: s.businessPhone || ''
              });
            }
          });
        } catch (staffErr) {
          console.warn('[Provider Users] Staff collection check error:', staffErr.message);
        }
      }

      return Array.from(dialpadUsersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('[Provider Users] Error fetching Dialpad users:', e.message);
      return [];
    }
  };

  try {
    const [qandle, recruitly, dialpad] = await Promise.all([
      fetchQandle(),
      fetchRecruitly(),
      fetchDialpad()
    ]);

    const result = {
      success: true,
      fromCache: false,
      cachedAt: new Date().toISOString(),
      qandle,
      recruitly,
      dialpad
    };

    // Save to Firestore Cache asynchronously
    if (cacheRef) {
      cacheRef.set(result).catch(err => {
        console.warn('[Provider Users] Failed to write cache to Firestore:', err.message);
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Provider Users] Master handler failure:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch provider users' });
  }
}
