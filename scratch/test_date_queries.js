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
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  
  // Format 1 (Frontend style)
  const q1 = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', dateKey),
    where('dateStarted', '<=', dateKey + 'T23:59:59Z')
  );
  const snap1 = await getDocs(q1);
  let count1 = 0;
  snap1.forEach(doc => {
    if (doc.data().handlerId === staffId) count1++;
  });
  
  // Format 2 (Backend style)
  const q2 = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  const snap2 = await getDocs(q2);
  let count2 = 0;
  snap2.forEach(doc => {
    if (doc.data().handlerId === staffId) count2++;
  });
  
  console.log(`Query 1 (Frontend style: '>= 2026-08-11' and '<= 2026-08-11T23:59:59Z') returns ${count1} calls for Chelsea.`);
  console.log(`Query 2 (Backend style: '>= 2026-08-11T00:00:00' and '<= 2026-08-11T23:59:59.999Z') returns ${count2} calls for Chelsea.`);
  
  // Print dates of calls returned by Q1 but not Q2
  const ids2 = new Set();
  snap2.forEach(doc => ids2.add(doc.id));
  
  console.log('\nCalls returned by Q1 but NOT Q2:');
  snap1.forEach(doc => {
    const data = doc.data();
    if (data.handlerId === staffId && !ids2.has(doc.id)) {
      console.log(`ID: ${doc.id} | DateStarted: ${data.dateStarted} | Direction: ${data.direction}`);
    }
  });
}

main().catch(console.error);
