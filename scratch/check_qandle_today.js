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
  console.log("Querying qandle_activities for today (date == '2026-08-11')...");
  const q = query(
    collection(db, 'qandle_activities'),
    where('date', '==', '2026-08-11')
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} Qandle records for today.`);
  snap.forEach(d => {
    const act = d.data();
    console.log(`- Recruiter: "${act.staffName}", Employee Code: "${act.employeeCode}", arrivalTime: "${act.arrivalTime}", leftTime: "${act.leftTime}"`);
  });
}

main().catch(console.error);
