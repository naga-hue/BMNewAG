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
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11')
  );
  
  const snap = await getDocs(q);
  console.log('Searching for Udeh/Okugbeni calls today...');
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('udeh') || str.includes('okugbeni')) {
      console.log(`\n=== Doc ID: ${docSnap.id} ===`);
      console.log(`dateStarted: ${data.dateStarted}`);
      console.log(`direction: ${data.direction}`);
      console.log(`externalName: ${data.externalName}`);
      console.log(`externalNumber: ${data.externalNumber}`);
      console.log(`primaryCallId: ${data.primaryCallId}`);
      console.log(`masterCallId: ${data.masterCallId}`);
      console.log(`entryPointCallId: ${data.entryPointCallId}`);
      console.log(`conversationId: ${data.conversationId}`);
      console.log(`relatedCallIds: ${JSON.stringify(data.relatedCallIds)}`);
      console.log(`targetName: ${data.targetName || (data.target && data.target.name)}`);
      console.log(`contact: ${JSON.stringify(data.contact)}`);
    }
  });
}

main().catch(console.error);
