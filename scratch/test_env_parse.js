import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
console.log("Checking path:", envLocalPath);
console.log("Exists:", fs.existsSync(envLocalPath));

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key.includes('DIALPAD_TOKEN')) {
        console.log(`Key: "${key}", Length: ${val.length}, Starts with: "${val.substring(0, 5)}...", Ends with: "...${val.substring(val.length - 5)}"`);
      }
    }
  });
}
