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
  const todayStr = '2026-08-11';
  console.log(`Fetching calls for Chelsea Rauch on ${todayStr}...`);
  
  // Chelsea's ID: staff-1782810939333-60-734
  const staffId = 'staff-1782810939333-60-734';
  
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', todayStr),
    where('dateStarted', '<=', todayStr + 'T23:59:59Z')
  );
  
  const snap = await getDocs(q);
  const chelseaCalls = [];
  
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.handlerId === staffId) {
      chelseaCalls.push({
        id: docSnap.id,
        dateStarted: data.dateStarted,
        direction: data.direction,
        duration: data.durationSeconds || 0,
        talkTime: data.talkTimeSeconds || 0,
        totalDuration: data.totalDurationMs ? data.totalDurationMs / 1000 : 0,
        state: data.callStatus || (data.connected ? 'Connected' : 'No Answer'),
        externalName: data.externalName || '',
        externalNumber: data.externalNumber || '',
        recordingUrl: data.recordingUrl || ''
      });
    }
  });
  
  chelseaCalls.sort((a, b) => a.dateStarted.localeCompare(b.dateStarted));
  
  console.log(`Found ${chelseaCalls.length} calls in Firestore for Chelsea Rauch.`);
  console.table(chelseaCalls.map((c, i) => ({
    Index: i + 1,
    CallId: c.id,
    Time: c.dateStarted.substring(11, 16),
    Dir: c.direction,
    DurSec: c.duration,
    TalkTimeSec: c.talkTime,
    TotalDurSec: c.totalDuration,
    State: c.state,
    Number: c.externalNumber
  })));
  
  const totalDurationSum = chelseaCalls.reduce((acc, c) => acc + c.duration, 0);
  const talkTimeSum = chelseaCalls.reduce((acc, c) => acc + c.talkTime, 0);
  console.log(`Total duration sum: ${Math.floor(totalDurationSum/60)}m ${totalDurationSum%60}s (${totalDurationSum}s)`);
  console.log(`Total talk time sum: ${Math.floor(talkTimeSum/60)}m ${talkTimeSum%60}s (${talkTimeSum}s)`);
}

main().catch(console.error);
