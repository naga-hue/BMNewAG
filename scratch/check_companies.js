import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  console.log("Checking companies collection...");
  try {
    const q = collection(db, 'companies');
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No companies found.");
    } else {
      snap.forEach(doc => {
        console.log(`Company ID: ${doc.id} -> Name: ${doc.data().name}`);
      });
    }
  } catch (e) {
    console.error("Error querying companies:", e);
  }
  process.exit(0);
}

run();
