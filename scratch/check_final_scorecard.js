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
  const dateKey = '2026-08-11';
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  const docId = `${staffId}_${dateKey}`;
  
  console.log(`Checking kpiDaily doc: ${docId}...`);
  const snap = await getDoc(doc(db, 'kpiDaily', docId));
  if (snap.exists()) {
    console.log(JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('kpiDaily doc not found!');
  }
}

main().catch(console.error);
