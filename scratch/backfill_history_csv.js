import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

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

// Fast custom CSV row parser
function parseCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Proximity-free consolidation logic matching our production codebase
function consolidateCalls(calls) {
  const groups = [];
  for (const call of calls) {
    let matchedGroup = null;
    
    for (const group of groups) {
      // Check ID links
      const masterLink = call.masterCallId && group.masterCallIds.has(call.masterCallId);
      const entryLink = call.entryPointCallId && group.entryPointCallIds.has(call.entryPointCallId);
      const directIdLink = (call.masterCallId && group.callIds.has(call.masterCallId)) || 
                           (call.entryPointCallId && group.callIds.has(call.entryPointCallId)) ||
                           (call.conversationId && (group.masterCallIds.has(call.conversationId) || group.entryPointCallIds.has(call.conversationId)));
      
      if (masterLink || entryLink || directIdLink) {
        matchedGroup = group;
        break;
      }
    }
    
    if (matchedGroup) {
      matchedGroup.callIds.add(call.conversationId || call.primaryCallId || call.id);
      if (call.masterCallId) matchedGroup.masterCallIds.add(call.masterCallId);
      if (call.entryPointCallId) matchedGroup.entryPointCallIds.add(call.entryPointCallId);
      if (call.externalNumber) matchedGroup.externalNumbers.add(call.externalNumber);
      matchedGroup.legs.push(call);
    } else {
      groups.push({
        callIds: new Set([call.conversationId || call.primaryCallId || call.id].filter(Boolean)),
        masterCallIds: new Set(call.masterCallId ? [call.masterCallId] : []),
        entryPointCallIds: new Set(call.entryPointCallId ? [call.entryPointCallId] : []),
        externalNumbers: new Set(call.externalNumber ? [call.externalNumber] : []),
        legs: [call]
      });
    }
  }

  return groups.map(group => {
    // Prefer legs that are connected or have longer talk time
    group.legs.sort((a, b) => {
      const talkA = Number(a.talkTimeSeconds || 0);
      const talkB = Number(b.talkTimeSeconds || 0);
      return talkB - talkA;
    });
    
    const primary = group.legs[0];
    const maxTalkTime = Math.max(...group.legs.map(l => Number(l.talkTimeSeconds || 0)));
    const maxDuration = Math.max(...group.legs.map(l => Number(l.durationSeconds || 0)));
    const connected = group.legs.some(l => l.connected === true);
    
    return {
      ...primary,
      talkTimeSeconds: maxTalkTime,
      durationSeconds: maxDuration,
      connected
    };
  });
}

async function main() {
  console.log('Loading active tracked recruiters...');
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnap.forEach(d => {
    const data = d.data();
    if (isStaffDialpadTracked(data)) {
      staffList.push({ id: d.id, ...data });
    }
  });
  console.log(`Loaded ${staffList.length} active recruiters.`);

  const csvPath = path.join(process.cwd(), 'import-data', 'Humres365.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    return;
  }

  console.log('Reading and grouping CSV call legs...');
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Group legs by recruiterId -> dateKey -> legsList
  const recruiterDayLegs = {};
  
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // skip header

    const cols = parseCsvRow(line);
    if (cols.length < 5) continue;

    const date_started = cols[0] ? cols[0].trim() : '';
    if (!date_started) continue;

    const name = cols[14] ? cols[14].trim() : '';
    const email = cols[15] ? cols[15].trim() : '';

    // Match recruiter
    let matchedStaff = null;
    if (email) {
      const normEmail = normalizeEmail(email);
      matchedStaff = staffList.find(s => {
        const primaryEmail = normalizeEmail(s.businessEmail || s.personalEmail);
        const dialpadEmail = normalizeEmail(s.dialpadEmail);
        const aliases = Array.isArray(s.additionalEmails) ? s.additionalEmails.map(normalizeEmail) : [];
        return primaryEmail === normEmail || dialpadEmail === normEmail || aliases.includes(normEmail);
      });
    }

    if (!matchedStaff && name) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      matchedStaff = staffList.find(s => {
        const cleanDbName = (s.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanDbName === cleanName;
      });
    }

    if (!matchedStaff) continue; // Skip if not active tracked recruiter

    // Extract leg values
    const call_id = cols[1] ? cols[1].trim() : '';
    const direction = cols[3] ? cols[3].trim().toLowerCase() : '';
    const external_number = cols[4] ? cols[4].trim() : '';
    const date_connected = cols[9] ? cols[9].trim() : '';
    const date_ended = cols[10] ? cols[10].trim() : '';
    const master_call_id = cols[34] ? cols[34].trim() : '';
    const entry_point_call_id = cols[17] ? cols[17].trim() : '';

    const startMs = Date.parse(date_started);
    const endMs = Date.parse(date_ended);
    const connMs = date_connected ? Date.parse(date_connected) : null;
    const durSec = isNaN(startMs) || isNaN(endMs) ? 0 : Math.round((endMs - startMs) / 1000);
    const talkSec = isNaN(endMs) || !connMs || isNaN(connMs) ? 0 : Math.round((endMs - connMs) / 1000);

    const dateKey = date_started.substring(0, 10); // YYYY-MM-DD

    const leg = {
      id: call_id,
      callId: call_id,
      masterCallId: master_call_id,
      entryPointCallId: entry_point_call_id,
      conversationId: master_call_id || entry_point_call_id || call_id,
      dateStarted: date_started,
      direction,
      externalNumber: external_number,
      connected: !!date_connected,
      durationSeconds: durSec,
      talkTimeSeconds: talkSec
    };

    if (!recruiterDayLegs[matchedStaff.id]) {
      recruiterDayLegs[matchedStaff.id] = {
        fullName: matchedStaff.fullName,
        department: matchedStaff.department || '',
        email: matchedStaff.businessEmail || matchedStaff.personalEmail || '',
        dates: {}
      };
    }

    if (!recruiterDayLegs[matchedStaff.id].dates[dateKey]) {
      recruiterDayLegs[matchedStaff.id].dates[dateKey] = [];
    }

    recruiterDayLegs[matchedStaff.id].dates[dateKey].push(leg);

    if (lineCount % 50000 === 0) {
      console.log(`Parsed ${lineCount} CSV lines...`);
    }
  }

  console.log(`CSV Reading complete. Total rows parsed: ${lineCount - 1}`);

  // Now, calculate aggregates and perform batch writes to Firestore
  console.log('Calculating aggregates and updating Firestore...');
  
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalDocsWritten = 0;

  for (const staffId of Object.keys(recruiterDayLegs)) {
    const profile = recruiterDayLegs[staffId];
    const dates = Object.keys(profile.dates);

    console.log(`Processing recruiter ${profile.fullName} (${dates.length} active dates)...`);

    for (const dateKey of dates) {
      const rawLegs = profile.dates[dateKey];
      const consolidated = consolidateCalls(rawLegs);

      let callsInbound = 0;
      let callsOutbound = 0;
      let callsTotal = 0;
      let totalTalkTimeSeconds = 0;
      let callsOver5Min = 0;
      let callsOver10Min = 0;

      consolidated.forEach(call => {
        callsTotal++;
        if (call.direction === 'inbound') {
          callsInbound++;
        } else {
          callsOutbound++;
        }
        const talkSec = Number(call.talkTimeSeconds || 0);
        totalTalkTimeSeconds += talkSec;
        if (talkSec >= 300) callsOver5Min++;
        if (talkSec >= 600) callsOver10Min++;
      });

      const docId = `${staffId}_${dateKey}`;
      const docRef = doc(db, 'kpiDaily', docId);

      const kpiData = {
        staffId,
        staffName: profile.fullName,
        department: profile.department,
        email: profile.email,
        date: dateKey,
        callsInbound,
        callsOutbound,
        callsTotal,
        totalTalkTimeSeconds,
        callsOver5Min,
        callsOver10Min,
        lastUpdated: new Date().toISOString(),
        callsBackfillSource: 'Humres365_CSV'
      };

      // Queue document update with merge: true to avoid deleting CV/Interview data
      batch.set(docRef, kpiData, { merge: true });
      batchCount++;

      if (batchCount === 500) {
        await batch.commit();
        totalDocsWritten += batchCount;
        console.log(`[Firestore] Batch commit successful. Written ${totalDocsWritten} daily logs so far.`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  // Commit remaining writes
  if (batchCount > 0) {
    await batch.commit();
    totalDocsWritten += batchCount;
    console.log(`[Firestore] Final batch commit successful. Total written daily logs: ${totalDocsWritten}`);
  }

  console.log('\nCSV History backfill has completed successfully for all active recruiters!');
}

main().catch(console.error);
