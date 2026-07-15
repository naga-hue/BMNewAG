import { create } from 'zustand';
import { firebaseService } from '../services/firebase';
import { Company, Staff, Expense, Placement, Vendor, NominalCode, PayrollRecord } from '../types';

interface StoreState {
  companies: Company[];
  staff: Staff[];
  leavePolicies: any[];
  holidays: any[];
  leaveRequests: any[];
  placements: Placement[];
  expenses: Expense[];
  contracts: any[];
  vendors: Vendor[];
  nominalCodes: NominalCode[];
  payrollRecords: PayrollRecord[];
  payrollPolicies: any[];

  initSubscriptions: (initialData?: any) => () => void;
  updatePlacement: (updated: Placement) => Promise<void>;
  updateCompany: (updated: Company) => Promise<void>;
  updateStaff: (updated: Staff) => Promise<void>;
  updateExpense: (updated: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  saveNominalCode: (code: any) => Promise<void>;
  deleteNominalCode: (id: string) => Promise<void>;
  saveVendor: (vendor: Vendor) => Promise<void>;
  savePayrollRecord: (record: PayrollRecord) => Promise<void>;
}

export const useBoundStore = create<StoreState>((set) => ({
  companies: [],
  staff: [],
  leavePolicies: [],
  holidays: [],
  leaveRequests: [],
  placements: [],
  expenses: [],
  contracts: [],
  vendors: [],
  nominalCodes: [],
  payrollRecords: [],
  payrollPolicies: [],

  // Subscriptions Setup
  initSubscriptions: (initialData = {}) => {
    const unsubscribes: any[] = [];

    // Companies
    unsubscribes.push(
      firebaseService.subscribeCompanies((list: Company[]) => {
        const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        set({ companies: sorted });
      }, initialData.companies || [])
    );

    // Staff
    unsubscribes.push(
      firebaseService.subscribeStaff((list: Staff[]) => {
        const sorted = [...list].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        set({ staff: sorted });
      }, initialData.staff || [])
    );

    // Leave Policies
    unsubscribes.push(
      firebaseService.subscribeLeavePolicies((list: any[]) => {
        set({ leavePolicies: list });
      }, initialData.leavePolicies || [])
    );

    // Holidays
    if (firebaseService.subscribeHolidays) {
      unsubscribes.push(
        firebaseService.subscribeHolidays((list: any[]) => {
          set({ holidays: list });
        }, initialData.holidays || [])
      );
    }

    // Leave Requests
    unsubscribes.push(
      firebaseService.subscribeLeaveRequests((list: any[]) => {
        set({ leaveRequests: list });
      }, initialData.leaveRequests || [])
    );

    // Placements
    unsubscribes.push(
      firebaseService.subscribePlacements((list: Placement[]) => {
        set({ placements: list });
      }, initialData.placements || [])
    );

    // Expenses
    unsubscribes.push(
      firebaseService.subscribeExpenses((list: Expense[]) => {
        set({ expenses: list });
      }, initialData.expenses || [])
    );

    // Contracts
    if (firebaseService.subscribeContracts) {
      unsubscribes.push(
        firebaseService.subscribeContracts((list: any[]) => {
          set({ contracts: list });
        }, initialData.contracts || [])
      );
    }

    // Vendors
    if (firebaseService.subscribeVendors) {
      unsubscribes.push(
        firebaseService.subscribeVendors((list: Vendor[]) => {
          set({ vendors: list });
        }, initialData.vendors || [])
      );
    }

    // Nominal Codes
    if (firebaseService.subscribeNominalCodes) {
      unsubscribes.push(
        firebaseService.subscribeNominalCodes((list: NominalCode[]) => {
          const sorted = [...list].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
          set({ nominalCodes: sorted });
        }, initialData.nominalCodes || [])
      );
    }

    // Payroll Records
    if (firebaseService.subscribePayrollRecords) {
      unsubscribes.push(
        firebaseService.subscribePayrollRecords((list: PayrollRecord[]) => {
          set({ payrollRecords: list });
        }, initialData.payrollRecords || [])
      );
    }

    // Payroll Policies
    if (firebaseService.subscribePayrollPolicies) {
      unsubscribes.push(
        firebaseService.subscribePayrollPolicies((list: any[]) => {
          set({ payrollPolicies: list });
        }, initialData.payrollPolicies || [])
      );
    }

    // Return combined unsubscribe
    return () => {
      unsubscribes.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  // State mutation actions
  updatePlacement: async (updated) => {
    await firebaseService.savePlacement(updated);
  },
  updateCompany: async (updated) => {
    await firebaseService.saveCompany(updated);
  },
  updateStaff: async (updated) => {
    await firebaseService.saveStaff(updated);
  },
  updateExpense: async (updated) => {
    await firebaseService.saveExpense(updated);
  },
  deleteExpense: async (id) => {
    await firebaseService.deleteExpense(id);
  },
  saveNominalCode: async (code) => {
    await firebaseService.saveNominalCode(code);
  },
  deleteNominalCode: async (id) => {
    await firebaseService.deleteNominalCode(id);
  },
  saveVendor: async (vendor) => {
    await firebaseService.saveVendor(vendor);
  },
  savePayrollRecord: async (record) => {
    await firebaseService.savePayrollRecord(record);
  }
}));
