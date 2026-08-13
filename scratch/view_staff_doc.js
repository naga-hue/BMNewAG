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
  console.log('Loading all staff documents...');
  const snap = await getDocs(collection(db, 'staff'));
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });

  console.log(`Loaded ${list.length} total staff documents.`);
  console.log('\nRecruiter Tracking Flags and Statuses:');
  
  // Show Matthew Sparks, Emile Brand, Chelsea Rauch and a few others
  list.forEach(s => {
    const isTracked = s.isStaffDialpadTracked;
    const trackingType = typeof isTracked;
    const status = s.status;
    const isSparks = s.fullName && s.fullName.includes('Sparks');
    const isBrand = s.fullName && s.fullName.includes('Emile');
    const isRauch = s.fullName && s.fullName.includes('Chelsea');
    
    if (isSparks || isBrand || isRauch || isTracked === true || isTracked === 'true' || s.isDialpadTracked === true || s.isDialpadTracked === 'true') {
      console.log(` - ID: ${s.id.padEnd(28)} | Name: ${s.fullName.padEnd(20)} | isStaffDialpadTracked: ${isTracked} (Type: ${trackingType}) | isDialpadTracked: ${s.isDialpadTracked} | status: ${status}`);
    }
  });
}

main().catch(console.error);
