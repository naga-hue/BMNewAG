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
  console.log("Loading all calls to identify duplicates by primary ID...");
  try {
    const snap = await getDocs(collection(db, 'dialpad_calls'));
    console.log(`Loaded ${snap.size} call documents.`);

    const groups = {};
    snap.forEach(docSnap => {
      const data = docSnap.data();
      // Group by primaryCallId, falling back to conversationId or document ID
      const primaryId = data.primaryCallId || data.conversationId || docSnap.id;
      if (!groups[primaryId]) groups[primaryId] = [];
      groups[primaryId].push({ id: docSnap.id, data });
    });

    let deleteCount = 0;
    for (const [primaryId, list] of Object.entries(groups)) {
      if (list.length > 1) {
        console.log(`\nDuplicate group found for primaryId ${primaryId}:`);
        
        // Sort to keep the best consolidated document:
        // Prioritize: 1. wasRecorded = true, 2. longest duration
        list.sort((a, b) => {
          if (a.data.wasRecorded !== b.data.wasRecorded) {
            return b.data.wasRecorded ? 1 : -1;
          }
          return (b.data.durationSeconds || 0) - (a.data.durationSeconds || 0);
        });

        const keepDoc = list[0];
        console.log(`- KEEP: ID=${keepDoc.id} (Duration=${keepDoc.data.durationSeconds}s, Recorded=${keepDoc.data.wasRecorded})`);

        for (let i = 1; i < list.length; i++) {
          const deleteDocItem = list[i];
          console.log(`- DELETE: ID=${deleteDocItem.id} (Duration=${deleteDocItem.data.durationSeconds}s, Recorded=${deleteDocItem.data.wasRecorded})`);
          await deleteDoc(doc(db, 'dialpad_calls', deleteDocItem.id));
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
