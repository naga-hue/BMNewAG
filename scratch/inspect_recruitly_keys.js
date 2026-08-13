import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function run() {
  try {
    // 1. Inspect companies
    console.log("Checking 'companies' collection:");
    const compSnap = await getDocs(collection(db, 'companies'));
    compSnap.forEach(d => {
      const c = d.data();
      console.log(`- Company ID: ${d.id}, Name: ${c.name}, Has recruitlyApiKey: ${!!c.recruitlyApiKey}`);
      if (c.recruitlyApiKey) {
        console.log(`  ApiKey: "${c.recruitlyApiKey.substring(0, 10)}..."`);
      }
    });

    // 2. Inspect staff
    console.log("\nChecking 'staff' collection:");
    const staffSnap = await getDocs(collection(db, 'staff'));
    staffSnap.forEach(d => {
      const s = d.data();
      if (s.recruitlyEmail) {
        console.log(`- Staff Name: ${s.fullName}, Recruitly Email: ${s.recruitlyEmail}`);
      }
    });

    // 3. Inspect config
    console.log("\nChecking 'config' collection:");
    const configSnap = await getDocs(collection(db, 'config'));
    configSnap.forEach(d => {
      console.log(`- Config Document ID: ${d.id}, keys: ${Object.keys(d.data()).join(', ')}`);
    });

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
