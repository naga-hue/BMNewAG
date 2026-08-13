import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local file not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  });
}

loadEnvLocal();

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
  const token = process.env.DIALPAD_TOKEN_1 || process.env.DIALPAD_TOKEN;
  if (!token) {
    throw new Error("Could not find DIALPAD_TOKEN_1 in .env.local file.");
  }
  
  const todayStr = '2026-08-11';
  console.log(`Querying Dialpad API directly for concluded calls on ${todayStr}...`);
  
  const chelseaEmail = 'c.rauch@huntek.co.uk';
  
  let cursor = null;
  let page = 1;
  let hasMore = true;
  const apiCalls = [];

  while (hasMore && page <= 25) {
    const url = `https://dialpad.com/api/v2/call${cursor ? `?cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.error(`Dialpad API returned ${res.status}`);
      break;
    }
    
    const payload = await res.json();
    const items = payload.items || payload.entries || [];
    if (items.length === 0) break;
    
    for (const item of items) {
      const dateStarted = item.date_started 
        ? new Date(item.date_started).toISOString()
        : '';
        
      if (dateStarted && !dateStarted.startsWith(todayStr)) {
        hasMore = false;
        break;
      }
      
      // Filter calls where target is Chelsea
      const targetEmail = item.target?.email || '';
      if (targetEmail.toLowerCase() === chelseaEmail) {
        apiCalls.push(item);
      }
    }
    
    if (payload.cursor && hasMore) {
      cursor = payload.cursor;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Found ${apiCalls.length} calls for Chelsea Rauch in Dialpad API today.`);
  apiCalls.sort((a, b) => a.date_started - b.date_started);
  
  const rows = apiCalls.map((c, i) => ({
    Index: i + 1,
    CallId: c.id,
    TimeUTC: new Date(c.date_started).toISOString().substring(11, 16),
    TimeBST: new Date(c.date_started + 3600000).toISOString().substring(11, 16), // BST is UTC+1
    Dir: c.direction,
    Duration: c.duration ? Math.round(c.duration / 1000) : 0,
    TalkTime: c.talk_time ? Math.round(c.talk_time / 1000) : 0,
    State: c.state,
    TargetEmail: c.target?.email || '',
    TargetName: c.target?.name || ''
  }));
  
  console.table(rows);
  
  const durSum = apiCalls.reduce((acc, c) => acc + (c.duration || 0), 0) / 1000;
  const talkSum = apiCalls.reduce((acc, c) => acc + (c.talk_time || 0), 0) / 1000;
  console.log(`Dialpad API Total Duration: ${Math.floor(durSum/60)}m ${Math.round(durSum%60)}s (${durSum}s)`);
  console.log(`Dialpad API Total Talk Time: ${Math.floor(talkSum/60)}m ${Math.round(talkSum%60)}s (${talkSum}s)`);
}

main().catch(console.error);
