import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

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
  console.log("=== CHECKING FIREBASE FOR WEBHOOK EVENTS AND CALL LOGS ===");

  // 1. Check dialpad_events (raw webhook notifications)
  console.log("\n--- Latest 5 documents in dialpad_events ---");
  try {
    const eventsQuery = query(collection(db, 'dialpad_events'), orderBy('receivedAt', 'desc'), limit(5));
    const snap = await getDocs(eventsQuery);
    if (snap.empty) {
      console.log("No events found in dialpad_events.");
    } else {
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`- Event ID: ${doc.id}`);
        console.log(`  Received At: ${d.receivedAt}`);
        console.log(`  Event Type: ${d.event?.event_type || 'N/A'}`);
        console.log(`  Call ID: ${d.event?.call?.call_id || 'N/A'}`);
        console.log(`  State: ${d.event?.call?.state || 'N/A'}`);
      });
    }
  } catch (e) {
    console.error("Error reading dialpad_events:", e.message);
  }

  // 2. Check dialpad_calls (processed live calls)
  console.log("\n--- Latest 5 documents in dialpad_calls ---");
  try {
    const callsQuery = query(collection(db, 'dialpad_calls'), orderBy('dateStarted', 'desc'), limit(5));
    const snap = await getDocs(callsQuery);
    if (snap.empty) {
      console.log("No calls found in dialpad_calls.");
    } else {
      snap.forEach(doc => {
        const d = doc.data();
        console.log(`- Call ID: ${doc.id}`);
        console.log(`  Date Started: ${d.dateStarted}`);
        console.log(`  Handler Name: ${d.handlerName}`);
        console.log(`  Direction: ${d.direction}`);
        console.log(`  Duration: ${d.durationSeconds}s`);
        console.log(`  State: ${d.state}`);
      });
    }
  } catch (e) {
    console.error("Error reading dialpad_calls:", e.message);
  }
  
  process.exit(0);
}

run();
