import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
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

async function run() {
  console.log('1. Loading staff directory from Firestore to map emails...');
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnapshot.forEach(doc => {
    staffList.push({ id: doc.id, ...doc.data() });
  });
  console.log(`Loaded ${staffList.length} staff profiles.`);

  // Helper to normalize email local-part by removing dots
  function normalizeEmail(emailStr) {
    if (!emailStr) return '';
    const parts = emailStr.toLowerCase().trim().split('@');
    if (parts.length !== 2) return emailStr.toLowerCase().trim();
    const localPart = parts[0].replace(/\./g, '');
    return `${localPart}@${parts[1]}`;
  }

  // Build mapping tables
  const emailToStaffMap = {};
  staffList.forEach(s => {
    if (s.businessEmail) {
      const norm = normalizeEmail(s.businessEmail);
      emailToStaffMap[norm] = s;
    }
    if (s.personalEmail) {
      const norm = normalizeEmail(s.personalEmail);
      emailToStaffMap[norm] = s;
    }
  });

  const csvPath = './import-data/dialpad_calls.csv';
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    return;
  }

  console.log('\n2. Streaming Dialpad call logs to aggregate metrics by recruiter & date...');
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  const aggregates = {};

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Skip header

    const parts = parseCSVLine(line);
    const dateStartedRaw = parts[0] || '';
    const direction = (parts[3] || '').toLowerCase().trim();
    const emailRaw = parts[15] || '';
    const email = normalizeEmail(emailRaw);
    const talkDurationMin = parseFloat(parts[44] || '0');

    // Filter: only process 2026 calls and recruiters mapped by email
    if (dateStartedRaw.startsWith('2026-') && email && emailToStaffMap[email]) {
      const dateKey = dateStartedRaw.substring(0, 10); // YYYY-MM-DD
      const staffMember = emailToStaffMap[email];
      
      const key = `${staffMember.id}_${dateKey}`;
      if (!aggregates[key]) {
        aggregates[key] = {
          staffId: staffMember.id,
          staffName: staffMember.fullName,
          department: staffMember.department || '',
          date: dateKey,
          email: email,
          callsInbound: 0,
          callsOutbound: 0,
          callsTotal: 0,
          callsOver5Min: 0,
          callsOver10Min: 0,
          totalTalkTimeSeconds: 0
        };
      }

      const agg = aggregates[key];
      agg.callsTotal++;
      if (direction === 'inbound') {
        agg.callsInbound++;
      } else if (direction === 'outbound') {
        agg.callsOutbound++;
      }

      if (!isNaN(talkDurationMin) && talkDurationMin > 0) {
        agg.totalTalkTimeSeconds += Math.round(talkDurationMin * 60);
        if (talkDurationMin >= 5.0) agg.callsOver5Min++;
        if (talkDurationMin >= 10.0) agg.callsOver10Min++;
      }
    }
  }

  const keys = Object.keys(aggregates);
  console.log(`\nProcessed ${lineCount} call log entries.`);
  console.log(`Generated ${keys.length} daily user activity documents to import.`);

  console.log('\n3. Uploading daily aggregates to Firestore in batch transactions...');
  const batchSize = 450;
  let batch = writeBatch(db);
  let operationCount = 0;
  let totalUploaded = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const data = aggregates[key];
    
    // Set document reference: collection 'kpiDaily', documentId: staffId_YYYY-MM-DD
    const docRef = doc(db, 'kpiDaily', key);
    
    // Merge true allows us to preserve other metrics like CRM activities if imported separately
    batch.set(docRef, {
      ...data,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    operationCount++;
    totalUploaded++;

    if (operationCount >= batchSize) {
      console.log(`Writing batch: ${totalUploaded} / ${keys.length}...`);
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  // Commit remaining writes
  if (operationCount > 0) {
    console.log(`Writing final batch: ${totalUploaded} / ${keys.length}...`);
    await batch.commit();
  }

  console.log(`\n🎉 Success! Successfully imported ${totalUploaded} historical daily KPI documents to Firestore.`);
}

run().catch(console.error);
