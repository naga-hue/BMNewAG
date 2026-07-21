import React, { useState } from 'react';
import MultiSelectFilter from './MultiSelectFilter';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  Award, 
  Percent, 
  Info,
  Globe,
  PieChart,
  Coins
} from 'lucide-react';

const FX_RATES = {
  GBP: 1.0,
  USD: 0.79,
  AED: 0.21,
  INR: 0.0094,
  ZAR: 0.043
};

const formatGBP = (val) => {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '£0';
  return '£' + Math.round(num).toLocaleString();
};

const getDaysWorkedInMonth = (startDateStr, exitDateStr, monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));
  
  const parseUTC = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  };

  let employeeStart = parseUTC(startDateStr);
  let employeeExit = parseUTC(exitDateStr);

  if (!employeeStart) {
    employeeStart = new Date(Date.UTC(2000, 0, 1));
  }

  if (employeeStart > monthEnd) {
    return 0;
  }

  if (employeeExit && employeeExit < monthStart) {
    return 0;
  }

  const actualStart = employeeStart > monthStart ? employeeStart : monthStart;
  const actualExit = (employeeExit && employeeExit < monthEnd)
    ? employeeExit
    : monthEnd;

  const diffTime = actualExit.getTime() - actualStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
};

export default function ReportsDashboard({
  companies = [],
  staff = [],
  placements = [],
  expenses = [],
  commissionPolicies = [],
  payrollRecords = [],
  payrollPolicies = [],
  leaveRequests = [],
  holidays = [],
  nominalCodes = [],
  vendors = [],
  contracts = [],
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('consolidated'); // consolidated, divisional, departmental, forecast, ratios, leagues
  
  // Global Filters
  const [companyFilter, setCompanyFilter] = useState(['all']);
  const [deptFilter, setDeptFilter] = useState(['all']);
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-12');
  const [expandedExpenses, setExpandedExpenses] = useState(false);
  const [drilldownState, setDrilldownState] = useState(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [selectedRecruiterPlacements, setSelectedRecruiterPlacements] = useState(null); // { recruiterName, placements: [...] }
  const [expandedExitedRatios, setExpandedExitedRatios] = useState(false);
  const [expandedExitedLeaguesBillings, setExpandedExitedLeaguesLeaguesBillings] = useState(false);
  const [whatIfSliders, setWhatIfSliders] = useState({
    "Recruitment": 100,
    "Sales & Marketing": 100,
    "Finance": 100,
    "Operations": 100,
    "Sourcing": 100,
    "HR": 100,
    "Admin": 100
  });
  // Companies included based on consolidation preference
  const activeCompaniesForPL = companies.filter(c => {
    if (companyFilter.includes('all')) {
      return c.includeInConsolidation !== false;
    }
    return companyFilter.includes(c.id);
  });
  const activeCompanyIds = activeCompaniesForPL.map(c => c.id);
  const [expandedExitedLeaguesPlacements, setExpandedExitedLeaguesLeaguesPlacements] = useState(false);
  const [expandedExitedOverheads, setExpandedExitedOverheads] = useState(false);

  // Generate months range dynamically
  const generateMonthsRange = (start, end) => {
    const list = [];
    try {
      let current = new Date(start + '-02');
      const targetEnd = new Date(end + '-02');
      // Limit to max 24 periods to avoid freeze
      let count = 0;
      while (current <= targetEnd && count < 24) {
        const yr = current.getFullYear();
        const mo = String(current.getMonth() + 1).padStart(2, '0');
        list.push(`${yr}-${mo}`);
        current.setMonth(current.getMonth() + 1);
        count++;
      }
    } catch (e) {
      return ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
    }
    return list.length > 0 ? list : ['2026-06'];
  };

  const monthsList = generateMonthsRange(startMonth, endMonth);

  // Exchange rate converter helper
  const toGBP = (amount, cur = 'GBP') => {
    const rate = FX_RATES[cur] || 1.0;
    return (Number(amount) || 0) * rate;
  };

  // Helper to calculate recruiter commission payout
  const calculateCashReceivedCommission = (member, policy, monthStr, staffList, companiesList, placementsList, basis = 'written') => {
    if (!policy) return 0;

    const getMonthsOfService = (startStr, dateStr) => {
      if (!startStr) return 999;
      try {
        const [startYear, startMonth] = startStr.substring(0, 7).split('-').map(Number);
        const [payYear, payMonth] = dateStr.split('-').map(Number);
        return (payYear - startYear) * 12 + (payMonth - startMonth);
      } catch (e) {
        return 999;
      }
    };

    const monthsOfService = getMonthsOfService(member.startDate, monthStr);
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
    const getRecruiterBillingForPayoutMonth = (targetMonthStr) => {
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
    const getPolicyCommission = (billingAmt) => {
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
    const getQuarterlyCommissionForMonth = (yearVal, monthVal) => {
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
            if (p.clientPaidDate) {
              const pPaidDate = new Date(p.clientPaidDate);
              paidInCurrentMonth = pPaidDate.getFullYear() === payYear && (pPaidDate.getMonth() + 1) === payMonth;
            }

            if (isPaid && paidInCurrentMonth) {
              totalReleased += myCommShare;
            }
          }
        }
      }
    });

    if (basis === 'written') {
      return baseEarned;
    }
    return totalPaidNow + totalReleased;
  };

  // Recruiter Commission calculator helper
  const calculateCommissionForRecruiter = (recruiterId, monthKey, basis = 'written') => {
    const member = staff.find(s => s.id === recruiterId);
    if (!member) return 0;
    const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
    return calculateCashReceivedCommission(member, policy, monthKey, staff, companies, placements, basis);
  };

  const getBusinessDaysInMonth = (monthKey, staffMember) => {
    const parts = monthKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    
    let count = 0;
    const days = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const dayOfWeek = new Date(year, month, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateString = `${year}-${mm}-${dd}`;
        const isHoliday = holidays.some(h => h.companyId === staffMember?.companyId && h.date === dateString);
        if (!isHoliday) {
          count++;
        }
      }
    }
    return count || 22;
  };

  // Helper to fetch payroll actual overrides or default projections
  const getStaffPayrollForMonth = (s, monthKey) => {
    const pr = payrollRecords.find(r => r.staffId === s.id && r.month === monthKey);
    if (pr && pr.isReconciled) {
      return {
        salaries: Number(pr.basicSalary) || 0,
        commissions: Number(pr.commission) || 0
      };
    }
    
    let salaries = 0;
    let commissions = 0;

    commissions = calculateCommissionForRecruiter(s.id, monthKey);
    const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);

    if (policy && policy.type === 'freelance') {
      const totalBusinessDays = getBusinessDaysInMonth(monthKey, s);
      const approvedLeaves = leaveRequests.filter(req => 
        req.staffId === s.id && 
        req.status === 'approved' && 
        req.startDate && 
        req.startDate.substring(0, 7) === monthKey
      );
      const leaveDays = approvedLeaves.reduce((sum, req) => sum + (Number(req.totalDays) || 0), 0);
      const attendanceDays = Math.max(0, totalBusinessDays - leaveDays);

      let dailyRate = 0;
      if (s.salary && Number(s.salary) > 0) {
        dailyRate = (Number(s.salary) / 12) / totalBusinessDays;
      } else if (s.attendanceRate && Number(s.attendanceRate) > 0) {
        dailyRate = Number(s.attendanceRate);
      } else {
        dailyRate = Number(policy.dailyRateDefault || 0);
      }
      salaries = toGBP(dailyRate * attendanceDays, s.currency || 'GBP');
    } else {
      salaries = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
    }

    if (s.status === 'exited') {
      const exitMonth = s.exitDate ? s.exitDate.substring(0, 7) : '';
      const cutoffStr = s.salaryPaidUntilDate || s.exitDate || '';
      if (cutoffStr) {
        const cutoffMonth = cutoffStr.substring(0, 7);
        if (monthKey > cutoffMonth) {
          salaries = 0;
          commissions = 0;
        } else if (monthKey === cutoffMonth) {
          const [y, m, d] = cutoffStr.split('-').map(Number);
          const daysInMonth = new Date(y, m, 0).getDate();
          const proration = Math.min(1.0, Math.max(0.0, d / daysInMonth));
          salaries = salaries * proration;
        }
      }
      if (exitMonth && monthKey === exitMonth && s.additionalExitPayment) {
        salaries += toGBP(Number(s.additionalExitPayment) || 0, s.currency || 'GBP');
      }
    }

    if (s.startDate) {
      const startMonth = s.startDate.substring(0, 7);
      if (monthKey < startMonth) {
        salaries = 0;
        commissions = 0;
      } else if (monthKey === startMonth) {
        const [y, m, d] = s.startDate.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
        salaries = salaries * proration;
      }
    }

    return { salaries, commissions };
  };

  // Dynamic shared overhead helper
  const getDynamicOverheadApportionment = (monthKey) => {
    const activeStaff = staff.filter(s => {
      if (!s.startDate) return false;
      const startMonth = s.startDate.substring(0, 7);
      return startMonth <= monthKey;
    });

    const totalHeadcount = activeStaff.length || 1;

    const companyHeadcounts = {};
    companies.forEach(c => {
      companyHeadcounts[c.id] = activeStaff.filter(s => s.companyId === c.id).length;
    });

    const deptHeadcounts = {};
    activeStaff.forEach(s => {
      deptHeadcounts[s.department] = (deptHeadcounts[s.department] || 0) + 1;
    });

    const monthExpenses = expenses.filter(e => e.plMonth === monthKey);

    let consolidatedOverhead = 0;
    const companyOverheadMap = {};
    const deptOverheadMap = {};

    monthExpenses.forEach(exp => {
      const gbpAmt = toGBP(exp.amount, exp.currency);
      
      if (exp.allocationType === 'company') {
        const targetComp = exp.allocationTarget;
        companyOverheadMap[targetComp] = (companyOverheadMap[targetComp] || 0) + gbpAmt;

        const compHead = companyHeadcounts[targetComp] || 1;
        const compStaff = activeStaff.filter(s => s.companyId === targetComp);
        compStaff.forEach(s => {
          const share = gbpAmt / compHead;
          deptOverheadMap[s.department] = (deptOverheadMap[s.department] || 0) + share;
        });
      } else if (exp.allocationType === 'department') {
        const targetDept = exp.allocationTarget;
        deptOverheadMap[targetDept] = (deptOverheadMap[targetDept] || 0) + gbpAmt;
        
        const deptHead = deptHeadcounts[targetDept] || 1;
        const deptStaff = activeStaff.filter(s => s.department === targetDept);
        deptStaff.forEach(s => {
          const share = gbpAmt / deptHead;
          companyOverheadMap[s.companyId] = (companyOverheadMap[s.companyId] || 0) + share;
        });
      } else if (exp.allocationType === 'staff') {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
        if (targets.length > 0) {
          const perStaffShare = gbpAmt / targets.length;
          targets.forEach(staffId => {
            const memberObj = staff.find(s => s.id === staffId);
            if (memberObj) {
              companyOverheadMap[memberObj.companyId] = (companyOverheadMap[memberObj.companyId] || 0) + perStaffShare;
              deptOverheadMap[memberObj.department] = (deptOverheadMap[memberObj.department] || 0) + perStaffShare;
            }
          });
        }
      } else {
        consolidatedOverhead += gbpAmt;
        activeStaff.forEach(s => {
          const share = gbpAmt / totalHeadcount;
          companyOverheadMap[s.companyId] = (companyOverheadMap[s.companyId] || 0) + share;
          deptOverheadMap[s.department] = (deptOverheadMap[s.department] || 0) + share;
        });
      }
    });

    return {
      consolidatedOverhead,
      companyOverheadMap,
      deptOverheadMap,
      companyHeadcounts,
      deptHeadcounts,
      totalHeadcount
    };
  };

  const calculateSlabCost = (amount, slabs) => {
    let cost = 0;
    let remaining = amount;
    for (const slab of slabs) {
      const min = Number(slab.minAmount || 0);
      const max = Number(slab.maxAmount || 99999999);
      const rate = Number(slab.rate || 0);
      const cap = max - min;
      if (remaining <= 0) break;
      const applicable = Math.min(remaining, cap);
      cost += (applicable * rate) / 100;
      remaining -= applicable;
    }
    return cost;
  };

  const getNominalBreakdownForMonth = (monthKey, overrideCompanyId = null) => {
    const breakdown = {};
    (nominalCodes || []).forEach(nc => {
      if (nc.code) breakdown[nc.code] = 0;
    });

    const activeStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      if (daysWorked < 10) return false;
      if (overrideCompanyId) {
        if (s.companyId !== overrideCompanyId) return false;
      } else {
        if (!activeCompanyIds.includes(s.companyId)) return false;
      }
      if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
      return true;
    });
    const activeStaffIds = activeStaff.map(s => s.id);

    const groupActiveStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      return daysWorked >= 10;
    });
    const groupActiveStaffIds = groupActiveStaff.map(s => s.id);

    // 1. Process actual bank statement expenses for monthKey
    const monthExpenses = expenses.filter(e => e.plMonth === monthKey);
    const reconciledContractIds = new Set(monthExpenses.map(e => e.linkedContractId).filter(Boolean));

    monthExpenses.forEach(exp => {
      const gbpAmt = toGBP(exp.amount, exp.currency);
      let allocatedGbp = 0;

      if (exp.allocationType === 'company') {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
        if (targets.length > 0) {
          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
            targets.forEach(compId => {
              const percent = parseInt(exp.manualAllocationShares[compId] || 0, 10);
              const companyShare = gbpAmt * (percent / 100);
              const compStaff = groupActiveStaff.filter(s => s.companyId === compId);
              const compHead = compStaff.length || 1;
              const perStaffShare = companyShare / compHead;
              compStaff.forEach(s => {
                if (activeStaffIds.includes(s.id)) {
                  allocatedGbp += perStaffShare;
                }
              });
            });
          } else {
            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.companyId));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              if (activeStaffIds.includes(s.id)) {
                allocatedGbp += perStaffShare;
              }
            });
          }
        }
      } else if (exp.allocationType === 'department') {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
        if (targets.length > 0) {
          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
            targets.forEach(dept => {
              const percent = parseInt(exp.manualAllocationShares[dept] || 0, 10);
              const deptShare = gbpAmt * (percent / 100);
              const deptStaff = groupActiveStaff.filter(s => s.department === dept);
              const deptHead = deptStaff.length || 1;
              const perStaffShare = deptShare / deptHead;
              deptStaff.forEach(s => {
                if (activeStaffIds.includes(s.id)) {
                  allocatedGbp += perStaffShare;
                }
              });
            });
          } else {
            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.department));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              if (activeStaffIds.includes(s.id)) {
                allocatedGbp += perStaffShare;
              }
            });
          }
        }
      } else if (exp.allocationType === 'staff') {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
        if (targets.length > 0) {
          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
            targets.forEach(staffId => {
              if (groupActiveStaffIds.includes(staffId)) {
                const percent = parseInt(exp.manualAllocationShares[staffId] || 0, 10);
                const perStaffShare = gbpAmt * (percent / 100);
                if (activeStaffIds.includes(staffId)) {
                  allocatedGbp += perStaffShare;
                }
              }
            });
          } else {
            const perStaffShare = gbpAmt / targets.length;
            targets.forEach(staffId => {
              if (groupActiveStaffIds.includes(staffId)) {
                if (activeStaffIds.includes(staffId)) {
                  allocatedGbp += perStaffShare;
                }
              }
            });
          }
        }
      } else {
        const groupHead = groupActiveStaff.length || 1;
        groupActiveStaff.forEach(s => {
          if (activeStaffIds.includes(s.id)) {
            allocatedGbp += gbpAmt / groupHead;
          }
        });
      }

      const expCode = exp.nominalCode || '15 - Recruitment Tool Expenses';
      const matchedKey = Object.keys(breakdown).find(k => k.startsWith(expCode) || k === expCode);
      if (matchedKey) {
        breakdown[matchedKey] += allocatedGbp;
      }
    });

    // 2. Process Vendor Contract Package Projections from Vendors & Assets module for un-reconciled months
    (contracts || []).forEach(contract => {
      if (!contract.startDate || !contract.endDate) return;
      const startM = contract.startDate.substring(0, 7);
      const endM = contract.endDate.substring(0, 7);

      if (monthKey >= startM && monthKey <= endM) {
        // If an actual bank payment was already reconciled for this contract package in monthKey, skip projection to avoid double counting
        if (reconciledContractIds.has(contract.id)) return;

        let cost = 0;
        if (contract.costInterval === 'monthly') {
          cost = Number(contract.unitCost || 0) * Number(contract.quantityPurchased || 1);
        } else if (contract.costInterval === 'annual') {
          cost = (Number(contract.unitCost || 0) * Number(contract.quantityPurchased || 1)) / 12;
        } else if (contract.costInterval === 'one-time' && startM === monthKey) {
          cost = Number(contract.unitCost || 0) * Number(contract.quantityPurchased || 1);
        }

        if (cost <= 0) return;
        const gbpCost = toGBP(cost, contract.currency || 'GBP');
        let allocatedGbp = 0;

        const targetComps = contract.companyId ? [contract.companyId] : activeCompanyIds;
        const eligibleStaff = groupActiveStaff.filter(s => targetComps.includes(s.companyId));
        const totalHead = eligibleStaff.length || 1;
        const perStaffShare = gbpCost / totalHead;

        eligibleStaff.forEach(s => {
          if (activeStaffIds.includes(s.id)) {
            allocatedGbp += perStaffShare;
          }
        });

        // Resolve nominal code for contract
        let targetCode = contract.nominalCode;
        if (!targetCode) {
          const nameLower = (contract.name || '').toLowerCase();
          if (nameLower.includes('rent') || nameLower.includes('office') || nameLower.includes('lease')) {
            targetCode = '10 - Rent';
          } else if (nameLower.includes('linkedin')) {
            targetCode = '17 - Linkedin';
          } else if (nameLower.includes('freelance')) {
            targetCode = '1 - Freelancer';
          } else {
            targetCode = '15 - Recruitment Tool Expenses';
          }
        }

        const matchedKey = Object.keys(breakdown).find(k => k.startsWith(targetCode) || k === targetCode);
        if (matchedKey) {
          breakdown[matchedKey] += allocatedGbp;
        }
      }
    });

    return breakdown;
  };

  // Filtered monthly calculations row generator
  const getFilteredMonthlyData = (monthKey) => {
    // 1. Active staff members matching company & department
    const activeStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      if (daysWorked < 10) return false;
      
      if (!activeCompanyIds.includes(s.companyId)) return false;
      if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
      return true;
    });

    const activeStaffIds = activeStaff.map(s => s.id);

    // 2. Placements splits revenue
    const monthPlacements = placements.filter(p => p.startDate && p.startDate.substring(0, 7) === monthKey);
    const revenue = monthPlacements.reduce((sum, p) => {
      let cellSum = 0;
      p.splits?.forEach(s => {
        const member = staff.find(st => st.id === s.staffId);
        if (member) {
          if (!activeCompanyIds.includes(member.companyId)) return;
          if (!deptFilter.includes('all') && !deptFilter.includes(member.department)) return;
          const share = (p.netScoreValue * s.percentage) / 100;
          cellSum += toGBP(share, 'GBP');
        }
      });
      return sum + cellSum;
    }, 0);

    // 3. Salaries & 4. Commissions
    let salaries = 0;
    let commissions = 0;
    activeStaff.forEach(s => {
      const pay = getStaffPayrollForMonth(s, monthKey);
      if (monthKey > '2026-06') {
        salaries += pay.salaries;
        commissions += pay.commissions;
      }
    });

    // 5. Operating expenses + shared overhead apportionments
    const nominalBreakdown = getNominalBreakdownForMonth(monthKey);
    const overheadsExpenses = Object.values(nominalBreakdown).reduce((sum, v) => sum + v, 0);

    const safeRevenue = Number(revenue) || 0;
    const safeCommissions = Number(commissions) || 0;
    const safeSalaries = Number(salaries) || 0;
    const safeOverheadsExpenses = Number(overheadsExpenses) || 0;

    const grossProfit = safeRevenue - safeCommissions;
    const totalOverheads = safeSalaries + safeOverheadsExpenses;
    const netProfit = grossProfit - totalOverheads;

    return {
      revenue,
      salaries,
      commissions,
      overheadsExpenses,
      grossProfit,
      totalOverheads,
      netProfit,
      nominalBreakdown,
      headcount: activeStaff.length
    };
  };

  // Find department options based on company selection
  const departmentOptions = Array.from(
    new Set(
      staff
        .filter(s => activeCompanyIds.includes(s.companyId))
        .map(s => s.department)
        .filter(Boolean)
    )
  ).sort();

  const companyOptions = [
    { value: 'all', label: 'All Companies (Consolidated)' },
    ...companies.map(c => ({ value: c.id, label: c.name }))
  ];

  const departmentOptionsList = [
    { value: 'all', label: 'All Departments / Divisions' },
    ...departmentOptions.map(d => ({ value: d, label: d }))
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Dynamic Global Filters Toolbar */}
      <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'visible', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Company Entity:</span>
            <MultiSelectFilter
              options={companyOptions}
              selectedValues={companyFilter}
              onChange={(vals) => {
                setCompanyFilter(vals);
                setDeptFilter(['all']); // reset division
              }}
              placeholder="Select Companies"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Division / Department:</span>
            <MultiSelectFilter
              options={departmentOptionsList}
              selectedValues={deptFilter}
              onChange={(vals) => setDeptFilter(vals)}
              placeholder="Select Departments"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Period:</span>
            <input 
              type="month"
              className="select-filter"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={{ padding: '5px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Period:</span>
            <input 
              type="month"
              className="select-filter"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={{ padding: '5px' }}
            />
          </div>

        </div>
      </div>

      {/* Reports Sub-tab Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        width: 'fit-content',
        gap: '4px'
      }}>
        {[
          { key: 'consolidated', label: 'Group P&L', icon: <BarChart3 size={14} /> },
          { key: 'ratios', label: 'Salary to billings', icon: <Percent size={14} /> },
          { key: 'leagues_billings', label: 'Recruiter billings', icon: <TrendingUp size={14} /> },
          { key: 'leagues_placements', label: 'Recruiter placements', icon: <Award size={14} /> },
          { key: 'forecast', label: 'Forecast desk', icon: <Coins size={14} /> }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: activeTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              color: activeTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ==============================================================
          TAB 1: DYNAMIC COMPANY-WIDE P&L MATRIX
          ============================================================== */}
      {activeTab === 'consolidated' && (
        <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="entity-table dense" style={{ minWidth: '1200px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ minWidth: '220px', fontWeight: 700 }}>P&L Account Line Items (GBP)</th>
                {monthsList.map(m => {
                  const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                  return <th key={m} style={{ textAlign: 'right', fontWeight: 700 }}>{label}</th>;
                })}
                <th style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.04)' }}>Period Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rowData = monthsList.map(m => getFilteredMonthlyData(m));

                const handleCellClick = (label, categoryKey, monthKey, amount, nominalCode = null) => {
                  setDrilldownState({
                    title: `${label} ${monthKey ? `(${new Date(monthKey + '-02').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})` : '(YTD Period Total)'}`,
                    label,
                    categoryKey,
                    monthKey,
                    nominalCode,
                    amount
                  });
                };

                const renderRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
                  const ytdSum = rowData.reduce((acc, row) => acc + (row[key] || 0), 0);
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td 
                        style={{ paddingLeft: isSub ? '24px' : '12px', color, cursor: 'pointer', textDecoration: 'underline decoration-dotted' }}
                        onClick={() => handleCellClick(label, key, null, ytdSum)}
                        title={`Click to view itemized ${label} records for full period`}
                      >
                        {label} 🔍
                      </td>
                      {rowData.map((row, idx) => {
                        const monthKey = monthsList[idx];
                        const val = row[key] || 0;
                        return (
                          <td 
                            key={idx} 
                            style={{ 
                              textAlign: 'right', 
                              color, 
                              cursor: val !== 0 ? 'pointer' : 'default',
                              fontWeight: val !== 0 ? 600 : 400
                            }}
                            onClick={() => val !== 0 && handleCellClick(label, key, monthKey, val)}
                            title={val !== 0 ? `Click to drilldown into ${label} for ${monthKey}` : undefined}
                          >
                            {formatGBP(val)}
                          </td>
                        );
                      })}
                      <td 
                        style={{ textAlign: 'right', fontWeight: 700, color, backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        onClick={() => handleCellClick(label, key, null, ytdSum)}
                        title="Click to view total period itemized transactions"
                      >
                        {formatGBP(ytdSum)}
                      </td>
                    </tr>
                  );
                };

                return (
                  <>
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Revenue stream credits</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderRow('Net Placements Fee Billings', 'revenue', false, true, 'var(--success)')}
                    
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Direct cost (Recruiter Commissions)</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderRow('Accrued Recruiter Commissions', 'commissions', false, true, 'var(--danger)')}

                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />

                    {renderRow('Gross Profit Margin', 'grossProfit', true, false, 'var(--accent)')}

                    <tr style={{ borderBottom: '1px dashed var(--border-color)', height: '8px' }} />

                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Overheads & Staff Expenses</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderRow('Base Wages & Salaries', 'salaries', false, true)}
                    {/* Apportioned Overheads & SaaS (Expandable) */}
                    <tr style={{ fontWeight: 400 }}>
                      <td style={{ paddingLeft: '24px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setExpandedExpenses(!expandedExpenses)}>
                        <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{expandedExpenses ? '▼' : '▶'}</span>
                        <span style={{ fontWeight: 600 }}>Apportioned Overheads & SaaS</span>
                      </td>
                      {rowData.map((row, idx) => {
                        const monthKey = monthsList[idx];
                        const val = row.overheadsExpenses || 0;
                        return (
                          <td 
                            key={idx} 
                            style={{ textAlign: 'right', cursor: val > 0 ? 'pointer' : 'default' }}
                            onClick={() => val > 0 && handleCellClick('Apportioned Overheads & SaaS', 'overheadsExpenses', monthKey, val)}
                            title={val > 0 ? `Click to view all overhead expenses for ${monthKey}` : undefined}
                          >
                            {formatGBP(val)}
                          </td>
                        );
                      })}
                      <td 
                        style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        onClick={() => handleCellClick('Apportioned Overheads & SaaS', 'overheadsExpenses', null, rowData.reduce((acc, row) => acc + (row.overheadsExpenses || 0), 0))}
                      >
                        {formatGBP(rowData.reduce((acc, row) => acc + (row.overheadsExpenses || 0), 0))}
                      </td>
                    </tr>

                    {/* Sub-rows for each nominal code category when expanded */}
                    {expandedExpenses && (() => {
                      const codeKeys = Array.from(new Set(
                        rowData.flatMap(r => Object.keys(r.nominalBreakdown || {}))
                      )).sort();

                      return codeKeys.map(code => {
                        const ytdSum = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0);
                        return (
                          <tr key={code} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <td 
                              style={{ paddingLeft: '48px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                              onClick={() => handleCellClick(`Nominal Cost: ${code}`, 'nominal', null, ytdSum, code)}
                              title={`Click to view all itemized ${code} transactions for full period`}
                            >
                              <span style={{ color: 'var(--text-muted)' }}>↳</span> {code} 🔍
                            </td>
                            {rowData.map((row, idx) => {
                              const monthKey = monthsList[idx];
                              const val = row.nominalBreakdown?.[code] || 0;
                              return (
                                <td 
                                  key={idx} 
                                  style={{ 
                                    textAlign: 'right', 
                                    opacity: val > 0 ? 0.9 : 0.4, 
                                    cursor: val > 0 ? 'pointer' : 'default',
                                    fontWeight: val > 0 ? 600 : 400
                                  }}
                                  onClick={() => val > 0 && handleCellClick(`Nominal Cost: ${code}`, 'nominal', monthKey, val, code)}
                                  title={val > 0 ? `Click to view ${code} transactions for ${monthKey}` : undefined}
                                >
                                  {val > 0 ? formatGBP(val) : '—'}
                                </td>
                              );
                            })}
                            <td 
                              style={{ textAlign: 'right', fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)', opacity: ytdSum > 0 ? 0.9 : 0.4, cursor: ytdSum > 0 ? 'pointer' : 'default' }}
                              onClick={() => ytdSum > 0 && handleCellClick(`Nominal Cost: ${code}`, 'nominal', null, ytdSum, code)}
                            >
                              {formatGBP(ytdSum)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {renderRow('Total Indirect Overheads', 'totalOverheads', true, true, 'var(--text-secondary)')}

                    <tr style={{ borderTop: '2px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.04)', fontSize: '13px' }}>
                      <td style={{ color: 'var(--success)' }}>EBITDA Net Profit Margin</td>
                      {rowData.map((row, idx) => (
                        <td key={idx} style={{ textAlign: 'right', color: row.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {formatGBP(row.netProfit)}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(rowData.reduce((acc, r) => acc + r.netProfit, 0))}
                      </td>
                    </tr>

                    {/* Cumulative Carry-Forward YTD Net Profit (YTD Running Total) */}
                    {(() => {
                      let runningYtd = 0;
                      const runningYtdList = rowData.map(r => {
                        runningYtd += r.netProfit;
                        return runningYtd;
                      });

                      return (
                        <tr style={{ fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.08)', fontSize: '12px', borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ color: 'var(--primary)' }}>📈 Cumulative Carry-Forward YTD Net Profit</td>
                          {runningYtdList.map((ytdVal, idx) => (
                            <td key={idx} style={{ textAlign: 'right', color: ytdVal >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                              {formatGBP(ytdVal)}
                            </td>
                          ))}
                          <td style={{ textAlign: 'right', fontWeight: 800, color: runningYtd >= 0 ? 'var(--success)' : 'var(--danger)', backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                            {formatGBP(runningYtd)}
                          </td>
                        </tr>
                      );
                    })()}

                    <tr style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      <td 
                        onClick={() => setDrilldownState({ categoryKey: 'staffCount', label: 'Staff Count in Apportionment', amount: rowData.reduce((acc, r) => acc + r.headcount, 0), monthKey: null })} 
                        style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}
                        title="Click to view all staff members included in apportionment"
                      >
                        Staff Count in Apportionment 🔍
                      </td>
                      {rowData.map((row, idx) => (
                        <td 
                          key={idx} 
                          onClick={() => setDrilldownState({ categoryKey: 'staffCount', label: 'Staff Count in Apportionment', amount: row.headcount, monthKey: monthsList[idx] })}
                          style={{ textAlign: 'right', cursor: 'pointer', fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' }}
                          title={`Click to view ${row.headcount} active staff members for ${monthsList[idx]}`}
                        >
                          {row.headcount} active
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.02)' }}>—</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 2: DIVISIONAL COMPARISONS (COMPANIES SIDE BY SIDE)
          ============================================================== */}
      {activeTab === 'divisional' && (
        <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="entity-table dense" style={{ minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ minWidth: '220px' }}>P&L Item (Period Cumulative)</th>
                {activeCompaniesForPL.map(c => (
                  <th key={c.id} style={{ textAlign: 'right' }}>{c.name}</th>
                ))}
                <th style={{ textAlign: 'right', fontWeight: 700 }}>Total Consolidated</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const companyDataMap = {};
                companies.forEach(c => {
                  companyDataMap[c.id] = { revenue: 0, commissions: 0, salaries: 0, overheads: 0 };
                });

                monthsList.forEach(mKey => {
                  // Placements
                  placements.filter(p => p.startDate && p.startDate.substring(0, 7) === mKey).forEach(p => {
                    p.splits?.forEach(s => {
                      const rec = staff.find(st => st.id === s.staffId);
                      if (rec && companyDataMap[rec.companyId]) {
                        // Apply department filter if active
                        if (deptFilter.includes('all') || deptFilter.includes(rec.department)) {
                          const share = (p.netScoreValue * s.percentage) / 100;
                          companyDataMap[rec.companyId].revenue += toGBP(share, 'GBP');
                        }
                      }
                    });
                  });

                  // Salaries & Commissions
                  staff.forEach(s => {
                    if (!s.startDate || s.startDate.substring(0, 7) > mKey) return;
                    if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return;
                    
                    if (companyDataMap[s.companyId]) {
                      const pay = getStaffPayrollForMonth(s, mKey);
                      if (mKey > '2026-06') {
                        companyDataMap[s.companyId].salaries += pay.salaries;
                        companyDataMap[s.companyId].commissions += pay.commissions;
                      }
                    }
                  });

                  // Shared overheads
                  const activeStaffInMonth = staff.filter(st => {
                    const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                    return daysWorked >= 10;
                  });
                  const activeStaffInMonthIds = activeStaffInMonth.map(st => st.id);
                  const monthExpenses = expenses.filter(e => e.plMonth === mKey);

                  monthExpenses.forEach(exp => {
                    const gbpAmt = toGBP(exp.amount, exp.currency);

                    if (exp.allocationType === 'company') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(compId => {
                            const percent = parseInt(exp.manualAllocationShares[compId] || 0, 10);
                            const companyShare = gbpAmt * (percent / 100);
                            const compStaff = activeStaffInMonth.filter(st => st.companyId === compId);
                            const compHead = compStaff.length || 1;
                            const perStaffShare = companyShare / compHead;
                            compStaff.forEach(st => {
                              if (companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.companyId));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                              companyDataMap[st.companyId].overheads += perStaffShare;
                            }
                          });
                        }
                      }
                    } else if (exp.allocationType === 'department') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(dept => {
                            const percent = parseInt(exp.manualAllocationShares[dept] || 0, 10);
                            const deptShare = gbpAmt * (percent / 100);
                            const deptStaff = activeStaffInMonth.filter(st => st.department === dept);
                            const deptHead = deptStaff.length || 1;
                            const perStaffShare = deptShare / deptHead;
                            deptStaff.forEach(st => {
                              if (companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.department));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                              companyDataMap[st.companyId].overheads += perStaffShare;
                            }
                          });
                        }
                      }
                    } else if (exp.allocationType === 'staff') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const percent = parseInt(exp.manualAllocationShares[staffId] || 0, 10);
                              const perStaffShare = gbpAmt * (percent / 100);
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            }
                          });
                        } else {
                          const perStaffShare = gbpAmt / targets.length;
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            }
                          });
                        }
                      }
                    } else {
                      const groupHead = activeStaffInMonth.length || 1;
                      activeStaffInMonth.forEach(st => {
                        if (companyDataMap[st.companyId] && (deptFilter.includes('all') || deptFilter.includes(st.department))) {
                          companyDataMap[st.companyId].overheads += gbpAmt / groupHead;
                        }
                      });
                    }
                  });
                });

                const renderSplitRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
                  const visibleCompanies = activeCompaniesForPL;
                  const totalCons = visibleCompanies.reduce((sum, c) => sum + companyDataMap[c.id][key], 0);
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                      {visibleCompanies.map(c => (
                        <td key={c.id} style={{ textAlign: 'right', color }}>
                          {formatGBP(companyDataMap[c.id][key])}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, color, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(totalCons)}
                      </td>
                    </tr>
                  );
                };

                return (
                  <>
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Revenue (Billings generated)</td>
                      <td colSpan={companies.length + 1} />
                    </tr>
                    {renderSplitRow('Net Score Placement Billings', 'revenue', false, true, 'var(--success)')}
                    
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Direct cost (Incentive Wages)</td>
                      <td colSpan={companies.length + 1} />
                    </tr>
                    {renderSplitRow('Accrued Recruiter Commissions', 'commissions', false, true, 'var(--danger)')}

                    <tr style={{ borderBottom: '2px solid var(--border-color)' }} />

                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Operating Overheads (Indirect costs)</td>
                      <td colSpan={companies.length + 1} />
                    </tr>
                    {renderSplitRow('Staff Roster Salaries', 'salaries', false, true)}
                    {renderSplitRow('Apportioned Overheads & SaaS', 'overheads', false, true)}

                    <tr style={{ borderTop: '2px solid var(--border-color)' }} />

                    <tr style={{ fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.05)', fontSize: '13px' }}>
                      <td style={{ color: 'var(--accent)' }}>Net Operating Margin (Profit)</td>
                      {companies.map(c => {
                        const cProfit = companyDataMap[c.id].revenue - companyDataMap[c.id].commissions - companyDataMap[c.id].salaries - companyDataMap[c.id].overheads;
                        return (
                          <td key={c.id} style={{ textAlign: 'right', color: cProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatGBP(cProfit)}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(companies.reduce((sum, c) => {
                          return sum + (companyDataMap[c.id].revenue - companyDataMap[c.id].commissions - companyDataMap[c.id].salaries - companyDataMap[c.id].overheads);
                        }, 0))}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 3: DEPARTMENTAL COMPARISONS
          ============================================================== */}
      {activeTab === 'departmental' && (
        <>
          {/* What-If Simulation Sliders */}
          <div className="detail-section" style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '13px', margin: '0 0 8px 0', color: 'var(--accent)', fontWeight: 700 }}>🎛️ What-If Overhead Allocations Simulator Sliders</h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Adjust the sliders below to simulate a redistribution of overhead expenses per department (e.g. scaling up operations vs downsizing sourcing) and see the Net Margin impact instantly.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {Object.keys(whatIfSliders).map(dept => (
                <div key={dept} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ fontWeight: 600 }}>{dept}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{whatIfSliders[dept]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={whatIfSliders[dept]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setWhatIfSliders(prev => ({ ...prev, [dept]: val }));
                    }}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setWhatIfSliders({
                  "Recruitment": 100,
                  "Sales & Marketing": 100,
                  "Finance": 100,
                  "Operations": 100,
                  "Sourcing": 100,
                  "HR": 100,
                  "Admin": 100
                })}
              >
                Reset Simulator
              </button>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="entity-table dense" style={{ minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ minWidth: '220px' }}>P&L Item (Period Cumulative)</th>
                {["Recruitment", "Sales & Marketing", "Finance", "Operations", "Sourcing", "HR", "Admin"].filter(d => deptFilter.includes('all') || deptFilter.includes(d)).map(d => (
                  <th key={d} style={{ textAlign: 'right' }}>{d}</th>
                ))}
                <th style={{ textAlign: 'right', fontWeight: 700 }}>Total Consolidated</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const depts = ["Recruitment", "Sales & Marketing", "Finance", "Operations", "Sourcing", "HR", "Admin"].filter(d => deptFilter.includes('all') || deptFilter.includes(d));
                const deptDataMap = {};
                depts.forEach(d => {
                  deptDataMap[d] = { revenue: 0, commissions: 0, salaries: 0, overheads: 0 };
                });

                monthsList.forEach(mKey => {
                  // Placements splits
                  placements.filter(p => p.startDate && p.startDate.substring(0, 7) === mKey).forEach(p => {
                    p.splits?.forEach(s => {
                      const rec = staff.find(st => st.id === s.staffId);
                      if (rec && deptDataMap[rec.department]) {
                        // Apply company filter
                        if (activeCompanyIds.includes(rec.companyId)) {
                          const share = (p.netScoreValue * s.percentage) / 100;
                          deptDataMap[rec.department].revenue += toGBP(share, 'GBP');
                        }
                      }
                    });
                  });

                  // Salaries & Commissions
                  staff.forEach(s => {
                    if (!s.startDate || s.startDate.substring(0, 7) > mKey) return;
                    if (!activeCompanyIds.includes(s.companyId)) return;

                    if (deptDataMap[s.department]) {
                      const pay = getStaffPayrollForMonth(s, mKey);
                      if (mKey > '2026-06') {
                        deptDataMap[s.department].salaries += pay.salaries;
                        deptDataMap[s.department].commissions += pay.commissions;
                      }
                    }
                  });

                  // Overheads apportionment
                  const activeStaffInMonth = staff.filter(st => {
                    const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                    return daysWorked >= 10;
                  });
                  const activeStaffInMonthIds = activeStaffInMonth.map(st => st.id);
                  const monthExpenses = expenses.filter(e => e.plMonth === mKey);

                  monthExpenses.forEach(exp => {
                    const gbpAmt = toGBP(exp.amount, exp.currency);

                    if (exp.allocationType === 'company') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(compId => {
                            const percent = parseInt(exp.manualAllocationShares[compId] || 0, 10);
                            const companyShare = gbpAmt * (percent / 100);
                            const compStaff = activeStaffInMonth.filter(st => st.companyId === compId);
                            const compHead = compStaff.length || 1;
                            const perStaffShare = companyShare / compHead;
                            compStaff.forEach(st => {
                              if (deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.companyId));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                              deptDataMap[st.department].overheads += perStaffShare;
                            }
                          });
                        }
                      }
                    } else if (exp.allocationType === 'department') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(dept => {
                            const percent = parseInt(exp.manualAllocationShares[dept] || 0, 10);
                            const deptShare = gbpAmt * (percent / 100);
                            const deptStaff = activeStaffInMonth.filter(st => st.department === dept);
                            const deptHead = deptStaff.length || 1;
                            const perStaffShare = deptShare / deptHead;
                            deptStaff.forEach(st => {
                              if (deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.department));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                              deptDataMap[st.department].overheads += perStaffShare;
                            }
                          });
                        }
                      }
                    } else if (exp.allocationType === 'staff') {
                      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
                      if (targets.length > 0) {
                        if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const percent = parseInt(exp.manualAllocationShares[staffId] || 0, 10);
                              const perStaffShare = gbpAmt * (percent / 100);
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            }
                          });
                        } else {
                          const perStaffShare = gbpAmt / targets.length;
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            }
                          });
                        }
                      }
                    } else {
                      const groupHead = activeStaffInMonth.length || 1;
                      activeStaffInMonth.forEach(st => {
                        if (deptDataMap[st.department] && (activeCompanyIds.includes(st.companyId))) {
                          deptDataMap[st.department].overheads += gbpAmt / groupHead;
                        }
                      });
                    }
                  });
                });

                // Apply What-If sliders overheads adjustments
                depts.forEach(d => {
                  const factor = whatIfSliders[d] !== undefined ? (whatIfSliders[d] / 100) : 1.0;
                  deptDataMap[d].overheads = deptDataMap[d].overheads * factor;
                });

                const renderDeptRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
                  const totalCons = depts.reduce((sum, d) => sum + deptDataMap[d][key], 0);
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                      {depts.map(d => (
                        <td key={d} style={{ textAlign: 'right', color }}>
                          {formatGBP(deptDataMap[d][key])}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, color, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(totalCons)}
                      </td>
                    </tr>
                  );
                };

                return (
                  <>
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Revenue splits</td>
                      <td colSpan={depts.length + 1} />
                    </tr>
                    {renderDeptRow('Candidate Placement Billings', 'revenue', false, true, 'var(--success)')}

                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Direct cost (Incentive Wages)</td>
                      <td colSpan={depts.length + 1} />
                    </tr>
                    {renderDeptRow('Accrued Commissions', 'commissions', false, true, 'var(--danger)')}

                    <tr style={{ borderBottom: '2px solid var(--border-color)' }} />

                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Overheads & SaaS Apportionment</td>
                      <td colSpan={depts.length + 1} />
                    </tr>
                    {renderDeptRow('Base salaries payroll', 'salaries', false, true)}
                    {renderDeptRow('Apportioned Overheads', 'overheads', false, true)}

                    <tr style={{ borderTop: '2px solid var(--border-color)' }} />

                    <tr style={{ fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.05)', fontSize: '13px' }}>
                      <td style={{ color: 'var(--accent)' }}>Net Operating Margin (Profit)</td>
                      {depts.map(d => {
                        const dProfit = deptDataMap[d].revenue - deptDataMap[d].commissions - deptDataMap[d].salaries - deptDataMap[d].overheads;
                        return (
                          <td key={d} style={{ textAlign: 'right', color: dProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatGBP(dProfit)}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(depts.reduce((sum, d) => {
                          return sum + (deptDataMap[d].revenue - deptDataMap[d].commissions - deptDataMap[d].salaries - deptDataMap[d].overheads);
                        }, 0))}
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ==============================================================
          TAB 4: FORECAST DESK
          ============================================================== */}
      {activeTab === 'forecast' && (
        <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="entity-table dense" style={{ minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ minWidth: '220px' }}>Projected Account (GBP)</th>
                {monthsList.map(m => {
                  const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                  return <th key={m} style={{ textAlign: 'right' }}>{label}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const baselineOverhead = expenses
                  .filter(e => e.plMonth)
                  .reduce((sum, e) => sum + toGBP(e.amount, e.currency), 0) / 6;

                const periodMetrics = monthsList.map(pKey => {
                  const isForecast = pKey > '2026-06';
                  
                  // Active staff matching filter
                  const activeStaff = staff.filter(s => {
                    const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, pKey);
                    if (daysWorked < 10) return false;
                    
                    if (!activeCompanyIds.includes(s.companyId)) return false;
                    if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
                    return true;
                  });

                  const activeStaffIds = activeStaff.map(s => s.id);

                  // Placements splits
                  const monthPlacements = placements.filter(p => p.startDate && p.startDate.substring(0, 7) === pKey);
                  const revenue = monthPlacements.reduce((sum, p) => {
                    let cellSum = 0;
                    p.splits?.forEach(s => {
                      const member = staff.find(st => st.id === s.staffId);
                      if (member) {
                        if (!activeCompanyIds.includes(member.companyId)) return;
                        if (!deptFilter.includes('all') && !deptFilter.includes(member.department)) return;
                        cellSum += toGBP((p.netScoreValue * s.percentage) / 100, 'GBP');
                      }
                    });
                    return sum + cellSum;
                  }, 0);

                  // Salaries & Commissions matching overrides/reconciled actuals
                  let salaries = 0;
                  let commissions = 0;

                  activeStaff.forEach(s => {
                    const pay = getStaffPayrollForMonth(s, pKey);
                    if (pKey > '2026-06') {
                      salaries += pay.salaries;
                      commissions += pay.commissions;
                    }
                  });

                  // Overheads
                  let overheadsExpenses = 0;
                  if (isForecast) {
                    overheadsExpenses = baselineOverhead * (activeStaff.length / (staff.length || 1));
                  } else {
                    const groupActiveStaff = staff.filter(s => {
                      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, pKey);
                      return daysWorked >= 10;
                    });
                    const groupActiveStaffIds = groupActiveStaff.map(s => s.id);
                    const monthExp = expenses.filter(e => e.plMonth === pKey);
                    
                    monthExp.forEach(exp => {
                      const gbpAmt = toGBP(exp.amount, exp.currency);
                      if (exp.allocationType === 'company') {
                        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                        if (targets.length > 0) {
                          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                            targets.forEach(compId => {
                              const percent = parseInt(exp.manualAllocationShares[compId] || 0, 10);
                              const companyShare = gbpAmt * (percent / 100);
                              const compStaff = groupActiveStaff.filter(s => s.companyId === compId);
                              const compHead = compStaff.length || 1;
                              const perStaffShare = companyShare / compHead;
                              compStaff.forEach(s => {
                                if (activeStaffIds.includes(s.id)) overheadsExpenses += perStaffShare;
                              });
                            });
                          } else {
                            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.companyId));
                            const totalHead = eligibleStaff.length || 1;
                            const perStaffShare = gbpAmt / totalHead;
                            eligibleStaff.forEach(s => {
                              if (activeStaffIds.includes(s.id)) overheadsExpenses += perStaffShare;
                            });
                          }
                        }
                      } else if (exp.allocationType === 'department') {
                        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                        if (targets.length > 0) {
                          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                            targets.forEach(dept => {
                              const percent = parseInt(exp.manualAllocationShares[dept] || 0, 10);
                              const deptShare = gbpAmt * (percent / 100);
                              const deptStaff = groupActiveStaff.filter(s => s.department === dept);
                              const deptHead = deptStaff.length || 1;
                              const perStaffShare = deptShare / deptHead;
                              deptStaff.forEach(s => {
                                if (activeStaffIds.includes(s.id)) overheadsExpenses += perStaffShare;
                              });
                            });
                          } else {
                            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.department));
                            const totalHead = eligibleStaff.length || 1;
                            const perStaffShare = gbpAmt / totalHead;
                            eligibleStaff.forEach(s => {
                              if (activeStaffIds.includes(s.id)) overheadsExpenses += perStaffShare;
                            });
                          }
                        }
                      } else if (exp.allocationType === 'staff') {
                        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
                        if (targets.length > 0) {
                          if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                            targets.forEach(staffId => {
                              if (groupActiveStaffIds.includes(staffId)) {
                                const percent = parseInt(exp.manualAllocationShares[staffId] || 0, 10);
                                const perStaffShare = gbpAmt * (percent / 100);
                                if (activeStaffIds.includes(staffId)) overheadsExpenses += perStaffShare;
                              }
                            });
                          } else {
                            const perStaffShare = gbpAmt / targets.length;
                            targets.forEach(staffId => {
                              if (groupActiveStaffIds.includes(staffId)) {
                                if (activeStaffIds.includes(staffId)) overheadsExpenses += perStaffShare;
                              }
                            });
                          }
                        }
                      } else {
                        const groupHead = groupActiveStaff.length || 1;
                        groupActiveStaff.forEach(s => {
                          if (activeStaffIds.includes(s.id)) overheadsExpenses += gbpAmt / groupHead;
                        });
                      }
                    });
                  }

                  const totalOverheads = salaries + overheadsExpenses;
                  const netProfit = revenue - commissions - totalOverheads;

                  return { revenue, salaries, commissions, overheadsExpenses, totalOverheads, netProfit };
                });

                const renderForecastRow = (label, key, color = 'var(--text-primary)', isBold = false) => {
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td style={{ color }}>{label}</td>
                      {periodMetrics.map((met, idx) => (
                        <td key={idx} style={{ textAlign: 'right', color, fontFamily: 'monospace' }}>
                          {formatGBP(met[key])}
                        </td>
                      ))}
                    </tr>
                  );
                };

                return (
                  <>
                    {renderForecastRow('Pipeline Revenue (Billings)', 'revenue', 'var(--success)', true)}
                    {renderForecastRow('Direct Commissions Cost', 'commissions', 'var(--danger)')}
                    <tr style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />
                    {renderForecastRow('Employee Salaries', 'salaries')}
                    {renderForecastRow('Projected Shared Overheads', 'overheadsExpenses')}
                    {renderForecastRow('Total Projected Overheads', 'totalOverheads', 'var(--text-secondary)', true)}
                    <tr style={{ borderTop: '2px solid var(--border-color)' }} />
                    <tr style={{ fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.04)', fontSize: '13px' }}>
                      <td style={{ color: 'var(--success)' }}>EBITDA Net Profit Margin</td>
                      {periodMetrics.map((met, idx) => (
                        <td key={idx} style={{ textAlign: 'right', color: met.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontFamily: 'monospace' }}>
                          {formatGBP(met.netProfit)}
                        </td>
                      ))}
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 5: SALARY-TO-BILLINGS RATIO
          ============================================================== */}
      {activeTab === 'ratios' && (
        <div className="table-container">
          <table className="entity-table dense">
            <thead>
              <tr>
                <th>Recruiter Name</th>
                <th>Department / Company</th>
                <th style={{ textAlign: 'right' }}>Wages Paid (GBP)</th>
                <th style={{ textAlign: 'right' }}>Commissions Paid (GBP)</th>
                <th style={{ textAlign: 'right', fontWeight: 600 }}>Total Compensation (GBP)</th>
                <th style={{ textAlign: 'right' }}>Revenue Generated (GBP)</th>
                <th style={{ textAlign: 'right', fontWeight: 700 }}>Cost-to-Revenue Ratio</th>
                <th>ROI Grading Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Filter staff members by company/dept (show all staff)
                const recruitersList = staff.filter(s => {
                  if (!activeCompanyIds.includes(s.companyId)) return false;
                  if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
                  return true;
                });

                const activeRecs = recruitersList.filter(s => s.status !== 'exited');
                const exitedRecs = recruitersList.filter(s => s.status === 'exited');

                if (recruitersList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                        No recruiters found matching the filtered company or department.
                      </td>
                    </tr>
                  );
                }

                const renderRecRow = (rec) => {
                  const employer = companies.find(c => c.id === rec.companyId);
                  
                  // Period Billings (within selected start and end months range)
                  const periodPlacements = placements.filter(p => {
                    if (!p.startDate || p.status === 'dns') return false;
                    const startMonthKey = p.startDate.substring(0, 7);
                    if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
                    return p.splits?.some(s => s.staffId === rec.id);
                  });

                  const periodBillings = periodPlacements.reduce((sum, p) => {
                    const splitObj = p.splits.find(s => s.staffId === rec.id);
                    const share = splitObj ? (Number(p.netScoreValue) * splitObj.percentage) / 100 : 0;
                    return sum + toGBP(share, 'GBP');
                  }, 0);

                  // Calculate actual wages & commissions paid during selected period
                  let wagesPaid = 0;
                  let commissionsPaid = 0;
                  monthsList.forEach(m => {
                    const pay = getStaffPayrollForMonth(rec, m);
                    wagesPaid += pay.salaries;
                    commissionsPaid += pay.commissions;
                  });
                  const totalPaid = wagesPaid + commissionsPaid;
                  const ratio = periodBillings > 0 ? (totalPaid / periodBillings) * 100 : 0;

                  let statusText = 'Low ROI / No Billings';
                  let statusColor = 'var(--danger)';
                  let statusBg = 'rgba(239, 68, 68, 0.08)';

                  if (periodBillings > 0) {
                    if (ratio <= 30) {
                      statusText = 'Superb ROI (≤30%)';
                      statusColor = 'var(--success)';
                      statusBg = 'rgba(16, 185, 129, 0.08)';
                    } else if (ratio <= 60) {
                      statusText = 'Good ROI (31-60%)';
                      statusColor = 'var(--accent)';
                      statusBg = 'rgba(14, 165, 233, 0.08)';
                    } else {
                      statusText = 'High Cost Ratio (>60%)';
                      statusColor = 'var(--warning)';
                      statusBg = 'rgba(245, 158, 11, 0.08)';
                    }
                  }

                  return (
                    <tr key={rec.id} style={{ opacity: rec.status === 'exited' ? 0.75 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        {rec.fullName} {rec.status === 'exited' && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>(Exited)</span>}
                      </td>
                      <td>{rec.department} &bull; {employer ? employer.name : 'Group'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatGBP(wagesPaid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatGBP(commissionsPaid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatGBP(totalPaid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--success)' }}>
                        {formatGBP(periodBillings)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: ratio > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {periodBillings > 0 ? `${ratio.toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: statusColor, 
                          backgroundColor: statusBg, 
                          padding: '3px 8px', 
                          borderRadius: '4px',
                          border: `1px solid ${statusColor}33`
                        }}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                };

                return (
                  <>
                    {activeRecs.map(renderRecRow)}
                    {exitedRecs.length > 0 && (
                      <>
                        <tr 
                          onClick={() => setExpandedExitedRatios(!expandedExitedRatios)}
                          style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td colSpan="8" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ marginRight: '6px' }}>{expandedExitedRatios ? '▼' : '▶'}</span>
                            Exited Staff ({exitedRecs.length})
                          </td>
                        </tr>
                        {expandedExitedRatios && exitedRecs.map(renderRecRow)}
                      </>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 6: RECRUITER LEAGUES
          ============================================================== */}
      {/* ==============================================================
          TAB 6: RECRUITER BILLINGS LEAGUE
          ============================================================== */}
      {activeTab === 'leagues_billings' && (
        <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rankings by Period Billings</h3>
          <table className="entity-table dense">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Rank</th>
                <th>Recruiter Name</th>
                <th style={{ textAlign: 'right' }}>Total Billings (GBP)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const billingsRankList = staff.map(rec => {
                  if (!companyFilter.includes('all') && !companyFilter.includes(rec.companyId)) return null;
                  if (!deptFilter.includes('all') && !deptFilter.includes(rec.department)) return null;

                  const recPlacements = placements.filter(p => {
                    if (!p.startDate || p.status === 'dns') return false;
                    const startMonthKey = p.startDate.substring(0, 7);
                    if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
                    return p.splits?.some(s => s.staffId === rec.id);
                  });

                  const totalVal = recPlacements.reduce((sum, p) => {
                    const split = p.splits.find(s => s.staffId === rec.id);
                    const share = split ? (p.netScoreValue * split.percentage) / 100 : 0;
                    return sum + toGBP(share, 'GBP');
                  }, 0);

                  return { rec, totalVal };
                })
                .filter(Boolean)
                .filter(item => item.totalVal > 0)
                .sort((a, b) => b.totalVal - a.totalVal);

                if (billingsRankList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                        No billings logged matching active filters.
                      </td>
                    </tr>
                  );
                }

                const activeRank = billingsRankList.filter(item => item.rec.status !== 'exited');
                const exitedRank = billingsRankList.filter(item => item.rec.status === 'exited');

                return (
                  <>
                    {activeRank.map((item, idx) => (
                      <tr key={item.rec.id}>
                        <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                        <td>{item.rec.fullName}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                          {formatGBP(item.totalVal)}
                        </td>
                      </tr>
                    ))}
                    {exitedRank.length > 0 && (
                      <>
                        <tr 
                          onClick={() => setExpandedExitedLeaguesLeaguesBillings(!expandedExitedLeaguesBillings)}
                          style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td colSpan="3" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ marginRight: '6px' }}>{expandedExitedLeaguesBillings ? '▼' : '▶'}</span>
                            Exited Staff ({exitedRank.length})
                          </td>
                        </tr>
                        {expandedExitedLeaguesBillings && exitedRank.map((item, idx) => (
                          <tr key={item.rec.id} style={{ opacity: 0.75 }}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>—</td>
                            <td>{item.rec.fullName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Exited)</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                              {formatGBP(item.totalVal)}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 7: RECRUITER PLACEMENTS LEAGUE
          ============================================================== */}
      {activeTab === 'leagues_placements' && (
        <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rankings by Placement Count</h3>
          <table className="entity-table dense">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Rank</th>
                <th>Recruiter Name</th>
                <th style={{ textAlign: 'right' }}>Placements Count</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const volumeRankList = staff.map(rec => {
                  if (!companyFilter.includes('all') && !companyFilter.includes(rec.companyId)) return null;
                  if (!deptFilter.includes('all') && !deptFilter.includes(rec.department)) return null;

                  const recPlacements = placements.filter(p => {
                    if (!p.startDate || p.status === 'dns') return false;
                    const startMonthKey = p.startDate.substring(0, 7);
                    if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
                    return p.splits?.some(s => s.staffId === rec.id);
                  });

                  const splitWeightedCount = recPlacements.reduce((sum, p) => {
                    const split = p.splits.find(s => s.staffId === rec.id);
                    const percentage = split ? (Number(split.percentage) || 0) : 0;
                    return sum + (percentage / 100);
                  }, 0);

                  return { rec, count: splitWeightedCount, rawPlacements: recPlacements };
                })
                .filter(Boolean)
                .filter(item => item.count > 0)
                .sort((a, b) => b.count - a.count);

                if (volumeRankList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                        No placements recorded matching active filters.
                      </td>
                    </tr>
                  );
                }

                const activeRank = volumeRankList.filter(item => item.rec.status !== 'exited');
                const exitedRank = volumeRankList.filter(item => item.rec.status === 'exited');

                return (
                  <>
                    {activeRank.map((item, idx) => (
                      <tr key={item.rec.id}>
                        <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                        <td>{item.rec.fullName}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => setSelectedRecruiterPlacements({
                              recruiterName: item.rec.fullName,
                              placements: item.rawPlacements,
                              recruiterId: item.rec.id
                            })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0,
                              fontSize: 'inherit'
                            }}
                          >
                            {Number(item.count.toFixed(2))} {Number(item.count.toFixed(2)) === 1 ? 'placement' : 'placements'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {exitedRank.length > 0 && (
                      <>
                        <tr 
                          onClick={() => setExpandedExitedLeaguesLeaguesPlacements(!expandedExitedLeaguesPlacements)}
                          style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td colSpan="3" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ marginRight: '6px' }}>{expandedExitedLeaguesPlacements ? '▼' : '▶'}</span>
                            Exited Staff ({exitedRank.length})
                          </td>
                        </tr>
                        {expandedExitedLeaguesPlacements && exitedRank.map((item, idx) => (
                          <tr key={item.rec.id} style={{ opacity: 0.75 }}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>—</td>
                            <td>{item.rec.fullName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Exited)</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                onClick={() => setSelectedRecruiterPlacements({
                                  recruiterName: item.rec.fullName,
                                  placements: item.rawPlacements,
                                  recruiterId: item.rec.id
                                })}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: 0,
                                  fontSize: 'inherit'
                                }}
                              >
                                {Number(item.count.toFixed(2))} {Number(item.count.toFixed(2)) === 1 ? 'placement' : 'placements'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 8: INDIA FINANCIALS
          ============================================================== */}
      {activeTab === 'india' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {(() => {
            const indiaCompanyId = 'comp-1782806277433';
            const indiaCompany = companies.find(c => c.id === indiaCompanyId);
            
            const toINR = (gbpVal) => (Number(gbpVal) || 0) / 0.0094;
            const formatINR = (inrVal) => '₹' + Math.round(inrVal).toLocaleString('en-IN');

            const rowData = monthsList.map(m => {
              const activeStaff = staff.filter(s => {
                if (s.companyId !== indiaCompanyId) return false;
                const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, m);
                return daysWorked >= 10;
              });

              const monthPlacements = placements.filter(p => p.startDate && p.startDate.substring(0, 7) === m);
              const revenue = monthPlacements.reduce((sum, p) => {
                let cellSum = 0;
                p.splits?.forEach(s => {
                  const member = staff.find(st => st.id === s.staffId);
                  if (member && member.companyId === indiaCompanyId) {
                    const share = (p.netScoreValue * s.percentage) / 100;
                    cellSum += toGBP(share, 'GBP');
                  }
                });
                return sum + cellSum;
              }, 0);

              let salaries = 0;
              let commissions = 0;
              activeStaff.forEach(s => {
                const pay = getStaffPayrollForMonth(s, m);
                if (m > '2026-06') {
                  salaries += pay.salaries;
                  commissions += pay.commissions;
                }
              });

              const nominalBreakdown = getNominalBreakdownForMonth(m, indiaCompanyId);
              const overheadsExpenses = Object.values(nominalBreakdown).reduce((sum, v) => sum + v, 0);

              const grossProfit = revenue - commissions;
              const totalOverheads = salaries + overheadsExpenses;
              const netProfit = revenue - commissions - totalOverheads;

              return {
                month: m,
                revenue: toINR(revenue),
                salaries: toINR(salaries),
                commissions: toINR(commissions),
                overheadsExpenses: toINR(overheadsExpenses),
                grossProfit: toINR(grossProfit),
                totalOverheads: toINR(totalOverheads),
                netProfit: toINR(netProfit),
                nominalBreakdown: Object.fromEntries(
                  Object.entries(nominalBreakdown).map(([k, v]) => [k, toINR(v)])
                ),
                headcount: activeStaff.length
              };
            });

            const renderIndiaRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
              const ytdSum = rowData.reduce((acc, row) => acc + (row[key] || 0), 0);
              return (
                <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                  <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                  {rowData.map((row, idx) => (
                    <td key={idx} style={{ textAlign: 'right', color }}>
                      {formatINR(row[key] || 0)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 700, color, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    {formatINR(ytdSum)}
                  </td>
                </tr>
              );
            };

            return (
              <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600 }}>India Offshore Sourcing Entity P&L Matrix</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Financial statement for **{indiaCompany ? indiaCompany.name : 'Talent-H'}** denominated in Indian Rupees (INR ₹) based on exchange rate conversions.
                    </p>
                  </div>
                </div>

                <table className="entity-table dense" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <th style={{ minWidth: '220px', fontWeight: 700 }}>P&L Account Line Items (INR)</th>
                      {monthsList.map(m => {
                        const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                        return <th key={m} style={{ textAlign: 'right', fontWeight: 700 }}>{label}</th>;
                      })}
                      <th style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.04)' }}>Period Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Revenue Credits (INR)</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderIndiaRow('Net Placements Fee Billings', 'revenue', false, true, 'var(--success)')}
                    
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Direct cost (INR)</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderIndiaRow('Accrued Recruiter Commissions', 'commissions', false, true, 'var(--danger)')}

                    <tr style={{ borderBottom: '1px solid var(--border-color)' }} />

                    {renderIndiaRow('Gross Profit Margin', 'grossProfit', true, false, 'var(--accent)')}

                    <tr style={{ borderBottom: '1px dashed var(--border-color)', height: '8px' }} />

                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Overheads & Staff Expenses (INR)</td>
                      <td colSpan={monthsList.length + 1} />
                    </tr>
                    {renderIndiaRow('Base Wages & Salaries', 'salaries', false, true)}
                    {renderIndiaRow('Apportioned Overheads & SaaS', 'overheadsExpenses', false, true)}
                    {renderIndiaRow('Total Indirect Overheads', 'totalOverheads', true, true, 'var(--text-secondary)')}

                    <tr style={{ borderTop: '2px solid var(--border-color)' }} />
                    
                    <tr style={{ fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.04)', fontSize: '13px' }}>
                      <td style={{ color: 'var(--success)' }}>EBITDA Net Profit Margin</td>
                      {rowData.map((row, idx) => (
                        <td key={idx} style={{ textAlign: 'right', color: row.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {formatINR(row.netProfit)}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatINR(rowData.reduce((acc, r) => acc + r.netProfit, 0))}
                      </td>
                    </tr>

                    <tr style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      <td>Active Headcount</td>
                      {rowData.map((row, idx) => (
                        <td key={idx} style={{ textAlign: 'right' }}>
                          {row.headcount} active
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.02)' }}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ==============================================================
          TAB 9: SHARED OVERHEADS ALLOCATION
          ============================================================== */}
      {activeTab === 'overheads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {(() => {
            const targetMonth = startMonth;

            const monthExpenses = expenses.filter(e => e.plMonth === targetMonth);
            const totalSharedPool = monthExpenses.reduce((sum, exp) => {
              if (exp.allocationType === 'company' || exp.allocationType === 'department' || exp.allocationType === 'staff') {
                return sum;
              }
              return sum + toGBP(exp.amount, exp.currency);
            }, 0);

            const activeStaff = staff.filter(s => {
              const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, targetMonth);
              return daysWorked >= 10;
            });

            const totalHeadcount = activeStaff.length || 1;
            const perStaffShare = totalSharedPool / totalHeadcount;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Shared Overheads Apportionment Ledger</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Shows how unallocated company-wide overhead expenses are split equally across headcount for **{targetMonth}**.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Select Allocation Month:</span>
                    <input
                      type="month"
                      className="select-filter"
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      style={{ padding: '6px' }}
                    />
                  </div>
                </div>

                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div className="metric-card" style={{ '--card-accent': 'var(--primary)', padding: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Shared Overheads Pool ({targetMonth})</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{formatGBP(totalSharedPool)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total unallocated company expenses</div>
                  </div>

                  <div className="metric-card" style={{ '--card-accent': 'var(--accent)', padding: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Apportionment Headcount</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{totalHeadcount} Consultants</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Active members (worked &gt;= 10 days)</div>
                  </div>

                  <div className="metric-card" style={{ '--card-accent': 'var(--success)', padding: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Apportioned Share / Recruiter</span>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--accent)' }}>{formatGBP(perStaffShare)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Equal split share per head</div>
                  </div>
                </div>

                <div className="table-container">
                  <table className="entity-table dense">
                    <thead>
                      <tr>
                        <th>Recruiter Name</th>
                        <th>Company Profile</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'right' }}>Direct Wages (GBP)</th>
                        <th style={{ textAlign: 'right' }}>Shared Overheads Share (GBP)</th>
                        <th style={{ textAlign: 'right', fontWeight: 700 }}>Total Allocated Cost (GBP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const activeStaffFiltered = activeStaff.filter(s => {
                          if (s.status === 'exited') return false;
                          if (!activeCompanyIds.includes(s.companyId)) return false;
                          if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
                          return true;
                        });
                        const exitedStaffFiltered = activeStaff.filter(s => {
                          if (s.status !== 'exited') return false;
                          if (!activeCompanyIds.includes(s.companyId)) return false;
                          if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
                          return true;
                        });

                        return (
                          <>
                            {activeStaffFiltered.map(s => {
                              const employer = companies.find(c => c.id === s.companyId);
                              const pay = getStaffPayrollForMonth(s, targetMonth);
                              const directWages = pay.salaries;
                              const totalCost = directWages + perStaffShare;

                              return (
                                <tr key={s.id}>
                                  <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                                  <td>{employer ? employer.name : 'Unknown'}</td>
                                  <td>{s.department || 'Operations'}</td>
                                  <td style={{ textAlign: 'right' }}>{formatGBP(directWages)}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatGBP(perStaffShare)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatGBP(totalCost)}</td>
                                </tr>
                              );
                            })}

                            {exitedStaffFiltered.length > 0 && (
                              <>
                                <tr 
                                  onClick={() => setExpandedExitedOverheads(!expandedExitedOverheads)}
                                  style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <td colSpan="6" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span style={{ marginRight: '6px' }}>{expandedExitedOverheads ? '▼' : '▶'}</span>
                                    Exited Staff ({exitedStaffFiltered.length})
                                  </td>
                                </tr>
                                {expandedExitedOverheads && exitedStaffFiltered.map(s => {
                                  const employer = companies.find(c => c.id === s.companyId);
                                  const pay = getStaffPayrollForMonth(s, targetMonth);
                                  const directWages = pay.salaries;
                                  const totalCost = directWages + perStaffShare;

                                  return (
                                    <tr key={s.id} style={{ opacity: 0.75 }}>
                                      <td style={{ fontWeight: 600 }}>{s.fullName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Exited)</span></td>
                                      <td>{employer ? employer.name : 'Unknown'}</td>
                                      <td>{s.department || 'Operations'}</td>
                                      <td style={{ textAlign: 'right' }}>{formatGBP(directWages)}</td>
                                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatGBP(perStaffShare)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatGBP(totalCost)}</td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </>
                        );
                      })()}

                      {activeStaff.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No active staff members found in this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Placements Details Popup Modal */}
      {selectedRecruiterPlacements && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="table-container" style={{
            width: '100%',
            maxWidth: '900px',
            maxHeight: '85vh',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Placements Breakdown: {selectedRecruiterPlacements.recruiterName}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Showing split allocations for period {startMonth} to {endMonth}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecruiterPlacements(null)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <table className="entity-table dense">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th>Placement ID</th>
                    <th>Client</th>
                    <th>Candidate</th>
                    <th>Start Date</th>
                    <th style={{ textAlign: 'right' }}>Total Net Fee</th>
                    <th style={{ textAlign: 'right' }}>Split %</th>
                    <th style={{ textAlign: 'right', fontWeight: 600 }}>Allocation (GBP)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecruiterPlacements.placements.map(p => {
                    const splitObj = p.splits?.find(s => s.staffId === selectedRecruiterPlacements.recruiterId);
                    const splitPct = splitObj ? (Number(splitObj.percentage) || 0) : 0;
                    const allocationVal = (Number(p.netScoreValue) * splitPct) / 100;
                    const feeGBP = toGBP(p.netScoreValue, 'GBP');
                    const allocationGBP = toGBP(allocationVal, 'GBP');
                    
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.pId || p.id}</td>
                        <td>{p.clientName}</td>
                        <td>{p.candidateName}</td>
                        <td>{p.startDate}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatGBP(feeGBP)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{splitPct}%</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>
                          {formatGBP(allocationGBP)}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: p.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                            color: p.status === 'active' ? 'var(--success)' : 'var(--warning)',
                            border: `1px solid ${p.status === 'active' ? 'var(--success)' : 'var(--warning)'}33`
                          }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {selectedRecruiterPlacements.placements.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                        No placement records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                className="btn-primary"
                onClick={() => setSelectedRecruiterPlacements(null)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive P&L Itemization & Transaction Drilldown Modal */}
      {drilldownState && (() => {
        const isCompanyMatch = (companyId) => {
          if (companyFilter.includes('all')) return true;
          return companyFilter.includes(companyId);
        };

        const isDeptMatch = (deptName) => {
          if (deptFilter.includes('all')) return true;
          return deptFilter.includes(deptName);
        };

        const getDrilldownItems = () => {
          const { categoryKey, monthKey, nominalCode } = drilldownState;
          if (!categoryKey) return [];

          if (categoryKey === 'revenue') {
            return (placements || []).filter(p => {
              if (!p.startDate || p.status === 'dns') return false;
              const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
                const d = new Date(p.startDate);
                d.setMonth(d.getMonth() + 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })();
              if (monthKey && pMonth !== monthKey) return false;

              const recIds = p.splits?.map(s => s.staffId).filter(Boolean) || [p.recruiterId];
              const recs = staff.filter(s => recIds.includes(s.id));
              const compMatches = recs.length > 0 ? recs.some(s => isCompanyMatch(s.companyId)) : true;
              const deptMatches = recs.length > 0 ? recs.some(s => isDeptMatch(s.department)) : true;

              return compMatches && deptMatches;
            });
          }

          if (categoryKey === 'commissions') {
            const results = [];
            (staff || []).forEach(s => {
              if (!isCompanyMatch(s.companyId) || !isDeptMatch(s.department)) return;
              const mList = monthKey ? [monthKey] : monthsList;
              mList.forEach(m => {
                const commVal = calculateCommissionForRecruiter(s.id, m);
                if (commVal > 0) {
                  results.push({
                    recruiterName: s.fullName,
                    department: s.department,
                    monthKey: m,
                    commVal,
                    policy: commissionPolicies.find(p => p.id === s.commissionPolicyId)?.name || 'Standard Plan'
                  });
                }
              });
            });
            return results;
          }

          if (categoryKey === 'salaries') {
            const results = [];
            (staff || []).forEach(s => {
              if (s.employmentStatus === 'exited') return;
              if (!isCompanyMatch(s.companyId) || !isDeptMatch(s.department)) return;
              const mList = monthKey ? [monthKey] : monthsList;
              mList.forEach(m => {
                const salData = getStaffPayrollForMonth(s, m);
                if (salData.salaries > 0) {
                  results.push({
                    staffName: s.fullName,
                    jobTitle: s.jobTitle,
                    department: s.department,
                    companyName: companies.find(c => c.id === s.companyId)?.name || 'Group',
                    monthKey: m,
                    amount: salData.salaries
                  });
                }
              });
            });
            return results;
          }

          if (categoryKey === 'staffCount') {
            const results = [];
            const mList = monthKey ? [monthKey] : monthsList;
            mList.forEach(m => {
              (staff || []).forEach(s => {
                if (!isCompanyMatch(s.companyId) || !isDeptMatch(s.department)) return;
                const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, m);
                if (daysWorked >= 10) {
                  results.push({
                    id: s.id,
                    staffName: s.fullName,
                    jobTitle: s.jobTitle || 'Recruiter / Staff',
                    department: s.department,
                    companyName: companies.find(c => c.id === s.companyId)?.name || 'Group',
                    startDate: s.startDate || '—',
                    monthKey: m,
                    daysWorked,
                    status: s.employmentStatus || 'active'
                  });
                }
              });
            });
            return results;
          }

          if (categoryKey === 'overheadsExpenses' || categoryKey === 'nominal' || categoryKey === 'totalOverheads') {
            return (expenses || []).filter(e => {
              if (e.status === 'dns' || e.status === 'cancelled') return false;
              const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
              if (monthKey && eMonth !== monthKey) return false;
              if (nominalCode && e.nominalCode !== nominalCode && !e.nominalCode?.startsWith(nominalCode)) return false;

              if (e.allocationType === 'staff' || e.recipientType === 'staff') {
                const targetStaffIds = Array.isArray(e.allocationTarget) ? e.allocationTarget : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                const matchedStaff = staff.filter(s => targetStaffIds.includes(s.id));
                const hasDeptMatch = matchedStaff.some(s => isDeptMatch(s.department));
                const hasCompMatch = matchedStaff.some(s => isCompanyMatch(s.companyId));
                if (!hasDeptMatch || !hasCompMatch) return false;
              } else if (e.allocationType === 'department') {
                const targetDepts = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
                if (!deptFilter.includes('all') && !targetDepts.some(d => deptFilter.includes(d))) return false;
              } else if (e.allocationType === 'company') {
                const targetComps = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
                if (!companyFilter.includes('all') && !targetComps.some(c => companyFilter.includes(c))) return false;

                if (!deptFilter.includes('all')) {
                  const hasDeptStaff = staff.some(s => targetComps.includes(s.companyId) && deptFilter.includes(s.department));
                  if (!hasDeptStaff) return false;
                }
              }

              return true;
            });
          }

          return [];
        };

        const rawItems = getDrilldownItems();
        const q = drilldownSearch.toLowerCase().trim();
        const filteredItems = rawItems.filter(item => {
          if (!q) return true;
          return JSON.stringify(item).toLowerCase().includes(q);
        });

        return (
          <div className="form-wizard-overlay" onClick={() => setDrilldownState(null)} style={{ zIndex: 1200 }}>
            <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '960px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    🔍 P&L Line Itemization: {drilldownState.label}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Period: <strong>{drilldownState.monthKey || 'YTD Full Period'}</strong> • Total Value: <strong style={{ color: 'var(--primary)' }}>{formatGBP(drilldownState.amount)}</strong>
                    {!deptFilter.includes('all') && (
                      <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', fontWeight: 700 }}>
                        Filtered by Division: {deptFilter.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setDrilldownState(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>✕</button>
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Filter by payee, recruiter, client, or role..." 
                  value={drilldownSearch} 
                  onChange={(e) => setDrilldownSearch(e.target.value)} 
                  className="search-input" 
                  style={{ width: '100%', maxWidth: '380px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Showing {filteredItems.length} of {rawItems.length} contributing records
                </span>
              </div>

              {/* Recipient Allocation Breakdown Bar ("For Whom The Sum Is") */}
              {(drilldownState.categoryKey === 'overheadsExpenses' || drilldownState.categoryKey === 'nominal' || drilldownState.categoryKey === 'totalOverheads') && (() => {
                const staffTargetMap = {};
                const companyTargetMap = {};

                filteredItems.forEach(exp => {
                  const mKey = exp.plMonth || drilldownState.monthKey || '2026-01';
                  const amt = toGBP(exp.amount || 0, exp.currency || 'GBP');
                  
                  const activeStaffInMonth = staff.filter(s => {
                    const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, mKey);
                    return daysWorked >= 10;
                  });

                  if (exp.recipientType === 'staff' && exp.recipientId) {
                    const sObj = activeStaffInMonth.find(s => s.id === exp.recipientId);
                    if (sObj && isDeptMatch(sObj.department) && isCompanyMatch(sObj.companyId)) {
                      staffTargetMap[sObj.fullName] = (staffTargetMap[sObj.fullName] || 0) + amt;
                    }
                  } else if (exp.allocationType === 'staff') {
                    const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : (exp.selectedStaffIds || []);
                    const matchingStaff = activeStaffInMonth.filter(s => ids.includes(s.id) && isDeptMatch(s.department) && isCompanyMatch(s.companyId));
                    if (matchingStaff.length > 0) {
                      const perStaff = amt / ids.length;
                      matchingStaff.forEach(sObj => {
                        staffTargetMap[sObj.fullName] = (staffTargetMap[sObj.fullName] || 0) + perStaff;
                      });
                    }
                  } else if (exp.allocationType === 'company') {
                    const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                    if (ids.length > 0) {
                      if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
                        ids.forEach(id => {
                          const percent = parseInt(exp.manualAllocationShares[id] || 0, 10);
                          const compShare = amt * (percent / 100);
                          const cObj = companies.find(c => c.id === id);
                          if (cObj && isCompanyMatch(cObj.id) && compShare > 0) {
                            companyTargetMap[cObj.name] = (companyTargetMap[cObj.name] || 0) + compShare;
                          }
                        });
                      } else {
                        // Automatic Staff-Weighted Apportionment based on THAT month's active staff!
                        const targetStaff = activeStaffInMonth.filter(s => ids.includes(s.companyId));
                        const totalHead = targetStaff.length || 1;

                        ids.forEach(id => {
                          const compStaff = targetStaff.filter(s => s.companyId === id);
                          const compHead = compStaff.length;
                          const compShare = (compHead / totalHead) * amt;
                          const cObj = companies.find(c => c.id === id);

                          if (cObj && isCompanyMatch(cObj.id) && compHead > 0) {
                            companyTargetMap[`${cObj.name} (${compHead} staff)`] = (companyTargetMap[`${cObj.name} (${compHead} staff)`] || 0) + compShare;
                          }
                        });
                      }
                    }
                  } else {
                    companyTargetMap['Group Corporate Overhead'] = (companyTargetMap['Group Corporate Overhead'] || 0) + amt;
                  }
                });

                const staffEntries = Object.entries(staffTargetMap);
                const companyEntries = Object.entries(companyTargetMap);

                return (
                  <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>💡 Cost Allocation Summary (For Whom This Sum Is Incurred):</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {staffEntries.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '6px', color: 'var(--primary)' }}>
                          <strong>👥 {staffEntries.length} Staff Seat Users:</strong>
                          <span>{staffEntries.slice(0, 5).map(([name, val]) => `${name} (£${Math.round(val)})`).join(', ')}{staffEntries.length > 5 ? ` +${staffEntries.length - 5} more` : ''}</span>
                        </div>
                      )}
                      {companyEntries.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', color: 'var(--success)' }}>
                          <strong>🏢 Entity Overheads:</strong>
                          <span>{companyEntries.map(([name, val]) => `${name} (£${Math.round(val)})`).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Table Body */}
              <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="entity-table dense" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      {drilldownState.categoryKey === 'revenue' && (
                        <>
                          <th>Placement ID</th>
                          <th>Candidate</th>
                          <th>Client / Company</th>
                          <th>Job Role</th>
                          <th>Start Date</th>
                          <th style={{ textAlign: 'right' }}>Net Fee (GBP)</th>
                        </>
                      )}
                      {drilldownState.categoryKey === 'commissions' && (
                        <>
                          <th>Recruiter Name</th>
                          <th>Department</th>
                          <th>Month</th>
                          <th>Commission Tier Policy</th>
                          <th style={{ textAlign: 'right' }}>Accrued Commission</th>
                        </>
                      )}
                      {drilldownState.categoryKey === 'salaries' && (
                        <>
                          <th>Staff Member</th>
                          <th>Job Title</th>
                          <th>Department</th>
                          <th>Primary Company</th>
                          <th>Month</th>
                          <th style={{ textAlign: 'right' }}>Monthly Base Salary</th>
                        </>
                      )}
                      {drilldownState.categoryKey === 'staffCount' && (
                        <>
                          <th>Staff Member</th>
                          <th>Job Title</th>
                          <th>Department / Division</th>
                          <th>Company Entity</th>
                          <th>Month</th>
                          <th>Start Date</th>
                          <th style={{ textAlign: 'right' }}>Active Status</th>
                        </>
                      )}
                      {(drilldownState.categoryKey === 'overheadsExpenses' || drilldownState.categoryKey === 'nominal' || drilldownState.categoryKey === 'totalOverheads') && (
                        <>
                          <th>Date</th>
                          <th>P&L Month</th>
                          <th>Payee / Vendor</th>
                          <th>Linked Contract</th>
                          <th>Nominal Code</th>
                          <th>Allocated To (For Whom)</th>
                          <th style={{ textAlign: 'right' }}>Amount (Gross)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                          No matching itemized records found for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        if (drilldownState.categoryKey === 'revenue') {
                          return (
                            <tr key={item.id || idx}>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.placementId || item.id}</td>
                              <td>{item.candidateName}</td>
                              <td>{item.clientName}</td>
                              <td>{item.jobTitle}</td>
                              <td>{item.startDate}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                {formatGBP(toGBP(item.netScoreValue || 0, item.currency || 'GBP'))}
                              </td>
                            </tr>
                          );
                        }
                        if (drilldownState.categoryKey === 'commissions') {
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{item.recruiterName}</td>
                              <td>{item.department}</td>
                              <td>{item.monthKey}</td>
                              <td>{item.policy}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                {formatGBP(item.commVal)}
                              </td>
                            </tr>
                          );
                        }
                        if (drilldownState.categoryKey === 'salaries') {
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{item.staffName}</td>
                              <td>{item.jobTitle}</td>
                              <td>{item.department}</td>
                              <td>{item.companyName}</td>
                              <td>{item.monthKey}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                {formatGBP(item.amount)}
                              </td>
                            </tr>
                          );
                        }
                        if (drilldownState.categoryKey === 'staffCount') {
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>👤 {item.staffName}</td>
                              <td>{item.jobTitle}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '11px' }}>
                                  {item.department}
                                </span>
                              </td>
                              <td>{item.companyName}</td>
                              <td>{item.monthKey}</td>
                              <td>{item.startDate}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                ✓ Active ({item.daysWorked} days)
                              </td>
                            </tr>
                          );
                        }

                        // Overheads & Nominal Codes allocation string calculation
                        let targetStr = '🌐 Group Corporate Overhead';
                        if (item.recipientType === 'staff' && item.recipientId) {
                          const sObj = staff.find(s => s.id === item.recipientId);
                          targetStr = `👤 Direct Staff: ${sObj?.fullName || 'Staff Member'}`;
                        } else if (item.allocationType === 'staff') {
                          const ids = Array.isArray(item.allocationTarget) ? item.allocationTarget : (item.selectedStaffIds || []);
                          const names = ids.map(id => staff.find(s => s.id === id)?.fullName).filter(Boolean);
                          targetStr = names.length > 0 ? `💻 ${names.length} Staff Seats: ${names.join(', ')}` : '💻 Staff Seats';
                        } else if (item.allocationType === 'company') {
                          const ids = Array.isArray(item.allocationTarget) ? item.allocationTarget : [item.allocationTarget].filter(Boolean);
                          const names = ids.map(id => companies.find(c => c.id === id)?.name).filter(Boolean);
                          targetStr = names.length > 0 ? `🏢 Entity Overhead: ${names.join(', ')}` : '🏢 Entity Overhead';
                        }

                        return (
                          <tr key={item.id || idx}>
                            <td>{item.date}</td>
                            <td>{item.plMonth}</td>
                            <td style={{ fontWeight: 600 }}>{item.payee}</td>
                            <td>{contracts.find(c => c.id === item.linkedContractId)?.name || 'General Vendor'}</td>
                            <td>{item.nominalCode}</td>
                            <td style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>{targetStr}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatGBP(toGBP(item.amount || 0, item.currency || 'GBP'))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setDrilldownState(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
