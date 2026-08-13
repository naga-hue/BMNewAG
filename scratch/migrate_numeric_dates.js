import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

function toISO(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const dObj = new Date(val);
    return !isNaN(dObj.getTime()) ? dObj.toISOString() : val;
  }
  return val;
}

async function run() {
  console.log("Starting date format migration for dialpad_calls and dialpad_call_legs...");
  
  // 1. Migrate dialpad_calls
  const callsSnap = await getDocs(collection(db, 'dialpad_calls'));
  for (const docSnap of callsSnap.docs) {
    const data = docSnap.data();
    const updates = {};
    if (typeof data.dateStarted === 'number') {
      updates.dateStarted = toISO(data.dateStarted);
    }
    if (typeof data.dateConnected === 'number') {
      updates.dateConnected = toISO(data.dateConnected);
    }
    if (typeof data.dateEnded === 'number') {
      updates.dateEnded = toISO(data.dateEnded);
    }
    
    if (Object.keys(updates).length > 0) {
      console.log(`Updating call ${docSnap.id}:`, updates);
      await updateDoc(doc(db, 'dialpad_calls', docSnap.id), updates);
    }
  }

  // 2. Migrate dialpad_call_legs
  const legsSnap = await getDocs(collection(db, 'dialpad_call_legs'));
  for (const docSnap of legsSnap.docs) {
    const data = docSnap.data();
    const updates = {};
    if (typeof data.dateStarted === 'number') {
      updates.dateStarted = toISO(data.dateStarted);
    }
    if (typeof data.dateConnected === 'number') {
      updates.dateConnected = toISO(data.dateConnected);
    }
    if (typeof data.dateEnded === 'number') {
      updates.dateEnded = toISO(data.dateEnded);
    }
    
    if (Object.keys(updates).length > 0) {
      console.log(`Updating leg ${docSnap.id}:`, updates);
      await updateDoc(doc(db, 'dialpad_call_legs', docSnap.id), updates);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

run();
