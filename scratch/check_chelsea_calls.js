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
  // Find Chelsea Rauch staff doc
  const staffSnap = await getDocs(collection(db, 'staff'));
  let chelsea = null;
  staffSnap.forEach(d => {
    const s = d.data();
    if (s.fullName && s.fullName.toLowerCase().includes('chelsea')) {
      chelsea = { id: d.id, ...s };
    }
  });

  if (!chelsea) {
    console.error("Chelsea Rauch not found in staff collection.");
    return;
  }

  console.log(`Found Chelsea Rauch in staff collection: ID = "${chelsea.id}"`);
  console.log(`dialpadEmail: "${chelsea.dialpadEmail || ''}", additionalEmails:`, chelsea.additionalEmails || []);

  // Query all calls for today
  console.log("Querying all dialpad_calls for today (>= 2026-08-11)...");
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11')
  );

  const snap = await getDocs(q);
  console.log(`Total calls found in database for today: ${snap.size}`);

  const chelseaCalls = [];
  const otherCalls = [];
  snap.forEach(d => {
    const call = d.data();
    if (call.handlerId === chelsea.id) {
      chelseaCalls.push({ id: d.id, ...call });
    } else {
      otherCalls.push({ id: d.id, ...call });
    }
  });

  console.log(`Chelsea Rauch calls count: ${chelseaCalls.length}`);
  console.log("Chelsea calls list:");
  chelseaCalls.forEach((c, idx) => {
    console.log(`[${idx+1}] ID: ${c.id}, dateStarted: ${c.dateStarted}, direction: ${c.direction}, duration: ${c.durationSeconds}s, externalNumber: ${c.externalNumber}, externalName: ${c.externalName}`);
  });

  // Check if some calls for Chelsea are assigned to other handlers due to email mappings
  console.log("\nChecking other calls for Chelsea Rauch email matching...");
  const matchedOther = [];
  otherCalls.forEach(c => {
    const handlerEmail = (c.handlerEmail || '').toLowerCase().trim();
    const emailsToCheck = [
      (chelsea.dialpadEmail || '').toLowerCase().trim(),
      ...(chelsea.additionalEmails || []).map(e => e.toLowerCase().trim())
    ].filter(Boolean);

    if (emailsToCheck.includes(handlerEmail)) {
      matchedOther.push(c);
    }
  });

  console.log(`Found ${matchedOther.length} calls with Chelsea's email but NOT assigned to her staff ID.`);
  matchedOther.forEach((c, idx) => {
    console.log(`[${idx+1}] ID: ${c.id}, handlerName: "${c.handlerName}", handlerId: "${c.handlerId}", dateStarted: ${c.dateStarted}, duration: ${c.durationSeconds}s`);
  });
}

main().catch(console.error);
