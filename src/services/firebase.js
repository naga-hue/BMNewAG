import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
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

let app = null;
let db = null;
let storage = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase Backend initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize Firebase app:", error);
  }
} else {
  console.log("Firebase configuration keys missing. Running in Local Storage Mode.");
}

// Service exports with Firebase / Local Storage fallback
export const firebaseService = {
  isConfigured() {
    return isConfigured;
  },

  /* ==========================================
     COMPANY MANAGEMENT SERVICES
     ========================================== */
  subscribeCompanies(onUpdate, fallbackData = []) {
    if (isConfigured && db) {
      const companiesRef = collection(db, 'companies');
      return onSnapshot(companiesRef, (snapshot) => {
        const companiesList = [];
        snapshot.forEach((doc) => {
          companiesList.push(doc.data());
        });
        onUpdate(companiesList);
      }, (error) => {
        console.error("Firestore subscription error:", error);
        const local = localStorage.getItem('bm-companies');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-companies');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const staffRef = collection(db, 'staff');
      return onSnapshot(staffRef, (snapshot) => {
        const staffList = [];
        snapshot.forEach((doc) => {
          staffList.push(doc.data());
        });
        onUpdate(staffList);
      }, (error) => {
        console.error("Firestore staff subscription error:", error);
        const local = localStorage.getItem('bm-staff');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-staff');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const policiesRef = collection(db, 'leavePolicies');
      return onSnapshot(policiesRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore leavePolicies subscription error:", error);
        const local = localStorage.getItem('bm-leave-policies');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-leave-policies');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const holidaysRef = collection(db, 'holidays');
      return onSnapshot(holidaysRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore holidays subscription error:", error);
        const local = localStorage.getItem('bm-holidays');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-holidays');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const requestsRef = collection(db, 'leaveRequests');
      return onSnapshot(requestsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore leaveRequests subscription error:", error);
        const local = localStorage.getItem('bm-leave-requests');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-leave-requests');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const policiesRef = collection(db, 'commissionPolicies');
      return onSnapshot(policiesRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore commissionPolicies subscription error:", error);
        const local = localStorage.getItem('bm-commission-policies');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-commission-policies');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const vendorsRef = collection(db, 'vendors');
      return onSnapshot(vendorsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore vendors subscription error:", error);
        const local = localStorage.getItem('bm-vendors');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-vendors');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const contractsRef = collection(db, 'contracts');
      return onSnapshot(contractsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore contracts subscription error:", error);
        const local = localStorage.getItem('bm-contracts');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-contracts');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const assignmentsRef = collection(db, 'assetAssignments');
      return onSnapshot(assignmentsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore assetAssignments subscription error:", error);
        const local = localStorage.getItem('bm-asset-assignments');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-asset-assignments');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const placementsRef = collection(db, 'placements');
      return onSnapshot(placementsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore placements subscription error:", error);
        const local = localStorage.getItem('bm-placements');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-placements');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const expensesRef = collection(db, 'expenses');
      return onSnapshot(expensesRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore expenses subscription error:", error);
        const local = localStorage.getItem('bm-expenses');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-expenses');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const nominalCodesRef = collection(db, 'nominalCodes');
      return onSnapshot(nominalCodesRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore nominalCodes subscription error:", error);
        const local = localStorage.getItem('bm-nominal-codes');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-nominal-codes');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const auditLogsRef = collection(db, 'auditLogs');
      return onSnapshot(auditLogsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        // Sort by timestamp desc
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        onUpdate(list);
      }, (error) => {
        console.error("Firestore auditLogs subscription error:", error);
        const local = localStorage.getItem('bm-audit-logs');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-audit-logs');
      const data = local ? JSON.parse(local) : fallbackData;
      // Sort by timestamp desc
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      onUpdate(data);
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
    if (isConfigured && db) {
      const payrollRef = collection(db, 'payrollRecords');
      return onSnapshot(payrollRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore payroll subscription error:", error);
        const local = localStorage.getItem('bm-payroll-records');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-payroll-records');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
    if (isConfigured && db) {
      const policiesRef = collection(db, 'payrollPolicies');
      return onSnapshot(policiesRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push(doc.data());
        });
        onUpdate(list);
      }, (error) => {
        console.error("Firestore payroll policies subscription error:", error);
        const local = localStorage.getItem('bm-payroll-policies');
        onUpdate(local ? JSON.parse(local) : fallbackData);
      });
    } else {
      const local = localStorage.getItem('bm-payroll-policies');
      const data = local ? JSON.parse(local) : fallbackData;
      onUpdate(data);
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
  }
};
