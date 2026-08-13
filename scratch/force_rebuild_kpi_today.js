import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where, getDoc } from 'firebase/firestore';

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

// Consolidate duplicate call legs of the same call without proximity checks
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
      const talkA = Number(a.durationSeconds || a.talkTimeSeconds || 0);
      const talkB = Number(b.durationSeconds || b.talkTimeSeconds || 0);
      return talkB - talkA;
    });
    
    const primary = group.legs[0];
    const duration = Math.max(...group.legs.map(l => Number(l.durationSeconds || l.talkTimeSeconds || 0)));
    const connected = group.legs.some(l => l.connected === true);
    
    return {
      ...primary,
      durationSeconds: duration,
      connected
    };
  });
}

async function rebuildKpisForRecruiter(handlerId, dateKey) {
  if (!handlerId || !dateKey) return;
  const docId = `${handlerId}_${dateKey}`;
  
  try {
    const staffDoc = await getDoc(doc(db, 'staff', handlerId));
    if (!staffDoc.exists()) return;
    const staff = staffDoc.data();

    // Query all today's calls
    const q = query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', `${dateKey}T00:00:00`),
      where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
    );
    const snap = await getDocs(q);
    
    let callsInbound = 0;
    let callsOutbound = 0;
    let callsTotal = 0;
    let totalTalkTimeSeconds = 0;
    let callsOver5Min = 0;
    let callsOver10Min = 0;

    const rawCalls = [];
    snap.forEach(docSnap => {
      const call = docSnap.data();
      if (call.handlerId === handlerId) {
        rawCalls.push(call);
      }
    });

    const consolidated = consolidateCalls(rawCalls);

    consolidated.forEach(call => {
      callsTotal++;
      if ((call.direction || '').toLowerCase() === 'inbound') {
        callsInbound++;
      } else {
        callsOutbound++;
      }
      
      const duration = Number(call.durationSeconds || 0);
      totalTalkTimeSeconds += duration;
      if (duration >= 300) callsOver5Min++;
      if (duration >= 600) callsOver10Min++;
    });

    const kpiData = {
      staffId: handlerId,
      staffName: staff.fullName || '',
      department: staff.department || '',
      email: staff.businessEmail || staff.personalEmail || '',
      date: dateKey,
      callsInbound,
      callsOutbound,
      callsTotal,
      totalTalkTimeSeconds,
      callsOver5Min,
      callsOver10Min,
      lastUpdated: new Date().toISOString()
    };

    await setDoc(doc(db, 'kpiDaily', docId), kpiData, { merge: true });
    console.log(`Updated KPI daily summary for ${staff.fullName}: calls=${callsTotal}, talkTime=${totalTalkTimeSeconds}s`);
  } catch (err) {
    console.error(`Error rebuilding KPI daily for ${handlerId}:`, err);
  }
}

async function main() {
  const dateKey = '2026-08-12';
  console.log(`Rebuilding all daily KPIs for ${dateKey}...`);
  
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnap.forEach(d => {
    staffList.push(d.id);
  });
  
  console.log(`Found ${staffList.length} staff members. Recalculating...`);
  
  for (const staffId of staffList) {
    await rebuildKpisForRecruiter(staffId, dateKey);
  }
  
  console.log('All KPI daily scorecards rebuilt successfully!');
}

main().catch(console.error);
