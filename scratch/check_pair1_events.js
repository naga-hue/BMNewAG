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
  const callIds = ["4960623875530752", "6726893358227456"];
  for (const callId of callIds) {
    console.log(`\n=== Events for Call ID: ${callId} ===`);
    try {
      const q = query(
        collection(db, 'dialpad_events'),
        where('callId', '==', callId)
      );
      const snap = await getDocs(q);
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`- Event: ${doc.id}`);
        console.log(`  State: ${d.state}`);
        console.log(`  masterCallId: ${d.masterCallId}`);
        console.log(`  entryPointCallId: ${d.entryPointCallId}`);
        console.log(`  operatorCallId: ${d.operatorCallId}`);
        console.log(`  Target:`, d.target);
      });
    } catch (e) {
      console.error(e);
    }
  }
  process.exit(0);
}

run();
