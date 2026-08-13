import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  console.log("Checking for call documents in dialpad_calls created/started after 08:29 UTC...");
  const q = query(
    collection(db, 'dialpad_calls'),
    orderBy('dateStarted', 'desc'),
    limit(10)
  );

  const snap = await getDocs(q);
  console.log(`Most recent call records:`);
  snap.forEach((d, idx) => {
    const c = d.data();
    console.log(`[${idx+1}] ID: ${d.id}, dateStarted: ${c.dateStarted}, handlerName: "${c.handlerName}", duration: ${c.durationSeconds}s, externalName: "${c.externalName}"`);
  });
}

main().catch(console.error);
