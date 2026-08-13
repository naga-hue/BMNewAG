import fs from 'fs';
import https from 'https';

// Load .env.local variables manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

function fetchJson(url, token) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: true, statusCode: res.statusCode, body });
        }
      });
    }).on('error', (err) => resolve({ error: true, message: err.message }));
  });
}

async function main() {
  const token = env.DIALPAD_TOKEN_1;
  const callId = "5038326873530368"; // Wendy's call
  
  console.log(`Querying Dialpad API for Call ID: ${callId}`);
  const url = `https://dialpad.com/api/v2/call/${callId}`;
  const res = await fetchJson(url, token);
  
  if (res.error) {
    console.error("API Error:", res);
  } else {
    console.log("API Success! Call details:");
    console.log(`- state: "${res.state}"`);
    console.log(`- duration: ${res.duration} (type: ${typeof res.duration})`);
    console.log(`- total_duration: ${res.total_duration}`);
    console.log(`- talk_time: ${res.talk_time}`);
    console.log(`- date_started: ${res.date_started}`);
    console.log(`- date_connected: ${res.date_connected}`);
    console.log(`- date_ended: ${res.date_ended}`);
    console.log(`- wasRecorded: ${!!res.recording_url}`);
    console.log(`- recording_url: ${res.recording_url}`);
  }
}

main().catch(console.error);
