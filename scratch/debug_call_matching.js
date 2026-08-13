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
  const start = "2026-08-10";
  const end = "2026-08-10";
  console.log(`Diagnostic: Checking document IDs for ${start}...`);

  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', start),
      where('dateStarted', '<=', end + 'T23:59:59Z')
    );
    const snap = await getDocs(q);
    
    console.log(`\nFound ${snap.size} total call documents.`);
    
    snap.forEach(docSnap => {
      const d = docSnap.data();
      console.log(`Doc ID: ${docSnap.id} | ConvID: ${d.conversationId} | PrimaryCallID: ${d.primaryCallId} | Time: ${d.dateStarted} | Handler: ${d.handlerName || 'None'} | Target: ${d.externalNumber} | Duration: ${d.durationSeconds}s`);
    });

  } catch (e) {
    console.error("Error running diagnostic:", e);
  }
  process.exit(0);
}

run();
