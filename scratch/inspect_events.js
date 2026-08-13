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
  const callId = "5541694448541696";
  try {
    const q = query(
      collection(db, 'dialpad_events'),
      where('callId', '==', callId)
    );
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} events for callId ${callId}:`);
    const events = [];
    snap.forEach(d => {
      events.push(d.data());
    });

    events.sort((a, b) => a.eventTimestamp - b.eventTimestamp);
    events.forEach(e => {
      console.log(`- State: "${e.state}" | Timestamp: ${e.eventTimestamp} | DateStarted: ${e.dateStarted} | DateEnded: ${e.dateEnded || 'N/A'} | Duration: ${e.duration}s`);
    });
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
