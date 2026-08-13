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
  const callId = "6639992613838848";
  try {
    console.log("--- INSPECTING CALL DOCUMENT ---");
    const callSnap = await getDoc(doc(db, 'dialpad_calls', callId));
    if (callSnap.exists()) {
      console.log(JSON.stringify(callSnap.data(), null, 2));
    } else {
      console.log("Call doc not found.");
    }

    console.log("\n--- INSPECTING RELATED CALL LEGS ---");
    const legsSnap = await getDocs(query(collection(db, 'dialpad_call_legs'), where('conversationId', '==', callId)));
    console.log(`Found ${legsSnap.size} legs.`);
    legsSnap.forEach(d => {
      console.log(`Leg ID: ${d.id}`);
      console.log(JSON.stringify(d.data(), null, 2));
    });
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
