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
  const staffId = "staff-1782810939333-48-596"; // Matthew Sparks
  const dateKey = "2026-08-12";

  console.log(`Checking daily aggregates for ${staffId} on ${dateKey}...`);
  const kpiRef = doc(db, 'kpiDaily', `${staffId}_${dateKey}`);
  const kpiSnap = await getDoc(kpiRef);
  if (kpiSnap.exists()) {
    console.log('[KPI Scorecard Found]:', kpiSnap.data());
  } else {
    console.log('[KPI Scorecard Not Found]');
  }

  // Check the placement we just posted
  // placement ID format in endpoint: `placement_${activityRef.id}`
  // Let's look up our second transaction which had activityId = nqIlaVSgFKB2UxnaFfae
  const placementId = `placement_nqIlaVSgFKB2UxnaFfae`;
  console.log(`\nChecking placement document for ID ${placementId}...`);
  const placementRef = doc(db, 'placements', placementId);
  const placementSnap = await getDoc(placementRef);
  if (placementSnap.exists()) {
    console.log('[Placement Doc Found]:', JSON.stringify(placementSnap.data(), null, 2));
  } else {
    console.log('[Placement Doc Not Found]');
  }
}

main().catch(console.error);
