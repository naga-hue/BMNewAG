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
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  const dateKey = '2026-08-11';

  console.log(`Searching for Chelsea's call >= 10 minutes today...`);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${dateKey}T00:00:00`),
    where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
  );
  
  const snap = await getDocs(q);
  let found = false;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.handlerId === staffId && data.durationSeconds >= 600) {
      found = true;
      console.log(`Found:`);
      console.log(JSON.stringify({ id: docSnap.id, ...data }, null, 2));
    }
  });

  if (!found) {
    console.log('No Chelsea calls >= 10 mins found in dialpad_calls.');
  }
}

main().catch(console.error);
