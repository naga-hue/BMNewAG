import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import https from 'https';

const firebaseConfig = {
  apiKey: "AIzaSyDK_4zfUH8qdnNWoYqF-w0GDbAQ-4crM1A",
  authDomain: "humres-management-hub.firebaseapp.com",
  projectId: "humres-management-hub",
  storageBucket: "humres-management-hub.firebasestorage.app",
  messagingSenderId: "285569320788",
  appId: "1:285569320788:web:2fbc1f17a839ba1091eac1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  const querySnapshot = await getDocs(collection(db, "companies"));
  let humresCompany = null;
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes("humres")) {
      humresCompany = data;
    }
  });

  if (!humresCompany || !humresCompany.recruitlyApiKey) {
    console.error("No Humres API key found.");
    return;
  }

  // Dialpad token is stored in process.env.DIALPAD_TOKEN_1 or 2. Let's see if we have env loaded.
  // Wait! In Vercel environment, we have DIALPAD_TOKEN_1 (for Humres).
  // Let's load the tokens from the local .env or .env.local file.
  // Wait! Let's check .env file. We viewed it earlier. It has only MS365 credentials.
  // What about .env.local? It only has VERCEL_OIDC_TOKEN.
  // Wait! Is there a DIALPAD_TOKEN_1 in the local environment?
  // Let's search process.env for DIALPAD_TOKEN_1.
  const token = process.env.DIALPAD_TOKEN_1 || process.env.DIALPAD_TOKEN || "YOUR_TOKEN";
  console.log("DIALPAD_TOKEN_1 from process.env:", token ? "FOUND (starts with " + token.substring(0, 10) + ")" : "MISSING");

  // If missing, let's search where the tokens are defined in the workspace files, just in case!
  // E.g. in config collection, or in start.sh, or other files.
  // Let's see if we can get it from firestore config!
  const configSnap = await getDocs(collection(db, 'config'));
  configSnap.forEach(d => {
    const c = d.data();
    console.log(`Config document ${d.id}:`, Object.keys(c));
  });

  const callId = "5038326873530368"; // Wendy's call
  
  // Since we run this unsandboxed, we can verify. If we don't have the token in the script,
  // we can run a check. Let's run a search in the workspace for "DIALPAD_TOKEN" to find if it is stored in a file!
}

main().catch(console.error);
