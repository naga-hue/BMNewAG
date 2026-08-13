import fetch from 'node-fetch';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDK_4zfUH8qdnNWoYqF-w0GDbAQ-4crM1A",
  authDomain: "humres-management-hub.firebaseapp.com",
  projectId: "humres-management-hub",
  storageBucket: "humres-management-hub.firebasestorage.app",
  messagingSenderId: "285569320788",
  appId: "1:285569320788:web:2fbc1f17a839ba1091eac1"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function main() {
  // Load Dialpad API Key from Firestore companies collection
  const compSnap = await getDocs(collection(db, 'companies'));
  let dialpadToken = '';
  compSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('humres') && data.dialpadTokenSlot2) {
      dialpadToken = data.dialpadTokenSlot2; // Huntek / Chelsea Rauch's token slot
    }
  });

  if (!dialpadToken) {
    throw new Error('Dialpad token slot 2 not found in companies collection.');
  }

  console.log('Fetching Chelsea Rauch\'s calls directly from Dialpad API...');
  
  let allCalls = [];
  let cursor = null;
  let page = 1;
  let hasMore = true;
  const targetDateStr = '2026-08-11';

  while (hasMore && page <= 10) {
    const url = `https://dialpad.com/api/v2/call?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${dialpadToken}`,
        'Accept': 'application/json'
      }
    });

    if (res.status !== 200) {
      console.error(`Dialpad API Error: ${res.status}`);
      break;
    }

    const payload = await res.json();
    const items = payload.cursor ? (payload.items || payload.entries || []) : (Array.isArray(payload) ? payload : (payload.items || payload.entries || []));
    
    if (Array.isArray(items) && items.length > 0) {
      items.forEach(c => {
        // Date check: UTC ISO format: 2026-08-11T...
        const dateStr = new Date(c.date_started).toISOString();
        if (dateStr.startsWith(targetDateStr)) {
          // Check if Chelsea was the caller or target
          const targetEmail = c.target?.email || '';
          if (targetEmail.toLowerCase().includes('rauch') || targetEmail.toLowerCase().includes('c.rauch') || (c.contact?.name || '').toLowerCase().includes('rauch')) {
            allCalls.push(c);
          }
        }
      });
      
      const oldestCall = items[items.length - 1];
      const oldestCallDate = new Date(oldestCall.date_started).toISOString();
      if (oldestCallDate < targetDateStr) {
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
  }

  console.log(`\nFound ${allCalls.length} calls for Chelsea Rauch on ${targetDateStr} directly from Dialpad API:`);
  allCalls.sort((a, b) => a.date_started - b.date_started).forEach((c, idx) => {
    const timeStr = new Date(c.date_started).toISOString().substring(11, 19);
    console.log(`[${idx + 1}] ID: ${c.id} | Time (UTC): ${timeStr} | Contact: ${c.contact?.name || c.contact?.phone_number} | State: ${c.state} | Dur: ${Math.round(c.duration/1000)}s | Talk: ${Math.round(c.talk_time/1000)}s | WasRecorded: ${c.was_recorded}`);
  });
}

main().catch(console.error);
