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

async function main() {
  const sparksId = 'staff-1782810939333-48-596'; // Matthew Sparks
  const todayStr = '2026-08-12';

  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', todayStr),
    where('dateStarted', '<=', todayStr + 'T23:59:59Z')
  );

  console.log(`Querying dialpad_calls for date ${todayStr}...`);
  const snap = await getDocs(q);
  const calls = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.handlerId === sparksId) {
      calls.push({ id: d.id, ...data });
    }
  });

  console.log(`Found ${calls.length} calls in Firestore for Matthew Sparks today:`);
  calls.sort((a, b) => b.dateStarted.localeCompare(a.dateStarted));
  calls.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c.id} | Time: ${c.dateStarted.substring(11, 19)} | Contact: ${c.externalName} (${c.externalNumber}) | Connected: ${c.connected} | Dur: ${c.durationSeconds}s | Disp: ${c.disposition}`);
  });
}

main().catch(console.error);
