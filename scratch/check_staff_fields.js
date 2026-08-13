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

async function run() {
  console.log("Listing all staff members...");
  try {
    const snap = await getDocs(collection(db, 'staff'));
    snap.forEach(docSnap => {
      const data = docSnap.data();
      console.log(`- ${docSnap.id} | Name: ${data.fullName} | Email: ${data.businessEmail} | Aliases: ${data.additionalEmails || 'none'}`);
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
