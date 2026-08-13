import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

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

async function main() {
  console.log("Querying dialpad_events for call 5167458622054400...");
  
  const q = query(collection(db, 'dialpad_events'));
  const snap = await getDocs(q);
  
  let found = false;
  snap.forEach(docSnap => {
    if (docSnap.id.startsWith('5167458622054400')) {
      found = true;
      console.log(`\nDocument ID: "${docSnap.id}"`);
      console.log("Content:", JSON.stringify(docSnap.data(), null, 2));
    }
  });

  if (!found) {
    console.log("No raw event document found starting with 5167458622054400.");
  }
}

main().catch(console.error);
