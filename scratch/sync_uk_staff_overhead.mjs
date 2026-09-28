import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, updateDoc } from "firebase/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const config = {};
envContent.split("\n").forEach(line => {
  const [k, ...v] = line.split("=");
  if (k && v.length) {
    config[k.trim()] = v.join("=").trim().replace(/^[\"\x27]|[\"\x27]$/g, "");
  }
});

const firebaseConfig = {
  apiKey: config.VITE_FIREBASE_API_KEY,
  authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: config.VITE_FIREBASE_PROJECT_ID,
  storageBucket: config.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const UK_STAFF_IDS = {
  ALEX_MOORE: 'staff-1782810939333-53-694',
  DANNY_COLEMAN: 'staff-1782810939333-52-647',
  EMMETT_GRIFFIN: 'staff-1782810939333-50-8',
  WILLIAM_CHAMPKEN: 'staff-1782810939333-54-893',
};

const OVERHEAD_MATRIX = [
  // Alex Moore
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-01', regularHours: 2500, bonus: 0, gross: 2500, royalLondon: 59.40, employerNi: 312.45, employerContrib: 371.85, total: 2871.85 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-02', regularHours: 2500, bonus: 698, gross: 3198, royalLondon: 80.34, employerNi: 417.15, employerContrib: 497.49, total: 3695.49 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-03', regularHours: 2500, bonus: 813, gross: 3313, royalLondon: 83.79, employerNi: 434.40, employerContrib: 518.19, total: 3831.19 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-04', regularHours: 2500, bonus: 1015, gross: 3515, royalLondon: 89.85, employerNi: 464.70, employerContrib: 554.55, total: 4069.55 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-05', regularHours: 2500, bonus: 3429, gross: 5929, royalLondon: 110.07, employerNi: 826.80, employerContrib: 936.87, total: 6865.87 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-06', regularHours: 2500, bonus: 5163, gross: 7663, royalLondon: 110.07, employerNi: 1086.90, employerContrib: 1196.97, total: 8859.97 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-07', regularHours: 2500, bonus: 1251.62, gross: 3751.62, royalLondon: 96.95, employerNi: 500.19, employerContrib: 597.14, total: 4348.76 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-08', regularHours: 2500, bonus: 2696.50, gross: 5196.50, royalLondon: 110.07, employerNi: 716.92, employerContrib: 826.99, total: 6023.49 },
  { staffId: UK_STAFF_IDS.ALEX_MOORE, name: 'Alex Moore', month: '2026-09', regularHours: 2500, bonus: 5830, gross: 8330, royalLondon: 110.07, employerNi: 1186.95, employerContrib: 1297.02, total: 9627.02 },

  // Danny Coleman
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-01', regularHours: 2708.33, bonus: 3438, gross: 6146.33, royalLondon: 110.07, employerNi: 859.40, employerContrib: 969.47, total: 7115.80 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-02', regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-03', regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-04', regularHours: 2708.33, bonus: 1000, gross: 3708.33, royalLondon: 95.65, employerNi: 493.70, employerContrib: 589.35, total: 4297.68 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-05', regularHours: 2708.33, bonus: 150, gross: 2858.33, royalLondon: 70.15, employerNi: 366.20, employerContrib: 436.35, total: 3294.68 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-06', regularHours: 2708.33, bonus: 609, gross: 3317.33, royalLondon: 83.92, employerNi: 435.05, employerContrib: 518.97, total: 3836.30 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-07', regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-08', regularHours: 2708.33, bonus: 2800, gross: 5508.33, royalLondon: 110.07, employerNi: 763.70, employerContrib: 873.77, total: 6382.10 },
  { staffId: UK_STAFF_IDS.DANNY_COLEMAN, name: 'Danny Coleman', month: '2026-09', regularHours: 2708.33, bonus: 1337.50, gross: 4045.83, royalLondon: 105.78, employerNi: 544.32, employerContrib: 650.10, total: 4695.93 },

  // Emmett Griffin
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-01', regularHours: 3791.67, bonus: 48, gross: 3839.67, royalLondon: 99.60, employerNi: 513.40, employerContrib: 613.00, total: 4452.67 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-02', regularHours: 3791.67, bonus: 1582, gross: 5373.67, royalLondon: 110.07, employerNi: 743.50, employerContrib: 853.57, total: 6227.24 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-03', regularHours: 3791.67, bonus: 4145, gross: 7936.67, royalLondon: 110.07, employerNi: 1127.95, employerContrib: 1238.02, total: 9174.69 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-04', regularHours: 3791.67, bonus: 4558, gross: 8349.67, royalLondon: 110.07, employerNi: 1189.90, employerContrib: 1299.97, total: 9649.64 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-05', regularHours: 3791.67, bonus: 4982, gross: 8773.67, royalLondon: 110.07, employerNi: 1253.50, employerContrib: 1363.57, total: 10137.24 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-06', regularHours: 3791.67, bonus: 1756, gross: 5547.67, royalLondon: 110.07, employerNi: 769.60, employerContrib: 879.67, total: 6427.34 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-07', regularHours: 3791.67, bonus: 2389.43, gross: 6181.10, royalLondon: 110.70, employerNi: 864.61, employerContrib: 975.31, total: 7156.41 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-08', regularHours: 3791.67, bonus: 8119.65, gross: 11911.32, royalLondon: 110.07, employerNi: 1724.15, employerContrib: 1834.22, total: 13745.54 },
  { staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, name: 'Emmett Griffin', month: '2026-09', regularHours: 3791.67, bonus: 2245.32, gross: 6036.99, royalLondon: 110.07, employerNi: 843.00, employerContrib: 953.07, total: 6990.06 },

  // William Champken
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-01', regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-02', regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-03', regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-04', regularHours: 4166.67, bonus: 617, gross: 4783.67, royalLondon: 110.07, employerNi: 655.00, employerContrib: 765.07, total: 5548.74 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-05', regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 502.54, employerContrib: 612.61, total: 4987.61 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-06', regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-07', regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.70, employerNi: 593.70, employerContrib: 704.40, total: 5079.40 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-08', regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77 },
  { staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, name: 'William Champken', month: '2026-09', regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77 },
];

async function sync() {
  console.log(`Writing ${OVERHEAD_MATRIX.length} payroll records to Firestore...`);
  
  for (const item of OVERHEAD_MATRIX) {
    const id = `${item.staffId}_${item.month}`;
    const docRef = doc(db, "payrollRecords", id);
    const data = {
      id,
      staffId: item.staffId,
      month: item.month,
      basicSalary: item.regularHours,
      bonus: item.bonus,
      gross: item.gross,
      employerPension: item.royalLondon,
      employerNi: item.employerNi,
      totalEmployerContributions: item.employerContrib,
      costToCompany: item.total,
      isReconciled: true,
      commission: 0,
      reimbursements: 0,
      employeeTaxNic: 0,
      employeePension: 0,
      notes: `Mapped from Humres Employee Overhead Jan-Sep 2026. Regular Hours: £${item.regularHours}, Bonus: £${item.bonus}, Royal London: £${item.royalLondon}, Employer NI: £${item.employerNi}`
    };

    await setDoc(docRef, data, { merge: true });
    console.log(`Saved ${id}: ${item.name} | ${item.month} | Basic: £${item.regularHours} | Bonus: £${item.bonus} | Total: £${item.total}`);
  }

  console.log("\nChecking and aligning expense links for UK staff...");
  const expSnap = await getDocs(collection(db, "expenses"));
  const staffIdList = Object.values(UK_STAFF_IDS);
  let updatedExpenses = 0;

  for (const d of expSnap.docs) {
    const data = d.data();
    if (staffIdList.includes(data.recipientId)) {
      const month = data.plMonth || (data.date && data.date !== 'Bulk Selection' ? data.date.substring(0, 7) : '');
      const expectedCellId = `${data.recipientId}_${month}`;
      if (month && data.linkedPayrollCellId !== expectedCellId) {
        await updateDoc(d.ref, {
          linkedPayrollCellId: expectedCellId
        });
        updatedExpenses++;
        console.log(`Updated expense ${d.id}: linkedPayrollCellId -> ${expectedCellId}`);
      }
    }
  }

  console.log(`\nSynchronization complete! ${OVERHEAD_MATRIX.length} payroll records synced. ${updatedExpenses} expenses re-aligned.`);
}

sync().catch(console.error);
