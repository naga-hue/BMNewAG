import { create } from 'zustand';
import { firebaseService } from '../services/firebase';
import { Company, Staff, Expense, Placement, Vendor, NominalCode, PayrollRecord, CrmClientCompany, CrmCandidate, DepartmentTool } from '../types';

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
  reimbursementClaims: any[];
  crmClientCompanies: CrmClientCompany[];
  crmCandidates: CrmCandidate[];
  departmentTools: DepartmentTool[];

  initSubscriptions: (initialData?: any) => () => void;
  updatePlacement: (updated: Placement) => Promise<void>;
  updateCompany: (updated: Company) => Promise<void>;
  updateStaff: (updated: Staff) => Promise<void>;
  updateExpense: (updated: Expense) => Promise<void>;
  saveExpensesBatch: (expenses: Expense[]) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteExpensesBatch: (ids: string[]) => Promise<void>;
  clearAllExpenses: () => Promise<void>;
  saveNominalCode: (code: any) => Promise<void>;
  deleteNominalCode: (id: string) => Promise<void>;
  saveVendor: (vendor: Vendor) => Promise<void>;
  savePayrollRecord: (record: PayrollRecord) => Promise<void>;
  saveReimbursementClaim: (claim: any) => Promise<void>;
  saveCrmClientCompany: (company: CrmClientCompany) => Promise<void>;
  deleteCrmClientCompany: (id: string) => Promise<void>;
  saveCrmCandidate: (candidate: CrmCandidate) => Promise<void>;
  deleteCrmCandidate: (id: string) => Promise<void>;
  saveDepartmentTool: (tool: DepartmentTool) => Promise<void>;
  deleteDepartmentTool: (id: string) => Promise<void>;
  mergeCompanyDepartments: (params: {
    companyId: string;
    sourceDept: string;
    targetDept: string;
    transferManager?: boolean;
  }) => Promise<{
    success: boolean;
    updatedStaffCount: number;
    updatedExpensesCount: number;
    updatedToolsCount: number;
    updatedPayrollCount: number;
    updatedCompany: Company | null;
  }>;
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
  reimbursementClaims: [],
  crmClientCompanies: [],
  crmCandidates: [],
  departmentTools: [],

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

    // Reimbursement Claims
    if (firebaseService.subscribeReimbursementClaims) {
      unsubscribes.push(
        firebaseService.subscribeReimbursementClaims((list: any[]) => {
          set({ reimbursementClaims: list });
        }, initialData.reimbursementClaims || [])
      );
    }

    // CRM Client Companies
    if (firebaseService.subscribeCrmClientCompanies) {
      unsubscribes.push(
        firebaseService.subscribeCrmClientCompanies((list: CrmClientCompany[]) => {
          set({ crmClientCompanies: list });
        }, initialData.crmClientCompanies || [])
      );
    }

    // CRM Candidates
    if (firebaseService.subscribeCrmCandidates) {
      unsubscribes.push(
        firebaseService.subscribeCrmCandidates((list: CrmCandidate[]) => {
          set({ crmCandidates: list });
        }, initialData.crmCandidates || [])
      );
    }

    // Department Tools
    if (firebaseService.subscribeDepartmentTools) {
      unsubscribes.push(
        firebaseService.subscribeDepartmentTools((list: DepartmentTool[]) => {
          set({ departmentTools: list });
        }, initialData.departmentTools || [])
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
    set(state => {
      const idx = state.expenses.findIndex(e => e.id === updated.id);
      if (idx > -1) {
        const next = [...state.expenses];
        next[idx] = updated;
        return { expenses: next };
      }
      return { expenses: [updated, ...state.expenses] };
    });
    await firebaseService.saveExpense(updated);
  },
  saveExpensesBatch: async (expenses) => {
    set(state => {
      const map = new Map(state.expenses.map(e => [e.id, e]));
      expenses.forEach(e => map.set(e.id, e));
      return { expenses: Array.from(map.values()) };
    });
    await firebaseService.saveExpensesBatch(expenses);
  },
  deleteExpense: async (id) => {
    if (!id) return;
    set(state => ({
      expenses: state.expenses.filter(e => e.id !== id)
    }));
    await firebaseService.deleteExpense(id);
  },
  deleteExpensesBatch: async (ids) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    set(state => ({
      expenses: state.expenses.filter(e => !idSet.has(e.id))
    }));
    await firebaseService.deleteExpensesBatch(ids);
  },
  clearAllExpenses: async () => {
    await firebaseService.clearAllExpenses();
    set({ expenses: [] });
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
  },
  saveReimbursementClaim: async (claim) => {
    await firebaseService.saveReimbursementClaim(claim);
  },
  saveCrmClientCompany: async (company) => {
    await firebaseService.saveCrmClientCompany(company);
  },
  deleteCrmClientCompany: async (id) => {
    await firebaseService.deleteCrmClientCompany(id);
  },
  saveCrmCandidate: async (candidate) => {
    await firebaseService.saveCrmCandidate(candidate);
  },
  deleteCrmCandidate: async (id) => {
    await firebaseService.deleteCrmCandidate(id);
  },
  saveDepartmentTool: async (tool) => {
    set(state => {
      const idx = state.departmentTools.findIndex(t => t.id === tool.id);
      if (idx > -1) {
        const next = [...state.departmentTools];
        next[idx] = tool;
        return { departmentTools: next };
      }
      return { departmentTools: [...state.departmentTools, tool] };
    });
    await firebaseService.saveDepartmentTool(tool);
  },
  deleteDepartmentTool: async (id) => {
    if (!id) return;
    set(state => ({
      departmentTools: state.departmentTools.filter(t => t.id !== id)
    }));
    await firebaseService.deleteDepartmentTool(id);
  },
  mergeCompanyDepartments: async (params) => {
    const res = await firebaseService.mergeCompanyDepartments(params);
    const sNorm = params.sourceDept.trim().toLowerCase();
    const tNorm = params.targetDept.trim();

    set(state => {
      // 1. Companies
      const nextCompanies = state.companies.map(c => {
        if (c.id === params.companyId && res.updatedCompany) {
          return res.updatedCompany;
        }
        return c;
      });

      // 2. Staff
      const nextStaff = state.staff.map(s => {
        if (s.companyId === params.companyId && s.department && s.department.trim().toLowerCase() === sNorm) {
          return { ...s, department: tNorm };
        }
        return s;
      });

      // 3. Expenses
      const nextExpenses = state.expenses.map(e => {
        const isCompMatch = !e.bankCompanyId || e.bankCompanyId === params.companyId || e.recipientId === params.companyId || e.companyId === params.companyId;
        if (!isCompMatch) return e;

        let updated = false;
        let nextTarget = e.allocationTarget;
        if (e.allocationType === 'department') {
          if (typeof e.allocationTarget === 'string' && e.allocationTarget.trim().toLowerCase() === sNorm) {
            nextTarget = tNorm;
            updated = true;
          } else if (Array.isArray(e.allocationTarget) && e.allocationTarget.some((d: string) => d.trim().toLowerCase() === sNorm)) {
            nextTarget = Array.from(new Set(e.allocationTarget.map((d: string) => d.trim().toLowerCase() === sNorm ? tNorm : d)));
            updated = true;
          }
        }

        let nextShares = e.manualAllocationShares;
        if (e.manualAllocationShares) {
          let sharesModified = false;
          const shares = { ...e.manualAllocationShares };
          let transferred = 0;
          Object.keys(shares).forEach(k => {
            if (k.trim().toLowerCase() === sNorm) {
              transferred += Number(shares[k]) || 0;
              delete shares[k];
              sharesModified = true;
            }
          });
          if (sharesModified) {
            shares[tNorm] = (Number(shares[tNorm]) || 0) + transferred;
            nextShares = shares;
            updated = true;
          }
        }

        if (updated) {
          return { ...e, allocationTarget: nextTarget, manualAllocationShares: nextShares };
        }
        return e;
      });

      // 4. Department Tools
      const nextTools = state.departmentTools.map(t => {
        const tComps = t.companyIds || [t.companyId || 'all'];
        if (tComps.includes('all') || tComps.includes(params.companyId)) {
          let updated = false;
          let nextDept = t.department;
          let nextDepts = t.departments;
          if (t.department && t.department.trim().toLowerCase() === sNorm) {
            nextDept = tNorm;
            updated = true;
          }
          if (Array.isArray(t.departments) && t.departments.some((d: string) => d.trim().toLowerCase() === sNorm)) {
            nextDepts = Array.from(new Set(t.departments.map((d: string) => d.trim().toLowerCase() === sNorm ? tNorm : d)));
            updated = true;
          }
          if (updated) {
            return { ...t, department: nextDept, departments: nextDepts };
          }
        }
        return t;
      });

      return {
        companies: nextCompanies,
        staff: nextStaff,
        expenses: nextExpenses,
        departmentTools: nextTools
      };
    });

    return res;
  }
}));
