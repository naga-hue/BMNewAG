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

// Configuration Constants
const DETAIL_CALLS_LIMIT = 85000; // Limit of recent call details to import to Firestore
const csvPath = fs.existsSync('./import-data/dialpad_new.csv') 
  ? './import-data/dialpad_new.csv' 
  : './import-data/dialpad_calls.csv';

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

// Parse CSV date format "YYYY-MM-DD HH:MM:SS.ffffff" to ISO String
function parseCSVDateToISO(dateStr) {
  if (!dateStr) return '';
  const cleaned = dateStr.trim().replace(' ', 'T');
  try {
    if (!cleaned.endsWith('Z')) {
      return new Date(cleaned + 'Z').toISOString();
    }
    return new Date(cleaned).toISOString();
  } catch (e) {
    return new Date(dateStr.trim()).toISOString();
  }
}

async function run() {
  console.log('1. Loading staff directory from Firestore to map emails...');
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnapshot.forEach(doc => {
    staffList.push({ id: doc.id, ...doc.data() });
  });
  console.log(`Loaded ${staffList.length} staff profiles.`);

  // Build mapping tables
  const emailToStaffMap = {};
  staffList.forEach(s => {
    if (s.businessEmail) {
      emailToStaffMap[normalizeEmail(s.businessEmail)] = s;
    }
    if (s.personalEmail) {
      emailToStaffMap[normalizeEmail(s.personalEmail)] = s;
    }
    if (s.additionalEmails) {
      const extraList = s.additionalEmails.split(',').map(e => e.trim()).filter(Boolean);
      extraList.forEach(e => {
        emailToStaffMap[normalizeEmail(e)] = s;
      });
    }
  });

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    return;
  }

  console.log('\n2. Streaming Dialpad call logs and grouping legs into recruiter conversations...');
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  const conversationMap = {};

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Skip header

    const parts = parseCSVLine(line);
    const dateStartedRaw = parts[0] || '';
    const callId = parts[1] || '';
    const direction = (parts[3] || '').toLowerCase().trim();
    const externalNumber = parts[4] || '';
    const emailRaw = parts[15] || '';
    const email = normalizeEmail(emailRaw);
    const wasRecorded = parts[16] === 'true';
    const entryPointCallId = parts[17] || '';
    const masterCallId = parts[34] || '';
    const talkDurationMin = parseFloat(parts[44] || '0');

    // Logical conversation grouping
    const conversationId = masterCallId || entryPointCallId || callId;
    if (!conversationId) continue;

    if (!conversationMap[conversationId]) {
      conversationMap[conversationId] = {
        conversationId,
        dateStarted: dateStartedRaw,
        direction,
        externalNumber,
        recruiterEmails: [],
        wasRecorded: false,
        maxTalkDurationMin: 0
      };
    }

    const conv = conversationMap[conversationId];
    // Track if any leg has recruiter email
    if (email && emailToStaffMap[email]) {
      if (!conv.recruiterEmails.includes(email)) {
        conv.recruiterEmails.push(email);
      }
    }
    // Track if any leg was recorded
    if (wasRecorded) {
      conv.wasRecorded = true;
    }
    // Track maximum duration leg
    if (talkDurationMin > conv.maxTalkDurationMin) {
      conv.maxTalkDurationMin = talkDurationMin;
    }
    // Pick earliest start date
    if (dateStartedRaw && (!conv.dateStarted || dateStartedRaw < conv.dateStarted)) {
      conv.dateStarted = dateStartedRaw;
    }
  }

  console.log(`\nProcessed ${lineCount} CSV rows.`);
  console.log(`Grouped into ${Object.keys(conversationMap).length} unique conversations.`);

  console.log('\n3. Processing recruiter-associated conversations and daily aggregates...');
  const aggregates = {};
  const sampleCalls = [];

  for (const conv of Object.values(conversationMap)) {
    if (conv.recruiterEmails.length === 0) continue;

    const email = conv.recruiterEmails[0]; // pick first matched recruiter email
    const staffMember = emailToStaffMap[email];
    const dateKey = conv.dateStarted.substring(0, 10); // YYYY-MM-DD
    const talkDurationMin = conv.maxTalkDurationMin;
    
    // Group aggregates: staffId_YYYY-MM-DD
    const aggKey = `${staffMember.id}_${dateKey}`;
    if (!aggregates[aggKey]) {
      aggregates[aggKey] = {
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

    const agg = aggregates[aggKey];
    agg.callsTotal++;
    if (conv.direction === 'inbound') {
      agg.callsInbound++;
    } else if (conv.direction === 'outbound') {
      agg.callsOutbound++;
    }

    if (!isNaN(talkDurationMin) && talkDurationMin > 0) {
      agg.totalTalkTimeSeconds += Math.round(talkDurationMin * 60);
      if (talkDurationMin >= 5.0) agg.callsOver5Min++;
      if (talkDurationMin >= 10.0) agg.callsOver10Min++;
    }

    // Collect call detail
    const parsedDate = parseCSVDateToISO(conv.dateStarted);
    sampleCalls.push({
      id: conv.conversationId,
      conversationId: conv.conversationId,
      primaryCallId: conv.conversationId,
      handlerId: staffMember.id,
      handlerName: staffMember.fullName,
      department: staffMember.department || '',
      direction: conv.direction,
      dateStarted: parsedDate,
      externalNumber: conv.externalNumber,
      externalName: conv.externalNumber, // Default to phone number
      wasRecorded: conv.wasRecorded,
      recordingUrl: '', // Will fetch on-demand via Vercel details modal
      durationSeconds: Math.round(talkDurationMin * 60),
      transcript: 'This is a historical call imported from the Dialpad CSV database backup.',
      transcriptStatus: 'pending' // Allows enrichment API to fetch details on demand
    });
  }

  const aggKeys = Object.keys(aggregates);
  console.log(`Generated ${aggKeys.length} daily user activity documents.`);
  console.log(`Generated ${sampleCalls.length} total recruiter call logs.`);

  console.log('\n4. Uploading daily aggregates to Firestore in batch transactions...');
  const batchSize = 450;
  let batch = writeBatch(db);
  let operationCount = 0;
  let totalUploaded = 0;

  for (let i = 0; i < aggKeys.length; i++) {
    const key = aggKeys[i];
    const data = aggregates[key];
    const docRef = doc(db, 'kpiDaily', key);
    
    batch.set(docRef, {
      ...data,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    operationCount++;
    totalUploaded++;

    if (operationCount >= batchSize) {
      console.log(`Writing batch: ${totalUploaded} / ${aggKeys.length}...`);
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    console.log(`Writing final batch: ${totalUploaded} / ${aggKeys.length}...`);
    await batch.commit();
  }

  console.log(`\n🎉 Success! Successfully imported ${totalUploaded} historical daily KPI documents to Firestore.`);

  // Upload recent detail calls to dialpad_calls
  console.log(`\n5. Uploading latest ${DETAIL_CALLS_LIMIT} individual call detail logs to dialpad_calls...`);
  sampleCalls.sort((a, b) => b.dateStarted.localeCompare(a.dateStarted));
  const callsToUpload = sampleCalls.slice(0, DETAIL_CALLS_LIMIT);

  batch = writeBatch(db);
  operationCount = 0;
  let callsUploaded = 0;

  for (const call of callsToUpload) {
    const docRef = doc(db, 'dialpad_calls', call.id);
    batch.set(docRef, {
      ...call,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    operationCount++;
    callsUploaded++;

    if (operationCount >= batchSize) {
      console.log(`Writing calls batch: ${callsUploaded} / ${callsToUpload.length}...`);
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    console.log(`Writing final calls batch: ${callsUploaded} / ${callsToUpload.length}...`);
    await batch.commit();
  }

  console.log(`Successfully uploaded ${callsUploaded} recent calls to dialpad_calls.`);
}

run().catch(console.error);
