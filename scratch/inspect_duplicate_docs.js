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
  const ids = ['4801112944091136', '6185401573122048'];
  for (const id of ids) {
    console.log(`\n=== Document ID: ${id} ===`);
    const snap = await getDoc(doc(db, 'dialpad_calls', id));
    if (snap.exists()) {
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('Not found in dialpad_calls');
    }
  }
}

main().catch(console.error);
