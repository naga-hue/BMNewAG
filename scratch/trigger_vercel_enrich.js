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
  console.log("1. Finding unhealed calls in Firestore for today...");
  const todayStr = new Date().toISOString().substring(0, 10);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${todayStr}T00:00:00.000Z`)
  );

  const callSnap = await getDocs(q);
  const unhealed = [];

  callSnap.forEach(docSnap => {
    const call = docSnap.data();
    if (call.handlerId && (!call.durationSeconds || call.durationSeconds === 0)) {
      unhealed.push({ id: docSnap.id, ...call });
    }
  });

  console.log(`Found ${unhealed.length} unhealed calls today.`);

  console.log("\n2. Triggering Vercel production enrichment handler to self-heal calls...");
  for (const call of unhealed) {
    const url = `https://bm-new-ag.vercel.app/api/dialpad/enrich?conversationId=${call.id}`;
    console.log(`Triggering: ${url} (Recruiter: ${call.handlerName})`);
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log(`  -> Status: ${res.status}, Response:`, data);
    } catch (err) {
      console.error(`  -> Failed to trigger enrichment for ${call.id}:`, err);
    }
    
    // Tiny delay to spread out requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("\nFinished triggering self-healing on Vercel!");
}

main().catch(console.error);
