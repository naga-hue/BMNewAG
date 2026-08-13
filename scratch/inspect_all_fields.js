import fs from 'fs';
import path from 'path';

function main() {
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  if (!fs.existsSync(rawPath)) {
    console.error('File not found.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  
  // Find Lee Norton call at 08:33 UTC
  const call = data.calls.find(c => {
    const timeNum = Number(c.date_started);
    const dateStr = !isNaN(timeNum) ? new Date(timeNum).toISOString() : '';
    const timeStr = dateStr ? dateStr.substring(11, 16) : '';
    return (c.contact?.name || '').includes('Lee Norton') && timeStr === '08:33';
  });

  if (call) {
    console.log('Complete Call Object Keys & Values:');
    console.log(JSON.stringify(call, null, 2));
  } else {
    console.log('Lee Norton call at 08:33 UTC not found.');
  }
}

main();
