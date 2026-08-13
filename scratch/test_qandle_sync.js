import fs from 'fs';
import handler from '../api/qandle/sync.js';

// Load .env.local variables into process.env
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    val = val.replace(/\\n/g, '\n');
    process.env[key] = val;
  }
});

const mockReq = {
  method: 'GET',
  query: {
    secret: process.env.QANDLE_INGEST_SECRET || 'qandle-talent-kpi-hub-key-2026',
    bypassTimecheck: 'true'
  },
  headers: {}
};

const mockRes = {
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`Response Status: ${this.statusCode}`);
    console.log(`Response Data:`, JSON.stringify(data, null, 2));
  }
};

async function main() {
  console.log("Running local Qandle Sync trigger...");
  try {
    await handler(mockReq, mockRes);
  } catch (e) {
    console.error("Qandle Sync Handler error:", e);
  }
}

main();
