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
  
  // Test number
  const testPhone = "+447441992672"; 
  const cleanPhone = "07441992672";

  console.log("Humres CRM ApiKey found.");

  // Test endpoints
  const urlsToTest = [
    // 1. candidates search by phone/q
    `https://api.recruitly.io/api/nova/candidates?apiKey=${apiKey}&phone=${encodeURIComponent(testPhone)}`,
    `https://api.recruitly.io/api/nova/candidates?apiKey=${apiKey}&q=${encodeURIComponent(testPhone)}`,
    `https://api.recruitly.io/api/nova/candidates?apiKey=${apiKey}&phone=${encodeURIComponent(cleanPhone)}`,
    
    // 2. candidate (non-nova) search
    `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&phone=${encodeURIComponent(cleanPhone)}`,
    `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&q=${encodeURIComponent(cleanPhone)}`,

    // 3. contacts search
    `https://api.recruitly.io/api/nova/contacts?apiKey=${apiKey}&phone=${encodeURIComponent(testPhone)}`,
    `https://api.recruitly.io/api/nova/contacts?apiKey=${apiKey}&q=${encodeURIComponent(testPhone)}`,
    `https://api.recruitly.io/api/nova/contacts?apiKey=${apiKey}&phone=${encodeURIComponent(cleanPhone)}`,

    // 4. general search / autocomplete
    `https://api.recruitly.io/api/nova/search?apiKey=${apiKey}&q=${encodeURIComponent(cleanPhone)}`
  ];

  for (let i = 0; i < urlsToTest.length; i++) {
    const url = urlsToTest[i];
    console.log(`\n--- Test ${i+1}: URL = ${url.split('apiKey=')[0]}apiKey=...${url.split('apiKey=')[1]?.substring(20)} ---`);
    const res = await fetchJson(url);
    if (res.error) {
      console.log(`Error or Status ${res.statusCode || ''}`);
      if (res.body) {
        console.log(`Body: ${res.body.substring(0, 200)}`);
      }
    } else {
      console.log("Success! Keys in response:", Object.keys(res));
      console.log("Data sample:", JSON.stringify(res, null, 2).substring(0, 500));
    }
  }
}

main().catch(console.error);
