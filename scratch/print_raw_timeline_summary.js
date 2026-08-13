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

  const times = data.calls.map(c => Number(c.date_started)).filter(t => !isNaN(t));
  times.sort((a, b) => a - b);
  
  const minDate = new Date(times[0]);
  const maxDate = new Date(times[times.length - 1]);
  
  console.log(`Total calls: ${times.length}`);
  console.log(`Oldest call in response (UTC): ${minDate.toISOString()}`);
  console.log(`Newest call in response (UTC): ${maxDate.toISOString()}`);
}

main();
