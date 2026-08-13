import fs from 'fs';
import path from 'path';

function main() {
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  if (!fs.existsSync(rawPath)) {
    console.error('scratch/dialpad_raw_calls.json not found.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  
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

  let output = `Total Dialpad API Calls fetched: ${data.calls.length}\n`;
  output += `Chelsea Rauch's calls from Dialpad API: ${chelseaCalls.length} calls\n\n`;
  
  chelseaCalls.sort((a, b) => Number(a.date_started) - Number(b.date_started)).forEach((c, idx) => {
    const timeNum = Number(c.date_started);
    const timeStr = !isNaN(timeNum) ? new Date(timeNum).toISOString().substring(11, 19) : '';
    output += `[${idx + 1}] ID: ${c.id} | Time (UTC): ${timeStr} | Direction: ${c.direction} | Contact: ${c.contact?.name || c.contact?.phone_number} | State: ${c.state} | Dur: ${Math.round(c.duration/1000)}s | Talk: ${Math.round(c.talk_time/1000)}s | Rec: ${c.was_recorded}\n`;
  });

  const auditPath = path.join(process.cwd(), 'scratch', 'chelsea_calls_audit.txt');
  fs.writeFileSync(auditPath, output, 'utf8');
  console.log(`Successfully wrote audit log to scratch/chelsea_calls_audit.txt`);
}

main();
