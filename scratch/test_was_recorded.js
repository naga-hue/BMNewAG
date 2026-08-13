import fs from 'fs';
import readline from 'readline';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

async function run() {
  const fileStream = fs.createReadStream('./import-data/dialpad_calls.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  const values = new Set();
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const parts = parseCSVLine(line);
    if (parts[16]) {
      values.add(parts[16]);
    }
    if (lineCount > 1000) break;
  }
  console.log("Values found at index 16 in first 1000 lines:", Array.from(values));
  process.exit(0);
}

run();
