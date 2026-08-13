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

function postJson(url, body) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: true, statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => resolve({ error: true, message: err.message }));
    req.write(JSON.stringify(body));
    req.end();
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

  const apiKey = humresCompany.recruitlyApiKey;
  
  // Test Noah Barr's info
  const phone = "+447949534088";

  console.log("Testing POST to /candidate and /contact");

  const tests = [
    {
      url: `https://api.recruitly.io/api/candidate?apiKey=${apiKey}`,
      body: { q: "Noah" }
    },
    {
      url: `https://api.recruitly.io/api/candidate?apiKey=${apiKey}`,
      body: { query: "Noah" }
    },
    {
      url: `https://api.recruitly.io/api/candidate?apiKey=${apiKey}`,
      body: { phone: phone }
    },
    {
      url: `https://api.recruitly.io/api/contact?apiKey=${apiKey}`,
      body: { q: "Noah" }
    },
    {
      url: `https://api.recruitly.io/api/contact?apiKey=${apiKey}`,
      body: { phone: phone }
    }
  ];

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    console.log(`\n--- Test ${i+1}: ${t.url.split('apiKey=')[0]} ---`);
    console.log(`Body: ${JSON.stringify(t.body)}`);
    const res = await postJson(t.url, t.body);
    if (res.error) {
      console.log(`Error: Status ${res.statusCode || ''}`);
      if (res.body) {
        console.log(`Response: ${res.body.substring(0, 150)}`);
      }
    } else {
      console.log(`Success! Keys:`, Object.keys(res));
      console.log(`Total: ${res.totalCount || res.total || 0}`);
      if (res.data && res.data.length > 0) {
        console.log(`First Match:`, res.data[0].fullName || res.data[0].name || res.data[0].id);
      }
    }
  }
}

main().catch(console.error);
