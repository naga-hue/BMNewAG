import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
  console.log("Searching for staff named Bianca...");
  const snap = await getDocs(collection(db, 'staff'));
  snap.forEach(d => {
    const s = d.data();
    if (s.fullName.toLowerCase().includes('bianca')) {
      console.log(`Matched Staff: ID="${d.id}", fullName="${s.fullName}", businessEmail="${s.businessEmail || ''}", personalEmail="${s.personalEmail || ''}", additionalEmails="${s.additionalEmails || ''}"`);
    }
  });
}

main().catch(console.error);
