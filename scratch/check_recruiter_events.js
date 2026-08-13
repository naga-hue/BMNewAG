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
  console.log("Querying all events in dialpad_events received after 2026-08-11T08:29:00.000Z...");
  const q = query(
    collection(db, 'dialpad_events'),
    where('receivedAt', '>=', '2026-08-11T08:29:00.000Z')
  );

  const snap = await getDocs(q);
  console.log(`Found ${snap.size} total events received after 08:29 UTC.`);

  const recruiterNames = ['Wendy', 'Chelsea', 'Eileen', 'Bianca', 'Callan', 'Toni', 'Semandi'];
  const matchedEvents = [];

  snap.forEach(d => {
    const ev = d.data();
    const name = ev.rawPayload?.target?.name || ev.handlerName || '';
    const email = ev.rawPayload?.target?.email || ev.handlerEmail || '';
    
    const isMatch = recruiterNames.some(rn => name.toLowerCase().includes(rn.toLowerCase()) || email.toLowerCase().includes(rn.toLowerCase()));
    
    if (isMatch) {
      matchedEvents.push({ id: d.id, ...ev });
    }
  });

  console.log(`Matched ${matchedEvents.length} events for our active recruiters:`);
  matchedEvents.slice(0, 30).forEach((ev, idx) => {
    console.log(`[${idx+1}] ID: ${ev.id}`);
    console.log(`  receivedAt: ${ev.receivedAt}`);
    console.log(`  state: "${ev.state}"`);
    console.log(`  handlerName: "${ev.handlerName || ''}"`);
    console.log(`  target.name: "${ev.rawPayload?.target?.name || ''}"`);
    console.log(`  target.email: "${ev.rawPayload?.target?.email || ''}"`);
    console.log(`  durationSeconds: ${ev.duration}`);
  });
}

main().catch(console.error);
