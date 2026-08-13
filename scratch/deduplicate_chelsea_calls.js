import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
  const todayStr = '2026-08-11';
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', todayStr),
    where('dateStarted', '<=', todayStr + 'T23:59:59Z')
  );
  
  const snap = await getDocs(q);
  const allCalls = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.handlerId === staffId) {
      allCalls.push({ id: docSnap.id, ...data });
    }
  });

  console.log(`Total call documents in Firestore for Chelsea: ${allCalls.length}`);

  // Deduplicate by grouping calls that share:
  // 1. Same masterCallId (if present)
  // 2. Same entryPointCallId (if present)
  // 3. Close starting times (within 60 seconds) AND same external number
  
  const uniqueGroups = [];
  for (const call of allCalls) {
    let matchedGroup = null;
    const callTime = new Date(call.dateStarted).getTime();
    
    for (const group of uniqueGroups) {
      // Check ID links
      const masterLink = call.masterCallId && group.masterCallIds.has(call.masterCallId);
      const entryLink = call.entryPointCallId && group.entryPointCallIds.has(call.entryPointCallId);
      const directIdLink = group.callIds.has(call.masterCallId) || group.callIds.has(call.entryPointCallId);
      
      // Check time & number proximity (redundancy fallback)
      const numMatch = call.externalNumber && group.externalNumbers.has(call.externalNumber);
      const timeMatch = Math.abs(callTime - group.baseTime) < 120 * 1000; // 2 minutes window
      
      if (masterLink || entryLink || directIdLink || (numMatch && timeMatch)) {
        matchedGroup = group;
        break;
      }
    }
    
    if (matchedGroup) {
      matchedGroup.callIds.add(call.id);
      if (call.masterCallId) matchedGroup.masterCallIds.add(call.masterCallId);
      if (call.entryPointCallId) matchedGroup.entryPointCallIds.add(call.entryPointCallId);
      if (call.externalNumber) matchedGroup.externalNumbers.add(call.externalNumber);
      matchedGroup.legs.push(call);
    } else {
      uniqueGroups.push({
        baseTime: callTime,
        callIds: new Set([call.id]),
        masterCallIds: new Set(call.masterCallId ? [call.masterCallId] : []),
        entryPointCallIds: new Set(call.entryPointCallId ? [call.entryPointCallId] : []),
        externalNumbers: new Set(call.externalNumber ? [call.externalNumber] : []),
        legs: [call]
      });
    }
  }

  console.log(`\nUnique consolidated physical calls after deduplication: ${uniqueGroups.length}`);

  // Print details of each group
  let totalCalculatedTalkTime = 0;
  let totalCalculatedDuration = 0;
  
  uniqueGroups.forEach((group, index) => {
    // For each physical call, the actual duration should be the maximum duration/talkTime found in any of its legs
    const maxDuration = Math.max(...group.legs.map(l => l.durationSeconds || 0));
    const maxTalkTime = Math.max(...group.legs.map(l => l.talkTimeSeconds || 0));
    const maxTotalDuration = Math.max(...group.legs.map(l => (l.totalDurationMs || 0) / 1000));
    
    totalCalculatedTalkTime += maxTalkTime;
    totalCalculatedDuration += maxDuration;

    // Check if the group has multiple legs
    if (group.legs.length > 1) {
      console.log(`\n--- Group ${index + 1}: Multiple Legs (${group.legs.length} docs) ---`);
      group.legs.forEach(leg => {
        console.log(`  DocId: ${leg.id} | Time: ${leg.dateStarted.substring(11, 16)} | Dir: ${leg.direction} | Status: ${leg.callStatus} | Dur: ${leg.durationSeconds}s | Talk: ${leg.talkTimeSeconds}s | Master: ${leg.masterCallId} | Entry: ${leg.entryPointCallId} | Num: ${leg.externalNumber}`);
      });
      console.log(`  => Consolidated Stats: Dur=${maxDuration}s, Talk=${maxTalkTime}s, TotalDur=${maxTotalDuration}s`);
    }
  });

  console.log(`\n=== Summary Stats after Leg Consolidation ===`);
  console.log(`Consolidated Call Count: ${uniqueGroups.length}`);
  console.log(`Consolidated Total Duration: ${Math.floor(totalCalculatedDuration/60)}m ${totalCalculatedDuration%60}s (${totalCalculatedDuration}s)`);
  console.log(`Consolidated Total Talk Time: ${Math.floor(totalCalculatedTalkTime/60)}m ${totalCalculatedTalkTime%60}s (${totalCalculatedTalkTime}s)`);
}

main().catch(console.error);
