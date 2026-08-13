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
  
  // Noah Barr's mobile from placements is: "+447949534088"
  // Let's test different formats
  const variants = [
    "+447949534088",
    "07949534088",
    "7949534088"
  ];

  for (const val of variants) {
    console.log(`\n=== Testing phone format: "${val}" ===`);
    
    // Search candidate
    const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encodeURIComponent(val)}`;
    const candRes = await fetchJson(candUrl);
    if (!candRes.error) {
      console.log(`Candidate Search: count = ${candRes.totalCount}`);
      if (candRes.data && candRes.data.length > 0) {
        console.log(`  -> Match: ${candRes.data[0].fullName} (${candRes.data[0].id})`);
      }
    }

    // Search contact
    const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encodeURIComponent(val)}`;
    const contactRes = await fetchJson(contactUrl);
    if (!contactRes.error) {
      console.log(`Contact Search: count = ${contactRes.totalCount}`);
      if (contactRes.data && contactRes.data.length > 0) {
        console.log(`  -> Match: ${contactRes.data[0].name || contactRes.data[0].fullName} (${contactRes.data[0].id})`);
      }
    }
  }
}

main().catch(console.error);
