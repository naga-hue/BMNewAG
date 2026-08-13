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
  console.log("Querying calls for 2026-08-09...");
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', '2026-08-09'),
      where('dateStarted', '<=', '2026-08-09T23:59:59Z')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No calls found for 2026-08-09.");
    } else {
      console.log(`Found ${snap.size} calls:`);
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`\n- Call ID: ${doc.id}`);
        console.log(`  Date Started: ${d.dateStarted}`);
        console.log(`  Handler Name: ${d.handlerName}`);
        console.log(`  Direction: ${d.direction}`);
        console.log(`  Duration: ${d.durationSeconds}s`);
        console.log(`  Was Recorded: ${d.wasRecorded}`);
        console.log(`  Recording URL: ${d.recordingUrl || 'N/A'}`);
        console.log(`  Recording URLs: ${JSON.stringify(d.recordingUrls || [])}`);
        console.log(`  Transcription ID: ${d.transcriptionId || 'N/A'}`);
        console.log(`  Transcript Status: ${d.transcriptStatus || 'N/A'}`);
        console.log(`  Transcript (length): ${d.transcript ? d.transcript.length : 0}`);
      });
    }
  } catch (e) {
    console.error("Error querying calls:", e);
  }
  process.exit(0);
}

run();
