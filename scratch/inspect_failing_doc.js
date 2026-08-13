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
  const docId = "4834369882497024";
  console.log(`Inspecting document "dialpad_calls/${docId}"...`);
  
  const ref = doc(db, 'dialpad_calls', docId);
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const data = snap.data();
    console.log("Document exists! Fields and types:");
    for (const [key, value] of Object.entries(data)) {
      console.log(`- ${key}: Type = ${typeof value}, Value =`, JSON.stringify(value));
    }
  } else {
    console.log("Document does not exist yet.");
  }
}

main().catch(console.error);
