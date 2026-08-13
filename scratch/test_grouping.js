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
  const emailToStaff = {};
  staffSnapshot.forEach(doc => {
    const s = doc.data();
    if (s.businessEmail) emailToStaff[normalizeEmail(s.businessEmail)] = s;
    if (s.personalEmail) emailToStaff[normalizeEmail(s.personalEmail)] = s;
    if (s.additionalEmails) {
      s.additionalEmails.split(',').map(e => e.trim()).filter(Boolean).forEach(e => {
        emailToStaff[normalizeEmail(e)] = s;
      });
    }
  });

  const fileStream = fs.createReadStream('./import-data/dialpad_calls.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  const conversationMap = {};

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;

    const parts = parseCSVLine(line);
    const dateStarted = parts[0] || '';
    const callId = parts[1] || '';
    const direction = parts[3] || '';
    const externalNumber = parts[4] || '';
    const email = normalizeEmail(parts[15] || '');
    const wasRecorded = parts[16] === 'true';
    const entryPointCallId = parts[17] || '';
    const masterCallId = parts[34] || '';
    const talkDurationMin = parseFloat(parts[44] || '0');

    // Grouping identifier (same logic as webhook!)
    const conversationId = masterCallId || entryPointCallId || callId;
    if (!conversationId) continue;

    if (!conversationMap[conversationId]) {
      conversationMap[conversationId] = {
        conversationId,
        dateStarted,
        direction,
        externalNumber,
        recruiterEmails: [],
        wasRecorded: false,
        maxTalkDurationMin: 0
      };
    }

    const conv = conversationMap[conversationId];
    if (email && emailToStaff[email]) {
      if (!conv.recruiterEmails.includes(email)) {
        conv.recruiterEmails.push(email);
      }
    }
    if (wasRecorded) {
      conv.wasRecorded = true;
    }
    if (talkDurationMin > conv.maxTalkDurationMin) {
      conv.maxTalkDurationMin = talkDurationMin;
    }
  }

  // Count grouped records
  let totalConversations = 0;
  let recruiterConversations = 0;
  let recordedConversations = 0;
  const yearlyCounts = {};

  for (const conv of Object.values(conversationMap)) {
    totalConversations++;
    if (conv.recruiterEmails.length > 0) {
      recruiterConversations++;
      if (conv.wasRecorded) {
        recordedConversations++;
      }
      const year = conv.dateStarted.substring(0, 4);
      yearlyCounts[year] = (yearlyCounts[year] || 0) + 1;
    }
  }

  console.log(`\n=== Grouped Conversations ===`);
  console.log(`Total Grouped Conversations: ${totalConversations}`);
  console.log(`Recruiter Associated Conversations: ${recruiterConversations}`);
  console.log(`Grouped Recorded Conversations: ${recordedConversations}`);
  console.log(`Yearly breakdown:`, yearlyCounts);

  process.exit(0);
}

run();
