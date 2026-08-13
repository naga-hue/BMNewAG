import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

function loadEnvToken() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found in CWD.');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  let match = content.match(/DIALPAD_TOKEN_2\s*=\s*["']?([^"'\r\n]+)/);
  if (!match) {
    match = content.match(/DIALPAD_TOKEN_1\s*=\s*["']?([^"'\r\n]+)/);
  }
  if (!match) {
    throw new Error('Neither DIALPAD_TOKEN_2 nor DIALPAD_TOKEN_1 found in .env.local.');
  }
  return match[1];
}

async function main() {
  const dialpadToken = loadEnvToken();
  console.log('Successfully loaded Dialpad Token. Fetching calls directly from Dialpad API...');

  let allCalls = [];
  let cursor = null;
  let page = 1;
  let hasMore = true;
  const targetDateStr = '2026-08-11';

  while (hasMore && page <= 25) {
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
        const dateStr = new Date(c.date_started).toISOString();
        if (dateStr.startsWith(targetDateStr)) {
          allCalls.push(c);
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

  console.log(`\nTotal Dialpad calls fetched today (any target) on ${targetDateStr}: ${allCalls.length}`);
  
  // Now filter calls where target.email contains 'rauch' or contact.name matches Chelsea's target or target.name is Chelsea
  const chelseaCalls = allCalls.filter(c => {
    const targetEmail = (c.target?.email || '').toLowerCase();
    const contactName = (c.contact?.name || '').toLowerCase();
    const targetName = (c.target?.name || '').toLowerCase();
    
    return targetEmail.includes('rauch') || 
           targetEmail.includes('c.rauch') || 
           targetName.includes('chelsea');
  });

  console.log(`\nFiltered Chelsea Rauch's calls (${chelseaCalls.length} calls):`);
  chelseaCalls.sort((a, b) => a.date_started - b.date_started).forEach((c, idx) => {
    const timeStr = new Date(c.date_started).toISOString().substring(11, 19);
    console.log(`[${idx + 1}] ID: ${c.id} | Time (UTC): ${timeStr} | Direction: ${c.direction} | Contact: ${c.contact?.name || c.contact?.phone_number} | State: ${c.state} | Dur: ${Math.round(c.duration/1000)}s | Talk: ${Math.round(c.talk_time/1000)}s`);
  });
}

main().catch(console.error);
