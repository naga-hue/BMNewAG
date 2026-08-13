import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  const callId = "6031397710929920";
  console.log(`Checking details for call ID: ${callId}`);
  try {
    const docRef = doc(db, 'dialpad_calls', callId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.log("Document does not exist in dialpad_calls.");
    } else {
      console.log("Document data:", JSON.stringify(snap.data(), null, 2));
    }
  } catch (e) {
    console.error("Error fetching doc:", e);
  }
  process.exit(0);
}

run();
