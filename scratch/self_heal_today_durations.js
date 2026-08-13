import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Parse environment variables manually from .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envConfig = {};
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      envConfig[key] = val;
    }
  });
}

const firebaseConfig = {
  apiKey: "AIzaSyDK_4zfUH8qdnNWoYqF-w0GDbAQ-4crM1A",
  authDomain: "humres-management-hub.firebaseapp.com",
  projectId: "humres-management-hub",
  storageBucket: "humres-management-hub.firebasestorage.app",
  messagingSenderId: "285569320788",
  appId: "1:285569320788:web:2fbc1f17a839ba1091eac1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Token resolver
function getDialpadToken(companyId) {
  if (companyId === 'comp-1782806159650') {
    return envConfig.DIALPAD_TOKEN_2 || envConfig.DIALPAD_TOKEN || '';
  }
  return envConfig.DIALPAD_TOKEN_1 || envConfig.DIALPAD_TOKEN || '';
}

async function updateKpiDaily(handlerId, dateKey) {
  if (!handlerId || !dateKey) return;
  const docId = `${handlerId}_${dateKey}`;
  console.log(`[KPI] Recalculating aggregates for recruiter ${handlerId} on ${dateKey}...`);

  try {
    const staffSnap = await getDocs(collection(db, 'staff'));
    let staffMember = null;
    staffSnap.forEach(d => {
      if (d.id === handlerId) staffMember = { id: d.id, ...d.data() };
    });

    if (!staffMember) {
      console.warn(`[KPI] Staff member ${handlerId} not found in database. Skipping.`);
      return;
    }

    const callsSnap = await getDocs(query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', `${dateKey}T00:00:00`),
      where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
    ));

    let callsInbound = 0;
    let callsOutbound = 0;
    let callsTotal = 0;
    let totalTalkTimeSeconds = 0;
    let callsOver5Min = 0;
    let callsOver10Min = 0;

    callsSnap.forEach(d => {
      const call = d.data();
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
      staffName: staffMember.fullName || '',
      department: staffMember.department || '',
      email: staffMember.businessEmail || staffMember.personalEmail || '',
      date: dateKey,
      callsInbound,
      callsOutbound,
      callsTotal,
      totalTalkTimeSeconds,
      callsOver5Min,
      callsOver10Min,
      lastUpdated: new Date().toISOString()
    };

    const kpiRef = doc(db, 'kpiDaily', docId);
    await setDoc(kpiRef, kpiData, { merge: true });
    console.log(`[KPI] kpiDaily ${docId} updated: totalCalls=${callsTotal}, totalTalkTime=${totalTalkTimeSeconds}s, callsOver5Min=${callsOver5Min}`);
  } catch (err) {
    console.error(`[KPI] Error updating daily aggregates for ${handlerId}:`, err);
  }
}

async function main() {
  console.log("1. Fetching today's logical calls with 0s duration...");
  const todayStr = new Date().toISOString().substring(0, 10);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${todayStr}T00:00:00.000Z`)
  );

  const callSnap = await getDocs(q);
  const zeroDurationCalls = [];

  callSnap.forEach(docSnap => {
    const call = docSnap.data();
    if (call.handlerId && (!call.durationSeconds || call.durationSeconds === 0)) {
      zeroDurationCalls.push({ id: docSnap.id, ...call });
    }
  });

  console.log(`Found ${zeroDurationCalls.length} calls with 0s duration to heal.`);

  const affectedRecruiters = new Set();
  let healedCount = 0;

  console.log("\n2. Fetching finalized details from Dialpad API and updating database...");
  for (const call of zeroDurationCalls) {
    // Resolve recruiter company to get correct Dialpad token
    let companyId = '';
    const staffSnap = await getDocs(collection(db, 'staff'));
    staffSnap.forEach(sDoc => {
      if (sDoc.id === call.handlerId) companyId = sDoc.data().companyId || '';
    });

    const token = getDialpadToken(companyId);
    if (!token) {
      console.warn(`No token found for call ${call.id}. Skipping.`);
      continue;
    }

    const primaryCallId = call.primaryCallId || call.id;
    console.log(`Fetching Dialpad details for callId ${primaryCallId} (Recruiter: ${call.handlerName})...`);

    try {
      const res = await fetch(`https://dialpad.com/api/v2/call/${primaryCallId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (res.status === 200) {
        const detailsData = await res.json();
        if (detailsData) {
          const durationMs = Number(detailsData.duration || 0);
          const durationSeconds = Math.round(durationMs / 1000);
          const talkTimeMs = Number(detailsData.talk_time || 0);
          const talkTimeSeconds = Math.round(talkTimeMs / 1000);
          const totalDurationMs = Number(detailsData.total_duration || 0);

          console.log(`-> Dialpad response: durationMs=${durationMs} (${durationSeconds}s), talkTimeMs=${talkTimeMs} (${talkTimeSeconds}s)`);
          
          if (durationSeconds > 0) {
            const callRef = doc(db, 'dialpad_calls', call.id);
            await setDoc(callRef, {
              durationMs,
              durationSeconds,
              talkTimeMs,
              talkTimeSeconds,
              totalDurationMs,
              connected: true
            }, { merge: true });

            healedCount++;
            affectedRecruiters.add(call.handlerId);
          } else {
            console.log(`-> Call is still showing 0 duration in Dialpad (e.g. missed/ringing).`);
          }
        }
      } else {
        console.error(`-> Failed to fetch call details. HTTP Status: ${res.status}`);
      }
    } catch (err) {
      console.error(`-> Error fetching call details for ${primaryCallId}:`, err);
    }
    // Rate limit buffer
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\nHealed duration for ${healedCount} call documents.`);

  if (affectedRecruiters.size > 0) {
    console.log(`\n3. Recalculating aggregates for affected recruiters: ${Array.from(affectedRecruiters).join(', ')}`);
    for (const rId of affectedRecruiters) {
      await updateKpiDaily(rId, todayStr);
    }
  }

  console.log("\nSelf-healing durations sweep finished successfully!");
}

main().catch(console.error);
