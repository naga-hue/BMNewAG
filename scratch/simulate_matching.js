import fs from 'fs';
import path from 'path';
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

// Helper functions copied from sync-recent-calls.js
function normalizeEmail(email) {
  if (!email) return '';
  return email.toLowerCase().trim();
}

const nameOverrides = {
  'william champken-frasca': 'will champken',
  'candyce dawes': 'candyce dawes celene',
  'candyce dawes celene': 'candyce dawes celene',
  'matthew james sparks': 'matthew sparks',
  'dynan kotze': 'dylan kotze'
};

function matchName(dbName, empName) {
  if (!dbName || !empName) return false;
  const normDb = dbName.toLowerCase().replace(/\s+/g, ' ').trim();
  let normEmp = empName.toLowerCase().replace(/\s+/g, ' ').trim();
  if (nameOverrides[normEmp]) {
    normEmp = nameOverrides[normEmp];
  }
  if (normDb === normEmp) return true;
  const cleanDb = normDb.replace(/[^a-z0-9]/g, '');
  const cleanEmp = normEmp.replace(/[^a-z0-9]/g, '');
  return cleanDb === cleanEmp;
}

async function main() {
  // Fetch active staff list
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnap.forEach(sDoc => {
    const data = sDoc.data();
    if (data.status !== 'exited') {
      staffList.push({ id: sDoc.id, ...data });
    }
  });
  console.log(`Loaded ${staffList.length} active staff profiles.`);

  // Load raw calls
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log(`Loaded ${data.calls.length} raw Dialpad calls.`);

  const targetTimes = [
    '08:33', '08:34', '08:35', '08:37', '08:38', '08:41', '08:42', '08:45', '09:04'
  ];

  data.calls.forEach(c => {
    const timeNum = Number(c.date_started);
    const timeStr = !isNaN(timeNum) ? new Date(timeNum).toISOString().substring(11, 16) : '';
    
    if (targetTimes.includes(timeStr)) {
      const targetEmail = c.target?.email || '';
      const targetName = c.target?.name || '';
      
      console.log(`\nAnalyzing call: Time ${timeStr} | Contact: ${c.contact?.name} | Target: ${targetName} (${targetEmail})`);

      // Match logic
      let matchedStaff = null;
      if (targetEmail) {
        const normTargetEmail = normalizeEmail(targetEmail);
        matchedStaff = staffList.find(s => {
          const busEmail = normalizeEmail(s.businessEmail);
          const persEmail = normalizeEmail(s.personalEmail);
          return busEmail === normTargetEmail || persEmail === normTargetEmail;
        });
      }

      if (!matchedStaff && targetName) {
        matchedStaff = staffList.find(s => matchName(s.fullName, targetName));
      }

      if (matchedStaff) {
        console.log(`-> MATCHED staff: ${matchedStaff.fullName} (${matchedStaff.id})`);
      } else {
        console.log(`-> NO MATCH`);
      }
    }
  });
}

main().catch(console.error);
