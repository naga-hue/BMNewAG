import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
  const dateKey = '2026-08-11';
  console.log(`Loading all calls in the database today (${dateKey})...`);
  
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  
  const snap = await getDocs(q);
  const calls = [];
  snap.forEach(d => {
    calls.push({ id: d.id, ...d.data() });
  });

  calls.sort((a, b) => a.dateStarted.localeCompare(b.dateStarted));
  console.log(`Total calls today across all staff: ${calls.length}`);
  
  console.log('\nTimeline of all calls today:');
  calls.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c.id} | Recruiter: ${c.handlerName || 'None'} | Time (UTC): ${c.dateStarted.substring(11, 19)} | Contact: ${c.externalName || c.externalNumber} | Dur: ${c.durationSeconds}s | Source: ${c.source || 'webhook'}`);
  });
}

main().catch(console.error);
