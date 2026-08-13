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

  console.log(`Searching for ANY call >= 5 minutes (300s) today...`);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  
  const snap = await getDocs(q);
  let count = 0;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.durationSeconds >= 300) {
      count++;
      console.log(`[${count}] Doc ID: ${docSnap.id} | Recruiter: ${data.handlerName} (${data.handlerId}) | Time (UTC): ${data.dateStarted.substring(11, 19)} | Contact: ${data.externalName} | Dur: ${data.durationSeconds}s | Source: ${data.source}`);
    }
  });

  console.log(`Found ${count} calls >= 5 mins today.`);
}

main().catch(console.error);
