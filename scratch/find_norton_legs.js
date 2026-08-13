import fs from 'fs';
import path from 'path';

function main() {
  const rawPath = path.join(process.cwd(), 'scratch', 'dialpad_raw_calls.json');
  if (!fs.existsSync(rawPath)) {
    console.error('File not found.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  
  // Find all legs for Lee Norton
  const legs = data.calls.filter(c => (c.contact?.phone || '').includes('7704616441'));
  
  console.log(`Found ${legs.length} legs for Lee Norton:`);
  console.log(JSON.stringify(legs, null, 2));
}

main();
