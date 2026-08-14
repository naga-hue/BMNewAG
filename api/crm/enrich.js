import https from 'https';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Formats private key PEM format safely
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

  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  
  key = key.replace(/\\n/g, '\n');

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
          console.error('[Firestore] Failed to parse privateKey as JSON:', e);
        }
      }
      if (clientEmail && clientEmail.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(clientEmail.trim());
          if (parsed.client_email) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed to parse clientEmail as JSON:', e);
        }
      }

      if (clientEmail && privateKey) {
        const formattedKey = formatPrivateKey(privateKey);
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedKey,
          })
        });
      } else {
        throw new Error('Firebase credentials are not configured.');
      }
    }
    db = getFirestore();
  }
  return db;
}

// REST HTTP get helper
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse json: ${e.message}`));
          }
        } else {
          resolve({ success: false, statusCode: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, candidateEmail, candidateName, clientCompany, contactName, jobTitle } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Missing companyId parameter' });
    }

    const firestore = initFirestore();

    // 1. Fetch API Key for this company tenant
    const compDoc = await firestore.collection('companies').doc(companyId).get();
    let apiKey = null;

    if (compDoc.exists) {
      apiKey = compDoc.data().recruitlyApiKey;
    }

    // Fallback: If no company matches, try to find a company containing "humres"
    if (!apiKey) {
      const humresSnap = await firestore.collection('companies')
        .where('name', '>=', 'Humres')
        .limit(10)
        .get();
      
      humresSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.name && data.name.toLowerCase().includes('humres') && data.recruitlyApiKey) {
          apiKey = data.recruitlyApiKey;
        }
      });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'No Recruitly API Key configured for this company tenant.' });
    }

    // Results to return
    let resolvedCandidateId = '';
    let resolvedCompanyId = '';
    let resolvedContactId = '';
    let resolvedJobId = '';

    // 2. Candidate Lookup
    if (candidateEmail || candidateName) {
      const queryStr = candidateEmail ? candidateEmail : candidateName;
      try {
        const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encodeURIComponent(queryStr)}`;
        const candRes = await fetchJson(candUrl);
        if (candRes && candRes.data && candRes.data.length > 0) {
          resolvedCandidateId = candRes.data[0].id || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Candidate lookup failed:', e);
      }
    }

    // 3. Company Lookup
    if (clientCompany) {
      try {
        const compUrl = `https://api.recruitly.io/api/company/search?apiKey=${apiKey}&query=${encodeURIComponent(clientCompany)}`;
        const compRes = await fetchJson(compUrl);
        if (compRes && compRes.data && compRes.data.length > 0) {
          resolvedCompanyId = compRes.data[0].id || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Company lookup failed:', e);
      }
    }

    // 4. Contact Lookup
    if (contactName) {
      try {
        const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encodeURIComponent(contactName)}`;
        const contactRes = await fetchJson(contactUrl);
        if (contactRes && contactRes.data && contactRes.data.length > 0) {
          let match = contactRes.data[0];
          if (resolvedCompanyId) {
            const filtered = contactRes.data.find(c => c.companyId === resolvedCompanyId);
            if (filtered) match = filtered;
          }
          resolvedContactId = match.id || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Contact lookup failed:', e);
      }
    }

    // 5. Job / Submission Lookup
    if (resolvedCandidateId) {
      try {
        const pipeUrl = `https://api.recruitly.io/api/candidate/submissions?apiKey=${apiKey}&candidateId=${resolvedCandidateId}`;
        const pipeRes = await fetchJson(pipeUrl);
        if (pipeRes && pipeRes.success && Array.isArray(pipeRes.data) && pipeRes.data.length > 0) {
          let matchedSub = null;
          if (jobTitle || clientCompany) {
            const targetTitle = (jobTitle || '').toLowerCase();
            const targetComp = (clientCompany || '').toLowerCase();
            
            matchedSub = pipeRes.data.find(sub => {
              const subJob = (sub.jobName || sub.jobTitle || '').toLowerCase();
              const subComp = (sub.companyName || sub.clientCompany || '').toLowerCase();
              return (targetTitle && subJob.includes(targetTitle)) || (targetComp && subComp.includes(targetComp));
            });
          }
          if (!matchedSub) {
            matchedSub = pipeRes.data[0];
          }
          resolvedJobId = matchedSub.jobId || '';
          if (matchedSub.companyId && !resolvedCompanyId) {
            resolvedCompanyId = matchedSub.companyId;
          }
          if (matchedSub.contactId && !resolvedContactId) {
            resolvedContactId = matchedSub.contactId;
          }
        }
      } catch (e) {
        console.warn('[CRM Enrich] Candidate submissions lookup failed, trying job title search fallback:', e);
      }
    }

    // Fallback Job Lookup by Job Title
    if (!resolvedJobId && jobTitle) {
      try {
        const jobSearchUrl = `https://api.recruitly.io/api/nova/jobs/search?apiKey=${apiKey}&query=${encodeURIComponent(jobTitle)}`;
        const jobRes = await fetchJson(jobSearchUrl);
        if (jobRes && jobRes.success && Array.isArray(jobRes.data) && jobRes.data.length > 0) {
          let matchedJob = jobRes.data[0];
          if (resolvedCompanyId) {
            const filtered = jobRes.data.find(j => j.companyId === resolvedCompanyId);
            if (filtered) matchedJob = filtered;
          }
          resolvedJobId = matchedJob.id || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Job search fallback failed:', e);
      }
    }

    // Fetch detailed properties of contact, job, company
    let resolvedContactName = contactName || '';
    let resolvedContactJobTitle = '';
    let resolvedContactEmail = '';

    if (resolvedContactId) {
      try {
        const contactUrl = `https://api.recruitly.io/api/nova/contacts/${resolvedContactId}?apiKey=${apiKey}`;
        const contactRes = await fetchJson(contactUrl);
        if (contactRes && contactRes.success && contactRes.data) {
          const contactData = contactRes.data;
          resolvedContactName = contactData.fullName || `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
          resolvedContactJobTitle = contactData.jobTitle || '';
          resolvedContactEmail = contactData.email || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Contact details fetch failed:', e);
      }
    }

    let resolvedJobTitle = jobTitle || '';
    if (resolvedJobId && !resolvedJobTitle) {
      try {
        const jobUrl = `https://api.recruitly.io/api/nova/jobs/${resolvedJobId}?apiKey=${apiKey}`;
        const jobRes = await fetchJson(jobUrl);
        if (jobRes && jobRes.success && jobRes.data) {
          resolvedJobTitle = jobRes.data.title || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Job details fetch failed:', e);
      }
    }

    let resolvedClientCompany = clientCompany || '';
    if (resolvedCompanyId && !resolvedClientCompany) {
      try {
        const companyUrl = `https://api.recruitly.io/api/nova/companies/${resolvedCompanyId}?apiKey=${apiKey}`;
        const companyRes = await fetchJson(companyUrl);
        if (companyRes && companyRes.success && companyRes.data) {
          resolvedClientCompany = companyRes.data.name || '';
        }
      } catch (e) {
        console.error('[CRM Enrich] Company details fetch failed:', e);
      }
    }

    return res.status(200).json({
      success: true,
      candidateId: resolvedCandidateId,
      companyId: resolvedCompanyId,
      contactId: resolvedContactId,
      jobId: resolvedJobId,
      contactName: resolvedContactName,
      contactJobTitle: resolvedContactJobTitle,
      contactEmail: resolvedContactEmail,
      clientCompany: resolvedClientCompany,
      jobTitle: resolvedJobTitle
    });

  } catch (error) {
    console.error('[CRM Enrich] Internal execution error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during CRM enrichment' });
  }
}
