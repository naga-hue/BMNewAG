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
  const callId = "5038326873530368";
  console.log(`Querying raw events in dialpad_events for callId: ${callId}`);
  
  const q = query(
    collection(db, 'dialpad_events'),
    where('callId', '==', callId)
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} raw events:`);

  snap.forEach(d => {
    const ev = d.data();
    console.log(`\n--- Event ID: ${d.id} ---`);
    console.log(`state: "${ev.state}"`);
    console.log(`receivedAt: ${ev.receivedAt}`);
    console.log(`duration (top level): ${ev.duration}`);
    console.log(`totalDuration (top level): ${ev.totalDuration}`);
    console.log(`talkTime (top level): ${ev.talkTime}`);
    if (ev.rawPayload) {
      console.log(`rawPayload.duration: ${ev.rawPayload.duration}`);
      console.log(`rawPayload.total_duration: ${ev.rawPayload.total_duration}`);
      console.log(`rawPayload.talk_time: ${ev.rawPayload.talk_time}`);
    }
  });
}

main().catch(console.error);
