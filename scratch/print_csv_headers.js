import fs from 'fs';
import readline from 'readline';

async function run() {
  const fileStream = fs.createReadStream('./import-data/dialpad_calls.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    console.log("Header line:");
    console.log(line);
    const parts = line.split(',');
    console.log("\nIndexed headers:");
    parts.forEach((p, i) => {
      console.log(`[${i}] ${p.trim()}`);
    });
    break;
  }
  process.exit(0);
}

run();
