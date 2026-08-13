import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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
  try {
    // 1. Get Eileen Vermeulen in staff
    const staffSnap = await getDocs(collection(db, 'staff'));
    let eileenStaffId = '';
    staffSnap.forEach(d => {
      const s = d.data();
      if (s.fullName?.includes('Eileen')) {
        console.log(`Staff collection matches Eileen: document ID = "${d.id}", name = "${s.fullName}"`);
        eileenStaffId = d.id;
      }
    });

    // 2. Query calls for Eileen Vermeulen in dialpad_calls
    const callsSnap = await getDocs(query(collection(db, 'dialpad_calls'), where('handlerName', '==', 'Eileen Vermeulen')));
    console.log(`\nFound ${callsSnap.size} calls for "Eileen Vermeulen" in dialpad_calls:`);
    if (callsSnap.size > 0) {
      const firstCall = callsSnap.docs[0].data();
      console.log(`First call document handlerId = "${firstCall.handlerId}", handlerName = "${firstCall.handlerName}"`);
    }

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
