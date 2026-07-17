import { Company, Staff, Placement } from '../../types';
import { toGBP } from '../../utils/currency';

export const symbolMap: Record<string, string> = { 
  GBP: '£', 
  USD: '$', 
  AED: 'AED ', 
  INR: '₹', 
  ZAR: 'R' 
};

export const MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
];

export interface Slab {
  minAmount: number;
  maxAmount: number;
  rate: number;
}

export function calculateSlabCost(amount: number, slabs: Slab[]): number {
  if (!slabs || slabs.length === 0) return 0;
  let totalCost = 0;
  const sortedSlabs = [...slabs].sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
  for (const slab of sortedSlabs) {
    const min = Number(slab.minAmount) || 0;
    const max = Number(slab.maxAmount) || 999999999;
    const rate = Number(slab.rate) || 0;
    
    if (amount <= min) continue;
    const applicableRange = Math.min(amount, max) - min;
    if (applicableRange > 0) {
      totalCost += (applicableRange * rate) / 100;
    }
  }
  return totalCost;
}

export function getBusinessDaysInMonth(monthKey: string, companyId?: string, holidays: any[] = []): number {
  const parts = monthKey.split('-');
  if (parts.length < 2) return 22;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  
  let count = 0;
  try {
    const days = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const dayOfWeek = new Date(year, month, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateString = `${year}-${mm}-${dd}`;
        const isHoliday = holidays.some(h => h.companyId === companyId && h.date === dateString);
        if (!isHoliday) {
          count++;
        }
      }
    }
    return count || 22;
  } catch {
    return 22;
  }
}

export function getProrationDetails(
  staffMember: Staff,
  monthKey: string,
  holidays: any[] = []
): { factor: number; activeDays: number; totalDays: number } {
  const parts = monthKey.split('-');
  if (parts.length < 2) return { factor: 1.0, activeDays: 22, totalDays: 22 };
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, totalDaysInMonth);

  // Parse staff start date
  let activeStart = monthStart;
  if (staffMember.startDate) {
    const startParts = staffMember.startDate.split('-').map(Number);
    if (startParts.length === 3) {
      const startDateObj = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      if (startDateObj > monthEnd) return { factor: 0.0, activeDays: 0, totalDays: 22 };
      if (startDateObj > monthStart) {
        activeStart = startDateObj;
      }
    }
  }

  // Parse staff exit / cutoff date
  let activeEnd = monthEnd;
  const exitStr = staffMember.salaryPaidUntilDate || staffMember.exitDate || '';
  if (exitStr) {
    const exitParts = exitStr.split('-').map(Number);
    if (exitParts.length === 3) {
      const exitDateObj = new Date(exitParts[0], exitParts[1] - 1, exitParts[2]);
      if (exitDateObj < monthStart) return { factor: 0.0, activeDays: 0, totalDays: 22 };
      if (exitDateObj < monthEnd) {
        activeEnd = exitDateObj;
      }
    }
  }

  // Count business days in month
  let totalBusinessDays = 0;
  let activeBusinessDays = 0;

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const currentDate = new Date(year, month, d);
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateString = `${year}-${mm}-${dd}`;
    const isHoliday = holidays.some(h => h.companyId === staffMember.companyId && h.date === dateString);

    if (!isWeekend && !isHoliday) {
      totalBusinessDays++;
      if (currentDate >= activeStart && currentDate <= activeEnd) {
        activeBusinessDays++;
      }
    }
  }

  if (totalBusinessDays === 0) return { factor: 1.0, activeDays: 22, totalDays: 22 };
  return {
    factor: activeBusinessDays / totalBusinessDays,
    activeDays: activeBusinessDays,
    totalDays: totalBusinessDays
  };
}

export function calculateProrationFactor(
  staffMember: Staff,
  monthKey: string,
  holidays: any[] = []
): number {
  return getProrationDetails(staffMember, monthKey, holidays).factor;
}

export function calculateCashReceivedCommission(
  member: Staff,
  policy: any,
  monthStr: string,
  staffList: Staff[],
  companiesList: Company[],
  placementsList: Placement[],
  basis: 'written' | 'cash_received' = 'written'
): number {
  if (!policy) return 0;

  const getMonthsOfService = (startStr: string | undefined | null, dateStr: string) => {
    if (!startStr) return 999;
    try {
      const [startYear, startMonth] = startStr.substring(0, 7).split('-').map(Number);
      const [payYear, payMonth] = dateStr.split('-').map(Number);
      return (payYear - startYear) * 12 + (payMonth - startMonth);
    } catch {
      return 999;
    }
  };

  const monthsOfService = getMonthsOfService(member.startDate || (member as any).joinDate, monthStr);
  const isStarterWaiverActive = policy.starterWaiveThreshold && monthsOfService < 12;
  const isLocked = policy.effectiveFrom === 'one_year_service' && monthsOfService < 12 && !isStarterWaiverActive;

  if (isLocked) return 0;

  const [payYear, payMonth] = monthStr.split('-').map(Number);

  // Determine target staff members
  let targetStaffIds = [member.id];
  if (policy.type === 'manager') {
    if (policy.assignedDepartments && policy.assignedDepartments.length > 0) {
      const deptStaff = staffList.filter(s => policy.assignedDepartments.includes(s.department));
      targetStaffIds = Array.from(new Set([member.id, ...deptStaff.map(s => s.id)]));
    } else {
      const teamMembers = staffList.filter(s => s.reportingManagerId === member.id);
      targetStaffIds = [member.id, ...teamMembers.map(s => s.id)];
    }
  }

  // Helper to calculate total recruiter split billing for a specific target payout month
  const getRecruiterBillingForPayoutMonth = (targetMonthStr: string) => {
    let sum = 0;
    placementsList.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      
      const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
        const d = new Date(p.startDate);
        d.setMonth(d.getMonth() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();

      if (pMonth !== targetMonthStr) return;

      p.splits?.forEach(s => {
        if (targetStaffIds.includes(s.staffId)) {
          sum += (p.netScoreValue * s.percentage) / 100;
        }
      });
    });
    return sum;
  };

  // Helper to apply slabs to a billing amount (normalized to GBP)
  const getPolicyCommission = (billingAmt: number) => {
    const policyCompany = companiesList.find(c => c.id === policy.companyId);
    const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
    
    const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold || 0, policyCurrency);
    const commissionable = Math.max(0, billingAmt - thresh);
    const slabs = policy.slabs || [];

    if (commissionable <= 0) return 0;

    if (policy.slabType === 'flat_rate') {
      let highestRate = 0;
      for (const slab of slabs) {
        const min = toGBP(slab.minAmount || 0, policyCurrency);
        if (commissionable > min) {
          highestRate = Number(slab.rate) || 0;
        }
      }
      return (commissionable * highestRate) / 100;
    } else {
      let earned = 0;
      let remaining = commissionable;
      for (const slab of slabs) {
        const min = toGBP(slab.minAmount || 0, policyCurrency);
        const max = toGBP(slab.maxAmount || 0, policyCurrency);
        const rate = Number(slab.rate) || 0;
        const slabCap = max - min;

        if (remaining <= 0) break;
        const applicable = Math.min(remaining, slabCap);
        earned += (applicable * rate) / 100;
        remaining -= applicable;
      }
      return earned;
    }
  };

  // Quarterly accumulator helper
  const getQuarterlyCommissionForMonth = (yearVal: number, monthVal: number) => {
    const quarterIdx = Math.floor((monthVal - 1) / 3);
    const startMonthOfQuarter = quarterIdx * 3 + 1;

    let cumulativeBilling = 0;
    for (let m = startMonthOfQuarter; m <= monthVal; m++) {
      const targetMonthStr = `${yearVal}-${String(m).padStart(2, '0')}`;
      cumulativeBilling += getRecruiterBillingForPayoutMonth(targetMonthStr);
    }
    const cumulativeCommission = getPolicyCommission(cumulativeBilling);

    let previousBilling = 0;
    for (let m = startMonthOfQuarter; m <= monthVal - 1; m++) {
      const targetMonthStr = `${yearVal}-${String(m).padStart(2, '0')}`;
      previousBilling += getRecruiterBillingForPayoutMonth(targetMonthStr);
    }
    const previousCommission = getPolicyCommission(previousBilling);

    return Math.max(0, cumulativeCommission - previousCommission);
  };

  // 1. Current Cycle calculations (payout scheduled in target monthStr)
  const currentCycleBilling = getRecruiterBillingForPayoutMonth(monthStr);
  const baseEarned = policy.calcInterval === 'quarterly'
    ? getQuarterlyCommissionForMonth(payYear, payMonth)
    : getPolicyCommission(currentCycleBilling);

  if (basis === 'written') {
    return baseEarned;
  }

  let totalPaidNow = 0;
  placementsList.forEach(p => {
    if (!p.startDate || p.status === 'dns') return;
    
    const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
      const d = new Date(p.startDate);
      d.setMonth(d.getMonth() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    if (pMonth === monthStr) {
      const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
      if (mySplits.length > 0) {
        const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
        const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;
        
        const myCommShare = currentCycleBilling > 0 
          ? (myBillingShare / currentCycleBilling) * baseEarned 
          : 0;

        const isPaid = p.clientPaymentStatus === 'paid';
        if (isPaid) {
          totalPaidNow += myCommShare;
        }
      }
    }
  });

  // 2. Releases from Prior Withholds (payout scheduled before target monthStr)
  let totalReleased = 0;
  placementsList.forEach(p => {
    if (!p.startDate || p.status === 'dns') return;
    
    const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
      const d = new Date(p.startDate);
      d.setMonth(d.getMonth() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const isPriorStart = pMonth < monthStr;

    if (isPriorStart) {
      const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
      if (mySplits.length > 0) {
        const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
        const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;

        const histCycleBilling = getRecruiterBillingForPayoutMonth(pMonth);
        const [pMonthYear, pMonthVal] = pMonth.split('-').map(Number);
        const histBaseEarned = policy.calcInterval === 'quarterly'
          ? getQuarterlyCommissionForMonth(pMonthYear, pMonthVal)
          : getPolicyCommission(histCycleBilling);

        const myCommShare = histCycleBilling > 0 
          ? (myBillingShare / histCycleBilling) * histBaseEarned 
          : 0;

        if (myCommShare > 0) {
          const isPaid = p.clientPaymentStatus === 'paid';
          
          let paidInCurrentMonth = false;
          const pPaidDateStr = (p as any).clientPaidDate || (p as any).paymentReceivedDate;
          if (pPaidDateStr) {
            const pPaidDate = new Date(pPaidDateStr);
            paidInCurrentMonth = pPaidDate.getFullYear() === payYear && (pPaidDate.getMonth() + 1) === payMonth;
          }

          if (isPaid && paidInCurrentMonth) {
            totalReleased += myCommShare;
          }
        }
      }
    }
  });

  return totalPaidNow + totalReleased;
}

export function calculateCommissionForRecruiter(
  recruiterId: string,
  monthKey: string,
  staff: Staff[],
  companies: Company[],
  placements: Placement[],
  commissionPolicies: any[],
  basis: 'written' | 'cash_received' = 'written'
): number {
  const member = staff.find(s => s.id === recruiterId);
  if (!member) return 0;
  const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
  return calculateCashReceivedCommission(member, policy, monthKey, staff, companies, placements, basis);
}

export interface PayrollCellData {
  isReconciled: boolean;
  basic: number;
  commission: number;
  reimbursements: number;
  total: number;
  employerNi: number;
  employerPension: number;
  employeeTaxNic: number;
  employeePension: number;
  notes: string;
  id: string | null;
}

export function getCellData(
  staffMember: Staff,
  month: string,
  payrollRecords: any[],
  payrollPolicies: any[],
  leaveRequests: any[],
  holidays: any[],
  staff: Staff[],
  companies: Company[],
  placements: Placement[],
  commissionPolicies: any[]
): PayrollCellData {
  const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);
  
  // Load global payroll rates
  let rates = {
    employerNiRate: 13.8,
    employerNiThreshold: 758,
    employerPensionRate: 3.0,
    employeePensionRate: 5.0,
    employeeTaxNicRate: 20.0
  };
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('bm-global-payroll-rates');
      if (saved) {
        rates = JSON.parse(saved);
      }
    }
  } catch {}

  // Project base monthly salaries in GBP
  let baselineBasic = toGBP(Number(staffMember.salary || 0) / 12, staffMember.currency || 'GBP');
  let baselineCommission = calculateCommissionForRecruiter(
    staffMember.id, 
    month, 
    staff, 
    companies, 
    placements, 
    commissionPolicies, 
    'written'
  );

  // Calculate proration based on actual working days in the month and actual days worked
  const proration = calculateProrationFactor(staffMember, month, holidays);
  baselineBasic = baselineBasic * proration;

  if (staffMember.status === 'exited') {
    const exitMonth = staffMember.exitDate ? staffMember.exitDate.substring(0, 7) : '';
    if (exitMonth && month === exitMonth && staffMember.additionalExitPayment) {
      baselineBasic += toGBP(Number(staffMember.additionalExitPayment) || 0, staffMember.currency || 'GBP');
    }
    // Ensure basic and commission are zero for months after exit
    const cutoffStr = staffMember.salaryPaidUntilDate || staffMember.exitDate || '';
    if (cutoffStr) {
      const cutoffMonth = cutoffStr.substring(0, 7);
      if (month > cutoffMonth) {
        baselineBasic = 0;
        baselineCommission = 0;
      }
    }
  }

  // Read policy template
  const policy = payrollPolicies.find(p => p.id === staffMember.payrollPolicyId);
  let projectedEmployerNi = 0;
  let projectedEmployerPension = 0;
  let projectedEmployeeTaxNic = 0;
  let projectedEmployeePension = 0;

  if (policy) {
    if (policy.type === 'freelance') {
      const totalBusinessDays = getBusinessDaysInMonth(month, staffMember.companyId, holidays);
      const approvedLeaves = leaveRequests.filter(req => 
        req.staffId === staffMember.id && 
        req.status === 'approved' && 
        req.startDate && 
        req.startDate.substring(0, 7) === month
      );
      const leaveDays = approvedLeaves.reduce((sum, req) => sum + (Number(req.totalDays) || 0), 0);
      const attendanceDays = Math.max(0, totalBusinessDays - leaveDays);

      let dailyRate = 0;
      if (staffMember.salary && Number(staffMember.salary) > 0) {
        dailyRate = (Number(staffMember.salary) / 12) / totalBusinessDays;
      } else if (staffMember.attendanceRate && Number(staffMember.attendanceRate) > 0) {
        dailyRate = Number(staffMember.attendanceRate);
      } else {
        dailyRate = Number(policy.dailyRateDefault || 0);
      }
      
      const monthlyContractorRateVal = dailyRate * attendanceDays;
      baselineBasic = toGBP(monthlyContractorRateVal, staffMember.currency || 'GBP');
    } else {
      const grossSalaryAndComm = baselineBasic + baselineCommission;
      
      // Calculate Employer NIC
      if (policy.employerNiSlabs && policy.employerNiSlabs.length > 0) {
        projectedEmployerNi = calculateSlabCost(grossSalaryAndComm, policy.employerNiSlabs);
      } else {
        const rateVal = policy.employerNiRate > 0 ? Number(policy.employerNiRate) : rates.employerNiRate;
        const thresholdGBP = toGBP(Number(policy.employerNiThreshold || rates.employerNiThreshold), 'GBP');
        const taxableNiAmount = Math.max(0, grossSalaryAndComm - thresholdGBP);
        projectedEmployerNi = (taxableNiAmount * rateVal) / 100;
      }
      
      // Calculate Employer Pension
      const empPensionRate = policy.employerPensionRate > 0 ? Number(policy.employerPensionRate) : rates.employerPensionRate;
      projectedEmployerPension = (grossSalaryAndComm * empPensionRate) / 100;

      // Calculate Employee Tax (PAYE)
      let projectedPAYE = 0;
      if (policy.payeSlabs && policy.payeSlabs.length > 0) {
        projectedPAYE = calculateSlabCost(grossSalaryAndComm, policy.payeSlabs);
      } else {
        const eeTaxRate = policy.employeeTaxNicRate > 0 ? Number(policy.employeeTaxNicRate) : rates.employeeTaxNicRate;
        projectedPAYE = (grossSalaryAndComm * eeTaxRate) / 100;
      }

      // Calculate Employee NIC
      let projectedEmployeeNic = 0;
      if (policy.employeeNiSlabs && policy.employeeNiSlabs.length > 0) {
        projectedEmployeeNic = calculateSlabCost(grossSalaryAndComm, policy.employeeNiSlabs);
      }

      projectedEmployeeTaxNic = projectedPAYE + projectedEmployeeNic;

      // Calculate Employee Pension
      const eePensionRate = policy.employeePensionRate > 0 ? Number(policy.employeePensionRate) : rates.employeePensionRate;
      projectedEmployeePension = (grossSalaryAndComm * eePensionRate) / 100;

      // Calculate Student Loan
      if (policy.studentLoanActive && policy.studentLoanRate > 0) {
        const slThresholdGBP = toGBP(Number(policy.studentLoanThreshold || 0), 'GBP');
        const slTaxable = Math.max(0, grossSalaryAndComm - slThresholdGBP);
        const studentLoanDeduction = (slTaxable * Number(policy.studentLoanRate)) / 100;
        projectedEmployeeTaxNic += studentLoanDeduction;
      }
    }
  }

  if (staffMember.startDate) {
    const startMonth = staffMember.startDate.substring(0, 7);
    if (month < startMonth) {
      baselineBasic = 0;
      baselineCommission = 0;
      projectedEmployerNi = 0;
      projectedEmployerPension = 0;
      projectedEmployeeTaxNic = 0;
      projectedEmployeePension = 0;
    } else if (month === startMonth) {
      const [y, m, d] = staffMember.startDate.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
      baselineBasic = baselineBasic * proration;
      projectedEmployerNi = projectedEmployerNi * proration;
      projectedEmployerPension = projectedEmployerPension * proration;
      projectedEmployeeTaxNic = projectedEmployeeTaxNic * proration;
      projectedEmployeePension = projectedEmployeePension * proration;
    }
  }

  if (record) {
    return {
      isReconciled: !!record.isReconciled,
      basic: record.isReconciled ? Number(record.basicSalary) : baselineBasic,
      commission: record.isReconciled ? Number(record.commission) : baselineCommission,
      reimbursements: record.isReconciled ? Number(record.reimbursements || 0) : 0,
      total: record.isReconciled 
        ? (Number(record.basicSalary) + Number(record.commission) + Number(record.reimbursements || 0) + Number(record.employerNi || 0) + Number(record.employerPension || 0)) 
        : (baselineBasic + baselineCommission + projectedEmployerNi + projectedEmployerPension),
      employerNi: record.isReconciled ? Number(record.employerNi || 0) : projectedEmployerNi,
      employerPension: record.isReconciled ? Number(record.employerPension || 0) : projectedEmployerPension,
      employeeTaxNic: record.isReconciled ? Number(record.employeeTaxNic || 0) : projectedEmployeeTaxNic,
      employeePension: record.isReconciled ? Number(record.employeePension || 0) : projectedEmployeePension,
      notes: record.notes || '',
      id: record.id
    };
  }

  return {
    isReconciled: false,
    basic: baselineBasic,
    commission: baselineCommission,
    reimbursements: 0,
    total: baselineBasic + baselineCommission + projectedEmployerNi + projectedEmployerPension,
    employerNi: projectedEmployerNi,
    employerPension: projectedEmployerPension,
    employeeTaxNic: projectedEmployeeTaxNic,
    employeePension: projectedEmployeePension,
    notes: '',
    id: null
  };
}
