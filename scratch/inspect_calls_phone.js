import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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
  
  // Eileen Vermeulen ID
  const staffId = "staff-1782810939333-56-454";
  
  console.log("Querying calls for staff:", staffId);
  const q = query(
    collection(db, 'dialpad_calls'),
    where('dateStarted', '>=', '2026-08-11')
  );
  
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} total calls for today in database.`);

  const eileenCalls = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.handlerId === staffId) {
      eileenCalls.push({ id: d.id, ...data });
    }
  });

  console.log(`Eileen has ${eileenCalls.length} calls today.`);

  for (const call of eileenCalls.slice(0, 10)) {
    console.log(`\n--- Call ID: ${call.id} ---`);
    console.log(`externalName: "${call.externalName}"`);
    console.log(`externalNumber: "${call.externalNumber}"`);
    console.log(`target.phone: "${call.target?.phone}"`);
    console.log(`target.name: "${call.target?.name}"`);

    const phoneToSearch = call.externalNumber || (call.target && call.target.phone) || "";
    if (phoneToSearch) {
      const cleanPhone = phoneToSearch.replace(/[^0-9+]/g, '').trim();
      console.log(`Phone to search: "${cleanPhone}"`);
      
      // Test candidate search
      const candUrl = `https://api.recruitly.io/api/candidate/search?apiKey=${apiKey}&query=${encodeURIComponent(cleanPhone)}`;
      const candRes = await fetchJson(candUrl);
      const candCount = candRes.totalCount || 0;
      console.log(`Candidate search match count: ${candCount}`);
      if (candRes.data && candRes.data.length > 0) {
        console.log(`  -> Matched Candidate: ${candRes.data[0].fullName} (${candRes.data[0].id})`);
      }

      // Test contact search
      const contactUrl = `https://api.recruitly.io/api/contact/search?apiKey=${apiKey}&query=${encodeURIComponent(cleanPhone)}`;
      const contactRes = await fetchJson(contactUrl);
      const contactCount = contactRes.totalCount || 0;
      console.log(`Contact search match count: ${contactCount}`);
      if (contactRes.data && contactRes.data.length > 0) {
        console.log(`  -> Matched Contact: ${contactRes.data[0].fullName || contactRes.data[0].name} (${contactRes.data[0].id})`);
      }
    } else {
      console.log("No phone number found to query.");
    }
  }
}

main().catch(console.error);
