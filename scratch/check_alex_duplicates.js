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
  console.log("Querying calls for Weidong Wang...");
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('externalNumber', '==', '+447926127111') // Weidong Wang's number
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      // Let's search by date started instead
      console.log("No calls found by phone number. Searching by date started...");
      const q2 = query(
        collection(db, 'dialpad_calls'),
        where('dateStarted', '>=', '2026-08-10T07:04:00'),
        where('dateStarted', '<=', '2026-08-10T07:05:00')
      );
      const snap2 = await getDocs(q2);
      printSnap(snap2);
    } else {
      printSnap(snap);
    }
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

function printSnap(snap) {
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
    console.log(`  adminRecordingUrls: ${JSON.stringify(d.adminRecordingUrls || [])}`);
  });
}

run();
