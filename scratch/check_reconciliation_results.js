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

  console.log(`Checking Chelsea Rauch's calls for ${dateKey}...`);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  
  const snap = await getDocs(q);
  const chelseaCalls = [];
  const otherCalls = [];
  
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.handlerId === staffId) {
      chelseaCalls.push({ id: docSnap.id, ...data });
    } else {
      otherCalls.push({ id: docSnap.id, ...data });
    }
  });

  console.log(`Total calls found in dialpad_calls today:`);
  console.log(`- Chelsea Rauch: ${chelseaCalls.length} records`);
  console.log(`- Others: ${otherCalls.length} records`);

  console.log(`\nChelsea's Calls detail sorting by time:`);
  chelseaCalls.sort((a, b) => a.dateStarted.localeCompare(b.dateStarted));
  chelseaCalls.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c.id} | Time: ${c.dateStarted.substring(11, 19)} | Contact: ${c.externalName || c.externalNumber} | Dur: ${c.durationSeconds}s | Source: ${c.source || 'webhook'}`);
  });

  // Let's check for the missing block 09:30 - 10:20
  console.log(`\nChecking specific expected missing calls block (09:30 - 10:20):`);
  const missingSearch = [
    'Lee Norton', 'Matt Harper', 'Olga Gavrilova', 'Oliver Phillips',
    'Robert Hickman', 'Udeh', 'Zuzana Kopcanova', 'Emily Cross',
    'Moh Dadashzadeh', 'Marius Mureseanu'
  ];

  chelseaCalls.forEach(c => {
    const timeStr = c.dateStarted.substring(11, 16); // HH:MM
    const name = c.externalName || '';
    const match = missingSearch.some(s => name.includes(s));
    if (match || (timeStr >= '09:30' && timeStr <= '10:20')) {
      console.log(`-> MATCHED call: ${c.dateStarted.substring(11, 19)} | Name: ${name} | ID: ${c.id} | Dur: ${c.durationSeconds}s | Source: ${c.source}`);
    }
  });
}

main().catch(console.error);
