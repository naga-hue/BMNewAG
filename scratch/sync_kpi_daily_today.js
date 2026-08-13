import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

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

async function run() {
  const dateKey = "2026-08-10";
  console.log(`Syncing daily KPI scoreboard stats for today: ${dateKey}...`);

  try {
    // 1. Query all calls started today
    const callsQ = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', `${dateKey}T00:00:00`),
      where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
    );
    const snap = await getDocs(callsQ);
    console.log(`Found ${snap.size} calls today.`);

    // Group by recruiter (handlerId)
    const groups = {};
    snap.forEach(docSnap => {
      const call = docSnap.data();
      const handlerId = call.handlerId;
      if (!handlerId) return; // Skip unassociated legs (already cleaned up anyway)

      if (!groups[handlerId]) {
        groups[handlerId] = [];
      }
      groups[handlerId].push(call);
    });

    // 2. Process each recruiter group and write to kpiDaily
    const handlerIds = Object.keys(groups);
    console.log(`Found call activity for ${handlerIds.length} recruiters today.`);

    for (const handlerId of handlerIds) {
      console.log(`\nProcessing recruiter ID: ${handlerId}...`);
      const calls = groups[handlerId];

      // Fetch staff details
      const staffDocSnap = await getDoc(doc(db, 'staff', handlerId));
      if (!staffDocSnap.exists()) {
        console.warn(`Staff profile not found for ${handlerId}`);
        continue;
      }
      const staff = staffDocSnap.data();

      let callsInbound = 0;
      let callsOutbound = 0;
      let callsTotal = 0;
      let totalTalkTimeSeconds = 0;
      let callsOver5Min = 0;
      let callsOver10Min = 0;

      calls.forEach(call => {
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

      const docId = `${handlerId}_${dateKey}`;
      const kpiData = {
        staffId: handlerId,
        staffName: staff.fullName || '',
        department: staff.department || '',
        email: staff.businessEmail || staff.personalEmail || '',
        date: dateKey,
        callsInbound,
        callsOutbound,
        callsTotal,
        totalTalkTimeSeconds,
        callsOver5Min,
        callsOver10Min,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(doc(db, 'kpiDaily', docId), kpiData, { merge: true });
      console.log(`Successfully updated kpiDaily doc ${docId}:`, kpiData);
    }

    console.log("\n🎉 Sync finished successfully!");
  } catch (e) {
    console.error("Error running sync script:", e);
  }
  process.exit(0);
}

run();
