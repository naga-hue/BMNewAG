import { create } from 'zustand';
import { firebaseService } from '../services/firebase';

export const useBoundStore = create((set, get) => ({
  companies: [],
  staff: [],
  leavePolicies: [],
  holidays: [],
  leaveRequests: [],
  placements: [],
  expenses: [],
  contracts: [],
  vendors: [],

  // Subscriptions Setup
  initSubscriptions: (initialData = {}) => {
    const unsubscribes = [];

    // Companies
    unsubscribes.push(
      firebaseService.subscribeCompanies((list) => {
        const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        set({ companies: sorted });
      }, initialData.companies || [])
    );

    // Staff
    unsubscribes.push(
      firebaseService.subscribeStaff((list) => {
        const sorted = [...list].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        set({ staff: sorted });
      }, initialData.staff || [])
    );

    // Leave Policies
    unsubscribes.push(
      firebaseService.subscribeLeavePolicies((list) => {
        set({ leavePolicies: list });
      }, initialData.leavePolicies || [])
    );

    // Holidays
    if (firebaseService.subscribeHolidays) {
      unsubscribes.push(
        firebaseService.subscribeHolidays((list) => {
          set({ holidays: list });
        }, initialData.holidays || [])
      );
    }

    // Leave Requests
    unsubscribes.push(
      firebaseService.subscribeLeaveRequests((list) => {
        set({ leaveRequests: list });
      }, initialData.leaveRequests || [])
    );

    // Placements
    unsubscribes.push(
      firebaseService.subscribePlacements((list) => {
        set({ placements: list });
      }, initialData.placements || [])
    );

    // Expenses
    unsubscribes.push(
      firebaseService.subscribeExpenses((list) => {
        set({ expenses: list });
      }, initialData.expenses || [])
    );

    // Contracts
    if (firebaseService.subscribeContracts) {
      unsubscribes.push(
        firebaseService.subscribeContracts((list) => {
          set({ contracts: list });
        }, initialData.contracts || [])
      );
    }

    // Vendors
    if (firebaseService.subscribeVendors) {
      unsubscribes.push(
        firebaseService.subscribeVendors((list) => {
          set({ vendors: list });
        }, initialData.vendors || [])
      );
    }

    // Return combined unsubscribe
    return () => {
      unsubscribes.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  },

  // State mutation actions that commit changes back to Firestore / LocalStorage
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
  }
}));
