import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const lines = envFile.split('\n');
const keyLine = lines.find(l => l.startsWith('FIREBASE_PRIVATE_KEY'));
if (keyLine) {
  const raw = keyLine.split('=').slice(1).join('=');
  console.log("Raw keyLine value starts with:", raw.substring(0, 100));
  console.log("Raw keyLine value ends with:", raw.substring(raw.length - 100));
  console.log("Contains literal \\n (escaped):", raw.includes('\\n'));
  console.log("Contains actual newline characters:", raw.includes('\n'));
} else {
  console.log("FIREBASE_PRIVATE_KEY not found in .env.local");
}
