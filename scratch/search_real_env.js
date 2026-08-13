import fs from 'fs';
import path from 'path';

const files = ['.env', '.env.local', '.env.vercel'];

files.forEach(f => {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    console.log(`Checking ${f}...`);
    const content = fs.readFileSync(p, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key.includes('DIALPAD_TOKEN')) {
          console.log(`  Key: "${key}", Length: ${val.length}, Is Real: ${val.length > 15 && !val.includes('SENS')}`);
        }
      }
    });
  }
});
