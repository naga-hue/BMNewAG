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

function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function getISTMidnightTimestamp(date) {
  const istDateStr = date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const dParts = istDateStr.split('/');
  const year = parseInt(dParts[2]);
  const month = parseInt(dParts[0]);
  const day = parseInt(dParts[1]);
  
  const istMidnightUTC = Date.UTC(year, month - 1, day) - (5.5 * 60 * 60 * 1000);
  return Math.floor(istMidnightUTC / 1000);
}

function formatDateIST(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;
  const shortMonth = month.substring(0, 3);
  return `${day}-${shortMonth}-${year}`;
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

function decimalToTime(val) {
  if (val === null || val === undefined || val === 0) return "-";
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  let hours = Math.floor(num);
  let minutes = Math.round((num - hours) * 60);
  if (minutes === 60) { hours += 1; minutes = 0; }
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return h12 + ":" + (minutes < 10 ? "0" : "") + minutes + " " + suffix;
}

// decimal hours to "Xh Ym"
function decimalToHours(val) {
  if (val === null || val === undefined || val === 0) return "-";
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  let hours = Math.floor(num);
  let minutes = Math.round((num - hours) * 60);
  if (minutes === 60) { hours += 1; minutes = 0; }
  return hours + "h " + (minutes < 10 ? "0" : "") + minutes + "m";
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
  
  if (nameOverrides[normEmp]) {
    normEmp = nameOverrides[normEmp];
  }
  
  if (normDb === normEmp) return true;
  
  const cleanDb = normDb.replace(/[^a-z0-9]/g, '');
  const cleanEmp = normEmp.replace(/[^a-z0-9]/g, '');
  if (cleanDb === cleanEmp) return true;
  
  return false;
}

function expandWeekData(graphData, anchorDate) {
  const rows = [];
  const dates = [];
  for (let d = -7; d <= 0; d++) { dates.push(addDays(anchorDate, d)); }

  for (let i = 0; i < dates.length; i++) {
    const dateStr = formatDateIST(dates[i]);
    const idx = i;

    function rawVal(metric) {
      if (!graphData[metric] || !graphData[metric].week_data) return null;
      const v = graphData[metric].week_data[idx];
      return (v === null || v === undefined) ? null : v;
    }

    const arr = rawVal("arrival_time");
    const lft = rawVal("left_time");
    const prd = rawVal("productive_time");
    const taw = rawVal("time_at_work");
    const dsk = rawVal("desktime");
    const eff = rawVal("effectiveness");
    const pro = rawVal("productivity");

    rows.push({
      date:            dateStr,
      arrival_time:    arr ? decimalToTime(arr)  : "-",
      left_time:       lft ? decimalToTime(lft)  : "-",
      productive_time: prd ? decimalToHours(prd) : "-",
      time_at_work:    taw ? decimalToHours(taw) : "-",
      desktime:        dsk ? decimalToHours(dsk) : "-",
      effectiveness:   eff ? String(eff) + "%"  : "-",
      productivity:    pro ? String(pro) + "%"  : "-"
    });
  }
  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth Check (Support native Vercel Cron header 'x-vercel-cron')
  const authHeader = req.headers.authorization || '';
  const querySecret = req.query.secret || '';
  const expectedSecret = process.env.QANDLE_INGEST_SECRET || 'qandle-talent-kpi-hub-key-2026';
  
  const isCron = req.headers['x-vercel-cron'] === '1';
  const isAuthorized = isCron || 
                       (authHeader.startsWith('Bearer ') && authHeader.split(' ')[1] === expectedSecret) || 
                       (querySecret === expectedSecret);

  if (!isAuthorized) {
    console.warn('[Qandle Sync/Ingest] Unauthorized access attempt.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1. Check if this is an Ingest action (POST with records array)
  const isIngest = req.method === 'POST' && req.body && Array.isArray(req.body.records);

  if (isIngest) {
    // --- RUN INGEST LOGIC ---
    const { records } = req.body;
    try {
      const firestore = initFirestore();
      const staffSnap = await firestore.collection('staff').get();
      const staffList = [];
      staffSnap.forEach(sDoc => {
        staffList.push({ id: sDoc.id, ...sDoc.data() });
      });

      console.log(`[Qandle Ingest] Processing batch of ${records.length} records.`);

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
          console.warn(`[Qandle Ingest] Skipping record. Could not match employee: ${rec.full_name}`);
          skippedCount++;
          continue;
        }

        const parsedDate = parseQandleDate(rec.date);
        if (!parsedDate) {
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

  // --- RUN SYNC LOGIC ---
  // Time gate (7 AM - 7 PM UK Time)
  const bypassTimecheck = req.query.bypassTimecheck === 'true';
  if (!bypassTimecheck) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hour12: false
    });
    const ukHour = parseInt(formatter.format(now), 10);
    
    if (ukHour < 7 || ukHour >= 19) {
      console.log(`[Qandle Sync] Outside UK work hours (Current UK hour: ${ukHour}). Skipping sync.`);
      return res.status(200).json({ success: true, message: `Skipped: Outside 7 AM - 7 PM UK hours` });
    }
  }

  const CLIENT_ID = process.env.QANDLE_CLIENT_ID || "87654456789231";
  const CLIENT_SECRET = process.env.QANDLE_CLIENT_SECRET || "ghru4545gjdf8f5fff0ff6se5";
  const BASE_URL = process.env.QANDLE_BASE_URL || "https://talent.qandle.com";

  try {
    const firestore = initFirestore();
    
    const staffSnap = await firestore.collection('staff').get();
    const staffList = [];
    staffSnap.forEach(sDoc => {
      const data = sDoc.data();
      if (data.status !== 'exited') {
        staffList.push({ id: sDoc.id, ...data });
      }
    });

    console.log(`[Qandle Sync] Loaded ${staffList.length} active staff profiles.`);

    const authRes = await fetch(BASE_URL + "/oauth/access-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "client_credentials",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });
    
    const tokenData = await authRes.json();
    if (!tokenData.access_token) {
      throw new Error(`Qandle auth failed: ${JSON.stringify(tokenData)}`);
    }
    const token = tokenData.access_token;

    const userRes = await fetch(BASE_URL + "/client-api/users-preview", {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    });
    const userData = await userRes.json();
    if (userData.status !== "success" || !Array.isArray(userData.data)) {
      throw new Error("Failed to fetch Qandle user list");
    }
    const qandleEmployees = userData.data;

    let matchedCount = 0;
    let fastPathWritten = 0;
    const batch = firestore.batch();
    const today = new Date();
    const timestamp = getISTMidnightTimestamp(today);

    const matchedStaffList = [];

    // Fast Path Sync
    for (const s of staffList) {
      const matchedEmp = qandleEmployees.find(qEmp => {
        const sQandle = (s.qandleEmail || '').trim().toLowerCase();
        const qEmail = (qEmp.personal_email_id || '').trim().toLowerCase();
        if (sQandle && qEmail && sQandle === qEmail) return true;

        const sCode = (s.employeeCode || s.employee_code || '').trim().toUpperCase();
        const qCode = (qEmp.employee_code || '').trim().toUpperCase();
        if (sCode && qCode && sCode === qCode) return true;

        return matchName(s.fullName, qEmp.full_name);
      });

      if (!matchedEmp) continue;
      matchedCount++;
      matchedStaffList.push({ staff: s, matchedEmp });

      const graphRes = await fetch(BASE_URL + `/client-api/productivity-graph/${matchedEmp._id}/${timestamp}`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + token }
      });
      const graphData = await graphRes.json();

      if (graphData.status === "success" && graphData.data) {
        const dailyRows = expandWeekData(graphData.data, today);
        const lastTwoDays = dailyRows.slice(-2);
        
        for (const row of lastTwoDays) {
          const parsedDate = parseQandleDate(row.date);
          if (!parsedDate) continue;

          const docId = `${s.id}_${parsedDate}`;
          const docRef = firestore.collection('qandle_activities').doc(docId);

          const activityData = {
            staffId: s.id,
            staffName: s.fullName,
            employeeCode: matchedEmp.employee_code || '',
            date: parsedDate,
            arrivalTime: row.arrival_time || '-',
            leftTime: row.left_time || '-',
            productiveTimeSeconds: timeStringToSeconds(row.productive_time),
            timeAtWorkSeconds: timeStringToSeconds(row.time_at_work),
            deskTimeSeconds: timeStringToSeconds(row.desktime),
            effectiveness: parsePercentage(row.effectiveness),
            productivity: parsePercentage(row.productivity),
            updatedAt: new Date().toISOString()
          };

          batch.set(docRef, activityData, { merge: true });
          fastPathWritten++;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (fastPathWritten > 0) {
      await batch.commit();
      console.log(`[Qandle Sync] Fast path complete. Wrote ${fastPathWritten} rows.`);
    }

    // Trailing background backfill
    const isFullBackfill = req.query.fullBackfill === 'true';
    let backfillTargetList = [];

    if (isFullBackfill) {
      backfillTargetList = matchedStaffList;
    } else if (matchedStaffList.length > 0) {
      const singleCandidate = [...matchedStaffList].sort((a, b) => {
        const aTime = a.staff.qandleLastBackfilledAt ? new Date(a.staff.qandleLastBackfilledAt).getTime() : 0;
        const bTime = b.staff.qandleLastBackfilledAt ? new Date(b.staff.qandleLastBackfilledAt).getTime() : 0;
        return aTime - bTime;
      })[0];
      
      if (singleCandidate) {
        backfillTargetList = [singleCandidate];
      }
    }

    let historyWrittenCount = 0;
    const historyOffsets = [-7, -14, -21, -28];

    for (const target of backfillTargetList) {
      const s = target.staff;
      const emp = target.matchedEmp;
      const historyBatch = firestore.batch();
      let targetWrittenCount = 0;

      for (const offset of historyOffsets) {
        const anchorDate = addDays(today, offset);
        const histTimestamp = getISTMidnightTimestamp(anchorDate);

        try {
          const histRes = await fetch(BASE_URL + `/client-api/productivity-graph/${emp._id}/${histTimestamp}`, {
            method: "GET",
            headers: { "Authorization": "Bearer " + token }
          });
          const histData = await histRes.json();

          if (histData.status === "success" && histData.data) {
            const dailyRows = expandWeekData(histData.data, anchorDate);
            for (const row of dailyRows) {
              const parsedDate = parseQandleDate(row.date);
              if (!parsedDate) continue;

              const docId = `${s.id}_${parsedDate}`;
              const docRef = firestore.collection('qandle_activities').doc(docId);

              const activityData = {
                staffId: s.id,
                staffName: s.fullName,
                employeeCode: emp.employee_code || '',
                date: parsedDate,
                arrivalTime: row.arrival_time || '-',
                leftTime: row.left_time || '-',
                productiveTimeSeconds: timeStringToSeconds(row.productive_time),
                timeAtWorkSeconds: timeStringToSeconds(row.time_at_work),
                deskTimeSeconds: timeStringToSeconds(row.desktime),
                effectiveness: parsePercentage(row.effectiveness),
                productivity: parsePercentage(row.productivity),
                updatedAt: new Date().toISOString()
              };

              historyBatch.set(docRef, activityData, { merge: true });
              targetWrittenCount++;
              historyWrittenCount++;
            }
          }
        } catch (err) {
          console.error(`[Qandle Sync] History offset ${offset} failed for ${s.fullName}:`, err);
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      if (targetWrittenCount > 0) {
        await historyBatch.commit();
      }

      await firestore.collection('staff').doc(s.id).update({
        qandleLastBackfilledAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: `Sync completed. Wrote ${fastPathWritten} recent and ${historyWrittenCount} history records.`
    });

  } catch (error) {
    console.error('[Qandle Sync] Error running sync cron:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
