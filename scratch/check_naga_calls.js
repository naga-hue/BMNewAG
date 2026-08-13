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
  console.log("=== CHECKING NAGENDRAN KANDASAMY CALLS TODAY ===");
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('handlerName', '==', 'Nagendran Kandasamy')
    );
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} total calls for Nagendran. Filtering for today (2026-08-10):`);
    snap.forEach(doc => {
      const d = doc.data();
      if (d.dateStarted && d.dateStarted.startsWith('2026-08-10')) {
        console.log(`- Call ID: ${doc.id}`);
        console.log(`  dateStarted: ${d.dateStarted}`);
        console.log(`  handlerId: ${d.handlerId}`);
        console.log(`  handlerName: ${d.handlerName}`);
        console.log(`  durationSeconds: ${d.durationSeconds}`);
      }
    });

    console.log("\n=== Checking kpiDaily for today ===");
    const kpiSnap = await getDocs(query(
      collection(db, 'kpiDaily'),
      where('staffName', '==', 'Nagendran Kandasamy'),
      where('date', '==', '2026-08-10')
    ));
    kpiSnap.forEach(doc => {
      console.log(`- KPI Doc ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
