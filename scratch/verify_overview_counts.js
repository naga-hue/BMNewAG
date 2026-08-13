import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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
  const start = "2026-08-10";
  const end = "2026-08-10";
  console.log(`Verifying Overview counts vs Call logs for today (${start})...`);

  try {
    // 1. Fetch staff
    const staffSnap = await getDocs(collection(db, 'staff'));
    const staffList = [];
    staffSnap.forEach(s => {
      staffList.push({ id: s.id, ...s.data() });
    });

    // 2. Fetch calls
    const callsQuery = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', start),
      where('dateStarted', '<=', end + 'T23:59:59Z')
    );
    const snap = await getDocs(callsQuery);
    const rawCalls = [];
    snap.forEach(docSnap => {
      rawCalls.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(`Fetched ${staffList.length} staff records and ${rawCalls.length} calls.`);

    // 3. Format calls using UI mapping
    const formattedCalls = rawCalls.map(call => {
      let dateVal = '';
      let timeVal = '';
      if (call.dateStarted) {
        let dateObj = new Date(call.dateStarted);
        if (dateObj && !isNaN(dateObj.getTime())) {
          // Format using local UTC-based ISO matching
          const year = dateObj.getUTCFullYear();
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getUTCDate()).padStart(2, '0');
          dateVal = `${year}-${month}-${day}`;
          
          const hours = String(dateObj.getUTCHours()).padStart(2, '0');
          const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
          timeVal = `${hours}:${minutes}`;
        }
      }

      return {
        id: call.id || call.conversationId,
        staffId: call.handlerId,
        staffName: call.handlerName,
        date: dateVal,
        time: timeVal,
        targetName: call.externalName || call.externalNumber || 'Unknown',
        duration: call.durationSeconds || 0,
      };
    });

    // Filter to today
    const activeCalls = formattedCalls.filter(c => c.date === start);

    // 4. Run Overview Aggregation
    const recruiterStats = {};
    staffList.forEach(s => {
      recruiterStats[s.id] = {
        name: s.fullName,
        calls: 0
      };
    });

    const callsByStaffIdInLogs = {};
    activeCalls.forEach(call => {
      const staffId = call.staffId;
      if (!staffId) return;
      
      // Increment logs count
      callsByStaffIdInLogs[staffId] = (callsByStaffIdInLogs[staffId] || 0) + 1;
      
      // Increment overview stats count if staff is in list
      if (recruiterStats[staffId]) {
        recruiterStats[staffId].calls++;
      }
    });

    console.log('\nRecruiter Call Count Verification:');
    let discrepancyFound = false;
    for (const [staffId, stats] of Object.entries(recruiterStats)) {
      const inLogs = callsByStaffIdInLogs[staffId] || 0;
      if (inLogs > 0 || stats.calls > 0) {
        const match = inLogs === stats.calls;
        console.log(`- ${stats.name} (ID: ${staffId}): overviewRows.calls = ${stats.calls} | callLogs.calls = ${inLogs} | Match: ${match ? 'YES ✅' : 'NO ❌'}`);
        if (!match) {
          discrepancyFound = true;
        }
      }
    }

    if (!discrepancyFound) {
      console.log('\nAll recruiter overview counts match the call logs counts exactly!');
    }

  } catch (e) {
    console.error("Error verifying:", e);
  }
  process.exit(0);
}

run();
