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
  // 1. Check staff mappings and Qandle backfill timestamps
  console.log('Fetching staff collection...');
  const staffSnap = await getDocs(collection(db, 'staff'));
  const activeStaff = [];
  
  staffSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status !== 'exited' && data.isStaffDialpadTracked) {
      activeStaff.push({ id: docSnap.id, ...data });
    }
  });

  console.log(`Found ${activeStaff.length} active tracked recruiters.`);
  
  let qandleSyncedCount = 0;
  const unsyncedRecruiters = [];
  
  activeStaff.forEach(s => {
    if (s.qandleLastBackfilledAt) {
      qandleSyncedCount++;
      console.log(` - Recruiter: ${s.fullName.padEnd(25)} | Qandle Sync Date: ${s.qandleLastBackfilledAt}`);
    } else {
      unsyncedRecruiters.push(s.fullName);
    }
  });

  console.log(`\nSummary:`);
  console.log(`- Qandle 30-day attendance sync: ${qandleSyncedCount} / ${activeStaff.length} recruiters fully completed.`);
  if (unsyncedRecruiters.length > 0) {
    console.log(`- Pending first Qandle backfill sync: ${unsyncedRecruiters.join(', ')}`);
  } else {
    console.log(`- All active recruiters are fully synced with Qandle!`);
  }
}

main().catch(console.error);
