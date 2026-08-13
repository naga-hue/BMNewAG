import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

async function main() {
  const token = process.env.DIALPAD_TOKEN_2 || process.env.DIALPAD_TOKEN_1;
  if (!token) {
    console.error('No token found.');
    return;
  }

  // Fetch calls from today (August 12, 2026)
  const url = `https://dialpad.com/api/v2/call`;
  console.log(`Fetching calls from ${url}...`);

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (res.status !== 200) {
    console.error(`Error status: ${res.status}`);
    return;
  }

  const data = await res.json();
  const items = data.items || data.entries || [];
  
  console.log(`Fetched ${items.length} total call items from Dialpad.`);
  
  // Filter for Matthew Sparks calls today
  const todayStr = '2026-08-12';
  const sparksCalls = items.filter(c => {
    const timeNum = Number(c.date_started);
    const dateStr = !isNaN(timeNum) ? new Date(timeNum).toISOString() : '';
    const isToday = dateStr && dateStr.startsWith(todayStr);
    
    const isSparks = (c.target?.name || '').includes('Matthew Sparks') || 
                    (c.target?.email || '').includes('m.sparks');
    return isToday && isSparks;
  });

  console.log(`\nFound ${sparksCalls.length} calls for Matthew Sparks today:`);
  sparksCalls.forEach((c, idx) => {
    const timeNum = Number(c.date_started);
    const dateStr = !isNaN(timeNum) ? new Date(timeNum).toISOString() : '';
    console.log(`[${idx + 1}] ID: ${c.call_id} | Time: ${dateStr.substring(11, 19)} | Contact: ${c.contact?.name} (${c.contact?.phone}) | State: ${c.state} | Dur: ${c.duration}s | Target: ${c.target?.name}`);
  });

  // Write all today's calls to a file for review
  fs.writeFileSync('scratch/today_raw_calls.json', JSON.stringify(items, null, 2));
}

main().catch(console.error);
