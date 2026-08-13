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
  console.log("Querying calls from dialpad_calls...");
  try {
    const qOldest = query(collection(db, 'dialpad_calls'), orderBy('dateStarted', 'asc'), limit(1));
    const qNewest = query(collection(db, 'dialpad_calls'), orderBy('dateStarted', 'desc'), limit(1));
    
    const oldestSnap = await getDocs(qOldest);
    const newestSnap = await getDocs(qNewest);
    
    console.log("Oldest call in database:");
    oldestSnap.forEach(doc => {
      console.log(doc.id, "->", doc.data().dateStarted);
    });

    console.log("\nNewest call in database:");
    newestSnap.forEach(doc => {
      console.log(doc.id, "->", doc.data().dateStarted);
    });

    // Also get count of calls
    const allSnap = await getDocs(collection(db, 'dialpad_calls'));
    console.log(`\nTotal calls currently in dialpad_calls: ${allSnap.size}`);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
