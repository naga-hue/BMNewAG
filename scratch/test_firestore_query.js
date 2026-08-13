import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

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
  const start = '2026-08-03';
  const end = '2026-08-09';
  console.log(`Testing query for range ${start} to ${end}...`);
  try {
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', start),
      where('dateStarted', '<=', end + 'T23:59:59Z'),
      orderBy('dateStarted', 'desc'),
      limit(500)
    );
    const snap = await getDocs(q);
    console.log(`Success! Query returned ${snap.size} documents.`);
  } catch (e) {
    console.error("Query Failed with error:", e);
  }
  process.exit(0);
}

run();
