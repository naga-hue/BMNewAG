import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { classifyCallRecord } from '../api/crm-lookup.js';

function formatPrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) key = parsed.private_key.trim();
    } catch (e) {
      console.error('[Firestore] Failed parsing privateKey JSON:', e);
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
    if (base64Body.includes(footer)) base64Body = base64Body.split(footer)[0];
    base64Body = base64Body.replace(/[^A-Za-z0-9+/=]/g, '');
    const lines = [];
    for (let i = 0; i < base64Body.length; i += 64) {
      lines.push(base64Body.substring(i, i + 64));
    }
    key = `${header}\n${lines.join('\n')}\n${footer}\n`;
  }
  return key;
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'humres-management-hub',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    })
  });
}
const db = getFirestore();

async function runBackfill(days = 10) {
  console.log(`\n==============================================`);
  console.log(`Starting Dialpad Calls Backfill for Last ${days} Days`);
  console.log(`==============================================\n`);

  // 1. Get Recruitly API Key from Companies
  const compSnap = await db.collection('companies').get();
  let apiKey = null;
  compSnap.forEach(d => {
    const data = d.data();
    if (data.name && data.name.toLowerCase().includes('humres') && data.recruitlyApiKey) {
      apiKey = data.recruitlyApiKey.trim();
    }
  });
  if (!apiKey) {
    compSnap.forEach(d => {
      const data = d.data();
      if (data.recruitlyApiKey && !apiKey) apiKey = data.recruitlyApiKey.trim();
    });
  }

  console.log(`Recruitly API Key configured: ${apiKey ? 'YES' : 'NO'}`);
  console.log(`DeepSeek API Key configured: ${process.env.DEEPSEEK_API_KEY ? 'YES' : 'NO'}`);

  // 2. Compute date cutoff
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - days);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  console.log(`Cutoff date: ${cutoffStr} (inclusive)`);

  // 3. Fetch all calls starting from cutoff
  const snap = await db.collection('dialpad_calls')
    .where('dateStarted', '>=', cutoffStr)
    .orderBy('dateStarted', 'desc')
    .get();

  console.log(`Total calls found in last ${days} days: ${snap.size}`);

  let crmCount = 0;
  let aiCount = 0;
  let defaultCount = 0;
  let skippedAlreadyValid = 0;
  let errorCount = 0;
  let processedCount = 0;

  for (const doc of snap.docs) {
    const call = { id: doc.id, ...doc.data() };
    processedCount++;

    // Skip if already classified with high confidence (crm or ai)
    const isClassified = call.classificationSource && 
      (call.classificationSource.startsWith('crm_') || call.classificationSource === 'ai_transcript');

    if (isClassified) {
      skippedAlreadyValid++;
      continue;
    }

    try {
      const classification = await classifyCallRecord(call, apiKey, db);
      const updates = {
        targetType: classification.targetType,
        classificationSource: classification.classificationSource,
        classifiedAt: new Date().toISOString()
      };

      if (classification.matched) {
        crmCount++;
        updates.crmId = classification.id || '';
        updates.crmName = classification.name || '';
        updates.crmType = classification.type || '';
        updates.crmCompany = classification.company || '';
        console.log(`[${processedCount}/${snap.size}] 🔗 CRM Match (${classification.classificationSource}): ${updates.crmName} (${updates.targetType}) [Call ID: ${call.id}]`);
      } else if (classification.classificationSource === 'ai_transcript') {
        aiCount++;
        updates.aiClassificationReason = classification.aiReason || '';
        console.log(`[${processedCount}/${snap.size}] 🤖 AI Transcript: ${classification.targetType} - "${updates.aiClassificationReason}" [Call ID: ${call.id}]`);
      } else {
        defaultCount++;
        console.log(`[${processedCount}/${snap.size}] ℹ️  Default Heuristic: ${classification.targetType} [Call ID: ${call.id}]`);
      }

      await db.collection('dialpad_calls').doc(call.id).update(updates);

      // Brief sleep between calls to be respectful to API rate limits
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      errorCount++;
      console.error(`[${processedCount}/${snap.size}] ❌ Error processing call ${call.id}:`, err.message);
    }
  }

  console.log(`\n==============================================`);
  console.log(`Backfill Completed!`);
  console.log(`Total calls processed: ${processedCount}`);
  console.log(`Skipped (already classified): ${skippedAlreadyValid}`);
  console.log(`New CRM Matches (ca-/ct-/cy-): ${crmCount}`);
  console.log(`New AI Transcript Classifications: ${aiCount}`);
  console.log(`Default Heuristic / Unmatched: ${defaultCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`==============================================\n`);
}

const daysArg = process.argv[2] ? parseInt(process.argv[2], 10) : 10;
runBackfill(daysArg).then(() => process.exit(0)).catch(err => {
  console.error('Fatal backfill error:', err);
  process.exit(1);
});
