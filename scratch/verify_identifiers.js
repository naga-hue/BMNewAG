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
  const docId = 'PkBwOteUFpSvYppDbsWF';
  console.log(`Checking crm_activities document with ID ${docId}...`);
  const ref = doc(db, 'crm_activities', docId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log('[CRM Activity Found]:', JSON.stringify(snap.data(), null, 2));
  } else {
    console.log('[CRM Activity Not Found]');
  }
}

main().catch(console.error);
