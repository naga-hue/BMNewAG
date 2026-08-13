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

function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase().replace(/['"]+/g, '');
}

async function run() {
  console.log("=== SCANNING FOR UNMAPPED DIALPAD RECRUITER ACCOUNTS ===");
  try {
    // 1. Load all staff in directory
    const staffSnap = await getDocs(collection(db, 'staff'));
    const staffEmails = new Set();
    const staffInfo = [];

    staffSnap.forEach(docSnap => {
      const s = docSnap.data();
      const id = docSnap.id;
      const normalizedBus = normalizeEmail(s.businessEmail);
      const normalizedPers = normalizeEmail(s.personalEmail);

      if (normalizedBus) staffEmails.add(normalizedBus);
      if (normalizedPers) staffEmails.add(normalizedPers);

      if (s.additionalEmails) {
        s.additionalEmails.split(',').forEach(email => {
          const norm = normalizeEmail(email.trim());
          if (norm) staffEmails.add(norm);
        });
      }

      staffInfo.push({
        id,
        fullName: s.fullName,
        emails: Array.from(staffEmails)
      });
    });

    console.log(`Loaded ${staffInfo.length} active staff profiles from directory.`);

    // 2. Load all calls and find any with handlerEmail not matching staffEmails
    const callsSnap = await getDocs(collection(db, 'dialpad_calls'));
    console.log(`Loaded ${callsSnap.size} call documents to analyze.`);

    const unmappedStats = {};

    callsSnap.forEach(docSnap => {
      const call = docSnap.data();
      const email = normalizeEmail(call.handlerEmail);
      const name = call.handlerName;

      if (!email) return; // Skip call legs without email (e.g. system routing legs already filtered out)

      // If this email is NOT matched in staffEmails directory
      if (!staffEmails.has(email)) {
        if (!unmappedStats[email]) {
          unmappedStats[email] = {
            name: name || 'Unknown Recruiter',
            callCount: 0,
            sampleCallDate: call.dateStarted
          };
        }
        unmappedStats[email].callCount++;
        if (call.dateStarted > unmappedStats[email].sampleCallDate) {
          unmappedStats[email].sampleCallDate = call.dateStarted;
        }
      }
    });

    const unmappedEmails = Object.keys(unmappedStats);
    if (unmappedEmails.length === 0) {
      console.log("\n🎉 Awesome! All recruiter Dialpad accounts with call activity are 100% matched to your Staff directory.");
    } else {
      console.log(`\nFound ${unmappedEmails.length} unmapped Dialpad email addresses with active call history:`);
      unmappedEmails.forEach(email => {
        const stats = unmappedStats[email];
        console.log(`\n- Email: "${email}"`);
        console.log(`  Recruiter Name: "${stats.name}"`);
        console.log(`  Total Call Count: ${stats.callCount}`);
        console.log(`  Latest Call Active: ${stats.sampleCallDate}`);
      });
    }
  } catch (e) {
    console.error("Error scanning:", e);
  }
  process.exit(0);
}

run();
