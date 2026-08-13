import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

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
  console.log("Querying dialpad_calls for today (dateStarted >= '2026-08-11')...");
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11T08:29:00.000Z')
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} logical calls starting after 08:29 UTC:`);
  snap.forEach(d => {
    const call = d.data();
    console.log(`- ID: ${d.id}, dateStarted: ${call.dateStarted}, handlerName: "${call.handlerName}", duration: ${call.durationSeconds}s, externalName: "${call.externalName}"`);
  });
}

main().catch(console.error);
