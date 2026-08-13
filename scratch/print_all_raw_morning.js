import fs from 'fs';
import path from 'path';

function main() {
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  if (!fs.existsSync(rawPath)) {
    console.error('scratch/dialpad_raw_calls.json not found.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log(`Total raw calls: ${data.calls.length}`);

  const morningCalls = [];
  data.calls.forEach(c => {
    const timeNum = Number(c.date_started);
    const dateStr = !isNaN(timeNum) ? new Date(timeNum).toISOString() : '';
    const timeStr = dateStr ? dateStr.substring(11, 19) : '';
    if (timeStr >= '08:00:00' && timeStr <= '12:00:00') {
      morningCalls.push({ time: timeStr, ...c });
    }
  });

  morningCalls.sort((a, b) => a.time.localeCompare(b.time));
  console.log(`\nFound ${morningCalls.length} morning calls (08:00 - 12:00 UTC) in Dialpad raw response:`);
  
  morningCalls.forEach((c, idx) => {
    console.log(`[${idx + 1}] Time (UTC): ${c.time} | Contact: ${c.contact?.name || c.contact?.phone_number} | Target Name: ${c.target?.name} | Target Email: ${c.target?.email} | Direction: ${c.direction} | State: ${c.state} | Dur: ${Math.round(c.duration/1000)}s`);
  });
}

main();
