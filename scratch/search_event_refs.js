import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  const searchId = "5150469853749248";
  console.log(`Searching all events for reference to ${searchId}...`);
  try {
    const snap = await getDocs(collection(db, 'dialpad_events'));
    let foundCount = 0;
    snap.forEach(doc => {
      const dataStr = JSON.stringify(doc.data());
      if (doc.id.includes(searchId) || dataStr.includes(searchId)) {
        console.log(`\nFound in Event: ${doc.id}`);
        const d = doc.data();
        console.log(`  State: ${d.state}`);
        console.log(`  callId: ${d.callId}`);
        console.log(`  masterCallId: ${d.masterCallId}`);
        console.log(`  entryPointCallId: ${d.entryPointCallId}`);
        console.log(`  operatorCallId: ${d.operatorCallId}`);
        foundCount++;
      }
    });
    console.log(`\nFinished. Found references in ${foundCount} events.`);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
