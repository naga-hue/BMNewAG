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

// Simulate formattedLiveCalls mapping from KpisDashboard.jsx
function formatCall(call) {
  const targetTypeVal = (call.target?.type || 'external').toLowerCase().trim() === 'user' 
    ? 'Candidate' 
    : 'Client';
    
  return {
    id: call.id || call.conversationId,
    staffId: call.handlerId,
    staffName: call.handlerName,
    department: call.department || '',
    direction: call.direction === 'inbound' ? 'Inbound' : 'Outbound',
    date: call.dateStarted ? call.dateStarted.substring(0, 10) : '',
    time: call.dateStarted ? call.dateStarted.substring(11, 19) : '',
    targetName: call.externalName || call.externalNumber || 'Unknown',
    targetType: targetTypeVal,
    duration: call.durationSeconds || 0,
    hasRecording: call.wasRecorded || false,
    recordingUrl: call.recordingUrl || '',
    transcript: call.transcript || 'No transcript generated yet.',
    disposition: call.disposition || '',
    recapSummary: call.recapSummary || '',
    recapOutcome: call.recapOutcome || '',
    externalNumber: call.externalNumber || '',
    masterCallId: call.masterCallId || '',
    entryPointCallId: call.entryPointCallId || '',
    conversationId: call.conversationId || '',
    dateStarted: call.dateStarted || '',
    timestamp: call.dateStarted ? new Date(call.dateStarted).getTime() : 0
  };
}

async function main() {
  const staffId = 'staff-1782810939333-60-734'; // Chelsea Rauch
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11')
  );
  
  const snap = await getDocs(q);
  const rawList = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.handlerId === staffId) {
      rawList.push(formatCall({ id: docSnap.id, ...data }));
    }
  });
  
  console.log(`Formatted calls from DB: ${rawList.length}`);
  
  // Consolidate duplicate call legs
  const groups = [];
  for (const call of rawList) {
    let matchedGroup = null;
    const callTime = call.timestamp || 0;
    
    for (const group of groups) {
      // Check ID links
      const masterLink = call.masterCallId && group.masterCallIds.has(call.masterCallId);
      const entryLink = call.entryPointCallId && group.entryPointCallIds.has(call.entryPointCallId);
      const directIdLink = (call.masterCallId && group.callIds.has(call.masterCallId)) || 
                           (call.entryPointCallId && group.callIds.has(call.entryPointCallId)) ||
                           (call.conversationId && (group.masterCallIds.has(call.conversationId) || group.entryPointCallIds.has(call.conversationId)));
      
      // Proximity link (same target/external number proximity)
      const numMatch = call.externalNumber && group.externalNumbers.has(call.externalNumber);
      const timeMatch = callTime > 0 && group.baseTime > 0 && Math.abs(callTime - group.baseTime) < 120 * 1000;
      
      if (masterLink || entryLink || directIdLink || (numMatch && timeMatch)) {
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
        baseTime: callTime,
        callIds: new Set([call.conversationId || call.primaryCallId || call.id].filter(Boolean)),
        masterCallIds: new Set(call.masterCallId ? [call.masterCallId] : []),
        entryPointCallIds: new Set(call.entryPointCallId ? [call.entryPointCallId] : []),
        externalNumbers: new Set(call.externalNumber ? [call.externalNumber] : []),
        legs: [call]
      });
    }
  }

  const consolidatedList = groups.map(group => {
    // Sort legs: prefer legs that have externalNumber (non-empty) and longer duration
    group.legs.sort((a, b) => {
      const hasPhoneA = !!a.externalNumber;
      const hasPhoneB = !!b.externalNumber;
      if (hasPhoneA !== hasPhoneB) return hasPhoneB ? 1 : -1;
      
      const talkA = Number(a.duration || 0);
      const talkB = Number(b.duration || 0);
      return talkB - talkA;
    });
    
    const primary = group.legs[0];
    const duration = Math.max(...group.legs.map(l => Number(l.duration || 0)));
    const connected = group.legs.some(l => l.connected === true);
    
    return {
      ...primary,
      duration,
      connected
    };
  });

  console.log(`Consolidated calls list count: ${consolidatedList.length}`);
  
  // Find any remaining duplicate times
  const times = {};
  consolidatedList.forEach(c => {
    const timeSec = c.time.substring(0, 5); // HH:MM
    times[timeSec] = (times[timeSec] || 0) + 1;
  });
  
  console.log('\nConsolidated List Sample around 15:18 / 15:15 / 15:07:');
  consolidatedList.sort((a, b) => b.time.localeCompare(a.time)).forEach(c => {
    if (['14:07', '14:15', '14:18', '15:18', '15:15', '15:07'].some(t => c.time.startsWith(t) || c.time.substring(0, 5) === t)) {
      console.log(`- Time: ${c.time} | Name: ${c.targetName} | Type: ${c.targetType} | Dur: ${c.duration}s | Phone: ${c.externalNumber} | Disp: ${c.disposition}`);
    }
  });
}

main().catch(console.error);
