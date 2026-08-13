import fs from 'fs';
import path from 'path';
import readline from 'readline';

function parseCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'import-data', 'Humres365.csv');
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let headers = [];
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) {
      headers = parseCsvRow(line);
      continue;
    }
    if (lineCount === 5) {
      const values = parseCsvRow(line);
      console.log(`Column count: Headers=${headers.length}, Values=${values.length}`);
      headers.forEach((h, idx) => {
        console.log(`[${idx}] ${h.padEnd(30)} : ${values[idx]}`);
      });
      break;
    }
  }
}

main().catch(console.error);
