import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

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
  console.log("Checking recently received webhook events in dialpad_events (last 30 documents)...");
  const q = query(
    collection(db, 'dialpad_events'),
    orderBy('receivedAt', 'desc'),
    limit(30)
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} recent events:`);
  snap.forEach((d, idx) => {
    const ev = d.data();
    console.log(`[${idx+1}] ID: ${d.id}, receivedAt: ${ev.receivedAt}, state: "${ev.state}", call_id: "${ev.callId}", duration: ${ev.duration}s, direction: "${ev.direction}", handlerName: "${ev.rawPayload?.target?.name || ''}"`);
  });
}

main().catch(console.error);
