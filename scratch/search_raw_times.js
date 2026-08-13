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
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  const dateKey = '2026-08-11';

  console.log(`Loading all calls today for Chelsea Rauch...`);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  
  const snap = await getDocs(q);
  const calls = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.handlerId === staffId) {
      calls.push({ id: d.id, ...data });
    }
  });

  calls.sort((a, b) => a.dateStarted.localeCompare(b.dateStarted));
  console.log(`Found ${calls.length} calls. Timeline:`);
  calls.forEach((c, idx) => {
    console.log(`[${idx + 1}] Time (UTC): ${c.dateStarted.substring(11, 19)} | Contact: ${c.externalName || c.externalNumber} | Dur: ${c.durationSeconds}s | Source: ${c.source || 'webhook'}`);
  });
}

main().catch(console.error);
