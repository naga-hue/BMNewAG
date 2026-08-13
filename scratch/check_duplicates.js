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
  console.log("Querying calls for 2026-08-10...");
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', '2026-08-10'),
      where('dateStarted', '<=', '2026-08-10T23:59:59Z')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No calls found for 2026-08-10.");
    } else {
      console.log(`Found ${snap.size} calls:`);
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`\n- Doc ID: ${doc.id}`);
        console.log(`  conversationId: ${d.conversationId}`);
        console.log(`  primaryCallId: ${d.primaryCallId}`);
        console.log(`  Date Started: ${d.dateStarted}`);
        console.log(`  Handler: ${d.handlerName}`);
        console.log(`  External: ${d.externalName} (${d.externalNumber})`);
        console.log(`  Duration: ${d.durationSeconds}s`);
        console.log(`  Was Recorded: ${d.wasRecorded}`);
        console.log(`  recordingUrl: ${d.recordingUrl || 'N/A'}`);
      });
    }
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
