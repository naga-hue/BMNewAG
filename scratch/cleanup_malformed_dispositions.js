import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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
  console.log("Loading all calls with malformed dispositions...");
  try {
    const snap = await getDocs(collection(db, 'dialpad_calls'));
    let cleanCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const disposition = data.disposition || '';

      // Check if it contains characters spread out (like "C, a, n, d, i, t, e")
      if (disposition.includes(', ') && disposition.length > 5) {
        const cleaned = disposition.split(', ').join('');
        console.log(`- Fixing call ${docSnap.id}: "${disposition}" -> "${cleaned}"`);
        await updateDoc(doc(db, 'dialpad_calls', docSnap.id), {
          disposition: cleaned
        });
        cleanCount++;
      }
    }
    console.log(`\nCleanup finished. Repaired ${cleanCount} malformed dispositions.`);
  } catch (e) {
    console.error("Error during cleanup:", e);
  }
  process.exit(0);
}

run();
