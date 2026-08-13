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

async function main() {
  const docRef = doc(db, 'staff', 'staff-1782810939333-60-734');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log('Chelsea Rauch Staff Document:');
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('Document staff-1782810939333-60-734 not found.');
  }
}

main().catch(console.error);
