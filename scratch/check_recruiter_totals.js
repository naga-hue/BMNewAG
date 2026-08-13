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
  const todayStr = new Date().toISOString().substring(0, 10);
  console.log(`Fetching daily KPIs for date: ${todayStr}...`);
  
  const q = query(
    collection(db, 'kpiDaily'),
    where('date', '==', todayStr)
  );
  
  const snap = await getDocs(q);
  const rows = [];
  
  snap.forEach(docSnap => {
    const data = docSnap.data();
    rows.push({
      Recruiter: data.staffName || data.staffId,
      TotalCalls: data.callsTotal || 0,
      Inbound: data.callsInbound || 0,
      Outbound: data.callsOutbound || 0,
      TalkTime: `${Math.floor(data.totalTalkTimeSeconds / 60)}m ${data.totalTalkTimeSeconds % 60}s`,
      TalkSeconds: data.totalTalkTimeSeconds || 0
    });
  });
  
  rows.sort((a, b) => b.TalkSeconds - a.TalkSeconds);
  console.table(rows);
}

main().catch(console.error);
