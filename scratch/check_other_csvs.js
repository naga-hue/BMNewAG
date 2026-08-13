import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function checkCsv(filename) {
  const csvPath = path.join(process.cwd(), 'import-data', filename);
  if (!fs.existsSync(csvPath)) return;

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  const emails = new Set();
  const offices = new Set();

  for await (const line of rl) {
    count++;
    if (count === 1) continue; // skip header
    const cols = line.split(',');
    if (cols.length >= 16) {
      const email = cols[15] ? cols[15].trim() : '';
      const name = cols[14] ? cols[14].trim() : '';
      const officeId = cols[25] ? cols[25].trim() : '';
      
      if (email) emails.add(email);
      if (officeId) offices.add(officeId);
    }
    if (count > 500) break; // just sample first 500 lines
  }

  console.log(`\nFile: ${filename} (Sampled ${count} rows)`);
  console.log(`- Unique Emails: ${Array.from(emails).slice(0, 5).join(', ')}...`);
  console.log(`- Unique Office IDs: ${Array.from(offices).join(', ')}`);
}

async function main() {
  const files = ['cd.csv', 'dialpad_calls.csv', 'dialpad_new.csv'];
  for (const f of files) {
    await checkCsv(f);
  }
}

main().catch(console.error);
