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
  const ids = ['4801112944091136', '6185401573122048'];
  
  const eventsRef = collection(db, 'dialpad_events');
  const snap = await getDocs(eventsRef);
  
  console.log('Searching raw event payloads...');
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (ids.includes(String(data.callId))) {
      console.log(`\n=== Event ID: ${docSnap.id} ===`);
      console.log(`State: ${data.state} | Timestamp: ${data.eventTimestamp}`);
      console.log('Raw Payload Keys & Values:');
      console.log(JSON.stringify({
        call_id: data.rawPayload?.call_id,
        master_call_id: data.rawPayload?.master_call_id,
        entry_point_call_id: data.rawPayload?.entry_point_call_id,
        operator_call_id: data.rawPayload?.operator_call_id,
        direction: data.rawPayload?.direction,
        state: data.rawPayload?.state,
        target: data.rawPayload?.target?.email
      }, null, 2));
    }
  });
}

main().catch(console.error);
