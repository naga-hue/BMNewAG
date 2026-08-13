import fs from 'fs';
import readline from 'readline';

// Custom quote-aware CSV line splitter
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
  let headers = [];
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) {
      headers = parseCSVLine(line);
      continue;
    }
    
    const parts = parseCSVLine(line);
    console.log(`\n--- Record ${lineCount - 1} ---`);
    parts.forEach((val, idx) => {
      if (val) {
        console.log(`${headers[idx]} [${idx}]: "${val}"`);
      }
    });

    if (lineCount > 3) break;
  }
  process.exit(0);
}

run();
