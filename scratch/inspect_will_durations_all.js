import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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

async function run() {
  const start = "2026-08-10";
  const end = "2026-08-10";
  const staffId = "staff-1782810939333-54-893"; // Will Champken

  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', start),
      where('dateStarted', '<=', end + 'T23:59:59Z')
    );
    const snap = await getDocs(q);
    const calls = [];
    snap.forEach(d => {
      const call = d.data();
      if (call.handlerId === staffId) {
        calls.push(call);
      }
    });

    console.log(`\nWill Champken's Call Durations on Aug 10 (${calls.length} calls):`);
    
    let sumDuration = 0;
    let sumTalkTime = 0;
    let sumTotalDurationMs = 0;

    calls.forEach((c, idx) => {
      const dur = c.durationSeconds || 0;
      const talk = c.talkTimeSeconds || 0;
      const totalDur = c.totalDurationMs ? Math.round(c.totalDurationMs / 1000) : 0;

      sumDuration += dur;
      sumTalkTime += talk;
      sumTotalDurationMs += totalDur;

      console.log(`[${idx+1}] Start: ${c.dateStarted} | durationSeconds: ${dur}s | talkTimeSeconds: ${talk}s | totalDurationMs/1000: ${totalDur}s`);
    });

    console.log(`\nTotals:`);
    console.log(`- Sum of durationSeconds: ${Math.floor(sumDuration/60)}m ${sumDuration%60}s (${sumDuration}s)`);
    console.log(`- Sum of talkTimeSeconds: ${Math.floor(sumTalkTime/60)}m ${sumTalkTime%60}s (${sumTalkTime}s)`);
    console.log(`- Sum of totalDurationMs: ${Math.floor(sumTotalDurationMs/60)}m ${sumTotalDurationMs%60}s (${sumTotalDurationMs}s)`);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
