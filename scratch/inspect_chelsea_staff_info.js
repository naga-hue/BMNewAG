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
  staffSnap.forEach(d => {
    const s = d.data();
    if (s.fullName && s.fullName.toLowerCase().includes('chelsea')) {
      console.log(`=== Chelsea Rauch Doc ID: ${d.id} ===`);
      console.log(JSON.stringify(s, null, 2));
    }
  });
}

main().catch(console.error);
