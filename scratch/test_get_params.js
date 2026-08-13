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
  
  // Let's test candidate queries
  const tests = [
    // 1. Candidate by name query
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&q=Noah`,
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&name=Noah`,
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&query=Noah`,
    
    // 2. Candidate by phone variants
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&q=07949534088`,
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&phone=07949534088`,
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&mobile=07949534088`,
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&q=${encodeURIComponent("+447949534088")}`,

    // 3. Contact by name query
    `https://api.recruitly.io/api/contact?apiKey=${apiKey}&q=Noah`,
    `https://api.recruitly.io/api/contact?apiKey=${apiKey}&name=Noah`,
    `https://api.recruitly.io/api/contact?apiKey=${apiKey}&q=07949534088`
  ];

  for (let i = 0; i < tests.length; i++) {
    const url = tests[i];
    console.log(`\n--- Test ${i+1}: ${url.split('apiKey=')[0]} ---`);
    console.log(`Params: ${url.split('&').slice(1).join('&')}`);
    const res = await fetchJson(url);
    if (res.error) {
      console.log(`Error: Status ${res.statusCode || ''}`);
    } else {
      console.log(`Success! Total Count: ${res.totalCount}`);
      if (res.data && res.data.length > 0) {
        console.log(`Data count: ${res.data.length}`);
        console.log(`First item match: Name = "${res.data[0].fullName || res.data[0].name}", ID = "${res.data[0].id}"`);
      }
    }
  }
}

main().catch(console.error);
