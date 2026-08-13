import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  const staffSnap = await getDocs(collection(db, 'staff'));
  let chelsea = null;
  staffSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('chelsea')) {
      chelsea = { id: doc.id, ...data };
    }
  });

  if (chelsea) {
    console.log('Chelsea Rauch Staff Profile:');
    console.log(JSON.stringify(chelsea, null, 2));
  } else {
    console.log('Chelsea Rauch profile not found in staff collection.');
  }
}

main().catch(console.error);
