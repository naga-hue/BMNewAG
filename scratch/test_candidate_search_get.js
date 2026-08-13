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

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
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

  const apiKey = humresCompany.recruitlyApiKey;
  
  // Test Noah Barr
  const testVal = "Noah";

  const urls = [
    `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${testVal}`,
    `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&term=${testVal}`,
    `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&keyword=${testVal}`,
    `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&search=${testVal}`,

    `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${testVal}`,
    `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&term=${testVal}`,
    `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&q=${testVal}`
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n--- Test ${i+1}: ${url.split('apiKey=')[0]}...&${url.split('&').slice(1).join('&')} ---`);
    const res = await fetchJson(url);
    if (res.error) {
      console.log(`  -> Status ${res.statusCode || ''}`);
      if (res.body) {
        console.log(`  -> Response: ${res.body.substring(0, 150)}`);
      }
    } else {
      console.log(`  -> Success! Keys:`, Object.keys(res));
      console.log(`  -> Total Count: ${res.totalCount || res.total || 0}`);
      if (res.data && res.data.length > 0) {
        console.log(`  -> First Match: Name = "${res.data[0].fullName || res.data[0].name}", ID = "${res.data[0].id}"`);
      }
    }
  }
}

main().catch(console.error);
