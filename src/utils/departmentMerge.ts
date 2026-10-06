import { Company, Staff, Expense, DepartmentTool, PayrollRecord } from '../types';

export interface MergeDepartmentsResult {
  updatedCompany: Company | null;
  updatedStaff: Staff[];
  updatedExpenses: Expense[];
  updatedTools: DepartmentTool[];
  updatedPayrollRecords: PayrollRecord[];
  updatedStaffCount: number;
  updatedExpensesCount: number;
  updatedToolsCount: number;
  updatedPayrollCount: number;
}

export function mergeDepartmentsData({
  companyId,
  sourceDept,
  targetDept,
  transferManager = true,
  companies = [],
  staff = [],
  expenses = [],
  departmentTools = [],
  payrollRecords = []
}: {
  companyId: string;
  sourceDept: string;
  targetDept: string;
  transferManager?: boolean;
  companies?: Company[];
  staff?: Staff[];
  expenses?: Expense[];
  departmentTools?: DepartmentTool[];
  payrollRecords?: PayrollRecord[];
}): MergeDepartmentsResult {
  const sNorm = sourceDept.trim().toLowerCase();
  const tNorm = targetDept.trim();

  let updatedStaffCount = 0;
  let updatedExpensesCount = 0;
  let updatedToolsCount = 0;
  let updatedPayrollCount = 0;

  // 1. Update Company
  let updatedCompany: Company | null = null;
  const targetCompany = companies.find(c => c.id === companyId);
  if (targetCompany) {
    const currentDepts: any[] = targetCompany.departments || [];
    const sourceEntry = currentDepts.find((d: any) => (d.name || d).trim().toLowerCase() === sNorm);
    let targetEntry = currentDepts.find((d: any) => (d.name || d).trim().toLowerCase() === tNorm.toLowerCase());

    let targetManagerId = (targetEntry && typeof targetEntry === 'object' && targetEntry.managerId)
      ? targetEntry.managerId
      : ((transferManager && sourceEntry && typeof sourceEntry === 'object' && sourceEntry.managerId) ? sourceEntry.managerId : '');

    const finalTargetObj = { name: tNorm, managerId: targetManagerId };
    const remainingDepts = currentDepts.filter((d: any) => (d.name || d).trim().toLowerCase() !== sNorm);
    const hasTarget = remainingDepts.some((d: any) => (d.name || d).trim().toLowerCase() === tNorm.toLowerCase());

    const newDepts = hasTarget
      ? remainingDepts.map((d: any) => (d.name || d).trim().toLowerCase() === tNorm.toLowerCase() ? finalTargetObj : d)
      : [...remainingDepts, finalTargetObj];

    updatedCompany = {
      ...targetCompany,
      departments: newDepts
    };
  }

  // 2. Update Staff
  const updatedStaff = staff.map(s => {
    if (s.companyId === companyId && s.department && s.department.trim().toLowerCase() === sNorm) {
      updatedStaffCount++;
      return { ...s, department: tNorm };
    }
    return s;
  });

  // 3. Update Expenses
  const updatedExpenses = expenses.map(e => {
    const isCompMatch = !e.bankCompanyId || e.bankCompanyId === companyId || e.recipientId === companyId || e.companyId === companyId;
    if (!isCompMatch) return e;

    let modified = false;
    let newTarget = e.allocationTarget;
    if (e.allocationType === 'department') {
      if (typeof e.allocationTarget === 'string' && e.allocationTarget.trim().toLowerCase() === sNorm) {
        newTarget = tNorm;
        modified = true;
      } else if (Array.isArray(e.allocationTarget) && e.allocationTarget.some((d: string) => d.trim().toLowerCase() === sNorm)) {
        newTarget = Array.from(new Set(e.allocationTarget.map((d: string) => d.trim().toLowerCase() === sNorm ? tNorm : d)));
        modified = true;
      }
    }

    let newShares = e.manualAllocationShares;
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
        newShares = shares;
        modified = true;
      }
    }

    if (modified) {
      updatedExpensesCount++;
      return { ...e, allocationTarget: newTarget, manualAllocationShares: newShares };
    }
    return e;
  });

  // 4. Update Tools
  const updatedTools = departmentTools.map(t => {
    const tComps = t.companyIds || [t.companyId || 'all'];
    if (tComps.includes('all') || tComps.includes(companyId)) {
      let modified = false;
      let newDept = t.department;
      let newDepts = t.departments;

      if (t.department && t.department.trim().toLowerCase() === sNorm) {
        newDept = tNorm;
        modified = true;
      }
      if (Array.isArray(t.departments) && t.departments.some((d: string) => d.trim().toLowerCase() === sNorm)) {
        newDepts = Array.from(new Set(t.departments.map((d: string) => d.trim().toLowerCase() === sNorm ? tNorm : d)));
        modified = true;
      }

      if (modified) {
        updatedToolsCount++;
        return { ...t, department: newDept, departments: newDepts };
      }
    }
    return t;
  });

  // 5. Update Payroll
  const updatedPayrollRecords = payrollRecords.map(r => {
    let modified = false;
    let newReimbDept = r.reimbursementDepartment;
    if (r.reimbursementDepartment && r.reimbursementDepartment.trim().toLowerCase() === sNorm) {
      newReimbDept = tNorm;
      modified = true;
    }

    let newItems = r.reimbursementItems;
    if (Array.isArray(r.reimbursementItems)) {
      let itemsModified = false;
      newItems = r.reimbursementItems.map((item: any) => {
        if (item.department && item.department.trim().toLowerCase() === sNorm) {
          itemsModified = true;
          return { ...item, department: tNorm };
        }
        return item;
      });
      if (itemsModified) modified = true;
    }

    if (modified) {
      updatedPayrollCount++;
      return { ...r, reimbursementDepartment: newReimbDept, reimbursementItems: newItems };
    }
    return r;
  });

  return {
    updatedCompany,
    updatedStaff,
    updatedExpenses,
    updatedTools,
    updatedPayrollRecords,
    updatedStaffCount,
    updatedExpensesCount,
    updatedToolsCount,
    updatedPayrollCount
  };
}
