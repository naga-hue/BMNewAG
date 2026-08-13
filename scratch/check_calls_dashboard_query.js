import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

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
  const start = '2026-08-11';
  const end = '2026-08-11';

  console.log(`Simulating dashboard query: start='${start}', end='${end}'`);
  
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', start),
    where('dateStarted', '<=', end + 'T23:59:59Z')
  );

  const snapshot = await getDocs(q);
  console.log(`Query returned ${snapshot.size} calls.`);
  
  const calls = [];
  snapshot.forEach(doc => {
    calls.push({ id: doc.id, ...doc.data() });
  });

  // Sort descending by dateStarted
  calls.sort((a, b) => (b.dateStarted || '').localeCompare(a.dateStarted || ''));

  console.log("Simulating formattedLiveCalls filter (.filter(call => call.handlerId && ...)):");
  const filtered = calls.filter(call => {
    const hasStaffId = !!call.handlerId;
    console.log(`Call ID: ${call.id}, dateStarted: ${call.dateStarted}, handlerName: "${call.handlerName}", handlerId: "${call.handlerId}", hasStaffId: ${hasStaffId}, externalName: "${call.externalName || ''}"`);
    return hasStaffId;
  });

  console.log(`\nFiltered count: ${filtered.length} out of ${calls.length} calls.`);
}

main().catch(console.error);
