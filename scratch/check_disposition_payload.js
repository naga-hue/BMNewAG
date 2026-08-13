import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';

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
  console.log("Checking disposition events in dialpad_events...");
  try {
    const q = query(
      collection(db, 'dialpad_events'),
      where('state', '==', 'dispositions'),
      limit(5)
    );
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} disposition events.`);
    snap.forEach(doc => {
      console.log(`\nEvent ID: ${doc.id}`);
      const data = doc.data();
      console.log(`callDispositions:`, data.callDispositions);
      console.log(`rawPayload.dispositions:`, data.rawPayload?.dispositions);
      console.log(`rawPayload.call_dispositions:`, data.rawPayload?.call_dispositions);
    });
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
