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
  
  // Test Noah Barr's mobile
  const phone = "+447949534088";
  const cleanPhone = "07949534088";

  console.log("Testing GET to /nova/candidates/search and /nova/contacts/search");

  const urls = [
    // 1. Nova candidates GET search
    `https://api.recruitly.io/api/nova/candidates/search?apiKey=${apiKey}&q=Noah`,
    `https://api.recruitly.io/api/nova/candidates/search?apiKey=${apiKey}&q=${encodeURIComponent(phone)}`,
    `https://api.recruitly.io/api/nova/candidates/search?apiKey=${apiKey}&phone=${encodeURIComponent(phone)}`,
    
    // 2. Nova contacts GET search
    `https://api.recruitly.io/api/nova/contacts/search?apiKey=${apiKey}&q=Noah`,
    `https://api.recruitly.io/api/nova/contacts/search?apiKey=${apiKey}&q=${encodeURIComponent(phone)}`,
    `https://api.recruitly.io/api/nova/contacts/search?apiKey=${apiKey}&phone=${encodeURIComponent(phone)}`
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n--- Test ${i+1}: ${url.split('apiKey=')[0]} ---`);
    console.log(`Params: ${url.split('&').slice(1).join('&')}`);
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
