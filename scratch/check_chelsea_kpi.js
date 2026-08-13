import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  const docId = "staff-1782810939333-60-734_2026-08-11";
  console.log(`Checking kpiDaily document "${docId}"...`);
  
  const ref = doc(db, 'kpiDaily', docId);
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const data = snap.data();
    console.log("Found kpiDaily data:");
    console.log(`- Recruiter Name: "${data.staffName}"`);
    console.log(`- Date: "${data.date}"`);
    console.log(`- Total Calls: ${data.callsTotal || data.totalCalls}`);
    console.log(`- Total Talk Time: ${data.totalTalkTimeSeconds || data.totalTalkTime} seconds (${Math.round((data.totalTalkTimeSeconds || data.totalTalkTime)/60)} minutes)`);
    console.log(`- Inbound: ${data.callsInbound}, Outbound: ${data.callsOutbound}`);
  } else {
    console.warn("Document does not exist!");
  }
}

main().catch(console.error);
