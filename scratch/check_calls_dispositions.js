import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';

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
  console.log("Checking dispositions in dialpad_calls...");
  try {
    const snap = await getDocs(collection(db, 'dialpad_calls'));
    let foundCount = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.disposition) {
        console.log(`- Call: ${docSnap.id} | Disposition: ${JSON.stringify(data.disposition)}`);
        foundCount++;
      }
    });
    console.log(`Total calls with disposition: ${foundCount}`);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
