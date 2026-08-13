import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  console.log("Querying the 10 most recent webhook documents in dialpad_events...");
  const q = query(
    collection(db, 'dialpad_events'),
    orderBy('receivedAt', 'desc'),
    limit(15)
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} events:`);
  snap.forEach((d, idx) => {
    const ev = d.data();
    // receivedAt can be Firestore Timestamp or string
    let dateStr = ev.receivedAt;
    if (ev.receivedAt && ev.receivedAt.seconds) {
      dateStr = new Date(ev.receivedAt.seconds * 1000).toISOString();
    }
    console.log(`[${idx+1}] ID: ${d.id}`);
    console.log(`  receivedAt: ${dateStr}`);
    console.log(`  event_type: "${ev.event_type || ev.event || ''}"`);
    console.log(`  call_id: "${ev.call_id || (ev.payload && ev.payload.call_id) || ''}"`);
    console.log(`  payload state: "${ev.payload && ev.payload.state}"`);
    console.log(`  payload target email: "${ev.payload && ev.payload.target && ev.payload.target.email}"`);
  });
}

main().catch(console.error);
