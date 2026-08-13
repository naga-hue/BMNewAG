import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
  const callId = "5677617748320256";
  try {
    console.log(`Searching for call ID ${callId} in dialpad_calls...`);
    const docRef = doc(db, 'dialpad_calls', callId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log("Found call by Document ID!");
      console.log(JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log("Not found by Document ID. Querying collection by fields...");
      const q = query(collection(db, 'dialpad_calls'), where('conversationId', '==', callId));
      const qSnap = await getDocs(q);
      if (qSnap.size > 0) {
        console.log(`Found ${qSnap.size} calls by conversationId!`);
        qSnap.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
      } else {
        const q2 = query(collection(db, 'dialpad_calls'), where('primaryCallId', '==', callId));
        const qSnap2 = await getDocs(q2);
        if (qSnap2.size > 0) {
          console.log(`Found ${qSnap2.size} calls by primaryCallId!`);
          qSnap2.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
        } else {
          console.log("Call not found in dialpad_calls at all!");
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
