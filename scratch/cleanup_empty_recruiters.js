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
  console.log("Loading all calls to identify unassociated routing legs...");
  try {
    const snap = await getDocs(collection(db, 'dialpad_calls'));
    console.log(`Loaded ${snap.size} call documents.`);

    let deleteCount = 0;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      // If there is no handler/recruiter mapped to this call doc
      if (!data.handlerId && !data.handlerName) {
        console.log(`- Deleting unassociated call leg: ID=${docSnap.id} (External: ${data.externalNumber}, Duration: ${data.durationSeconds}s)`);
        await deleteDoc(doc(db, 'dialpad_calls', docSnap.id));
        deleteCount++;
      }
    }
    console.log(`\nCleanup finished. Deleted ${deleteCount} unassociated call records.`);
  } catch (e) {
    console.error("Error running cleanup:", e);
  }
  process.exit(0);
}

run();
