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
  
  // Let's get placements
  console.log("Checking 'placements' collection in Firestore...");
  const plSnap = await getDocs(collection(db, "placements"));
  
  for (const doc of plSnap.docs) {
    const p = doc.data();
    if (p.placementId && !p.placementId.includes("mock") && p.crmCandidateId) {
      const candidateId = p.crmCandidateId;
      const candidateName = p.candidateName;

      console.log(`Found candidate "${candidateName}" with Recruitly ID: "${candidateId}"`);

      // Fetch full details from Recruitly
      const candidateUrl = `https://api.recruitly.io/api/nova/candidates/${candidateId}?apiKey=${apiKey}`;
      const candDetails = await fetchJson(candidateUrl);
      
      if (candDetails.error || !candDetails.data) {
        console.log(`Failed to fetch candidate details or empty data for ${candidateName}`);
        continue;
      }

      const info = candDetails.data;
      const phone = info.phone || info.mobile || info.mobileNumber || info.phoneNumber || "";
      console.log(`Candidate phone number: "${phone}"`);

      if (!phone) {
        console.log("No phone number for this candidate, checking next...");
        continue;
      }

      // Now, test searching by this phone number
      const searchUrl1 = `https://api.recruitly.io/api/candidate?apiKey=${apiKey}&phone=${encodeURIComponent(phone)}`;
      console.log(`\nSearching via phone: ${searchUrl1.split('apiKey=')[0]}apiKey=...`);
      const sRes1 = await fetchJson(searchUrl1);
      console.log("Search result keys:", Object.keys(sRes1));
      console.log("Total Count:", sRes1.totalCount);
      if (sRes1.data && sRes1.data.length > 0) {
        console.log("Match found! Name:", sRes1.data[0].fullName || sRes1.data[0].name);
        console.log("Matched ID:", sRes1.data[0].id);
      }

      // Let's test searching contacts as well
      const contactUrl = `https://api.recruitly.io/api/contact?apiKey=${apiKey}&phone=${encodeURIComponent(phone)}`;
      console.log(`\nSearching contact via: ${contactUrl.split('apiKey=')[0]}apiKey=...`);
      const cRes = await fetchJson(contactUrl);
      console.log("Contact search result keys:", Object.keys(cRes));
      console.log("Total Count:", cRes.totalCount);
      break;
    }
  }
}

main().catch(console.error);
