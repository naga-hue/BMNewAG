import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Normalize email local-part by removing dots
function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  const parts = emailStr.toLowerCase().trim().split('@');
  if (parts.length !== 2) return emailStr.toLowerCase().trim();
  const localPart = parts[0].replace(/\./g, '');
  return `${localPart}@${parts[1]}`;
}

// Robust PEM private key formatter
function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        key = parsed.private_key.trim();
      }
    } catch (e) {
      console.error('[Firestore] Failed to parse private key as JSON:', e);
    }
  }

  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);
  key = key.replace(/\\n/g, '\n');
  if (key.startsWith('nMII')) key = key.substring(1);

  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';

  if (!key.includes(header)) {
    let base64Body = key;
    if (base64Body.includes(footer)) {
      base64Body = base64Body.split(footer)[0];
    }
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');
    const lines = [];
    for (let i = 0; i < base64Body.length; i += 64) {
      lines.push(base64Body.substring(i, i + 64));
    }
    key = `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return key;
}

let db = null;
function initFirestore() {
  if (!db) {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || 'humres-management-hub';
      let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (privateKey && privateKey.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(privateKey.trim());
          if (parsed.private_key) privateKey = parsed.private_key;
          if (parsed.client_email && !clientEmail) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed parsing privateKey JSON:', e);
        }
      }

      if (clientEmail && clientEmail.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(clientEmail.trim());
          if (parsed.client_email) clientEmail = parsed.client_email;
        } catch (e) {
          console.error('[Firestore] Failed parsing clientEmail JSON:', e);
        }
      }

      if (clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formatPrivateKey(privateKey),
          })
        });
      } else {
        throw new Error('Firebase credentials not set in Vercel environment variables.');
      }
    }
    db = getFirestore();
  }
  return db;
}

// Helper to normalize Dialpad milliseconds epoch timestamps to ISO date strings
function formatDialpadDate(val) {
  if (!val) return '';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  const dateObj = new Date(num);
  return !isNaN(dateObj.getTime()) ? dateObj.toISOString() : String(val);
}

// Name matching overrides for staff
const nameOverrides = {
  'william champken-frasca': 'will champken',
  'candyce dawes': 'candyce dawes celene',
  'candyce dawes celene': 'candyce dawes celene',
  'matthew james sparks': 'matthew sparks',
  'swarupa elisetti': 'swarupa elissetti',
  'praveen m': 'praveenkumar m',
  'praveenkumar m': 'praveenkumar m'
};

function matchName(dbName, empName) {
  if (!dbName || !empName) return false;
  const normDb = dbName.toLowerCase().replace(/\s+/g, ' ').trim();
  let normEmp = empName.toLowerCase().replace(/\s+/g, ' ').trim();
  if (nameOverrides[normEmp]) {
    normEmp = nameOverrides[normEmp];
  }
  if (normDb === normEmp) return true;
  const cleanDb = normDb.replace(/[^a-z0-9]/g, '');
  const cleanEmp = normEmp.replace(/[^a-z0-9]/g, '');
  return cleanDb === cleanEmp;
}

// Consolidate duplicate call legs of the same call
function consolidateCalls(calls) {
  const groups = [];
  for (const call of calls) {
    let matchedGroup = null;
    const callTime = call.dateStarted ? new Date(call.dateStarted).getTime() : 0;
    
    for (const group of groups) {
      // Check ID links
      const masterLink = call.masterCallId && group.masterCallIds.has(call.masterCallId);
      const entryLink = call.entryPointCallId && group.entryPointCallIds.has(call.entryPointCallId);
      const directIdLink = (call.masterCallId && group.callIds.has(call.masterCallId)) || 
                           (call.entryPointCallId && group.callIds.has(call.entryPointCallId)) ||
                           (call.conversationId && (group.masterCallIds.has(call.conversationId) || group.entryPointCallIds.has(call.conversationId)));
      
      // Only consolidate legs of the same call sharing exact ID links (e.g. transfers, routing legs)
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
        baseTime: callTime,
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

async function updateRecruiterKpis(firestore, handlerId, dateKey) {
  if (!handlerId || !dateKey) return;
  const docId = `${handlerId}_${dateKey}`;
  console.log(`[KPI Rebuild] Recalculating totals for recruiter ${handlerId} on ${dateKey}...`);

  try {
    const staffDoc = await firestore.collection('staff').doc(handlerId).get();
    if (!staffDoc.exists) return;
    const staff = staffDoc.data();

    const dayCallsSnap = await firestore.collection('dialpad_calls')
      .where('dateStarted', '>=', `${dateKey}T00:00:00`)
      .where('dateStarted', '<=', `${dateKey}T23:59:59.999Z`)
      .get();

    let callsInbound = 0;
    let callsOutbound = 0;
    let callsTotal = 0;
    let totalTalkTimeSeconds = 0;
    let callsOver5Min = 0;
    let callsOver10Min = 0;

    const rawCalls = [];
    dayCallsSnap.forEach(docSnap => {
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

    await firestore.collection('kpiDaily').doc(docId).set(kpiData, { merge: true });
    console.log(`[KPI Rebuild] Saved doc ${docId}: talkTime=${totalTalkTimeSeconds}s`);
  } catch (err) {
    console.error(`[KPI Rebuild] Error updating ${handlerId} on ${dateKey}:`, err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple secret protection
  const querySecret = req.query.secret || '';
  const isCron = req.headers['x-vercel-cron'] === '1';
  const expectedSecret = process.env.QANDLE_INGEST_SECRET || 'qandle-talent-kpi-hub-key-2026';
  
  if (!isCron && querySecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const firestore = initFirestore();

    // 1. Fetch company configured dialpad API keys from database
    const compSnap = await firestore.collection('companies').get();
    const dbTokens = [];
    compSnap.forEach(doc => {
      const c = doc.data();
      if (c.dialpadApiKey && c.dialpadApiKey.trim()) {
        dbTokens.push(c.dialpadApiKey.trim());
      }
    });

    const tokenSlot1 = process.env.DIALPAD_TOKEN_1 || process.env.DIALPAD_TOKEN || '';
    const tokenSlot2 = process.env.DIALPAD_TOKEN_2 || process.env.DIALPAD_TOKEN || '';
    
    // Combine database configured tokens and env variables (as fallback)
    const rawTokensList = [...dbTokens, tokenSlot1, tokenSlot2];
    const tokens = Array.from(new Set(rawTokensList)).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(500).json({ error: 'Dialpad API tokens not configured in database or env variables' });
    }

    // 2. Fetch active staff list
    const staffSnap = await firestore.collection('staff').get();
    const staffList = [];
    staffSnap.forEach(sDoc => {
      const data = sDoc.data();
      if (data.status !== 'exited') {
        staffList.push({ id: sDoc.id, ...data });
      }
    });

    console.log(`[Sync Calls] Loaded ${staffList.length} active staff profiles.`);

    // 3. Fetch trailing concluded calls from Dialpad API with a reconciliation window
    let allDialpadCalls = [];
    
    const daysLimit = Number(req.query.days || 2);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffDateStr = cutoffDate.toISOString().substring(0, 10); // "YYYY-MM-DD"
    console.log(`[Sync Calls] Running recovery sync with cutoff date ${cutoffDateStr} (${daysLimit} days ago).`);
    
    let healedCount = 0;

    for (const token of tokens) {
      let cursor = null;
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) { // Safeguard to prevent infinite loops (max 25 pages)
        const url = `https://dialpad.com/api/v2/call${cursor ? `?cursor=${cursor}` : ''}`;
        console.log(`[Sync Calls] Fetching concluded calls page ${page} from Dialpad...`);
        
        const apiRes = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (apiRes.status === 200) {
          const payload = await apiRes.json();
          const items = payload.cursor ? (payload.items || payload.entries || []) : (Array.isArray(payload) ? payload : (payload.items || payload.entries || []));
          
          if (Array.isArray(items) && items.length > 0) {
            allDialpadCalls = allDialpadCalls.concat(items);
            
            // Check if we have started seeing calls older than our cutoff date
            const oldestCall = items[items.length - 1];
            const oldestCallDate = formatDialpadDate(oldestCall?.date_started);
              
            if (oldestCallDate && oldestCallDate < cutoffDateStr) {
              console.log(`[Sync Calls] Reached calls older than cutoff date (${oldestCallDate.substring(0, 10)}). Stopping pagination.`);
              hasMore = false;
            }
          } else {
            hasMore = false;
          }

          if (payload.cursor && hasMore) {
            cursor = payload.cursor;
            page++;
          } else {
            hasMore = false;
          }
        } else {
          console.error(`[Sync Calls] Dialpad API returned status ${apiRes.status}`);
          hasMore = false;
        }
      }
    }

    console.log(`[Sync Calls] Fetched ${allDialpadCalls.length} concluded calls from Dialpad API.`);

    // Bulk fetch existing calls in the date range to optimize Firestore reads
    console.log(`[Sync Calls] Bulk loading existing calls from Firestore starting from ${cutoffDateStr}...`);
    const existingCallsMap = new Map();
    const existingSnap = await firestore.collection('dialpad_calls')
      .where('dateStarted', '>=', cutoffDateStr)
      .get();
      
    existingSnap.forEach(docSnap => {
      existingCallsMap.set(docSnap.id, docSnap.data());
    });
    console.log(`[Sync Calls] Loaded ${existingCallsMap.size} existing calls from Firestore.`);

    const affectedRecruiters = new Set();

    for (const dCall of allDialpadCalls) {
      const callId = String(dCall.id);
      const conversationId = String(dCall.master_call_id || dCall.entry_point_call_id || dCall.id);
      
      const dateStartedStr = formatDialpadDate(dCall.date_started);
        
      if (dateStartedStr < cutoffDateStr) {
        continue; // Only process calls within the reconciliation window
      }

      // Check if call exists in Firestore Map (doc ID is callId)
      const existingCall = existingCallsMap.get(callId) || null;
      const callRef = firestore.collection('dialpad_calls').doc(callId);

      // Extract target properties
      const targetEmail = dCall.target?.email || '';
      const targetName = dCall.target?.name || '';
      
      // Determine if we need to write/update
      const isMissing = !existingCall;
      const isUnmapped = existingCall && !existingCall.handlerId;
      const isZeroDuration = existingCall && (!existingCall.durationSeconds || existingCall.durationSeconds === 0) && dCall.duration > 0;

      if (isMissing || isUnmapped || isZeroDuration) {
        // Find matching staff member
        let matchedStaff = null;
        if (targetEmail) {
          const normTargetEmail = normalizeEmail(targetEmail);
          matchedStaff = staffList.find(s => {
            const dialpadEmail = normalizeEmail(s.dialpadEmail);
            const busEmail = normalizeEmail(s.businessEmail);
            const persEmail = normalizeEmail(s.personalEmail);
            if ((dialpadEmail && dialpadEmail === normTargetEmail) || busEmail === normTargetEmail || persEmail === normTargetEmail) return true;
            if (s.additionalEmails) {
              const extraList = s.additionalEmails.split(',').map(e => normalizeEmail(e)).filter(Boolean);
              if (extraList.includes(normTargetEmail)) return true;
            }
            return false;
          });
        }

        if (!matchedStaff && targetName) {
          matchedStaff = staffList.find(s => matchName(s.fullName, targetName));
        }

        const handlerId = matchedStaff ? matchedStaff.id : '';
        const handlerName = matchedStaff ? matchedStaff.fullName : targetName;
        const handlerEmail = matchedStaff ? (matchedStaff.businessEmail || matchedStaff.personalEmail || '') : targetEmail;
        const department = matchedStaff ? (matchedStaff.department || '') : '';

        const durationMs = Number(dCall.duration || 0);
        const durationSeconds = Math.round(durationMs / 1000);
        const talkTimeMs = Number(dCall.talk_time || 0);
        const talkTimeSeconds = Math.round(talkTimeMs / 1000);
        const totalDurationMs = Number(dCall.total_duration || 0);

        const callData = {
          conversationId,
          primaryCallId: callId,
          relatedCallIds: [callId],
          masterCallId: dCall.master_call_id || '',
          entryPointCallId: dCall.entry_point_call_id || '',
          dateStarted: dateStartedStr,
          dateConnected: formatDialpadDate(dCall.date_connected),
          dateEnded: formatDialpadDate(dCall.date_ended),
          direction: dCall.direction || '',
          handlerId,
          handlerName,
          handlerEmail,
          department,
          externalName: dCall.contact?.name || '',
          externalNumber: dCall.contact?.phone_number || '',
          internalNumber: dCall.target?.phone || '',
          connected: dCall.state === 'concluded' || dCall.state === 'connected',
          durationMs,
          durationSeconds,
          talkTimeMs,
          talkTimeSeconds,
          totalDurationMs,
          wasRecorded: dCall.was_recorded || false,
          recordingUrl: (Array.isArray(dCall.recording_url) ? dCall.recording_url[0] : dCall.recording_url) || '',
          callStatus: dCall.state === 'concluded' ? 'Connected' : 'No Answer',
          updatedAt: new Date().toISOString(),

          // Diagnostic / Audit Fields
          dialpadCallId: callId,
          webhookState: dCall.state || 'concluded',
          phoneNumber: dCall.contact?.phone_number || '',
          dialpadUser: targetEmail,
          originalTimestamp: dateStartedStr,
          webhookReceivedTimestamp: '',
          source: 'api_reconciliation',
          callSource: isMissing ? 'Recovered from Dialpad API' : (existingCall?.callSource || ''),
          matchedRecruitlyIds: [],
          numberOfRecruitlyMatches: 0
        };

        await callRef.set(callData, { merge: true });
        healedCount++;

        if (handlerId) {
          const dateStr = dateStartedStr.substring(0, 10);
          affectedRecruiters.add(`${handlerId}_${dateStr}`);
        }
      }
    }

    console.log(`[Sync Calls] Completed sweep. Saved/healed ${healedCount} calls.`);

    // 3. Recalculate daily kpis for affected recruiters & dates
    if (affectedRecruiters.size > 0) {
      for (const pair of affectedRecruiters) {
        const [rId, dateStr] = pair.split('_');
        await updateRecruiterKpis(firestore, rId, dateStr);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Completed sync. Processed ${allDialpadCalls.length} concluded calls, healed ${healedCount} records. Recalculated ${affectedRecruiters.size} recruiters.`
    });

  } catch (error) {
    console.error('[Sync Calls] Error syncing recent calls:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
