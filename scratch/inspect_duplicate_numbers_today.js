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
  console.log(`Checking for repeat dials to the same number today (${start})...`);

  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', start),
      where('dateStarted', '<=', end + 'T23:59:59Z')
    );
    const snap = await getDocs(q);
    const calls = [];
    snap.forEach(d => {
      calls.push(d.data());
    });

    // Group calls by Recruiter + Phone Number
    const grouped = {};
    calls.forEach(c => {
      const rec = c.handlerName || 'None';
      const num = c.externalNumber || 'Unknown';
      const key = `${rec} -> ${num}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    console.log('\nRepeat dials (recruiter calling the same number >= 2 times today):');
    let found = false;
    for (const [key, callList] of Object.entries(grouped)) {
      if (callList.length >= 2) {
        found = true;
        console.log(`\n${key}:`);
        callList.forEach(c => {
          console.log(`  - ConvID: ${c.conversationId} | CallID: ${c.primaryCallId} | Time: ${c.dateStarted} | Duration: ${c.durationSeconds}s | Status: ${c.callStatus}`);
        });
      }
    }

    if (!found) {
      console.log('No repeat dials found today.');
    }

  } catch (e) {
    console.error("Error inspecting:", e);
  }
  process.exit(0);
}

run();
