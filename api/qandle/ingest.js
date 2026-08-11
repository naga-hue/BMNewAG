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
        throw new Error('Firebase credentials not set in Vercel environment variables.');
      }
    }
    db = getFirestore();
  }
  return db;
}

function parseQandleDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parts = str.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const year = parts[2];
    const monthStr = parts[1].toLowerCase().substring(0, 3);
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const month = months[monthStr];
    if (month) return `${year}-${month}-${day}`;
  }
  return str;
}

function timeStringToSeconds(val) {
  if (!val || val === '-') return 0;
  const str = String(val).trim();
  
  if (/^\d+(\.\d+)?$/.test(str)) {
    const decimalHours = parseFloat(str);
    return Math.round(decimalHours * 3600);
  }
  
  const match = str.match(/^(\d+)h\s*(\d+)m$/i);
  if (match) {
    const hrs = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    return (hrs * 3600) + (mins * 60);
  }
  return 0;
}

function parsePercentage(val) {
  if (!val || val === '-') return 0;
  const str = String(val).replace(/%/g, '').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

const nameOverrides = {
  'william champken-frasca': 'will champken',
  'candyce dawes': 'candyce dawes celene',
  'matthew james sparks': 'matthew sparks',
  'swarupa elisetti': 'swarupa elissetti',
  'praveen m': 'praveenkumar m',
  'praveenkumar m': 'praveenkumar m'
};

function matchName(dbName, empName) {
  if (!dbName || !empName) return false;
  
  const normDb = dbName.toLowerCase().replace(/\s+/g, ' ').trim();
  let normEmp = empName.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Apply overrides
  if (nameOverrides[normEmp]) {
    normEmp = nameOverrides[normEmp];
  }
  
  // Exact match
  if (normDb === normEmp) return true;
  
  // Clean alphanumeric match (handles Mc Dougall vs McDougall, and hyphens)
  const cleanDb = normDb.replace(/[^a-z0-9]/g, '');
  const cleanEmp = normEmp.replace(/[^a-z0-9]/g, '');
  if (cleanDb === cleanEmp) return true;
  
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization || '';
  const expectedSecret = process.env.QANDLE_INGEST_SECRET || 'qandle-talent-kpi-hub-key-2026';
  
  if (!authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedSecret) {
    console.warn('[Qandle Ingest] Unauthorized request.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { records } = req.body;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid payload: records array is required.' });
  }

  try {
    const firestore = initFirestore();
    const staffSnap = await firestore.collection('staff').get();
    const staffList = [];
    staffSnap.forEach(sDoc => {
      staffList.push({ id: sDoc.id, ...sDoc.data() });
    });

    console.log(`[Qandle Ingest] Processing batch of ${records.length} records. Matched staff database size: ${staffList.length}`);

    let processedCount = 0;
    let skippedCount = 0;

    const batch = firestore.batch();

    for (const rec of records) {
      const empCode = (rec.employee_code || '').trim().toUpperCase();
      const empName = (rec.full_name || '').trim().toLowerCase();

      let matchedStaff = staffList.find(s => {
        const dbCode = (s.employeeCode || s.employee_code || '').trim().toUpperCase();
        return dbCode && dbCode === empCode;
      });

      if (!matchedStaff) {
        matchedStaff = staffList.find(s => {
          const dbName = (s.fullName || s.full_name || '').trim();
          return matchName(dbName, rec.full_name);
        });
      }

      if (!matchedStaff) {
        console.warn(`[Qandle Ingest] Skipping record. Could not match employee: ${rec.full_name} (${empCode})`);
        skippedCount++;
        continue;
      }

      const parsedDate = parseQandleDate(rec.date);
      if (!parsedDate) {
        console.warn(`[Qandle Ingest] Skipping record due to empty or invalid date:`, rec);
        skippedCount++;
        continue;
      }

      const docId = `${matchedStaff.id}_${parsedDate}`;
      const docRef = firestore.collection('qandle_activities').doc(docId);

      const activityData = {
        staffId: matchedStaff.id,
        staffName: matchedStaff.fullName || matchedStaff.full_name || rec.full_name,
        employeeCode: matchedStaff.employeeCode || empCode,
        date: parsedDate,
        arrivalTime: rec.arrival_time || '-',
        leftTime: rec.left_time || '-',
        productiveTimeSeconds: timeStringToSeconds(rec.productive_time),
        timeAtWorkSeconds: timeStringToSeconds(rec.time_at_work),
        deskTimeSeconds: timeStringToSeconds(rec.desktime),
        effectiveness: parsePercentage(rec.effectiveness),
        productivity: parsePercentage(rec.productivity),
        updatedAt: new Date().toISOString()
      };

      batch.set(docRef, activityData, { merge: true });
      processedCount++;
    }

    if (processedCount > 0) {
      await batch.commit();
    }

    console.log(`[Qandle Ingest] Successfully processed ${processedCount} records, skipped ${skippedCount}.`);
    return res.status(200).json({ success: true, processed: processedCount, skipped: skippedCount });

  } catch (error) {
    console.error('[Qandle Ingest] Error processing ingest:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
