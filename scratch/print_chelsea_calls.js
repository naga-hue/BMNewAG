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
  const todayStr = new Date().toISOString().substring(0, 10);
  console.log(`Querying today's calls for Chelsea Rauch (dateStarted >= ${todayStr})...`);
  
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${todayStr}T00:00:00.000Z`)
  );

  const snap = await getDocs(q);
  let totalDur = 0;
  let callCount = 0;

  snap.forEach(docSnap => {
    const call = docSnap.data();
    if (call.handlerId === 'staff-1782810939333-60-734') {
      callCount++;
      const dur = call.durationSeconds || 0;
      totalDur += dur;
      console.log(`[Call ${callCount}] ID: ${docSnap.id}, dateStarted: ${call.dateStarted}, durationSeconds: ${dur}s, talkTimeSeconds: ${call.talkTimeSeconds || 0}s, externalName: "${call.externalName || ''}"`);
    }
  });

  console.log(`\nChelsea Rauch: Total Calls = ${callCount}, Aggregated Duration = ${totalDur} seconds (${Math.round(totalDur/60)}m ${totalDur%60}s)`);
}

main().catch(console.error);
