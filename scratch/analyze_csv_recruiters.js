import fs from 'fs';
import path from 'path';
import readline from 'readline';
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

// Simple dot-insensitive email resolver
function normalizeEmail(email) {
  if (!email) return '';
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return email.trim().toLowerCase();
  const local = parts[0].replace(/\./g, '');
  return `${local}@${parts[1]}`;
}

// Exact production tracked helper
function isStaffDialpadTracked(s) {
  if (s.status === 'exited') return false;
  if (s.dialpadTracked === false) return false;
  if (s.dialpadTracked === true) return true;
  const email = (s.businessEmail || s.personalEmail || '').toLowerCase();
  if (email.includes('@talent-h.com') || email.includes('@totaco.net')) {
    return false;
  }
  return true;
}

async function main() {
  // Load staff from database
  console.log('Loading staff list from Firestore...');
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnap.forEach(d => {
    const data = d.data();
    if (isStaffDialpadTracked(data)) {
      staffList.push({ id: d.id, ...data });
    }
  });
  console.log(`Loaded ${staffList.length} active tracked recruiters.`);

  const csvPath = path.join(process.cwd(), 'import-data', 'Humres365.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    return;
  }

  console.log(`Analyzing CSV file: ${csvPath}...`);
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let totalLines = 0;
  let matchedLegs = 0;
  let headerColumns = [];
  const recruiterLegCounts = {};
  
  for await (const line of rl) {
    totalLines++;
    if (totalLines === 1) {
      headerColumns = line.split(',');
      continue;
    }

    // Split line by comma, handle basic CSV row
    const cols = line.split(',');
    if (cols.length < 5) continue;

    // Find indices for relevant fields: name, email, target_type
    // Header order from preview:
    // date_started [0], call_id [1], category [2], direction [3], external_number [4]... target_type [13], name [14], email [15]
    const legName = cols[14] ? cols[14].trim() : '';
    const legEmail = cols[15] ? cols[15].trim() : '';

    // Attempt to match with active recruiters
    let matchedStaff = null;

    if (legEmail) {
      const normLegEmail = normalizeEmail(legEmail);
      matchedStaff = staffList.find(s => {
        const primaryEmail = normalizeEmail(s.businessEmail || s.personalEmail);
        const dialpadEmail = normalizeEmail(s.dialpadEmail);
        const aliases = Array.isArray(s.additionalEmails) ? s.additionalEmails.map(normalizeEmail) : [];
        return primaryEmail === normLegEmail || dialpadEmail === normLegEmail || aliases.includes(normLegEmail);
      });
    }

    if (!matchedStaff && legName) {
      const cleanLegName = legName.toLowerCase().replace(/[^a-z0-9]/g, '');
      matchedStaff = staffList.find(s => {
        const cleanDbName = (s.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanDbName === cleanLegName;
      });
    }

    if (matchedStaff) {
      matchedLegs++;
      recruiterLegCounts[matchedStaff.fullName] = (recruiterLegCounts[matchedStaff.fullName] || 0) + 1;
    }

    if (totalLines % 50000 === 0) {
      console.log(`Processed ${totalLines} lines...`);
    }
  }

  console.log(`\nAnalysis Finished:`);
  console.log(`- Total CSV records: ${totalLines - 1}`);
  console.log(`- Total matched legs for active tracked staff: ${matchedLegs}`);
  
  console.log(`\nLeg counts by recruiter:`);
  Object.keys(recruiterLegCounts).sort((a,b) => recruiterLegCounts[b] - recruiterLegCounts[a]).forEach(name => {
    console.log(` - ${name.padEnd(25)} : ${recruiterLegCounts[name]} legs`);
  });
}

main().catch(console.error);
