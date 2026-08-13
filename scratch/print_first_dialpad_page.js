import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

function loadEnvToken() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found in CWD.');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  let match = content.match(/DIALPAD_TOKEN_2\s*=\s*["']?([^"'\r\n]+)/);
  if (!match) {
    match = content.match(/DIALPAD_TOKEN_1\s*=\s*["']?([^"'\r\n]+)/);
  }
  return match[1];
}

async function main() {
  const dialpadToken = loadEnvToken();
  const url = 'https://dialpad.com/api/v2/call?limit=1';
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${dialpadToken}`,
      'Accept': 'application/json'
    }
  });

  const payload = await res.json();
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(console.error);
