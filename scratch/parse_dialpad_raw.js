import fs from 'fs';
import path from 'path';

function main() {
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  if (!fs.existsSync(rawPath)) {
    console.error('scratch/dialpad_raw_calls.json not found.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log(`Total raw calls fetched from Dialpad: ${data.count}`);
  
  if (!data.calls || data.calls.length === 0) {
    console.log('No calls returned.');
    return;
  }

  // Filter Chelsea calls
  const chelseaCalls = data.calls.filter(c => {
    const targetEmail = (c.target?.email || '').toLowerCase();
    const contactName = (c.contact?.name || '').toLowerCase();
    const targetName = (c.target?.name || '').toLowerCase();
    
    return targetEmail.includes('rauch') || 
           targetEmail.includes('c.rauch') || 
           targetName.includes('chelsea');
  });

  console.log(`\nChelsea Rauch's calls from Dialpad API (${chelseaCalls.length} calls):`);
  
  chelseaCalls.sort((a, b) => Number(a.date_started) - Number(b.date_started)).forEach((c, idx) => {
    const timeNum = Number(c.date_started);
    const timeStr = !isNaN(timeNum) ? new Date(timeNum).toISOString().substring(11, 19) : '';
    console.log(`[${idx + 1}] ID: ${c.id} | Time (UTC): ${timeStr} | Contact: ${c.contact?.name || c.contact?.phone_number} | State: ${c.state} | Dur: ${Math.round(c.duration/1000)}s | Talk: ${Math.round(c.talk_time/1000)}s`);
  });

  console.log(`\nChecking for calls between 08:30 and 09:20 UTC (09:30 - 10:20 BST):`);
  const missingSearch = [
    'Lee Norton', 'Matt Harper', 'Olga Gavrilova', 'Oliver Phillips',
    'Robert Hickman', 'Udeh', 'Zuzana Kopcanova', 'Emily Cross',
    'Moh Dadashzadeh', 'Marius Mureseanu'
  ];

  data.calls.sort((a, b) => Number(a.date_started) - Number(b.date_started)).forEach(c => {
    const timeNum = Number(c.date_started);
    const timeStr = !isNaN(timeNum) ? new Date(timeNum).toISOString().substring(11, 16) : ''; // HH:MM
    const name = c.contact?.name || c.contact?.phone_number || '';
    
    // Check if within timeframe or match names
    const matchTime = (timeStr >= '08:30' && timeStr <= '09:20');
    const matchName = missingSearch.some(s => name.toLowerCase().includes(s.toLowerCase()));
    
    if (matchTime || matchName) {
      console.log(`-> Dialpad API Call: UTC ${timeStr} | Name: ${name} | ID: ${c.id} | Dur: ${Math.round(c.duration/1000)}s | Target: ${c.target?.email}`);
    }
  });
}

main();
