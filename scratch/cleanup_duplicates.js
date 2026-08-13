import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

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
  console.log("Loading all calls to identify duplicates...");
  try {
    const snap = await getDocs(collection(db, 'dialpad_calls'));
    console.log(`Loaded ${snap.size} call documents.`);

    const callMap = {};
    snap.forEach(docSnap => {
      callMap[docSnap.id] = docSnap.data();
    });

    let deleteCount = 0;
    for (const [id, data] of Object.entries(callMap)) {
      const conversationId = data.conversationId;
      // If the document ID is different from its conversationId
      if (conversationId && id !== conversationId) {
        // If the consolidated conversation document also exists in Firestore
        if (callMap[conversationId]) {
          console.log(`\nStale call leg doc detected:`);
          console.log(`- Stale Doc ID: ${id} (Duration: ${data.durationSeconds}s, Recorded: ${data.wasRecorded})`);
          console.log(`- Keep Main Doc ID: ${conversationId} (Duration: ${callMap[conversationId].durationSeconds}s, Recorded: ${callMap[conversationId].wasRecorded})`);
          
          await deleteDoc(doc(db, 'dialpad_calls', id));
          console.log(`Deleted stale doc ID ${id}`);
          deleteCount++;
        }
      }
    }
    console.log(`\nCleanup finished. Deleted ${deleteCount} stale duplicate records.`);
  } catch (e) {
    console.error("Error running cleanup:", e);
  }
  process.exit(0);
}

run();
