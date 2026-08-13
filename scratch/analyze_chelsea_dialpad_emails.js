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
  console.log("Analyzing all 137 calls today for Chelsea matching patterns...");
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11')
  );

  const snap = await getDocs(q);
  let matchedCount = 0;
  
  snap.forEach(d => {
    const call = d.data();
    
    // Check if the handlerName, handlerEmail, externalName, target.name or target.email has 'chelsea' or 'crauch' or 'rauch'
    const matchName = (call.handlerName || '').toLowerCase().includes('chelsea') || 
                      (call.handlerEmail || '').toLowerCase().includes('chelsea') || 
                      (call.handlerEmail || '').toLowerCase().includes('crauch') ||
                      (call.handlerEmail || '').toLowerCase().includes('rauch');
                      
    const matchTarget = (call.target?.name || '').toLowerCase().includes('chelsea') ||
                        (call.target?.email || '').toLowerCase().includes('chelsea') ||
                        (call.target?.email || '').toLowerCase().includes('crauch') ||
                        (call.target?.email || '').toLowerCase().includes('rauch');

    if (matchName || matchTarget) {
      matchedCount++;
      console.log(`[Call #${matchedCount}] ID: ${d.id}`);
      console.log(`  dateStarted: ${call.dateStarted}`);
      console.log(`  handlerId: "${call.handlerId}"`);
      console.log(`  handlerName: "${call.handlerName}"`);
      console.log(`  handlerEmail: "${call.handlerEmail}"`);
      console.log(`  direction: "${call.direction}"`);
      console.log(`  durationSeconds: ${call.durationSeconds}`);
      console.log(`  target.name: "${call.target?.name}"`);
      console.log(`  target.email: "${call.target?.email}"`);
      console.log(`  externalNumber: "${call.externalNumber}"`);
      console.log(`  externalName: "${call.externalName}"`);
    }
  });

  console.log(`\nTotal matched calls for Chelsea Rauch: ${matchedCount}`);
}

main().catch(console.error);
