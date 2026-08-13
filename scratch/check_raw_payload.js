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

async function run() {
  const eventId = "4743673636921344_call_transcription_1786291364047";
  const recordingEventId = "4743673636921344_admin_recording_1786291365640";
  
  console.log(`Checking transcription event: ${eventId}`);
  try {
    const docRef = doc(db, 'dialpad_events', eventId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.log("Transcription event not found.");
    } else {
      console.log("Transcription event payload:", JSON.stringify(snap.data(), null, 2));
    }
  } catch (e) {
    console.error("Error:", e);
  }

  console.log(`\nChecking recording event: ${recordingEventId}`);
  try {
    const docRef = doc(db, 'dialpad_events', recordingEventId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.log("Recording event not found.");
    } else {
      console.log("Recording event payload:", JSON.stringify(snap.data(), null, 2));
    }
  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

run();
