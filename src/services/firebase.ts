import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { Company, Staff, Expense, Placement, Vendor, NominalCode, PayrollRecord } from '../types';

export interface FirebaseServiceInterface {
  isConfigured(): boolean;
  subscribeCompanies(onUpdate: (companies: Company[]) => void, fallbackData?: Company[]): () => void;
  saveCompany(company: Company): Promise<Company>;
  deleteCompany(companyId: string): Promise<boolean>;
  uploadFile(companyId: string, file: File, docType: string): Promise<any>;
  deleteFile(companyId: string, docType: string, fileId: string, fileName: string): Promise<boolean>;
  subscribeStaff(onUpdate: (staff: Staff[]) => void, fallbackData?: Staff[]): () => void;
  saveStaff(staff: Staff): Promise<Staff>;
  deleteStaff(staffId: string): Promise<boolean>;
  subscribeLeavePolicies(onUpdate: (policies: any[]) => void, fallbackData?: any[]): () => void;
  saveLeavePolicy(policy: any): Promise<any>;
  deleteLeavePolicy(policyId: string): Promise<boolean>;
  subscribeHolidays(onUpdate: (holidays: any[]) => void, fallbackData?: any[]): () => void;
  saveHoliday(holiday: any): Promise<any>;
  deleteHoliday(holidayId: string): Promise<boolean>;
  subscribeLeaveRequests(onUpdate: (requests: any[]) => void, fallbackData?: any[]): () => void;
  saveLeaveRequest(request: any): Promise<any>;
  deleteLeaveRequest(requestId: string): Promise<boolean>;
  subscribeCommissionPolicies(onUpdate: (policies: any[]) => void, fallbackData?: any[]): () => void;
  saveCommissionPolicy(policy: any): Promise<any>;
  deleteCommissionPolicy(policyId: string): Promise<boolean>;
  subscribeVendors(onUpdate: (vendors: Vendor[]) => void, fallbackData?: Vendor[]): () => void;
  saveVendor(vendor: Vendor): Promise<Vendor>;
  deleteVendor(vendorId: string): Promise<boolean>;
  subscribeContracts(onUpdate: (contracts: any[]) => void, fallbackData?: any[]): () => void;
  saveContract(contract: any): Promise<any>;
  deleteContract(contractId: string): Promise<boolean>;
  subscribeAssetAssignments(onUpdate: (assignments: any[]) => void, fallbackData?: any[]): () => void;
  saveAssetAssignment(assignment: any): Promise<any>;
  deleteAssetAssignment(assignmentId: string): Promise<boolean>;
  subscribePlacements(onUpdate: (placements: Placement[]) => void, fallbackData?: Placement[]): () => void;
  savePlacement(placement: Placement): Promise<Placement>;
  deletePlacement(placementId: string): Promise<boolean>;
  subscribeExpenses(onUpdate: (expenses: Expense[]) => void, fallbackData?: Expense[]): () => void;
  saveExpense(expense: Expense): Promise<Expense>;
  deleteExpense(expenseId: string): Promise<boolean>;
  subscribeNominalCodes(onUpdate: (codes: NominalCode[]) => void, fallbackData?: NominalCode[]): () => void;
  saveNominalCode(code: NominalCode): Promise<NominalCode>;
  deleteNominalCode(codeId: string): Promise<boolean>;
  subscribeAuditLogs(onUpdate: (logs: any[]) => void, fallbackData?: any[]): () => void;
  saveAuditLog(log: any): Promise<any>;
  subscribePayrollRecords(onUpdate: (records: PayrollRecord[]) => void, fallbackData?: PayrollRecord[]): () => void;
  savePayrollRecord(record: PayrollRecord): Promise<PayrollRecord>;
  deletePayrollRecord(recordId: string): Promise<boolean>;
  subscribePayrollPolicies(onUpdate: (policies: any[]) => void, fallbackData?: any[]): () => void;
  savePayrollPolicy(policy: any): Promise<any>;
  deletePayrollPolicy(policyId: string): Promise<boolean>;
  subscribeLetterTemplates(onUpdate: (templates: any[]) => void, fallbackData?: any[]): () => void;
  saveLetterTemplate(template: any): Promise<any>;
  deleteLetterTemplate(templateId: string): Promise<boolean>;
  subscribeExitSettings(onUpdate: (settings: any) => void, fallbackData?: any): () => void;
  saveExitSettings(settings: any): Promise<any>;
}

// Check if Firebase configuration is provided
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_api_key_here'
);

let app: any = null;
let db: any = null;
let storage: any = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Initialize Firestore with modern persistent caching and multi-tab management
    db = initializeFirestore(app, {
      cache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalAutoDetectLongPolling: true
    });

    storage = getStorage(app);
    console.log("Firebase Backend initialized successfully with persistent cache!");
  } catch (error) {
    console.error("Failed to initialize Firebase app:", error);
  }
} else {
  console.log("Firebase configuration keys missing. Running in Local Storage Mode.");
}

// Service exports with Firebase / Local Storage fallback
export const firebaseService: FirebaseServiceInterface = {
  isConfigured() {
    return isConfigured;
  },

  /* ==========================================
     COMPANY MANAGEMENT SERVICES
     ========================================== */
    subscribeCompanies(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-companies');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'companies');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-companies', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore companies snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveCompany(company) {
    if (isConfigured && db) {
      const docRef = doc(db, 'companies', company.id);
      await setDoc(docRef, company);
      return company;
    } else {
      const local = localStorage.getItem('bm-companies');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(c => c.id === company.id);
      
      if (index > -1) {
        list[index] = company;
      } else {
        list.unshift(company);
      }
      
      localStorage.setItem('bm-companies', JSON.stringify(list));
      return company;
    }
  },

  async deleteCompany(companyId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'companies', companyId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-companies');
      if (local) {
        const list = JSON.parse(local).filter(c => c.id !== companyId);
        localStorage.setItem('bm-companies', JSON.stringify(list));
      }
      return true;
    }
  },

  async uploadFile(companyId, file, docType) {
    const fileSizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;
    
    const docId = `doc-${Date.now()}`;
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    if (isConfigured && storage && db) {
      const fileRef = ref(storage, `companies/${companyId}/${docType}/${cleanFileName}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        id: docId,
        type: docType,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: fileSizeStr,
        url: downloadUrl,
        storagePath: `companies/${companyId}/${docType}/${cleanFileName}`
      };
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: file.size > 1.5 * 1024 * 1024 ? '#' : reader.result
          });
        };
        if (file.size > 1.5 * 1024 * 1024) {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: '#'
          });
        } else {
          reader.readAsDataURL(file);
        }
      });
    }
  },

  async deleteFile(docObj) {
    if (isConfigured && storage && docObj.storagePath) {
      try {
        const fileRef = ref(storage, docObj.storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.error("Error deleting file from storage:", err);
      }
      return true;
    }
    return true;
  },

  /* ==========================================
     STAFF MANAGEMENT SERVICES
     ========================================== */
    subscribeStaff(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-staff');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'staff');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-staff', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore staff snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveStaff(staffMember) {
    if (isConfigured && db) {
      const docRef = doc(db, 'staff', staffMember.id);
      await setDoc(docRef, staffMember);
      return staffMember;
    } else {
      const local = localStorage.getItem('bm-staff');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(s => s.id === staffMember.id);
      
      if (index > -1) {
        list[index] = staffMember;
      } else {
        list.unshift(staffMember);
      }
      
      localStorage.setItem('bm-staff', JSON.stringify(list));
      return staffMember;
    }
  },

  async deleteStaff(staffId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'staff', staffId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-staff');
      if (local) {
        const list = JSON.parse(local).filter(s => s.id !== staffId);
        localStorage.setItem('bm-staff', JSON.stringify(list));
      }
      return true;
    }
  },

  async clearStaff(staffList = []) {
    if (isConfigured && db) {
      for (const s of staffList) {
        const docRef = doc(db, 'staff', s.id);
        await deleteDoc(docRef);
      }
      return true;
    } else {
      localStorage.setItem('bm-staff', JSON.stringify([]));
      return true;
    }
  },

  async uploadStaffFile(staffId, file, docType) {
    const fileSizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;
    
    const docId = `sdoc-${Date.now()}`;
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    if (isConfigured && storage && db) {
      const fileRef = ref(storage, `staff/${staffId}/${docType}/${cleanFileName}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        id: docId,
        type: docType,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: fileSizeStr,
        url: downloadUrl,
        storagePath: `staff/${staffId}/${docType}/${cleanFileName}`
      };
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: file.size > 1.5 * 1024 * 1024 ? '#' : reader.result
          });
        };
        if (file.size > 1.5 * 1024 * 1024) {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: '#'
          });
        } else {
          reader.readAsDataURL(file);
        }
      });
    }
  },

  /* ==========================================
     LEAVE & HOLIDAY MODULE SERVICES
     ========================================== */
    subscribeLeavePolicies(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-leave-policies');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'leavePolicies');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-leave-policies', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore leavePolicies snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveLeavePolicy(policy) {
    if (isConfigured && db) {
      const docRef = doc(db, 'leavePolicies', policy.id);
      await setDoc(docRef, policy);
      return policy;
    } else {
      const local = localStorage.getItem('bm-leave-policies');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(p => p.id === policy.id);
      if (index > -1) {
        list[index] = policy;
      } else {
        list.unshift(policy);
      }
      localStorage.setItem('bm-leave-policies', JSON.stringify(list));
      return policy;
    }
  },

  async deleteLeavePolicy(policyId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'leavePolicies', policyId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-leave-policies');
      if (local) {
        const list = JSON.parse(local).filter(p => p.id !== policyId);
        localStorage.setItem('bm-leave-policies', JSON.stringify(list));
      }
      return true;
    }
  },

    subscribeHolidays(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-holidays');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'holidays');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-holidays', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore holidays snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveHoliday(holiday) {
    if (isConfigured && db) {
      const docRef = doc(db, 'holidays', holiday.id);
      await setDoc(docRef, holiday);
      return holiday;
    } else {
      const local = localStorage.getItem('bm-holidays');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(h => h.id === holiday.id);
      if (index > -1) {
        list[index] = holiday;
      } else {
        list.unshift(holiday);
      }
      localStorage.setItem('bm-holidays', JSON.stringify(list));
      return holiday;
    }
  },

  async deleteHoliday(holidayId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'holidays', holidayId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-holidays');
      if (local) {
        const list = JSON.parse(local).filter(h => h.id !== holidayId);
        localStorage.setItem('bm-holidays', JSON.stringify(list));
      }
      return true;
    }
  },

    subscribeLeaveRequests(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-leave-requests');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'leaveRequests');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-leave-requests', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore leaveRequests snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveLeaveRequest(request) {
    if (isConfigured && db) {
      const docRef = doc(db, 'leaveRequests', request.id);
      await setDoc(docRef, request);
      return request;
    } else {
      const local = localStorage.getItem('bm-leave-requests');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(r => r.id === request.id);
      if (index > -1) {
        list[index] = request;
      } else {
        list.unshift(request);
      }
      localStorage.setItem('bm-leave-requests', JSON.stringify(list));
      return request;
    }
  },

  async deleteLeaveRequest(requestId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'leaveRequests', requestId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-leave-requests');
      if (local) {
        const list = JSON.parse(local).filter(r => r.id !== requestId);
        localStorage.setItem('bm-leave-requests', JSON.stringify(list));
      }
      return true;
    }
  },

  /* ==========================================
     COMMISSION SCHEMES MODULE SERVICES
     ========================================== */
    subscribeCommissionPolicies(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-commission-policies');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'commissionPolicies');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-commission-policies', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore commissionPolicies snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveCommissionPolicy(policy) {
    if (isConfigured && db) {
      const docRef = doc(db, 'commissionPolicies', policy.id);
      await setDoc(docRef, policy);
      return policy;
    } else {
      const local = localStorage.getItem('bm-commission-policies');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(p => p.id === policy.id);
      if (index > -1) {
        list[index] = policy;
      } else {
        list.unshift(policy);
      }
      localStorage.setItem('bm-commission-policies', JSON.stringify(list));
      return policy;
    }
  },

  async deleteCommissionPolicy(policyId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'commissionPolicies', policyId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-commission-policies');
      if (local) {
        const list = JSON.parse(local).filter(p => p.id !== policyId);
        localStorage.setItem('bm-commission-policies', JSON.stringify(list));
      }
      return true;
    }
  },

  /* ==========================================
     VENDOR & ASSETS MODULE SERVICES
     ========================================== */
    subscribeVendors(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-vendors');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'vendors');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-vendors', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore vendors snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveVendor(vendor) {
    if (isConfigured && db) {
      const docRef = doc(db, 'vendors', vendor.id);
      await setDoc(docRef, vendor);
      return vendor;
    } else {
      const local = localStorage.getItem('bm-vendors');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(v => v.id === vendor.id);
      if (index > -1) {
        list[index] = vendor;
      } else {
        list.unshift(vendor);
      }
      localStorage.setItem('bm-vendors', JSON.stringify(list));
      return vendor;
    }
  },

  async deleteVendor(vendorId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'vendors', vendorId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-vendors');
      if (local) {
        const list = JSON.parse(local).filter(v => v.id !== vendorId);
        localStorage.setItem('bm-vendors', JSON.stringify(list));
      }
      return true;
    }
  },

    subscribeContracts(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-contracts');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'contracts');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-contracts', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore contracts snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveContract(contract) {
    if (isConfigured && db) {
      const docRef = doc(db, 'contracts', contract.id);
      await setDoc(docRef, contract);
      return contract;
    } else {
      const local = localStorage.getItem('bm-contracts');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(c => c.id === contract.id);
      if (index > -1) {
        list[index] = contract;
      } else {
        list.unshift(contract);
      }
      localStorage.setItem('bm-contracts', JSON.stringify(list));
      return contract;
    }
  },

  async deleteContract(contractId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'contracts', contractId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-contracts');
      if (local) {
        const list = JSON.parse(local).filter(c => c.id !== contractId);
        localStorage.setItem('bm-contracts', JSON.stringify(list));
      }
      return true;
    }
  },

    subscribeAssetAssignments(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-asset-assignments');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'assetAssignments');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-asset-assignments', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore assetAssignments snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveAssetAssignment(assignment) {
    if (isConfigured && db) {
      const docRef = doc(db, 'assetAssignments', assignment.id);
      await setDoc(docRef, assignment);
      return assignment;
    } else {
      const local = localStorage.getItem('bm-asset-assignments');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(a => a.id === assignment.id);
      if (index > -1) {
        list[index] = assignment;
      } else {
        list.unshift(assignment);
      }
      localStorage.setItem('bm-asset-assignments', JSON.stringify(list));
      return assignment;
    }
  },

  async deleteAssetAssignment(assignmentId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'assetAssignments', assignmentId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-asset-assignments');
      if (local) {
        const list = JSON.parse(local).filter(a => a.id !== assignmentId);
        localStorage.setItem('bm-asset-assignments', JSON.stringify(list));
      }
      return true;
    }
  },

  async uploadContractInvoice(contractId, file, docType) {
    const fileSizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;
    
    const docId = `vdoc-${Date.now()}`;
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    if (isConfigured && storage && db) {
      const fileRef = ref(storage, `contracts/${contractId}/${docType}/${cleanFileName}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      return {
        id: docId,
        type: docType,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: fileSizeStr,
        url: downloadUrl,
        storagePath: `contracts/${contractId}/${docType}/${cleanFileName}`
      };
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: file.size > 1.5 * 1024 * 1024 ? '#' : reader.result
          });
        };
        if (file.size > 1.5 * 1024 * 1024) {
          resolve({
            id: docId,
            type: docType,
            name: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            fileSize: fileSizeStr,
            url: '#'
          });
        } else {
          reader.readAsDataURL(file);
        }
      });
    }
  },

  /* ==========================================
     PLACEMENTS & SALES MODULE SERVICES
     ========================================== */
    subscribePlacements(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-placements');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'placements');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-placements', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore placements snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async savePlacement(placement) {
    if (isConfigured && db) {
      const docRef = doc(db, 'placements', placement.id);
      await setDoc(docRef, placement);
      return placement;
    } else {
      const local = localStorage.getItem('bm-placements');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(p => p.id === placement.id);
      if (index > -1) {
        list[index] = placement;
      } else {
        list.unshift(placement);
      }
      localStorage.setItem('bm-placements', JSON.stringify(list));
      return placement;
    }
  },

  async deletePlacement(placementId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'placements', placementId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-placements');
      if (local) {
        const list = JSON.parse(local).filter(p => p.id !== placementId);
        localStorage.setItem('bm-placements', JSON.stringify(list));
      }
      return true;
    }
  },

  async clearPlacements(placementsList = []) {
    if (isConfigured && db) {
      for (const p of placementsList) {
        const docRef = doc(db, 'placements', p.id);
        await deleteDoc(docRef);
      }
      return true;
    } else {
      localStorage.setItem('bm-placements', JSON.stringify([]));
      return true;
    }
  },

  async savePlacementsBatch(placementsList) {
    if (isConfigured && db) {
      // Use setDoc for each item in the list
      for (const p of placementsList) {
        const docRef = doc(db, 'placements', p.id);
        await setDoc(docRef, p);
      }
      return placementsList;
    } else {
      const local = localStorage.getItem('bm-placements');
      const list = local ? JSON.parse(local) : [];
      
      // Merge imported placements with existing
      placementsList.forEach(p => {
        const index = list.findIndex(item => item.id === p.id);
        if (index > -1) {
          list[index] = p;
        } else {
          list.unshift(p);
        }
      });

      localStorage.setItem('bm-placements', JSON.stringify(list));
      return placementsList;
    }
  },

    subscribeExpenses(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-expenses');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'expenses');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-expenses', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore expenses snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveExpense(expense) {
    if (isConfigured && db) {
      const docRef = doc(db, 'expenses', expense.id);
      await setDoc(docRef, expense);
      return expense;
    } else {
      const local = localStorage.getItem('bm-expenses');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(e => e.id === expense.id);
      if (index > -1) {
        list[index] = expense;
      } else {
        list.unshift(expense);
      }
      localStorage.setItem('bm-expenses', JSON.stringify(list));
      return expense;
    }
  },

  async deleteExpense(expenseId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'expenses', expenseId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-expenses');
      let list = local ? JSON.parse(local) : [];
      list = list.filter(e => e.id !== expenseId);
      localStorage.setItem('bm-expenses', JSON.stringify(list));
      return true;
    }
  },

    subscribeNominalCodes(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-nominal-codes');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'nominalCodes');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-nominal-codes', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore nominalCodes snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveNominalCode(codeObj) {
    if (isConfigured && db) {
      const docRef = doc(db, 'nominalCodes', codeObj.id);
      await setDoc(docRef, codeObj);
      return codeObj;
    } else {
      const local = localStorage.getItem('bm-nominal-codes');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(c => c.id === codeObj.id);
      if (index > -1) {
        list[index] = codeObj;
      } else {
        list.push(codeObj);
      }
      localStorage.setItem('bm-nominal-codes', JSON.stringify(list));
      return codeObj;
    }
  },

  async deleteNominalCode(codeId) {
    if (isConfigured && db) {
      const docRef = doc(db, 'nominalCodes', codeId);
      await deleteDoc(docRef);
      return true;
    } else {
      const local = localStorage.getItem('bm-nominal-codes');
      let list = local ? JSON.parse(local) : [];
      list = list.filter(c => c.id !== codeId);
      localStorage.setItem('bm-nominal-codes', JSON.stringify(list));
      return true;
    }
  },

    subscribeAuditLogs(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-audit-logs');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'auditLogs');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-audit-logs', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore auditLogs snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveAuditLog(log) {
    if (isConfigured && db) {
      const docRef = doc(db, 'auditLogs', log.id);
      await setDoc(docRef, log);
      return log;
    } else {
      const local = localStorage.getItem('bm-audit-logs');
      const list = local ? JSON.parse(local) : [];
      list.unshift(log); // Add to beginning (descending order)
      localStorage.setItem('bm-audit-logs', JSON.stringify(list));
      return log;
    }
  },

    subscribePayrollRecords(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-payroll-records');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'payrollRecords');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-payroll-records', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore payrollRecords snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async savePayrollRecord(record) {
    if (isConfigured && db) {
      const docRef = doc(db, 'payrollRecords', record.id);
      await setDoc(docRef, record);
      return record;
    } else {
      const local = localStorage.getItem('bm-payroll-records');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(r => r.id === record.id);
      if (index > -1) {
        list[index] = record;
      } else {
        list.push(record);
      }
      localStorage.setItem('bm-payroll-records', JSON.stringify(list));
      return record;
    }
  },

    subscribePayrollPolicies(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-payroll-policies');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'payrollPolicies');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-payroll-policies', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore payrollPolicies snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async savePayrollPolicy(policy) {
    if (isConfigured && db) {
      const docRef = doc(db, 'payrollPolicies', policy.id);
      await setDoc(docRef, policy);
      return policy;
    } else {
      const local = localStorage.getItem('bm-payroll-policies');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(p => p.id === policy.id);
      if (index > -1) {
        list[index] = policy;
      } else {
        list.push(policy);
      }
      localStorage.setItem('bm-payroll-policies', JSON.stringify(list));
      return policy;
    }
  },

  async deletePayrollPolicy(id) {
    if (isConfigured && db) {
      const docRef = doc(db, 'payrollPolicies', id);
      await deleteDoc(docRef);
      return id;
    } else {
      const local = localStorage.getItem('bm-payroll-policies');
      const list = local ? JSON.parse(local) : [];
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem('bm-payroll-policies', JSON.stringify(filtered));
      return id;
    }
  },

    subscribeLetterTemplates(onUpdate, fallbackData = []) {
    const localCache = localStorage.getItem('bm-letter-templates');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const refCol = collection(db, 'letterTemplates');
      return onSnapshot(refCol, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        localStorage.setItem('bm-letter-templates', JSON.stringify(list));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore letterTemplates snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveLetterTemplate(template) {
    if (isConfigured && db) {
      const docRef = doc(db, 'letterTemplates', template.id);
      await setDoc(docRef, template);
      return template;
    } else {
      const local = localStorage.getItem('bm-letter-templates');
      const list = local ? JSON.parse(local) : [];
      const index = list.findIndex(p => p.id === template.id);
      if (index > -1) {
        list[index] = template;
      } else {
        list.push(template);
      }
      localStorage.setItem('bm-letter-templates', JSON.stringify(list));
      return template;
    }
  },

  async deleteLetterTemplate(id) {
    if (isConfigured && db) {
      const docRef = doc(db, 'letterTemplates', id);
      await deleteDoc(docRef);
      return id;
    } else {
      const local = localStorage.getItem('bm-letter-templates');
      const list = local ? JSON.parse(local) : [];
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem('bm-letter-templates', JSON.stringify(filtered));
      return id;
    }
  },

    subscribeExitSettings(onUpdate, fallbackData = {}) {
    const localCache = localStorage.getItem('bm-exit-settings');
    if (localCache) {
      try {
        onUpdate(JSON.parse(localCache));
      } catch (e) {
        onUpdate(fallbackData);
      }
    } else {
      onUpdate(fallbackData);
    }

    if (isConfigured && db) {
      const docRef = doc(db, 'exitSettings', 'config');
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          localStorage.setItem('bm-exit-settings', JSON.stringify(data));
          onUpdate(data);
        } else {
          onUpdate(fallbackData);
        }
      }, (error) => {
        console.error("Firestore exitSettings snapshot error:", error);
      });
    } else {
      return () => {};
    }
  },

  async saveExitSettings(settings) {
    if (isConfigured && db) {
      const docRef = doc(db, 'exitSettings', 'config');
      await setDoc(docRef, settings);
      return settings;
    } else {
      localStorage.setItem('bm-exit-settings', JSON.stringify(settings));
      return settings;
    }
  },

  async logEmailNotification(notification) {
    if (isConfigured && db) {
      const docRef = doc(db, 'emailNotifications', notification.id || 'email-' + Date.now());
      await setDoc(docRef, notification);
      return notification;
    } else {
      const local = localStorage.getItem('bm-email-notifications');
      const list = local ? JSON.parse(local) : [];
      list.push(notification);
      localStorage.setItem('bm-email-notifications', JSON.stringify(list));
      return notification;
    }
  },

  async uploadLetterheadBg(companyId, file) {
    if (isConfigured && storage) {
      const fileRef = ref(storage, `companies/${companyId}/letterheadBg_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.readAsDataURL(file);
      });
    }
  }
};
