import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

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

// Normalize email local-part by removing dots
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

async function updateKpiDaily(handlerId, dateStarted) {
  if (!handlerId || !dateStarted) return;
  const dateKey = dateStarted.substring(0, 10);
  const docId = `${handlerId}_${dateKey}`;
  console.log(`[KPI] Recalculating daily aggregate for recruiter ${handlerId} on ${dateKey}...`);

  try {
    const staffSnap = await getDocs(query(collection(db, 'staff')));
    let staffDoc = null;
    staffSnap.forEach(d => {
      if (d.id === handlerId) staffDoc = d.data();
    });
    
    if (!staffDoc) {
      console.warn(`[KPI] Staff member ${handlerId} not found. Skipping.`);
      return;
    }

    // Query all calls on this day from dialpad_calls
    const callsSnap = await getDocs(query(
      collection(db, 'dialpad_calls'),
      where('dateStarted', '>=', `${dateKey}T00:00:00`),
      where('dateStarted', '<=', `${dateKey}T23:59:59Z`)
    ));

    let totalCalls = 0;
    let totalTalkTime = 0;
    let callsOver5Min = 0;

    callsSnap.forEach(d => {
      const call = d.data();
      if (call.handlerId !== handlerId) return; // Filter by recruiter in-memory

      totalCalls++;
      const duration = parseInt(call.durationSeconds || 0, 10);
      totalTalkTime += duration;
      if (duration > 300) {
        callsOver5Min++;
      }
    });

    const kpiRef = doc(db, 'kpiDaily', docId);
    await updateDoc(kpiRef, {
      totalCalls,
      totalTalkTime,
      callsOver5Min,
      updatedAt: new Date().toISOString()
    });
    console.log(`[KPI] Updated daily kpiDaily document ${docId}: totalCalls=${totalCalls}, totalTalkTime=${totalTalkTime}s, callsOver5Min=${callsOver5Min}`);
  } catch (err) {
    console.error(`[KPI] Error updating daily aggregates for ${handlerId} on ${dateKey}:`, err);
  }
}

async function main() {
  console.log("1. Loading all staff profiles...");
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffList = [];
  staffSnap.forEach(d => {
    staffList.push({ id: d.id, ...d.data() });
  });
  console.log(`Loaded ${staffList.length} staff profiles.`);

  console.log("\n2. Fetching today's logical calls from dialpad_calls...");
  const todayStr = new Date().toISOString().substring(0, 10);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', `${todayStr}T00:00:00.000Z`)
  );

  const callSnap = await getDocs(q);
  console.log(`Found ${callSnap.size} calls starting today.`);

  let healedCount = 0;
  const affectedRecruiters = new Set();

  for (const callDoc of callSnap.docs) {
    const call = callDoc.data();
    
    // If handlerId is empty, try to resolve using normalized email matching
    if (!call.handlerId) {
      const targetEmail = call.handlerEmail || call.rawPayload?.target?.email || '';
      const targetName = call.handlerName || call.rawPayload?.target?.name || '';
      
      let matchedStaff = null;
      if (targetEmail) {
        const normTargetEmail = normalizeEmail(targetEmail);
        matchedStaff = staffList.find(s => {
          const busEmail = normalizeEmail(s.businessEmail);
          const persEmail = normalizeEmail(s.personalEmail);
          if (busEmail === normTargetEmail || persEmail === normTargetEmail) return true;
          
          if (s.additionalEmails) {
            const extraList = s.additionalEmails.split(',').map(e => normalizeEmail(e)).filter(Boolean);
            if (extraList.includes(normTargetEmail)) return true;
          }
          return false;
        });
      }

      // Fallback to name matching if email matching failed
      if (!matchedStaff && targetName) {
        matchedStaff = staffList.find(s => s.fullName.toLowerCase().trim() === targetName.toLowerCase().trim());
      }

      if (matchedStaff) {
        console.log(`Healing call ${callDoc.id}: Matched email "${targetEmail}" / name "${targetName}" to staff "${matchedStaff.fullName}"`);
        
        const callRef = doc(db, 'dialpad_calls', callDoc.id);
        await updateDoc(callRef, {
          handlerId: matchedStaff.id,
          handlerName: matchedStaff.fullName,
          handlerEmail: matchedStaff.businessEmail || matchedStaff.personalEmail || '',
          department: matchedStaff.department || ''
        });

        healedCount++;
        affectedRecruiters.add(matchedStaff.id);
      }
    }
  }

  console.log(`\nHealed ${healedCount} call records.`);

  if (affectedRecruiters.size > 0) {
    console.log(`\n3. Recalculating daily aggregate metrics for affected recruiters: ${Array.from(affectedRecruiters).join(', ')}`);
    for (const rId of affectedRecruiters) {
      await updateKpiDaily(rId, `${todayStr}T10:00:00Z`);
    }
  }
  
  console.log("\nSelf-healing process completed successfully!");
}

main().catch(console.error);
