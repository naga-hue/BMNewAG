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
  console.log("Querying calls for Charlie Wills or Ephraim Aluge...");
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', '2026-08-10T08:10:00Z'),
      where('dateStarted', '<=', '2026-08-10T08:22:00Z')
    );
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} calls:`);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`\n- Doc ID: ${doc.id}`);
      console.log(`  conversationId: ${d.conversationId}`);
      console.log(`  primaryCallId: ${d.primaryCallId}`);
      console.log(`  entryPointCallId: ${d.entryPointCallId || 'N/A'}`);
      console.log(`  operatorCallId: ${d.operatorCallId || 'N/A'}`);
      console.log(`  masterCallId: ${d.masterCallId || 'N/A'}`);
      console.log(`  Date Started: ${d.dateStarted}`);
      console.log(`  Direction: ${d.direction}`);
      console.log(`  Handler: ${d.handlerName} (${d.handlerId || 'N/A'})`);
      console.log(`  External: ${d.externalName} (${d.externalNumber})`);
      console.log(`  Duration: ${d.durationSeconds}s`);
      console.log(`  Was Recorded: ${d.wasRecorded}`);
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
