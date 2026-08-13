import fs from 'fs';
import path from 'path';

function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/DIALPAD_TOKEN_1\s*=\s*["']?([^"'\r\n]+)/);
  if (!match) {
    console.log('DIALPAD_TOKEN_1 not found.');
    return;
  }
  const token = match[1];
  console.log(`Token length: ${token.length}`);
  console.log(`Starts with: ${token.substring(0, 8)}`);
  console.log(`Ends with: ${token.substring(token.length - 8)}`);
}

main();
