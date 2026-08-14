import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

// Dot-insensitive email normalizer
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

// Normalize activity type strings from Recruitly / Zapier
function normalizeActivityType(typeStr) {
  if (!typeStr) return '';
  const s = typeStr.toLowerCase().trim();
  
  if (s.includes('cv share for job') || s.includes('cv share') || s.includes('submission') || s.includes('cv sent') || s === 'cv_sent') {
    return 'cv_sent';
  }
  if (s.includes('speculative') || s === 'speculative_cv') {
    return 'speculative_cv';
  }
  if (s.includes('interview') || s.includes('meeting') || s.includes('arrange') || s === 'interview') {
    return 'interview';
  }
  if (s.includes('placement') || s.includes('deal') || s.includes('placed') || s === 'placement') {
    return 'placement';
  }
  if (s.includes('opportunity') || s.includes('bite')) {
    return 'opportunity';
  }
  if (s.includes('job') || s.includes('lead') || s === 'job_taken') {
    return 'job_taken';
  }
  return s;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'recruitly-crm-activity-ingestion' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { secret } = req.query;
    const configuredSecret = process.env.CRM_WEBHOOK_SECRET || 'qandle-talent-kpi-hub-key-2026';
    
    if (secret !== configuredSecret) {
      return res.status(401).json({ error: 'Unauthorized secret key' });
    }

    let {
      recruiterEmail,
      activityType,
      candidateName,
      clientCompany,
      jobTitle,
      value,
      timestamp,
      candidateId,
      contactId,
      companyId,
      jobId
    } = req.body;

    // Fallback support for default Zapier key mappings (_1, _2, _3, _4, "")
    if (!recruiterEmail && req.body._1) recruiterEmail = req.body._1;
    if (!activityType && req.body._2) activityType = req.body._2;
    if (!candidateName && req.body._3) candidateName = req.body._3;
    if (!clientCompany && req.body._4) clientCompany = req.body._4;
    
    // Robust date scavenging from standard CRM fields
    if (!timestamp) {
      const standardDateKeys = [
        'timestamp', 'eventDate', 'event_date', 'createdDate', 'created_date',
        'dateCreated', 'date_created', 'startDate', 'start_date', 'placementDate',
        'placement_date', 'interviewDate', 'interview_date', 'date'
      ];
      
      for (const key of standardDateKeys) {
        if (req.body[key]) {
          timestamp = req.body[key];
          break;
        }
      }
      
      if (!timestamp) {
        if (req.body[""] !== undefined) {
          timestamp = req.body[""];
        } else {
          // Search body for any ISO-like date string or format (e.g. YYYY-MM-DD, DD/MM/YYYY, etc.)
          for (const [k, v] of Object.entries(req.body)) {
            if (typeof v === 'string') {
              const trimmed = v.trim();
              const ymdMatch = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
              const dmyMatch = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(trimmed);
              const isoMatch = trimmed.includes('T') && trimmed.includes(':');
              
              if (ymdMatch || dmyMatch || isoMatch) {
                timestamp = trimmed;
                break;
              }
            }
          }
        }
      }
    }

    if (!recruiterEmail || !activityType) {
      return res.status(400).json({ error: 'Missing recruiterEmail or activityType parameters' });
    }

    const normalizedType = normalizeActivityType(activityType);
    const firestore = initFirestore();

    // 1. Match recruiter using primary and aliases email fields
    const staffSnap = await firestore.collection('staff').get();
    let matchedStaff = null;
    const normRecruiterEmail = normalizeEmail(recruiterEmail);

    staffSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'exited') return;

      const primary = normalizeEmail(data.businessEmail || data.personalEmail);
      const dialpad = normalizeEmail(data.dialpadEmail);
      const crmEmail = normalizeEmail(data.recruitlyEmail);
      const aliases = Array.isArray(data.additionalEmails) ? data.additionalEmails.map(normalizeEmail) : [];

      if (
        primary === normRecruiterEmail ||
        dialpad === normRecruiterEmail ||
        crmEmail === normRecruiterEmail ||
        aliases.includes(normRecruiterEmail)
      ) {
        matchedStaff = { id: docSnap.id, ...data };
      }
    });

    if (!matchedStaff) {
      console.warn(`[CRM Ingest] Recruiter email not found in staff: ${recruiterEmail}`);
      return res.status(404).json({ error: `Recruiter email not found in staff database: ${recruiterEmail}` });
    }

    // 2. Format dates & times
    const eventTime = timestamp ? new Date(timestamp) : new Date();
    const isoTimestamp = eventTime.toISOString();
    const dateKey = isoTimestamp.substring(0, 10); // YYYY-MM-DD

    // 3. Save raw CRM activity log
    const activityRef = firestore.collection('crm_activities').doc();
    const activityData = {
      recruiterId: matchedStaff.id,
      recruiterName: matchedStaff.fullName,
      activityType: normalizedType,
      candidateName: candidateName || '',
      clientCompany: clientCompany || '',
      jobTitle: jobTitle || '',
      placementValue: Number(value || 0),
      timestamp: isoTimestamp,
      dateKey,
      createdAt: new Date().toISOString(),
      candidateId: candidateId || req.body.candidate_id || req.body.candidate_ID || '',
      contactId: contactId || req.body.contact_id || req.body.contact_ID || '',
      companyId: companyId || req.body.company_id || req.body.company_ID || '',
      jobId: jobId || req.body.job_id || req.body.job_ID || '',
      rawPayload: req.body || {}
    };

    await activityRef.set(activityData);
    console.log(`[CRM Ingest] Saved raw activity: ${activityRef.id}`);

    // 4. Update the daily scorecards (kpiDaily) with merge rules
    const kpiDocId = `${matchedStaff.id}_${dateKey}`;
    const kpiDocRef = firestore.collection('kpiDaily').doc(kpiDocId);

    const updateFields = {
      staffId: matchedStaff.id,
      staffName: matchedStaff.fullName,
      department: matchedStaff.department || '',
      email: matchedStaff.businessEmail || matchedStaff.personalEmail || '',
      date: dateKey,
      lastUpdated: new Date().toISOString()
    };

    const typeLower = normalizedType;
    if (typeLower === 'cv_sent') {
      updateFields.cvsSent = FieldValue.increment(1);
    } else if (typeLower === 'speculative_cv') {
      updateFields.speculativeCvs = FieldValue.increment(1);
    } else if (typeLower === 'interview') {
      updateFields.interviews = FieldValue.increment(1);
    } else if (typeLower === 'opportunity') {
      updateFields.opportunities = FieldValue.increment(1);
    } else if (typeLower === 'job_taken') {
      updateFields.jobsTaken = FieldValue.increment(1);
    }

    await kpiDocRef.set(updateFields, { merge: true });
    console.log(`[CRM Ingest] Updated kpiDaily scorecard: ${kpiDocId}`);

    // 5. If placement, write to placements collection
    if (typeLower === 'placement') {
      const placementId = `placement_${activityRef.id}`;
      const placementDocRef = firestore.collection('placements').doc(placementId);
      
      const placementData = {
        id: placementId,
        placementId: placementId,
        candidateName: candidateName || 'Unknown Candidate',
        clientCompany: clientCompany || 'Unknown Client',
        netScoreValue: Number(value || 0),
        clientPaymentStatus: 'Pending',
        status: 'active',
        splits: [
          {
            staffId: matchedStaff.id,
            percentage: 100
          }
        ],
        createdAt: isoTimestamp,
        date: dateKey,
        startDate: dateKey,
        scoredDate: dateKey
      };

      await placementDocRef.set(placementData);
      console.log(`[CRM Ingest] Saved sales dashboard record: ${placementId}`);
    }

    return res.status(200).json({
      success: true,
      activityId: activityRef.id,
      recruiter: matchedStaff.fullName,
      date: dateKey,
      activity: typeLower
    });

  } catch (error) {
    console.error('[CRM Ingest] Runtime error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
