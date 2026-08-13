import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import readline from 'readline';

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

// Custom quote-aware CSV line splitter
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

// Normalize email local-part by removing dots
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

async function run() {
  console.log('Loading staff directory...');
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const emails = new Set();
  staffSnapshot.forEach(doc => {
    const s = doc.data();
    if (s.businessEmail) emails.add(normalizeEmail(s.businessEmail));
    if (s.personalEmail) emails.add(normalizeEmail(s.personalEmail));
    if (s.additionalEmails) {
      s.additionalEmails.split(',').map(e => e.trim()).filter(Boolean).forEach(e => {
        emails.add(normalizeEmail(e));
      });
    }
  });
  console.log(`Loaded ${emails.size} unique recruiter emails.`);

  const fileStream = fs.createReadStream('./import-data/dialpad_calls.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let totalRows = 0;
  let matchingCallsCount = 0;
  let recordedCallsCount = 0;
  const yearlyCounts = {};

  for await (const line of rl) {
    totalRows++;
    if (totalRows === 1) continue;

    const parts = parseCSVLine(line);
    const dateStarted = parts[0] || '';
    const email = normalizeEmail(parts[15] || '');
    const wasRecorded = parts[16] === 'true';

    if (email && emails.has(email)) {
      matchingCallsCount++;
      if (wasRecorded) recordedCallsCount++;
      const year = dateStarted.substring(0, 4);
      yearlyCounts[year] = (yearlyCounts[year] || 0) + 1;
    }
  }

  console.log(`\n=== Dry Run Statistics ===`);
  console.log(`Total CSV Rows: ${totalRows}`);
  console.log(`Recruiter Matching Calls: ${matchingCallsCount}`);
  console.log(`Recorded Calls: ${recordedCallsCount}`);
  console.log(`Yearly breakdown:`, yearlyCounts);
  
  process.exit(0);
}

run();
