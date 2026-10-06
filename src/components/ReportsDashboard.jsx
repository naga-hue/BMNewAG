import React, { useState, useEffect, useMemo } from 'react';
import MultiSelectFilter from './MultiSelectFilter';
import CompanyDeptTreeFilter from './CompanyDeptTreeFilter';
import { toGBP, FX_RATES } from '../utils/currency';
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
  Coins,
  Printer,
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DepartmentTeamCostTab from './reports/DepartmentTeamCostTab';

const formatGBP = (val) => {
  return '£' + Math.round(val).toLocaleString();
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
  leavePolicies = [],
  holidays = [],
  nominalCodes = [],
  vendors = [],
  contracts = [],
  assetAssignments = [],
  onShowToast,
  currentUser
}) {
  const [activeTab, setActiveTab] = useState('consolidated'); // consolidated, divisional, departmental, forecast, ratios, leagues
  
  const isManager = currentUser?.permissions?.role === 'manager';
  const userDept = currentUser?.department;

  // Global Filters
  const [companyFilter, setCompanyFilter] = useState(['all']);
  const [deptFilter, setDeptFilter] = useState(isManager && userDept ? [userDept] : ['all']);
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-12');

  useEffect(() => {
    if (isManager && userDept) {
      setDeptFilter([userDept]);
      setCompanyFilter(['all']);
    }
  }, [currentUser, isManager, userDept]);
  const [expandedExpenses, setExpandedExpenses] = useState(false);
  const [expandedBalanceSheet, setExpandedBalanceSheet] = useState(false);
  const [hideZeroNominals, setHideZeroNominals] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-hide-zero-nominals');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true; // Default to hiding nominal rows with £0 balance
  });

  const handleToggleHideZeroNominals = () => {
    setHideZeroNominals(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bm-hide-zero-nominals', String(next));
      } catch (e) {}
      return next;
    });
  };
  const [drilldownState, setDrilldownState] = useState(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [drilldownTypeFilter, setDrilldownTypeFilter] = useState('all'); // 'all', 'paid', 'projected'
  const [drilldownVisibleCols, setDrilldownVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-drilldown-expense-cols');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      date: true,
      plMonth: true,
      payee: true,
      contract: true,
      nominal: true,
      allocation: true,
      status: true,
      amount: true,
      tax: false,
      bank: false,
      receipt: false
    };
  });
  const [showDrilldownColPicker, setShowDrilldownColPicker] = useState(false);

  const handleToggleDrilldownCol = (key) => {
    setDrilldownVisibleCols(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('bm-drilldown-expense-cols', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };
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

  // Excluded nominal codes in Apportioned Overheads & SaaS
  const [excludedNominalCodes, setExcludedNominalCodes] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-reports-excluded-nominals');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return (nominalCodes || [])
      .filter(c => c && c.includeInOverheads === false)
      .map(c => c.code || c.id);
  });

  const matchesNominal = (a, b) => {
    if (!a || !b) return false;
    const sA = String(a).trim().toLowerCase();
    const sB = String(b).trim().toLowerCase();
    if (sA === sB) return true;
    if (sA.startsWith(sB + ' ') || sA.startsWith(sB + ' -') || sB.startsWith(sA + ' ') || sB.startsWith(sA + ' -')) return true;
    const idA = sA.split(' - ')[0]?.trim();
    const idB = sB.split(' - ')[0]?.trim();
    if (idA && idB && idA === idB) return true;
    return false;
  };

  const isNominalExcluded = (code) => {
    if (!code) return false;
    return excludedNominalCodes.some(ex => matchesNominal(ex, code));
  };

  const isExpenseSupersededByPayroll = (e) => {
    if (!e || !e.id) return false;
    // Generated payroll items are never superseded
    if (
      e.id.startsWith('payroll-salary-') ||
      e.id.startsWith('payroll-reimburse-') ||
      e.id.startsWith('payroll-tax-') ||
      e.id.startsWith('payroll-pension-') ||
      e.id.startsWith('payroll-exp-')
    ) {
      return false;
    }

    const allExpenses = expenses || [];
    const pRecords = payrollRecords || [];

    // Check if directly linked via linkedPayrollCellId (e.g. "staff-xxx_2026-03")
    if (e.linkedPayrollCellId) {
      const parts = e.linkedPayrollCellId.split('_');
      const staffId = parts[0];
      const targetMonth = parts[1] || e.plMonth;
      const hasSalaryExpense = allExpenses.some(pe => 
        pe.id === `payroll-salary-${staffId}-${targetMonth}` || 
        pe.id === `payroll-salary-${staffId}-${e.plMonth}` || 
        pe.id === `payroll-salary-${e.linkedPayrollCellId}` ||
        pe.id.startsWith(`payroll-salary-${staffId}-${targetMonth}`) ||
        pe.id.startsWith(`payroll-salary-${staffId}-${e.plMonth}`)
      );
      if (hasSalaryExpense) return true;
    }

    // Check if referenced by a reconciled payroll record
    const matchingRecord = pRecords.find(r => r.linkedExpenseId === e.id && r.isReconciled);
    if (matchingRecord) {
      const hasSalaryExpense = allExpenses.some(pe => 
        pe.id === `payroll-salary-${matchingRecord.staffId}-${matchingRecord.month}` || 
        pe.id === `payroll-salary-${matchingRecord.id}` ||
        pe.id.startsWith(`payroll-salary-${matchingRecord.staffId}-${matchingRecord.month}`)
      );
      if (hasSalaryExpense) return true;
    }

    return false;
  };

  const handleToggleNominalInclusion = (code) => {
    setExcludedNominalCodes(prev => {
      const isEx = isNominalExcluded(code);
      let updated;
      if (isEx) {
        updated = prev.filter(c => !matchesNominal(c, code));
      } else {
        updated = [...prev, code];
      }
      try {
        localStorage.setItem('bm-reports-excluded-nominals', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleIncludeAllNominals = () => {
    setExcludedNominalCodes([]);
    try {
      localStorage.setItem('bm-reports-excluded-nominals', JSON.stringify([]));
    } catch (e) {}
  };

  const allAvailableNominals = useMemo(() => {
    const list = new Set();
    (nominalCodes || []).forEach(c => {
      if (c && c.code) list.add(c.code);
    });
    (expenses || []).forEach(e => {
      if (e.nominalCode && !e.nominalCode.trim().startsWith('9')) list.add(e.nominalCode);
    });
    (contracts || []).forEach(c => {
      if (c.nominalCode) list.add(c.nominalCode);
    });
    return Array.from(list).sort();
  }, [nominalCodes, expenses, contracts]);

  const selectedNominalValues = useMemo(() => {
    if (excludedNominalCodes.length === 0) return ['all'];
    const included = allAvailableNominals.filter(c => !isNominalExcluded(c));
    return included.length === 0 ? [] : included;
  }, [excludedNominalCodes, allAvailableNominals]);

  const handleNominalFilterChange = (selected) => {
    if (selected.includes('all')) {
      handleIncludeAllNominals();
      return;
    }
    const newlyExcluded = allAvailableNominals.filter(c => !selected.includes(c));
    setExcludedNominalCodes(newlyExcluded);
    try {
      localStorage.setItem('bm-reports-excluded-nominals', JSON.stringify(newlyExcluded));
    } catch (e) {}
  };

  // Companies included based on consolidation preference
  const activeCompaniesForPL = companies.filter(c => {
    if (currentUser?.permissions?.role !== 'admin' && c.id !== currentUser?.companyId) {
      return false;
    }
    if (companyFilter.includes('all')) {
      return c.includeInConsolidation !== false;
    }
    return companyFilter.includes(c.id);
  });

  const getContractCompanyShare = (c, mKey, companyId) => {
    const splits = c.splits || [];
    
    // Filter active staff in the month
    const activeStaff = staff.filter(s => {
      const days = getDaysWorkedInMonth(s.startDate, s.exitDate, mKey);
      return days >= 10;
    });

    if (c.useHeadcountSplit) {
      if (splits.length === 0) {
        // Global headcount split across all consolidated companies
        const consolidatedComps = companies.filter(co => co.includeInConsolidation !== false).map(co => co.id);
        const eligibleStaff = activeStaff.filter(s => consolidatedComps.includes(s.companyId));
        const total = eligibleStaff.length;
        if (total === 0) return 0;
        const matchingStaff = eligibleStaff.filter(s => s.companyId === companyId);
        return matchingStaff.length / total;
      } else {
        // Headcount split among targets in splits list
        const counts = splits.map(s => {
          if (s.type === 'company') {
            return activeStaff.filter(member => member.companyId === s.targetId).length;
          } else if (s.type === 'department') {
            return activeStaff.filter(member => member.department === s.targetId).length;
          } else if (s.type === 'user') {
            return activeStaff.some(member => member.id === s.targetId) ? 1 : 0;
          }
          return 0;
        });

        const totalCount = counts.reduce((a, b) => a + b, 0);
        if (totalCount <= 0) return 0;

        let companyShare = 0;
        splits.forEach((s, idx) => {
          const count = counts[idx];
          const targetShare = count / totalCount;
          
          if (s.type === 'company') {
            if (s.targetId === companyId) {
              companyShare += targetShare;
            }
          } else if (s.type === 'department') {
            const deptStaff = activeStaff.filter(member => member.department === s.targetId);
            const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
            if (deptStaff.length > 0) {
              companyShare += targetShare * (targetCompStaffCount / deptStaff.length);
            }
          } else if (s.type === 'user' && s.targetId) {
            const member = activeStaff.find(member => member.id === s.targetId);
            if (member && member.companyId === companyId) {
              companyShare += targetShare;
            }
          }
        });

        return companyShare;
      }
    } else {
      // Manual splits
      if (splits.length === 0) {
        return c.companyId === companyId ? 1.0 : 0;
      }

      let companyShare = 0;
      splits.forEach(s => {
        const manualPct = Number(s.percentage || 0) / 100;
        if (s.type === 'company') {
          if (s.targetId === companyId) {
            companyShare += manualPct;
          }
        } else if (s.type === 'department') {
          const deptStaff = activeStaff.filter(member => member.department === s.targetId);
          const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
          if (deptStaff.length > 0) {
            companyShare += manualPct * (targetCompStaffCount / deptStaff.length);
          }
        } else if (s.type === 'user' && s.targetId) {
          const member = activeStaff.find(member => member.id === s.targetId);
          if (member && member.companyId === companyId) {
            companyShare += manualPct;
          }
        }
      });

      return companyShare;
    }
  };
  const activeCompanyIds = activeCompaniesForPL.map(c => c.id);
  const [expandedExitedLeaguesPlacements, setExpandedExitedLeaguesLeaguesPlacements] = useState(false);
  const [expandedExitedOverheads, setExpandedExitedOverheads] = useState(false);
  const [ratiosSortField, setRatiosSortField] = useState('fullName');
  const [ratiosSortDirection, setRatiosSortDirection] = useState('asc');
  const [leaguesSortField, setLeaguesSortField] = useState('totalVal');
  const [leaguesSortDirection, setLeaguesSortDirection] = useState('desc');
  const [showPnlDashboard, setShowPnlDashboard] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [pnlVersion, setPnlVersion] = useState('v1');

  // Bank Statements Reconciliation Cutoff Date
  const autoDetectedBankCutoff = useMemo(() => {
    let maxDate = '';
    (expenses || []).forEach(e => {
      if (e.status === 'dns' || e.status === 'cancelled') return;
      if (e.date && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        if (!maxDate || e.date > maxDate) {
          maxDate = e.date;
        }
      }
    });
    return maxDate || '2026-08-31';
  }, [expenses]);

  const [reconciledCutoffDate, setReconciledCutoffDate] = useState(() => {
    return localStorage.getItem('bm-bank-reconciled-cutoff') || '2026-08-31';
  });

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('bm-bank-reconciled-cutoff');
      if (saved && saved !== reconciledCutoffDate) {
        setReconciledCutoffDate(saved);
      }
    };
    window.addEventListener('bank-cutoff-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('bank-cutoff-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [reconciledCutoffDate]);

  const handleSetReconciledCutoffDate = (newDate) => {
    if (!newDate) return;
    setReconciledCutoffDate(newDate);
    localStorage.setItem('bm-bank-reconciled-cutoff', newDate);
    window.dispatchEvent(new Event('bank-cutoff-updated'));
    if (onShowToast) {
      onShowToast(`Bank reconciliation cutoff updated to ${newDate}`, 'info');
    }
  };

  const reconciledCutoffMonth = useMemo(() => {
    return (reconciledCutoffDate || '2026-08-31').substring(0, 7);
  }, [reconciledCutoffDate]);

  const [suppressedProjections, setSuppressedProjections] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bm-suppressed-projections') || '[]');
    } catch {
      return [];
    }
  });

  const handleToggleSuppressProjection = (projId) => {
    if (!projId) return;
    setSuppressedProjections(prev => {
      const next = prev.includes(projId) ? prev.filter(id => id !== projId) : [...prev, projId];
      try {
        localStorage.setItem('bm-suppressed-projections', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
    if (onShowToast) {
      onShowToast('Projection status updated', 'info');
    }
  };

  const [overheadViewMode, setOverheadViewMode] = useState(() => {
    return localStorage.getItem('bm-overhead-view-mode') || 'all'; // 'all', 'compare', 'paid', 'projected'
  });

  const handleLeaguesHeaderClick = (field) => {
    if (leaguesSortField === field) {
      setLeaguesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLeaguesSortField(field);
      setLeaguesSortDirection('desc');
    }
  };

  const renderLeaguesSortIndicator = (field) => {
    if (leaguesSortField !== field) return ' ↕';
    return leaguesSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleRatiosHeaderClick = (field) => {
    if (ratiosSortField === field) {
      setRatiosSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setRatiosSortField(field);
      setRatiosSortDirection('desc');
    }
  };

  const renderRatiosSortIndicator = (field) => {
    if (ratiosSortField !== field) return ' ↕';
    return ratiosSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

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
        const teamMembers = staffList.filter(s => {
          const mgrIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
          return mgrIds.includes(member.id);
        });
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
      
      const year = monthKey.substring(0, 4);
      const yearLeaves = leaveRequests.filter(req => 
        req.staffId === s.id && 
        req.status === 'approved' && 
        req.startDate && 
        req.startDate.substring(0, 4) === year
      );
      const sortedLeaves = [...yearLeaves].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const lp = leavePolicies.find(p => p.id === s.leavePolicyId);
      
      let annualAllowed = 20;
      if (lp) {
        if (lp.name?.toLowerCase().includes('global recruiters')) {
          if (s.startDate) {
            const start = new Date(s.startDate);
            if (!isNaN(start.getTime())) {
              const today = new Date();
              let years = today.getFullYear() - start.getFullYear();
              const m = today.getMonth() - start.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
                years--;
              }
              const calculated = 20 + Math.max(0, years);
              annualAllowed = Math.min(25, calculated);
            }
          }
        } else {
          annualAllowed = lp.annualAllowance || 20;
        }
      }
      const sickAllowed = lp ? (lp.sickAllowance ?? 10) : 10;

      let annualUsed = 0;
      let sickUsed = 0;
      let unpaidDaysInTargetMonth = 0;

      sortedLeaves.forEach(req => {
        const reqMonth = req.startDate.substring(0, 7);
        const reqDays = Number(req.totalDays) || 0;
        let unpaidDaysForThisRequest = 0;

        if (req.leaveType === 'unpaid') {
          unpaidDaysForThisRequest = reqDays;
        } else if (req.leaveType === 'annual') {
          const newTotal = annualUsed + reqDays;
          if (newTotal > annualAllowed) {
            const unpaidPart = Math.max(0, newTotal - annualAllowed);
            unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
            annualUsed = annualAllowed;
          } else {
            annualUsed = newTotal;
          }
        } else if (req.leaveType === 'sick') {
          const newTotal = sickUsed + reqDays;
          if (newTotal > sickAllowed) {
            const unpaidPart = Math.max(0, newTotal - sickAllowed);
            unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
            sickUsed = sickAllowed;
          } else {
            sickUsed = newTotal;
          }
        }

        if (reqMonth === monthKey) {
          unpaidDaysInTargetMonth += unpaidDaysForThisRequest;
        }
      });

      const attendanceDays = Math.max(0, totalBusinessDays - unpaidDaysInTargetMonth);

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

    const monthExpenses = expenses.filter(e => e.plMonth === monthKey && !isExpenseSupersededByPayroll(e));

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
    let currentContractContext = null;
    let currentStaffContext = null;
    let currentAmortizeContext = null;
    let currentExpenseContext = null;

    const breakdown = {};
    const paidBreakdown = {};
    const projectedBreakdown = {};

    nominalCodes.forEach(nc => {
      breakdown[nc.code] = 0;
      paidBreakdown[nc.code] = 0;
      projectedBreakdown[nc.code] = 0;
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

    const allocateExpenseToMap = (exp, targetMap, customGbpAmt = null, targetNominalCode = null) => {
      const gbpAmt = customGbpAmt !== null ? customGbpAmt : toGBP(exp.amount, exp.currency);
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

      const effectiveCode = targetNominalCode || exp.nominalCode || 'Unassigned';
      const matchedKey = Object.keys(targetMap).find(k => k.startsWith(effectiveCode) || k === effectiveCode);
      if (matchedKey) {
        targetMap[matchedKey] = (targetMap[matchedKey] || 0) + allocatedGbp;
      } else {
        const defaultSoftwareNominal = nominalCodes.find(nc => nc.code.toLowerCase().includes('software') || nc.code.toLowerCase().includes('subscrip') || nc.code.startsWith('750'))?.code || 'Unassigned';
        if (defaultSoftwareNominal) {
          targetMap[defaultSoftwareNominal] = (targetMap[defaultSoftwareNominal] || 0) + allocatedGbp;
        }
      }
    };

    // 1. Regular actual non-amortized expenses for this month
    const monthExpenses = (expenses || []).filter(e => e.plMonth === monthKey && e.amortize !== true && !e.nominalCode?.trim().startsWith('9') && e.status !== 'dns' && e.status !== 'cancelled' && !isExpenseSupersededByPayroll(e));
    monthExpenses.forEach(exp => {
      currentExpenseContext = exp;
      allocateExpenseToMap(exp, paidBreakdown);
      allocateExpenseToMap(exp, breakdown);
    });
    currentExpenseContext = null;

    // 2. Amortized expenses active for this month
    const amortizedExpenses = (expenses || []).filter(e => e.amortize === true && e.status !== 'dns' && e.status !== 'cancelled');
    amortizedExpenses.forEach(exp => {
      currentAmortizeContext = exp;
      const startM = (exp.amortizeStartMonth && /^\d{4}-\d{2}$/.test(exp.amortizeStartMonth.trim())) 
        ? exp.amortizeStartMonth.trim() 
        : (exp.plMonth || (exp.date ? exp.date.substring(0, 7) : ''));
      if (!startM) return;
      const N = Number(exp.amortizeMonths || 36);
      
      const [y1, mo1] = monthKey.split('-').map(Number);
      const [y2, mo2] = startM.split('-').map(Number);
      const diff = (y1 - y2) * 12 + (mo1 - mo2);
      
      if (diff >= 0 && diff < N) {
        const shareAmount = (Number(exp.amount) || 0) / N;
        const targetCode = exp.amortizeNominalCode || exp.nominalCode;
        allocateExpenseToMap(exp, paidBreakdown, shareAmount, targetCode);
        allocateExpenseToMap(exp, breakdown, shareAmount, targetCode);
      }
    });
    currentAmortizeContext = null;

    // 3. Dynamic staff projections (salary, freelance, taxes)
    const isReconciledMonth = monthKey <= reconciledCutoffMonth;

    groupActiveStaff.forEach(s => {
      currentStaffContext = s;
      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
      if (policy) {
        let staffCost = 0;
        if (policy.type === 'freelance') {
          const totalBusinessDays = getBusinessDaysInMonth(monthKey, s);
          
          const year = monthKey.substring(0, 4);
          const yearLeaves = leaveRequests.filter(req => 
            req.staffId === s.id && 
            req.status === 'approved' && 
            req.startDate && 
            req.startDate.substring(0, 4) === year
          );
          const sortedLeaves = [...yearLeaves].sort((a, b) => a.startDate.localeCompare(b.startDate));
          const lp = leavePolicies.find(p => p.id === s.leavePolicyId);
          
          let annualAllowed = 20;
          if (lp) {
            if (lp.name?.toLowerCase().includes('global recruiters')) {
              if (s.startDate) {
                const start = new Date(s.startDate);
                if (!isNaN(start.getTime())) {
                  const today = new Date();
                  let years = today.getFullYear() - start.getFullYear();
                  const m = today.getMonth() - start.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
                    years--;
                  }
                  const calculated = 20 + Math.max(0, years);
                  annualAllowed = Math.min(25, calculated);
                }
              }
            } else {
              annualAllowed = lp.annualAllowance || 20;
            }
          }
          const sickAllowed = lp ? (lp.sickAllowance ?? 10) : 10;

          let annualUsed = 0;
          let sickUsed = 0;
          let unpaidDaysInTargetMonth = 0;

          sortedLeaves.forEach(req => {
            const reqMonth = req.startDate.substring(0, 7);
            const reqDays = Number(req.totalDays) || 0;
            let unpaidDaysForThisRequest = 0;

            if (req.leaveType === 'unpaid') {
              unpaidDaysForThisRequest = reqDays;
            } else if (req.leaveType === 'annual') {
              const newTotal = annualUsed + reqDays;
              if (newTotal > annualAllowed) {
                const unpaidPart = Math.max(0, newTotal - annualAllowed);
                unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                annualUsed = annualAllowed;
              } else {
                annualUsed = newTotal;
              }
            } else if (req.leaveType === 'sick') {
              const newTotal = sickUsed + reqDays;
              if (newTotal > sickAllowed) {
                const unpaidPart = Math.max(0, newTotal - sickAllowed);
                unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                sickUsed = sickAllowed;
              } else {
                sickUsed = newTotal;
              }
            }

            if (reqMonth === monthKey) {
              unpaidDaysInTargetMonth += unpaidDaysForThisRequest;
            }
          });

          const attendanceDays = Math.max(0, totalBusinessDays - unpaidDaysInTargetMonth);

          let dailyRate = 0;
          if (s.salary && Number(s.salary) > 0) {
            dailyRate = (Number(s.salary) / 12) / totalBusinessDays;
          } else if (s.attendanceRate && Number(s.attendanceRate) > 0) {
            dailyRate = Number(s.attendanceRate);
          } else {
            dailyRate = Number(policy.dailyRateDefault || 0);
          }

          let val = toGBP(dailyRate * attendanceDays, s.currency || 'GBP');
          if (s.startDate && s.startDate.substring(0, 7) === monthKey) {
            const [y, m, d] = s.startDate.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
            val = val * proration;
          }
          const comm = calculateCommissionForRecruiter(s.id, monthKey);
          staffCost = val + comm;
        } else {
          let basicGBP = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
          let proration = 1.0;
          if (s.startDate && s.startDate.substring(0, 7) === monthKey) {
            const [y, m, d] = s.startDate.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
            basicGBP = basicGBP * proration;
          }
          const comm = calculateCommissionForRecruiter(s.id, monthKey);
          staffCost = basicGBP + comm;

          // Employer NI/Pension tax accumulation
          let empNi = 0;
          let empPension = 0;
          const gross = basicGBP + comm;

          if (policy.employerNiSlabs && policy.employerNiSlabs.length > 0) {
            empNi = calculateSlabCost(gross, policy.employerNiSlabs);
          } else if (policy.employerNiRate > 0) {
            const thresholdGBP = toGBP(Number(policy.employerNiThreshold || 0), 'GBP');
            const taxableNiAmount = Math.max(0, gross - thresholdGBP);
            empNi = (taxableNiAmount * Number(policy.employerNiRate)) / 100;
          }
          if (policy.employerPensionRate > 0) {
            empPension = (gross * Number(policy.employerPensionRate)) / 100;
          }

          empNi = empNi * proration;
          empPension = empPension * proration;

          const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code || '1002 - Salary';
          const taxNominal = nominalCodes.find(nc => nc.id === '501' || nc.code?.includes('501') || nc.code?.toLowerCase().includes('paye') || nc.code?.toLowerCase().includes('tax') || /\bni\b/i.test(nc.code) || nc.code?.toLowerCase().includes('pension'))?.code || salaryNominal;
          if (taxNominal) {
            const isComp = activeCompanyIds.includes(s.companyId);
            const isDept = deptFilter.includes('all') || deptFilter.includes(s.department);
            if (isComp && isDept) {
              projectedBreakdown[taxNominal] = (projectedBreakdown[taxNominal] || 0) + (empNi + empPension);
              if (!isReconciledMonth) {
                breakdown[taxNominal] = (breakdown[taxNominal] || 0) + (empNi + empPension);
              }
            }
          }
        }

        // Dynamic nominal routing
        let targetNominal = policy.nominalCode;
        if (!targetNominal) {
          if (policy.type === 'freelance') {
            const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
            targetNominal = contractorNominal || '1001 - Freelancer Payments';
          } else {
            const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
            targetNominal = salaryNominal || '1002 - Salary';
          }
        }

        // Reconcile dynamic projections: if this staff member already has actual payments in this month, skip projections
        const cleanTarget = targetNominal?.split(' - ')[0]?.trim() || '';
        const hasActualPayment = monthExpenses.some(e => {
          const cleanCode = e.nominalCode?.split(' - ')[0]?.trim() || '';
          const targetStaffIds = Array.isArray(e.allocationTarget) 
            ? e.allocationTarget 
            : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
          const matchesId = targetStaffIds.includes(s.id) || e.recipientId === s.id;
          const matchesName = e.payee && s.fullName && e.payee.toLowerCase().includes(s.fullName.toLowerCase());
          return (cleanCode === cleanTarget && (matchesId || matchesName)) || matchesId || matchesName;
        });

        const matchedKey = Object.keys(breakdown).find(k => k.startsWith(targetNominal) || k === targetNominal) || targetNominal;
        const staffProjId = `proj-staff-${s.id}-${monthKey}`;
        const isSuppressed = (suppressedProjections || []).includes(staffProjId);

        // Always accumulate into projectedBreakdown for comparison visibility
        const isTargetComp = activeCompanyIds.includes(s.companyId);
        const isTargetDept = deptFilter.includes('all') || deptFilter.includes(s.department);
        if (isTargetComp && isTargetDept) {
          projectedBreakdown[matchedKey] = (projectedBreakdown[matchedKey] || 0) + staffCost;
        }

        // Apportionment check for 1004 - SA-Shared costs vs direct routing for active P&L
        if (!isReconciledMonth && !hasActualPayment && !isSuppressed) {
          if (targetNominal.includes('1004')) {
            if (s.companyId && s.companyId !== 'comp-1782789370085') {
              if (isTargetComp && isTargetDept) {
                breakdown[matchedKey] = (breakdown[matchedKey] || 0) + staffCost;
              }
            } else {
              const targetCompanyIds = (s.allocatedCompanyIds && s.allocatedCompanyIds.length > 0) ? s.allocatedCompanyIds : null;
              const otherStaff = groupActiveStaff.filter(os => {
                const comp = companies.find(c => c.id === os.companyId);
                const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== s.companyId;
                return comp && comp.includeInConsolidation !== false && compMatch;
              });
              if (otherStaff.length > 0) {
                const perStaffShare = staffCost / otherStaff.length;
                otherStaff.forEach(os => {
                  const isComp = activeCompanyIds.includes(os.companyId);
                  const isDept = deptFilter.includes('all') || deptFilter.includes(os.department);
                  if (isComp && isDept) {
                    breakdown[matchedKey] = (breakdown[matchedKey] || 0) + perStaffShare;
                  }
                });
              } else {
                if (isTargetComp && isTargetDept) {
                  breakdown[matchedKey] = (breakdown[matchedKey] || 0) + staffCost;
                }
              }
            }
          } else {
            // Standard direct routing
            if (isTargetComp && isTargetDept) {
              breakdown[matchedKey] = (breakdown[matchedKey] || 0) + staffCost;
            }
          }
        }
      }
    });
    currentStaffContext = null;

    // 4. Contract Projections
    contracts.forEach(contract => {
      currentContractContext = contract;
      if (!contract.startDate || !contract.endDate) return;
      const startM = contract.startDate.substring(0, 7);
      const endM = contract.endDate.substring(0, 7);

      const matchedVendor = vendors.find(v => v.id === contract.vendorId || (v.name && contract.vendorName && v.name.toLowerCase() === contract.vendorName.toLowerCase()));
      const vendorContracts = contracts.filter(con => con.vendorId === contract.vendorId || (matchedVendor && con.vendorId === matchedVendor.id));
      const vendorContractsIds = vendorContracts.map(vc => vc.id);

      const vendorHasReconciledInMonth = (expenses || []).some(e => {
        if (e.status === 'dns' || e.status === 'cancelled') return false;
        const expMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
        if (expMonth !== monthKey) return false;

        // 1. Explicit link
        if (e.linkedVendorCellId) {
          const parts = e.linkedVendorCellId.split(',').map((s) => s.trim()).filter(Boolean);
          const matches = parts.some(part => {
            const cid = part.split('_')[0];
            return vendorContractsIds.includes(cid);
          });
          if (matches) return true;
        }
        if (e.linkedContractId && vendorContractsIds.includes(e.linkedContractId)) {
          return true;
        }

        // 2. Payee name match
        if (matchedVendor && matchedVendor.name && e.payee && e.payee.toLowerCase().includes(matchedVendor.name.toLowerCase())) {
          return true;
        }

        // 3. Recipient type match
        if (e.recipientType === 'vendor' && (e.recipientId === contract.vendorId || (matchedVendor && e.recipientId === matchedVendor.id))) {
          return true;
        }

        return false;
      });

      if (monthKey >= startM && monthKey <= endM) {
        const totalSeats = contract.quantityPurchased || 1;
        let unitMonthlyCost = Number(contract.unitCost || 0);
        if (contract.costInterval === 'annual') {
          unitMonthlyCost = unitMonthlyCost / 12;
        } else if (contract.costInterval === 'one-time' && startM !== monthKey) {
          unitMonthlyCost = 0;
        }

        const assignedSeats = assetAssignments.filter(a => a.contractId === contract.id);
        let gbpCost = 0;
        const taxFactor = 1 + (Number(contract.taxRate || 0) / 100);
        const targetCompIds = overrideCompanyId ? [overrideCompanyId] : activeCompanyIds;

        targetCompIds.forEach(compId => {
          let deptProration = 1.0;
          if (!deptFilter.includes('all')) {
            const compActiveStaff = groupActiveStaff.filter(s => s.companyId === compId);
            const deptActiveStaff = compActiveStaff.filter(s => deptFilter.includes(s.department));
            deptProration = compActiveStaff.length > 0 ? (deptActiveStaff.length / compActiveStaff.length) : 0;
          }

          if (assignedSeats.length > 0) {
            const costPerSeat = unitMonthlyCost;
            let companyAssignedCount = 0;
            let activeAssignedTotalCount = 0;
            assignedSeats.forEach(a => {
              const member = staff.find(s => s.id === a.staffId);
              if (member) {
                const isActiveInMonth = groupActiveStaffIds.includes(member.id);
                if (isActiveInMonth) {
                  activeAssignedTotalCount++;
                  const staffComp = companies.find(co => co.id === member.companyId);
                  const effectiveCompanyId = staffComp?.country === 'India' ? contract.companyId : member.companyId;
                  if (effectiveCompanyId === compId) {
                    const isDept = deptFilter.includes('all') || deptFilter.includes(member.department);
                    if (isDept) {
                      companyAssignedCount++;
                    }
                  }
                }
              }
            });

            const assignedCost = companyAssignedCount * costPerSeat;

            const unusedCount = Math.max(0, totalSeats - activeAssignedTotalCount);
            let unusedCost = 0;
            if (unusedCount > 0) {
              if (contract.unusedCostTag?.companyId) {
                if (contract.unusedCostTag.companyId === compId) {
                  const isDept = deptFilter.includes('all') || deptFilter.includes(contract.unusedCostTag.department);
                  if (isDept) {
                    unusedCost = unusedCount * costPerSeat;
                  }
                }
              } else {
                const baseShare = getContractCompanyShare(contract, monthKey, compId);
                if (baseShare > 0) {
                  unusedCost = unusedCount * costPerSeat * baseShare * deptProration;
                }
              }
            }

            if (assignedCost > 0 || unusedCost > 0) {
              gbpCost += toGBP(assignedCost + unusedCost, contract.currency || 'GBP') * taxFactor;
            }
          } else {
            const baseShare = getContractCompanyShare(contract, monthKey, compId);
            if (baseShare > 0) {
              const cost = unitMonthlyCost * totalSeats * baseShare * deptProration;
              gbpCost += toGBP(cost, contract.currency || 'GBP') * taxFactor;
            }
          }
        });

        if (gbpCost > 0) {
          const vendorObj = vendors.find(v => v.id === contract.vendorId);
          let assignedNominal = contract.nominalCode || vendorObj?.nominalCode;

          if (!assignedNominal) {
            const nameLower = contract.name.toLowerCase();
            if (nameLower.includes('rent') || nameLower.includes('office') || nameLower.includes('lease')) {
              const rentMatch = nominalCodes.find(nc => nc.code.toLowerCase().includes('rent') || nc.code.toLowerCase().includes('rates') || nc.code.startsWith('700'));
              assignedNominal = rentMatch ? rentMatch.code : 'Unassigned';
            } else {
              const swMatch = nominalCodes.find(nc => nc.code.toLowerCase().includes('software') || nc.code.toLowerCase().includes('subscrip') || nc.code.startsWith('750'));
              assignedNominal = swMatch ? swMatch.code : 'Unassigned';
            }
          }

          const matchedKey = Object.keys(breakdown).find(k => k.startsWith(assignedNominal) || k === assignedNominal) || assignedNominal;
          projectedBreakdown[matchedKey] = (projectedBreakdown[matchedKey] || 0) + gbpCost;

          const contractProjId = `proj-contract-${contract.id}-${monthKey}`;
          const isSuppressed = (suppressedProjections || []).includes(contractProjId);

          if (!isReconciledMonth && !vendorHasReconciledInMonth && !isSuppressed) {
            breakdown[matchedKey] = (breakdown[matchedKey] || 0) + gbpCost;
          }
        }
      }
    });
    currentContractContext = null;

    Object.defineProperty(breakdown, '__paid', {
      value: paidBreakdown,
      enumerable: false,
      writable: true,
      configurable: true
    });
    Object.defineProperty(breakdown, '__projected', {
      value: projectedBreakdown,
      enumerable: false,
      writable: true,
      configurable: true
    });
    return breakdown;
  };

  const getBalanceSheetBreakdownForMonth = (monthKey, overrideCompanyId = null) => {
    const breakdown = {};
    const targetCompIds = overrideCompanyId ? [overrideCompanyId] : activeCompanyIds;

    const activeStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      if (daysWorked < 10) return false;
      if (!targetCompIds.includes(s.companyId)) return false;
      if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
      return true;
    });

    const activeStaffIds = activeStaff.map(s => s.id);

    const groupActiveStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      return daysWorked >= 10;
    });
    const groupActiveStaffIds = groupActiveStaff.map(s => s.id);

    if (monthKey < '2026-07') {
      const monthExpenses = expenses.filter(e => e.plMonth === monthKey && e.nominalCode?.trim().startsWith('9'));
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

        const matchedKey = Object.keys(breakdown).find(k => k.startsWith(exp.nominalCode) || k === exp.nominalCode) || exp.nominalCode;
        breakdown[matchedKey] = (breakdown[matchedKey] || 0) + allocatedGbp;
      });
    }

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
    // Recruiter commissions are categorized within the individual's payment under overheads / staff costs
    let salaries = 0;
    let commissions = 0;

    // 5. Operating expenses + shared overhead apportionments
    const nominalBreakdown = getNominalBreakdownForMonth(monthKey);
    const nominalPaidBreakdown = nominalBreakdown.__paid || nominalBreakdown;
    const nominalProjectedBreakdown = nominalBreakdown.__projected || {};

    const overheadsExpenses = Object.entries(nominalBreakdown)
      .filter(([code, v]) => !code.startsWith('__') && typeof v === 'number' && !isNaN(v) && !isNominalExcluded(code))
      .reduce((sum, [, v]) => sum + v, 0);

    const overheadsPaid = Object.entries(nominalPaidBreakdown)
      .filter(([code, v]) => !code.startsWith('__') && typeof v === 'number' && !isNaN(v) && !isNominalExcluded(code))
      .reduce((sum, [, v]) => sum + v, 0);

    const overheadsProjected = Object.entries(nominalProjectedBreakdown)
      .filter(([code, v]) => !code.startsWith('__') && typeof v === 'number' && !isNaN(v) && !isNominalExcluded(code))
      .reduce((sum, [, v]) => sum + v, 0);

    const balanceSheetBreakdown = getBalanceSheetBreakdownForMonth(monthKey);
    const balanceSheetTotal = Object.values(balanceSheetBreakdown).reduce((sum, v) => sum + v, 0);

    const grossProfit = revenue;
    const totalOverheads = overheadsExpenses;
    const netProfit = revenue - totalOverheads;

    return {
      revenue,
      salaries,
      commissions,
      overheadsExpenses,
      overheadsPaid,
      overheadsProjected,
      grossProfit,
      totalOverheads,
      netProfit,
      nominalBreakdown,
      nominalPaidBreakdown,
      nominalProjectedBreakdown,
      balanceSheetBreakdown,
      balanceSheetTotal,
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
      <div style={{ alignSelf: 'flex-end', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5 }}>
        Build Tag: v2.0.3-tax-nominal-fixed
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
          { key: 'team_cost', label: 'Team & Tool Costs', icon: <Users size={14} /> },
          { key: 'ratios', label: 'Salary to billings', icon: <Percent size={14} /> },
          { key: 'leagues', label: 'Recruiter Leagues', icon: <Award size={14} /> }
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
          TAB: DEPARTMENT TEAM & TOOL COSTS
          ============================================================== */}
      {activeTab === 'team_cost' && (
        <DepartmentTeamCostTab
          companies={companies}
          staff={staff}
          payrollRecords={payrollRecords}
          payrollPolicies={payrollPolicies}
          leaveRequests={leaveRequests}
          holidays={holidays}
          placements={placements}
          commissionPolicies={commissionPolicies}
          currentUser={currentUser}
          onShowToast={onShowToast}
        />
      )}

      {/* Dynamic Global Filters Toolbar (Hidden on Team & Tool Costs tab) */}
      {activeTab !== 'team_cost' && (
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'visible', position: 'relative', zIndex: 100 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Entity / Department:</span>
              {isManager ? (
                <div style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                  🏢 Department: {userDept} (Locked)
                </div>
              ) : (() => {
                const selectableCompanies = currentUser?.permissions?.role === 'admin'
                  ? companies
                  : companies.filter(c => c.id === currentUser?.companyId);
                return (
                  <CompanyDeptTreeFilter
                    companies={selectableCompanies}
                    staff={staff}
                    selectedCompanyIds={companyFilter}
                    selectedDepartments={deptFilter}
                    onChange={({ companyIds, departments }) => {
                      setCompanyFilter(companyIds);
                      setDeptFilter(departments);
                    }}
                  />
                );
              })()}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Overhead Nominals:</span>
                {excludedNominalCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleIncludeAllNominals}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '10px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    Reset All
                  </button>
                )}
              </div>
              <MultiSelectFilter
                options={[
                  { value: 'all', label: 'All Nominals Included' },
                  ...allAvailableNominals.map(n => ({ value: n, label: n }))
                ]}
                selectedValues={selectedNominalValues}
                onChange={handleNominalFilterChange}
                placeholder="All Nominals Included"
                style={{ minWidth: '190px' }}
              />
            </div>

          </div>
        </div>
      )}

      {/* ==============================================================
          TAB 1: DYNAMIC COMPANY-WIDE P&L MATRIX
          ============================================================== */}
      {activeTab === 'consolidated' && (() => {
        let rowData = monthsList.map(m => getFilteredMonthlyData(m));

        if (pnlVersion === 'v2') {
          // Compute 3-month run-rate average from April, May, June 2026
          const runRateMonths = ['2026-04', '2026-05', '2026-06'];
          const runRateData = runRateMonths.map(m => getFilteredMonthlyData(m));
          
          const avgRevenue = runRateData.reduce((sum, d) => sum + (d.revenue || 0), 0) / 3;
          const avgOverheads = runRateData.reduce((sum, d) => sum + (d.overheadsExpenses || 0), 0) / 3;
          
          const allCodes = Array.from(new Set([
            ...nominalCodes.map(nc => nc.code),
            ...runRateData.flatMap(d => Object.keys(d.nominalBreakdown || {}))
          ])).filter(c => !c.startsWith('__'));
          const avgNominalBreakdown = {};
          allCodes.forEach(code => {
            const sum = runRateData.reduce((acc, d) => acc + (d.nominalBreakdown?.[code] || 0), 0);
            avgNominalBreakdown[code] = sum / 3;
          });

          // Apply flat-lined averages to forecast months (months after reconciled bank statement cutoff)
          rowData = rowData.map((row, idx) => {
            const mKey = monthsList[idx];
            if (mKey > reconciledCutoffMonth) {
              const updatedRevenue = avgRevenue;
              const updatedCommissions = 0;
              const updatedOverheads = avgOverheads;
              const updatedGrossProfit = updatedRevenue;
              const updatedNetProfit = updatedRevenue - updatedOverheads;
              return {
                ...row,
                revenue: updatedRevenue,
                commissions: updatedCommissions,
                overheadsExpenses: updatedOverheads,
                overheadsProjected: updatedOverheads,
                totalOverheads: updatedOverheads,
                grossProfit: updatedGrossProfit,
                netProfit: updatedNetProfit,
                nominalBreakdown: avgNominalBreakdown,
                nominalProjectedBreakdown: avgNominalBreakdown
              };
            }
            return row;
          });
        }

        const totalRevenue = rowData.reduce((acc, row) => acc + (row.revenue || 0), 0);
        const totalCommissions = rowData.reduce((acc, row) => acc + (row.commissions || 0), 0);
        const totalOverheads = rowData.reduce((acc, row) => acc + (row.overheadsExpenses || 0), 0);
        const totalProfit = rowData.reduce((acc, row) => acc + (row.netProfit || 0), 0);
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        const handlePrintPnl = () => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert("Please allow popups to print/save the P&L report.");
            return;
          }

          const title = `Consolidated Profit & Loss (P&L) Report`;
          const sub = `Model: ${pnlVersion === 'v1' ? 'v1 - Standard Projections' : 'v2 - 3-Month Running Average'}`;
          const range = `Period: ${new Date(startMonth + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} - ${new Date(endMonth + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
          const bankCutoffNote = `Bank Statement Cutoff: ${reconciledCutoffDate} (${reconciledCutoffDate <= '2026-08-31' ? 'Reconciled through end of August' : `Reconciled through ${reconciledCutoffDate}`})`;

          let tableHeadersHtml = `<th>P&L Account Line Items (GBP)</th>`;
          monthsList.forEach(m => {
            const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
            tableHeadersHtml += `<th style="text-align: right;">${label}</th>`;
          });
          tableHeadersHtml += `<th style="text-align: right; background-color: #e0e7ff; color: #3730a3;">YTV</th>`;
          tableHeadersHtml += `<th style="text-align: right; background-color: #f1f5f9;">Period Total</th>`;

          // Row helper inside print
          const makeRowHtml = (label, dataKey, isBold = false, indent = 0) => {
            let html = `<tr style="${isBold ? 'font-weight: bold; background-color: #f8fafc;' : ''}">`;
            html += `<td style="padding-left: ${indent}px;">${label}</td>`;
            let total = 0;
            rowData.forEach(row => {
              const val = row[dataKey] || 0;
              total += val;
              html += `<td style="text-align: right;">${formatGBP(val)}</td>`;
            });
            const ytvVal = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row[dataKey] || 0), 0);
            html += `<td style="text-align: right; font-weight: 600; background-color: #f5f3ff;">${formatGBP(ytvVal)}</td>`;
            html += `<td style="text-align: right; font-weight: bold; background-color: #f1f5f9;">${formatGBP(total)}</td>`;
            html += `</tr>`;
            return html;
          };

          // Construct nominal code breakdowns
          let overheadsDetailHtml = '';
          const codeKeys = Array.from(new Set(
            rowData.flatMap(r => Object.keys(r.nominalBreakdown || {}))
          )).filter(c => {
            if (c.startsWith('__')) return false;
            if (hideZeroNominals) {
              const total = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[c] || 0), 0);
              if (total === 0) return false;
            }
            return true;
          }).sort();

          codeKeys.forEach(code => {
            const total = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0);
            const ytvNominal = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0);
            overheadsDetailHtml += `<tr style="font-size: 11px; color: #475569;">`;
            overheadsDetailHtml += `<td style="padding-left: 32px; font-style: italic;">↳ ${code}</td>`;
            rowData.forEach(row => {
              const val = row.nominalBreakdown?.[code] || 0;
              overheadsDetailHtml += `<td style="text-align: right; opacity: ${val > 0 ? 1 : 0.4};">${formatGBP(val)}</td>`;
            });
            overheadsDetailHtml += `<td style="text-align: right; font-weight: 600; background-color: #f5f3ff;">${formatGBP(ytvNominal)}</td>`;
            overheadsDetailHtml += `<td style="text-align: right; font-weight: bold; background-color: #f1f5f9;">${formatGBP(total)}</td>`;
            overheadsDetailHtml += `</tr>`;
          });

          // Construct balance sheet breakdowns
          let balanceSheetDetailHtml = '';
          const bsCodeKeys = Array.from(new Set(
            rowData.flatMap(r => Object.keys(r.balanceSheetBreakdown || {}))
          )).filter(c => {
            if (hideZeroNominals) {
              const total = rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[c] || 0), 0);
              if (total === 0) return false;
            }
            return true;
          }).sort();

          bsCodeKeys.forEach(code => {
            const total = rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0);
            const ytvBs = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0);
            balanceSheetDetailHtml += `<tr style="font-size: 11px; color: #475569;">`;
            balanceSheetDetailHtml += `<td style="padding-left: 32px; font-style: italic;">↳ ${code}</td>`;
            rowData.forEach(row => {
              const val = row.balanceSheetBreakdown?.[code] || 0;
              balanceSheetDetailHtml += `<td style="text-align: right; opacity: ${val > 0 ? 1 : 0.4};">${val > 0 ? formatGBP(val) : '—'}</td>`;
            });
            balanceSheetDetailHtml += `<td style="text-align: right; font-weight: 600; background-color: #f5f3ff;">${ytvBs > 0 ? formatGBP(ytvBs) : '—'}</td>`;
            balanceSheetDetailHtml += `<td style="text-align: right; font-weight: bold; background-color: #f1f5f9;">${formatGBP(total)}</td>`;
            balanceSheetDetailHtml += `</tr>`;
          });

          // Calculate EBITDA row
          let ebitdaHtml = `<tr style="font-weight: bold; background-color: #f0fdf4; font-size: 13px;">`;
          ebitdaHtml += `<td style="color: #15803d;">EBITDA Net Profit Margin</td>`;
          let ebitdaTotal = 0;
          rowData.forEach(row => {
            ebitdaTotal += row.netProfit;
            ebitdaHtml += `<td style="text-align: right; color: ${row.netProfit >= 0 ? '#15803d' : '#b91c1c'};">${formatGBP(row.netProfit)}</td>`;
          });
          const ytvEbitda = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + r.netProfit, 0);
          ebitdaHtml += `<td style="text-align: right; font-weight: bold; color: ${ytvEbitda >= 0 ? '#15803d' : '#b91c1c'}; background-color: #e0e7ff;">${formatGBP(ytvEbitda)}</td>`;
          ebitdaHtml += `<td style="text-align: right; color: ${ebitdaTotal >= 0 ? '#15803d' : '#b91c1c'}; background-color: #e2e8f0;">${formatGBP(ebitdaTotal)}</td>`;
          ebitdaHtml += `</tr>`;

          // Carry forward row
          let carryForwardHtml = `<tr style="font-weight: bold; background-color: #eff6ff; font-size: 13px; border-top: 1px dashed #3b82f6;">`;
          carryForwardHtml += `<td style="color: #1d4ed8;">📈 Cumulative Carry-Forward P&L</td>`;
          let cumulativePnl = 0;
          rowData.forEach(row => {
            cumulativePnl += row.netProfit;
            carryForwardHtml += `<td style="text-align: right; color: ${cumulativePnl >= 0 ? '#15803d' : '#b91c1c'};">${formatGBP(cumulativePnl)}</td>`;
          });
          const ytvCumulative = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + r.netProfit, 0);
          carryForwardHtml += `<td style="text-align: right; font-weight: bold; color: ${ytvCumulative >= 0 ? '#15803d' : '#b91c1c'}; background-color: #e0e7ff;">${formatGBP(ytvCumulative)}</td>`;
          carryForwardHtml += `<td style="text-align: right; color: ${cumulativePnl >= 0 ? '#15803d' : '#b91c1c'}; background-color: #e2e8f0;">${formatGBP(cumulativePnl)}</td>`;
          carryForwardHtml += `</tr>`;

          // Staff headcount row
          let staffCountHtml = `<tr style="color: #64748b; font-size: 11px;">`;
          staffCountHtml += `<td>Staff Count in Apportionment</td>`;
          rowData.forEach(row => {
            staffCountHtml += `<td style="text-align: right;">${row.headcount} active</td>`;
          });
          staffCountHtml += `<td style="text-align: right; background-color: #f5f3ff;">—</td>`;
          staffCountHtml += `<td style="text-align: right; background-color: #f1f5f9;">—</td>`;
          staffCountHtml += `</tr>`;

          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>${title}</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  color: #1e293b;
                  padding: 30px;
                  margin: 0;
                }
                .header {
                  margin-bottom: 25px;
                  border-bottom: 2px solid #e2e8f0;
                  padding-bottom: 15px;
                }
                .header h1 {
                  margin: 0 0 5px 0;
                  font-size: 22px;
                  font-weight: 800;
                  color: #0f172a;
                }
                .header .meta {
                  font-size: 12px;
                  color: #64748b;
                  display: flex;
                  justify-content: space-between;
                  flex-wrap: wrap;
                  gap: 8px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 12px;
                  margin-bottom: 20px;
                }
                th {
                  background-color: #f8fafc;
                  color: #475569;
                  font-weight: 700;
                  padding: 8px 10px;
                  border-bottom: 2px solid #e2e8f0;
                }
                td {
                  padding: 8px 10px;
                  border-bottom: 1px solid #f1f5f9;
                }
                .section-header {
                  font-weight: bold;
                  background-color: #f8fafc;
                }
                .print-btn {
                  background-color: #4f46e5;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  font-size: 12px;
                  font-weight: 600;
                  border-radius: 6px;
                  cursor: pointer;
                  margin-bottom: 20px;
                }
                @media print {
                  .print-btn { display: none; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
              <div class="header">
                <h1>${title}</h1>
                <div class="meta">
                  <span>${sub}</span>
                  <span>${range}</span>
                  <span style="color: #4f46e5; font-weight: 600;">${bankCutoffNote}</span>
                  <span>Generated on: ${new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>${tableHeadersHtml}</tr>
                </thead>
                <tbody>
                  <tr class="section-header">
                    <td colspan="${monthsList.length + 3}">Revenue stream credits</td>
                  </tr>
                  ${makeRowHtml('Net Placements Fee Billings', 'revenue', false, 16)}

                  <tr class="section-header">
                    <td colspan="${monthsList.length + 3}">Overheads & Staff Expenses</td>
                  </tr>
                  ${makeRowHtml('Apportioned Overheads & SaaS', 'overheadsExpenses', false, 16)}
                  ${overheadsDetailHtml}
                  ${makeRowHtml('Total Indirect Overheads', 'totalOverheads', true)}

                  ${ebitdaHtml}
                  ${carryForwardHtml}

                  <tr class="section-header">
                    <td colspan="${monthsList.length + 3}">Non-P&L Balance Sheet Items (Cash Flow Only)</td>
                  </tr>
                  ${makeRowHtml('Refundable Deposits & Prepayments', 'balanceSheetTotal', false, 16)}
                  ${balanceSheetDetailHtml}

                  ${staffCountHtml}
                </tbody>
              </table>
            </body>
            </html>
          `;

          printWindow.document.write(htmlContent);
          printWindow.document.close();
        };

        const handleExportPnlExcel = () => {
          try {
            const wb = XLSX.utils.book_new();

            // 1. P&L Summary Sheet
            const summaryAoa = [];
            
            // Header metadata
            summaryAoa.push(["Humres Technical Recruitment - Consolidated Profit & Loss (P&L) Report"]);
            summaryAoa.push(["Forecasting Model:", pnlVersion === 'v1' ? 'v1 - Standard Projections' : 'v2 - 3-Month Running Average (April-June 2026 Baseline)']);
            summaryAoa.push(["Period Range:", `${startMonth} to ${endMonth}`]);
            summaryAoa.push(["Bank Reconciliation Cutoff:", `${reconciledCutoffDate} (Actuals through cutoff, forecast thereafter)`]);
            summaryAoa.push(["Entities Included:", activeCompaniesForPL.map(c => c.name).join(', ') || 'All Consolidated Entities']);
            summaryAoa.push(["Department Filter:", deptFilter.includes('all') ? 'All Departments' : deptFilter.join(', ')]);
            summaryAoa.push(["Export Date:", new Date().toLocaleDateString('en-GB')]);
            summaryAoa.push([]); // blank spacer row

            // Column Headers
            const monthHeaders = monthsList.map(m => new Date(m + '-02').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
            summaryAoa.push(["P&L Account Line Items (GBP)", ...monthHeaders, "YTV (Reconciled)", "Period Total"]);

            // Helper to add data rows
            const addDataRow = (label, dataKey) => {
              const vals = rowData.map(r => Math.round(r[dataKey] || 0));
              const ytvVal = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r[dataKey] || 0), 0));
              const totalVal = Math.round(rowData.reduce((acc, r) => acc + (r[dataKey] || 0), 0));
              summaryAoa.push([label, ...vals, ytvVal, totalVal]);
            };

            // Section 1: Revenue stream credits
            summaryAoa.push(["Revenue stream credits"]);
            addDataRow("  Net Placements Fee Billings", "revenue");
            summaryAoa.push([]);

            // Section 2: Overheads & Staff Expenses
            summaryAoa.push(["Overheads & Staff Expenses"]);
            addDataRow("  Apportioned Overheads & SaaS", "overheadsExpenses");

            // Nominal breakdowns
            const codeKeys = Array.from(new Set(
              rowData.flatMap(r => Object.keys(r.nominalBreakdown || {}))
            )).filter(c => {
              if (c.startsWith('__')) return false;
              if (hideZeroNominals) {
                const total = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[c] || 0), 0);
                if (total === 0) return false;
              }
              return true;
            }).sort();

            codeKeys.forEach(code => {
              const isExcluded = isNominalExcluded(code);
              const vals = rowData.map(r => Math.round(r.nominalBreakdown?.[code] || 0));
              const ytvNominal = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0));
              const totalNominal = Math.round(rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0));
              summaryAoa.push([`    ↳ ${code}${isExcluded ? ' (Excluded from overheads)' : ''}`, ...vals, ytvNominal, totalNominal]);
            });

            addDataRow("Total Indirect Overheads", "totalOverheads");
            summaryAoa.push([]);

            // Section 3: EBITDA Net Profit
            const ebitdaVals = rowData.map(r => Math.round(r.netProfit || 0));
            const ytvEbitda = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.netProfit || 0), 0));
            const totalEbitda = Math.round(rowData.reduce((acc, r) => acc + (r.netProfit || 0), 0));
            summaryAoa.push(["EBITDA Net Profit Margin", ...ebitdaVals, ytvEbitda, totalEbitda]);

            // Section 4: Cumulative Carry-Forward P&L
            let cum = 0;
            const cumVals = rowData.map(r => {
              cum += Math.round(r.netProfit || 0);
              return cum;
            });
            const ytvCum = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.netProfit || 0), 0));
            summaryAoa.push(["Cumulative Carry-Forward P&L", ...cumVals, ytvCum, cum]);
            summaryAoa.push([]);

            // Section 5: Non-P&L Balance Sheet Items
            summaryAoa.push(["Non-P&L Balance Sheet Items (Cash Flow Only)"]);
            addDataRow("  Refundable Deposits & Prepayments", "balanceSheetTotal");

            // Balance sheet nominal breakdowns
            const bsCodeKeys = Array.from(new Set(
              rowData.flatMap(r => Object.keys(r.balanceSheetBreakdown || {}))
            )).filter(c => {
              if (hideZeroNominals) {
                const total = rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[c] || 0), 0);
                if (total === 0) return false;
              }
              return true;
            }).sort();

            bsCodeKeys.forEach(code => {
              const vals = rowData.map(r => Math.round(r.balanceSheetBreakdown?.[code] || 0));
              const ytvBs = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0));
              const totalBs = Math.round(rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0));
              summaryAoa.push([`    ↳ ${code}`, ...vals, ytvBs, totalBs]);
            });
            summaryAoa.push([]);

            // Section 6: Staff Headcount
            const headcounts = rowData.map(r => r.headcount || 0);
            summaryAoa.push(["Staff Count in Apportionment", ...headcounts, "—", "—"]);

            const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
            wsSummary['!cols'] = [
              { wch: 42 },
              ...monthsList.map(() => ({ wch: 14 })),
              { wch: 16 },
              { wch: 16 }
            ];
            XLSX.utils.book_append_sheet(wb, wsSummary, "P&L Summary");

            // 2. Paid vs Projected Comparison Sheet
            const compAoa = [];
            compAoa.push(["Overheads & Expenses - Bank Paid vs Projected Comparison"]);
            compAoa.push(["Period Range:", `${startMonth} to ${endMonth}`]);
            compAoa.push(["Bank Cutoff Date:", `${reconciledCutoffDate} (Actuals through cutoff, forecast thereafter)`]);
            compAoa.push([]);
            compAoa.push(["Nominal Code / Line Item", "Type", ...monthHeaders, "YTV", "Period Total"]);

            // Total Apportioned
            const ytvOverheads = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.overheadsExpenses || 0), 0));
            const ytvPaid = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.overheadsPaid || 0), 0));
            const ytvProj = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.overheadsProjected || 0), 0));
            const totOverheads = Math.round(rowData.reduce((acc, r) => acc + (r.overheadsExpenses || 0), 0));
            const totPaid = Math.round(rowData.reduce((acc, r) => acc + (r.overheadsPaid || 0), 0));
            const totProj = Math.round(rowData.reduce((acc, r) => acc + (r.overheadsProjected || 0), 0));

            compAoa.push(["Total Apportioned Overheads", "P&L Recognized", ...rowData.map(r => Math.round(r.overheadsExpenses || 0)), ytvOverheads, totOverheads]);
            compAoa.push(["", "Bank Paid (Actuals)", ...rowData.map(r => Math.round(r.overheadsPaid || 0)), ytvPaid, totPaid]);
            compAoa.push(["", "Projected Forecast", ...rowData.map(r => Math.round(r.overheadsProjected || 0)), ytvProj, totProj]);
            compAoa.push([]);

            // Each nominal code
            codeKeys.forEach(code => {
              const recVals = rowData.map(r => Math.round(r.nominalBreakdown?.[code] || 0));
              const paidVals = rowData.map(r => Math.round(r.nominalPaidBreakdown?.[code] || 0));
              const projVals = rowData.map(r => Math.round(r.nominalProjectedBreakdown?.[code] || 0));

              const ytvRecCode = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0));
              const ytvPaidCode = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalPaidBreakdown?.[code] || 0), 0));
              const ytvProjCode = Math.round(rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalProjectedBreakdown?.[code] || 0), 0));

              const totRecCode = Math.round(rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0));
              const totPaidCode = Math.round(rowData.reduce((acc, r) => acc + (r.nominalPaidBreakdown?.[code] || 0), 0));
              const totProjCode = Math.round(rowData.reduce((acc, r) => acc + (r.nominalProjectedBreakdown?.[code] || 0), 0));

              compAoa.push([code, "P&L Recognized", ...recVals, ytvRecCode, totRecCode]);
              compAoa.push(["", "Bank Paid", ...paidVals, ytvPaidCode, totPaidCode]);
              compAoa.push(["", "Projected", ...projVals, ytvProjCode, totProjCode]);
            });

            const wsComp = XLSX.utils.aoa_to_sheet(compAoa);
            wsComp['!cols'] = [
              { wch: 35 },
              { wch: 20 },
              ...monthsList.map(() => ({ wch: 14 })),
              { wch: 16 },
              { wch: 16 }
            ];
            XLSX.utils.book_append_sheet(wb, wsComp, "Paid vs Projected");

            // Write File
            const filename = `Consolidated_PnL_${startMonth}_to_${endMonth}.xlsx`;
            XLSX.writeFile(wb, filename);

            if (onShowToast) {
              onShowToast(`P&L report exported successfully to ${filename}`, 'success');
            }
          } catch (err) {
            console.error("Failed to export P&L to Excel:", err);
            if (onShowToast) {
              onShowToast("Failed to generate Excel export. Please check console for details.", "error");
            }
          }
        };

        // Recruiter Ratios calculations for Overall compensation to billings gauge
        const recruiterRatios = staff.map(rec => {
          if (!companyFilter.includes('all') && !companyFilter.includes(rec.companyId)) return null;
          if (!deptFilter.includes('all') && !deptFilter.includes(rec.department)) return null;

          const recPlacements = placements.filter(p => {
            if (!p.startDate || p.status === 'dns') return false;
            const startMonthKey = p.startDate.substring(0, 7);
            if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
            return p.splits?.some(s => s.staffId === rec.id);
          });

          const periodBillings = recPlacements.reduce((sum, p) => {
            const split = p.splits.find(s => s.staffId === rec.id);
            const share = split ? (p.netScoreValue * split.percentage) / 100 : 0;
            return sum + toGBP(share, 'GBP');
          }, 0);

          let wagesPaid = 0;
          let commissionsPaid = 0;
          monthsList.forEach(m => {
            const pay = getStaffPayrollForMonth(rec, m);
            const policy = payrollPolicies.find(p => p.id === rec.payrollPolicyId);
            let targetNominal = policy?.nominalCode;
            if (!targetNominal && policy) {
              if (policy.type === 'freelance') {
                const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                targetNominal = contractorNominal || '1001 - Freelancer Payments';
              } else {
                const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                targetNominal = salaryNominal || '1002 - Salary';
              }
            }

            if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
              const groupActiveStaff = staff.filter(st => {
                const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, m);
                return daysWorked >= 10;
              });
              const targetCompanyIds = (rec.allocatedCompanyIds && rec.allocatedCompanyIds.length > 0) ? rec.allocatedCompanyIds : null;
              const otherStaff = groupActiveStaff.filter(os => {
                const comp = companies.find(c => c.id === os.companyId);
                const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== rec.companyId;
                return comp && comp.includeInConsolidation !== false && compMatch;
              });

              if (otherStaff.length > 0) {
                let activeOtherStaffCount = 0;
                otherStaff.forEach(os => {
                  const isComp = activeCompanyIds.includes(os.companyId);
                  const isDept = deptFilter.includes('all') || deptFilter.includes(os.department);
                  if (isComp && isDept) {
                    activeOtherStaffCount++;
                  }
                });
                const shareFactor = activeOtherStaffCount / otherStaff.length;
                wagesPaid += pay.salaries * shareFactor;
                commissionsPaid += pay.commissions * shareFactor;
              } else {
                const isComp = activeCompanyIds.includes(rec.companyId);
                const isDept = deptFilter.includes('all') || deptFilter.includes(rec.department);
                if (isComp && isDept) {
                  wagesPaid += pay.salaries;
                  commissionsPaid += pay.commissions;
                }
              }
            } else {
              const isComp = activeCompanyIds.includes(rec.companyId);
              const isDept = deptFilter.includes('all') || deptFilter.includes(rec.department);
              if (isComp && isDept) {
                wagesPaid += pay.salaries;
                commissionsPaid += pay.commissions;
              }
            }
          });

          const totalPaid = wagesPaid + commissionsPaid;
          const ratio = periodBillings > 0 ? (totalPaid / periodBillings) * 100 : 0;

          return { rec, periodBillings, ratio, totalPaid };
        }).filter(Boolean);

        let superb = 0;
        let good = 0;
        let highCost = 0;
        let low = 0;

        recruiterRatios.forEach(item => {
          if (item.periodBillings > 0) {
            if (item.ratio <= 30) superb++;
            else if (item.ratio <= 60) good++;
            else highCost++;
          } else {
            low++;
          }
        });

        const totalRecPaid = recruiterRatios.reduce((sum, item) => sum + item.totalPaid, 0);
        const totalRecBillings = recruiterRatios.reduce((sum, item) => sum + item.periodBillings, 0);
        const overallCompToBillingsRatio = totalRecBillings > 0 ? (totalRecPaid / totalRecBillings) * 100 : 0;

        const handleCellClick = (label, categoryKey, monthKey, amount, nominalCode = null) => {
          let periodLabel = '(YTD Period Total)';
          if (monthKey === 'ytv') {
            periodLabel = `(YTV Reconciled Bank Actuals through ${reconciledCutoffDate})`;
          } else if (monthKey) {
            periodLabel = `(${new Date(monthKey + '-02').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})`;
          }
          setDrilldownState({
            title: `${label} ${periodLabel}`,
            label,
            categoryKey,
            monthKey,
            nominalCode,
            amount
          });
        };

        const renderRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
          const ytdSum = rowData.reduce((acc, row) => acc + (row[key] || 0), 0);
          const ytvSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row[key] || 0), 0);
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
                style={{ 
                  textAlign: 'right', 
                  fontWeight: 600, 
                  color, 
                  backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                  borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                  cursor: 'pointer' 
                }}
                onClick={() => handleCellClick(label, key, 'ytv', ytvSum)}
                title={`Click to view reconciled bank actuals through ${reconciledCutoffDate}`}
              >
                {formatGBP(ytvSum)}
              </td>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            
            {/* Forecast Model Version Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>P&L Forecasting Model:</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {pnlVersion === 'v1' 
                    ? 'Version 1: Uses actual reconciled transactions for historical months and explicit projections/contracts for future months.' 
                    : 'Version 2: Uses actual reconciled transactions for historical months and flat-lines future months\' sales revenue, commissions, and overheads to a 3-month run-rate average (April - June 2026).'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setPnlVersion('v1')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: pnlVersion === 'v1' ? 'var(--accent)' : 'transparent',
                    color: pnlVersion === 'v1' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  v1 - Standard Projections
                </button>
                <button
                  type="button"
                  onClick={() => setPnlVersion('v2')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: pnlVersion === 'v2' ? 'var(--accent)' : 'transparent',
                    color: pnlVersion === 'v2' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  v2 - 3-Month Running Average
                </button>
              </div>
            </div>

            {/* Bank Statements Reconciliation Cutoff Banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              gap: '14px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🏦</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                      Bank Statements Reconciled Up To:
                    </span>
                    <span style={{ 
                      backgroundColor: 'rgba(99, 102, 241, 0.15)', 
                      color: 'var(--primary)', 
                      fontWeight: 700, 
                      fontSize: '12px', 
                      padding: '2px 8px', 
                      borderRadius: '4px' 
                    }}>
                      {reconciledCutoffDate ? new Date(reconciledCutoffDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Set'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: reconciledCutoffDate <= '2026-08-31' ? 'var(--success)' : '#f59e0b',
                      fontWeight: 600
                    }}>
                      ({reconciledCutoffDate <= '2026-08-31' ? 'Closed through end of August' : `Reconciled up to ${new Date(reconciledCutoffDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`})
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    The <strong>YTV</strong> column in the table below totals actual bank transactions reconciled up through this cutoff date.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Statement Cutoff Date:
                </label>
                <input
                  type="date"
                  value={reconciledCutoffDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSetReconciledCutoffDate(e.target.value);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSetReconciledCutoffDate('2026-08-31')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: reconciledCutoffDate === '2026-08-31' ? 700 : 500,
                    backgroundColor: reconciledCutoffDate === '2026-08-31' ? 'var(--primary)' : 'var(--bg-primary)',
                    color: reconciledCutoffDate === '2026-08-31' ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  title="Set cutoff to end of August (2026-08-31)"
                >
                  End of August
                </button>
                {autoDetectedBankCutoff && autoDetectedBankCutoff !== '2026-08-31' && (
                  <button
                    type="button"
                    onClick={() => handleSetReconciledCutoffDate(autoDetectedBankCutoff)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: reconciledCutoffDate === autoDetectedBankCutoff ? 700 : 500,
                      backgroundColor: reconciledCutoffDate === autoDetectedBankCutoff ? 'var(--primary)' : 'var(--bg-primary)',
                      color: reconciledCutoffDate === autoDetectedBankCutoff ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    title={`Set cutoff to latest bank statement date (${autoDetectedBankCutoff})`}
                  >
                    Latest Statement ({autoDetectedBankCutoff})
                  </button>
                )}
              </div>
            </div>
            
            {/* Dashboard Toggle / Header Panel */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              backgroundColor: 'var(--bg-secondary)', 
              padding: '12px 18px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>📊</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>P&L Performance Summary Dashboard</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  onClick={handleExportPnlExcel}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Export complete P&L statement, nominal breakdown, and actuals vs budget to Excel (.xlsx)"
                >
                  <FileSpreadsheet size={14} /> Export to Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintPnl}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--success)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={14} /> Print PDF
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPnlDashboard(!showPnlDashboard)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {showPnlDashboard ? '🙈 Hide Chart Analytics' : '👁️ Show Chart Analytics'}
                </button>
              </div>
            </div>

            {/* Visual Analytics dashboard */}
            {showPnlDashboard && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* KPI Summary Cards Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px'
                }}>
                  {[
                    { title: 'Total Revenue (Billings)', value: totalRevenue, color: 'var(--success)', icon: '💰', desc: 'Net Placements Fee Billings' },
                    { title: 'Accrued Commissions', value: totalCommissions, color: 'var(--danger)', icon: '🎟️', desc: 'Direct Recruiter Commissions' },
                    { title: 'Indirect Overheads & SaaS', value: totalOverheads, color: 'var(--warning)', icon: '🏢', desc: 'Apportioned Shared Expenses' },
                    { title: 'EBITDA Net Profit', value: totalProfit, color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)', icon: '📈', desc: `${profitMargin.toFixed(1)}% Profit Margin` },
                  ].map((card, idx) => (
                    <div key={idx} style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: 'var(--shadow-md)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        fontSize: '60px',
                        opacity: 0.05,
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}>
                        {card.icon}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.title}</span>
                      <span style={{ fontSize: '20px', fontWeight: 800, color: card.color, fontFamily: 'monospace' }}>{formatGBP(card.value)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{card.desc}</span>
                    </div>
                  ))}
                </div>

                {/* Dashboard Charts Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '20px'
                }}>
                  
                  {/* Chart 1: Revenue vs. Expenses Trend */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: 'var(--shadow-md)',
                    minHeight: '320px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Monthly Billings vs. Total Expenses</h4>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '2px' }} />
                          Revenue
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--danger)', borderRadius: '2px' }} />
                          Expenses
                        </span>
                      </div>
                    </div>

                    <div style={{ position: 'relative', flex: 1, minHeight: '200px' }}>
                      {(() => {
                        const width = 600;
                        const height = 200;
                        const paddingLeft = 55;
                        const paddingRight = 15;
                        const paddingTop = 15;
                        const paddingBottom = 30;

                        const chartWidth = width - paddingLeft - paddingRight;
                        const chartHeight = height - paddingTop - paddingBottom;

                        const maxVal = Math.max(
                          ...rowData.map(r => Math.max(r.revenue || 0, (r.commissions || 0) + (r.overheadsExpenses || 0))),
                          1000
                        ) * 1.15;

                        const colWidth = chartWidth / rowData.length;
                        const barWidth = Math.max(6, colWidth * 0.3);

                        const gridCount = 4;
                        const gridLines = Array.from({ length: gridCount + 1 }).map((_, idx) => {
                          const val = (maxVal / gridCount) * idx;
                          const y = height - paddingBottom - (val / maxVal) * chartHeight;
                          return { val, y };
                        });

                        return (
                          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                            <defs>
                              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                              </linearGradient>
                              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
                              </linearGradient>
                            </defs>

                            {gridLines.map((line, idx) => (
                              <g key={idx}>
                                <line 
                                  x1={paddingLeft} 
                                  y1={line.y} 
                                  x2={width - paddingRight} 
                                  y2={line.y} 
                                  stroke="var(--border-color)" 
                                  strokeWidth={0.5} 
                                  strokeDasharray={idx === 0 ? "none" : "3,3"}
                                />
                                <text 
                                  x={paddingLeft - 8} 
                                  y={line.y + 3} 
                                  textAnchor="end" 
                                  fill="var(--text-muted)" 
                                  fontSize="9px" 
                                  fontFamily="monospace"
                                >
                                  {formatGBP(line.val, 0)}
                                </text>
                              </g>
                            ))}

                            {rowData.map((row, idx) => {
                              const monthKey = monthsList[idx];
                              const revenue = row.revenue || 0;
                              const expenses = (row.commissions || 0) + (row.overheadsExpenses || 0);
                              const xCenter = paddingLeft + idx * colWidth + colWidth / 2;

                              const revHeight = (revenue / maxVal) * chartHeight;
                              const revY = height - paddingBottom - revHeight;
                              const revX = xCenter - barWidth - 1.5;

                              const expHeight = (expenses / maxVal) * chartHeight;
                              const expY = height - paddingBottom - expHeight;
                              const expX = xCenter + 1.5;

                              const label = new Date(monthKey + '-02').toLocaleDateString(undefined, { month: 'short' });
                              const isHovered = activeTooltip && activeTooltip.index === idx && activeTooltip.chart === 'trend';

                              return (
                                <g key={idx}>
                                  <rect
                                    x={paddingLeft + idx * colWidth}
                                    y={paddingTop}
                                    width={colWidth}
                                    height={chartHeight}
                                    fill="currentColor"
                                    opacity={isHovered ? 0.03 : 0}
                                    style={{ pointerEvents: 'none' }}
                                  />
                                  {revenue > 0 && (
                                    <rect x={revX} y={revY} width={barWidth} height={revHeight} fill="url(#revGrad)" rx={1.5} />
                                  )}
                                  {expenses > 0 && (
                                    <rect x={expX} y={expY} width={barWidth} height={expHeight} fill="url(#expGrad)" rx={1.5} />
                                  )}
                                  <text
                                    x={xCenter}
                                    y={height - paddingBottom + 16}
                                    textAnchor="middle"
                                    fill={isHovered ? "var(--accent)" : "var(--text-secondary)"}
                                    fontSize="9px"
                                    fontWeight={isHovered ? 700 : 500}
                                  >
                                    {label}
                                  </text>
                                  <rect
                                    x={paddingLeft + idx * colWidth}
                                    y={paddingTop}
                                    width={colWidth}
                                    height={chartHeight}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => {
                                      setActiveTooltip({
                                        chart: 'trend',
                                        index: idx,
                                        x: xCenter,
                                        y: Math.min(revY, expY) - 10,
                                        month: new Date(monthKey + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                                        revenue,
                                        expenses,
                                        profit: row.netProfit
                                      });
                                    }}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                  />
                                </g>
                              );
                            })}

                            {activeTooltip && activeTooltip.chart === 'trend' && (
                              <g>
                                <line x1={activeTooltip.x} y1={paddingTop} x2={activeTooltip.x} y2={height - paddingBottom} stroke="var(--accent)" strokeWidth={0.75} strokeDasharray="2,2" />
                                <foreignObject
                                  x={Math.max(paddingLeft, Math.min(width - paddingRight - 150, activeTooltip.x - 75))}
                                  y={Math.max(5, activeTooltip.y - 85)}
                                  width={160}
                                  height={95}
                                  pointerEvents="none"
                                >
                                  <div style={{
                                    backgroundColor: 'var(--bg-sidebar)',
                                    border: '1px solid var(--accent)',
                                    borderRadius: '4px',
                                    padding: '6px 8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    fontSize: '10px'
                                  }}>
                                    <strong style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '3px', marginBottom: '3px', display: 'block' }}>
                                      {activeTooltip.month}
                                    </strong>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>Billings:</span>
                                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>{formatGBP(activeTooltip.revenue)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>Expenses:</span>
                                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatGBP(activeTooltip.expenses)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '2px', marginTop: '2px' }}>
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Net Profit:</span>
                                      <span style={{ color: activeTooltip.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                                        {formatGBP(activeTooltip.profit)}
                                      </span>
                                    </div>
                                  </div>
                                </foreignObject>
                              </g>
                            )}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Chart 2: Top Recruiter Yields */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: 'var(--shadow-md)',
                    minHeight: '320px'
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Top 5 Recruiter Billings Yield</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
                      {(() => {
                        const topRecs = staff.map(rec => {
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

                          return { fullName: rec.fullName || 'Unknown', totalVal };
                        })
                        .filter(Boolean)
                        .filter(item => item.totalVal > 0)
                        .sort((a, b) => b.totalVal - a.totalVal)
                        .slice(0, 5);

                        if (topRecs.length === 0) {
                          return (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                              No recruiter billings recorded in this period.
                            </div>
                          );
                        }

                        const maxYield = Math.max(...topRecs.map(r => r.totalVal), 1);

                        return topRecs.map((item, idx) => {
                          const percent = (item.totalVal / maxYield) * 100;
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                <span>{idx + 1}. {item.fullName}</span>
                                <span style={{ color: 'var(--success)', fontFamily: 'monospace' }}>{formatGBP(item.totalVal)}</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div 
                                  style={{ 
                                    width: `${percent}%`, 
                                    height: '100%', 
                                    background: 'linear-gradient(90deg, var(--accent) 0%, #38bdf8 100%)', 
                                    borderRadius: '4px'
                                  }} 
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Chart 3: Salary-to-Billings Efficiency Progress Circle */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: 'var(--shadow-md)',
                    minHeight: '320px'
                  }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Salary-to-Billings Efficiency ROI</h4>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px', padding: '10px 0' }}>
                      
                      {/* SVG Gauge */}
                      <div style={{ width: '100px', height: '100px', position: 'relative' }}>
                        {(() => {
                          const r = 40;
                          const circ = 2 * Math.PI * r;
                          const offset = circ - (Math.min(100, overallCompToBillingsRatio) / 100) * circ;
                          return (
                            <svg width="100%" height="100%" viewBox="0 0 100 100">
                              <circle 
                                cx="50" 
                                cy="50" 
                                r={r} 
                                fill="transparent" 
                                stroke="rgba(255, 255, 255, 0.05)" 
                                strokeWidth="8" 
                              />
                              <circle 
                                cx="50" 
                                cy="50" 
                                r={r} 
                                fill="transparent" 
                                stroke="var(--accent)" 
                                strokeWidth="8" 
                                strokeDasharray={circ}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                                style={{ transition: 'stroke-dashoffset 0.6s ease-in-out' }}
                              />
                              <text 
                                x="50" 
                                y="54" 
                                textAnchor="middle" 
                                fill="var(--text-primary)" 
                                fontSize="12px" 
                                fontWeight="800"
                                fontFamily="monospace"
                              >
                                {overallCompToBillingsRatio > 0 ? `${overallCompToBillingsRatio.toFixed(1)}%` : '0%'}
                              </text>
                            </svg>
                          );
                        })()}
                      </div>

                      {/* Distribution breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Overall Compensation/Billings:</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent)' }}>
                            {formatGBP(totalRecPaid)} / {formatGBP(totalRecBillings)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                          <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--success)', borderRadius: '50%' }} />
                              Superb (≤30%):
                            </span>
                            <span style={{ fontWeight: 700 }}>{superb} recruiter(s)</span>
                          </div>
                          <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#38bdf8', borderRadius: '50%' }} />
                              Good (31-60%):
                            </span>
                            <span style={{ fontWeight: 700 }}>{good} recruiter(s)</span>
                          </div>
                          <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--warning)', borderRadius: '50%' }} />
                              High Cost (&gt;60%):
                            </span>
                            <span style={{ fontWeight: 700 }}>{highCost} recruiter(s)</span>
                          </div>
                          <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--text-muted)', borderRadius: '50%' }} />
                              Low/No Billings:
                            </span>
                            <span style={{ fontWeight: 700 }}>{low} recruiter(s)</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* Numerical P&L Table Container */}
            <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
              <table className="entity-table dense" style={{ minWidth: '1200px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ minWidth: '220px', fontWeight: 700 }}>P&L Account Line Items (GBP)</th>
                    {monthsList.map(m => {
                      const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                      return <th key={m} style={{ textAlign: 'right', fontWeight: 700 }}>{label}</th>;
                    })}
                    <th style={{ 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      color: 'var(--primary)',
                      borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
                      whiteSpace: 'nowrap'
                    }} title={`Year-To-Date Bank Actuals (Reconciled through ${reconciledCutoffDate})`}>
                      YTV
                    </th>
                    <th style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.04)' }}>Period Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <td>Revenue stream credits</td>
                    <td colSpan={monthsList.length + 2} />
                  </tr>
                  {renderRow('Net Placements Fee Billings', 'revenue', false, true, 'var(--success)')}
                  
                  <tr style={{ borderBottom: '1px dashed var(--border-color)', height: '8px' }} />

                  <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <td>Overheads & Staff Expenses</td>
                    <td colSpan={monthsList.length + 2} />
                  </tr>

                  {/* Apportioned Overheads & SaaS (Expandable) */}
                  <tr style={{ fontWeight: 400 }}>
                    <td style={{ paddingLeft: '24px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} onClick={() => setExpandedExpenses(!expandedExpenses)}>
                      <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{expandedExpenses ? '▼' : '▶'}</span>
                      <span style={{ fontWeight: 600 }}>Apportioned Overheads & SaaS</span>
                      {excludedNominalCodes.length > 0 ? (
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                          color: '#ef4444', 
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          ⚠️ {excludedNominalCodes.length} Excluded
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleIncludeAllNominals(); }}
                            style={{ 
                              background: 'rgba(255,255,255,0.15)', 
                              border: 'none', 
                              borderRadius: '4px', 
                              color: '#fff', 
                              cursor: 'pointer', 
                              fontSize: '9px', 
                              padding: '1px 5px',
                              fontWeight: 700
                            }}
                            title="Restore and include all nominal codes"
                          >
                            Reset All
                          </button>
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                          (All Nominals Included)
                        </span>
                      )}

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>View:</span>
                        {[
                          { id: 'all', label: 'Consolidated P&L' },
                          { id: 'compare', label: '⚖️ Projected vs Paid' },
                          { id: 'paid', label: '💳 Paid Only' },
                          { id: 'projected', label: '🔮 Projected Only' }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              setOverheadViewMode(mode.id);
                              try { localStorage.setItem('bm-overhead-view-mode', mode.id); } catch (e) {}
                            }}
                            style={{
                              fontSize: '9px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: overheadViewMode === mode.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: overheadViewMode === mode.id ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                              color: overheadViewMode === mode.id ? '#fff' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontWeight: overheadViewMode === mode.id ? 700 : 500
                            }}
                          >
                            {mode.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleToggleHideZeroNominals}
                          style={{
                            fontSize: '9px',
                            padding: '2px 7px',
                            marginLeft: '6px',
                            borderRadius: '4px',
                            border: hideZeroNominals ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                            backgroundColor: hideZeroNominals ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                            color: hideZeroNominals ? '#10b981' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title={hideZeroNominals ? "Nominals with £0 are hidden. Click to show all." : "Showing all nominals. Click to hide £0 nominals."}
                        >
                          {hideZeroNominals ? '🚫 £0 Hidden' : '👁️ Show All £0'}
                        </button>
                      </div>
                    </td>
                    {rowData.map((row, idx) => {
                      const monthKey = monthsList[idx];
                      const val = row.overheadsExpenses || 0;
                      const paidVal = row.overheadsPaid || 0;
                      const projVal = row.overheadsProjected || 0;
                      const displayVal = overheadViewMode === 'paid' ? paidVal : overheadViewMode === 'projected' ? projVal : val;
                      return (
                        <td 
                          key={idx} 
                          style={{ textAlign: 'right', cursor: (val > 0 || paidVal > 0 || projVal > 0) ? 'pointer' : 'default', verticalAlign: 'middle' }}
                          onClick={() => (val > 0 || paidVal > 0 || projVal > 0) && handleCellClick('Apportioned Overheads & SaaS', 'overheadsExpenses', monthKey, val)}
                          title={`Month: ${monthKey}\n• P&L Recognized: ${formatGBP(val)}\n• Paid from Bank: ${formatGBP(paidVal)}\n• Projected Budget: ${formatGBP(projVal)}${monthKey <= reconciledCutoffMonth ? ' (Closed - Reconciled by Bank Statements)' : ''}`}
                        >
                          {overheadViewMode === 'compare' ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{formatGBP(val)}</div>
                              <div style={{ fontSize: '9px', display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                <span style={{ color: '#10b981', fontWeight: 600 }} title="Paid from bank statements">P:{formatGBP(paidVal)}</span>
                                <span style={{ color: '#a855f7', fontWeight: 600 }} title="Projected budget from contracts/payroll">Pr:{formatGBP(projVal)}</span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span>{formatGBP(displayVal)}</span>
                              {overheadViewMode === 'all' && projVal > 0 && monthKey > reconciledCutoffMonth && (
                                <span style={{ fontSize: '9px', marginLeft: '3px', color: '#a855f7', fontWeight: 700 }} title={`Includes ${formatGBP(projVal)} forecast projection`}>●</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {(() => {
                      const ytvOverheadsSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row.overheadsExpenses || 0), 0);
                      const ytvPaidSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row.overheadsPaid || 0), 0);
                      const displayYtv = overheadViewMode === 'paid' ? ytvPaidSum : ytvOverheadsSum;
                      return (
                        <td 
                          style={{ 
                            textAlign: 'right', 
                            fontWeight: 600, 
                            backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                            borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                            cursor: 'pointer',
                            verticalAlign: 'middle'
                          }}
                          onClick={() => handleCellClick('Apportioned Overheads & SaaS', 'overheadsExpenses', 'ytv', ytvOverheadsSum)}
                          title={`Click to view reconciled overhead expenses through ${reconciledCutoffDate}`}
                        >
                          {overheadViewMode === 'compare' ? (
                            <div>
                              <div>{formatGBP(ytvOverheadsSum)}</div>
                              <div style={{ fontSize: '9px', display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                <span style={{ color: '#10b981', fontWeight: 600 }} title="Paid through bank reconciliation cutoff">P:{formatGBP(ytvPaidSum)}</span>
                              </div>
                            </div>
                          ) : (
                            formatGBP(displayYtv)
                          )}
                        </td>
                      );
                    })()}
                    {(() => {
                      const totalOverheadsSum = rowData.reduce((acc, row) => acc + (row.overheadsExpenses || 0), 0);
                      const totalPaidSum = rowData.reduce((acc, row) => acc + (row.overheadsPaid || 0), 0);
                      const totalProjSum = rowData.reduce((acc, row) => acc + (row.overheadsProjected || 0), 0);
                      const displayTotal = overheadViewMode === 'paid' ? totalPaidSum : overheadViewMode === 'projected' ? totalProjSum : totalOverheadsSum;
                      return (
                        <td 
                          style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer', verticalAlign: 'middle' }}
                          onClick={() => handleCellClick('Apportioned Overheads & SaaS', 'overheadsExpenses', null, totalOverheadsSum)}
                        >
                          {overheadViewMode === 'compare' ? (
                            <div>
                              <div>{formatGBP(totalOverheadsSum)}</div>
                              <div style={{ fontSize: '9px', display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                <span style={{ color: '#10b981', fontWeight: 600 }} title="Total actual bank paid">P:{formatGBP(totalPaidSum)}</span>
                                <span style={{ color: '#a855f7', fontWeight: 600 }} title="Total projected">Pr:{formatGBP(totalProjSum)}</span>
                              </div>
                            </div>
                          ) : (
                            formatGBP(displayTotal)
                          )}
                        </td>
                      );
                    })()}
                  </tr>

                  {/* Sub-rows for each nominal code category when expanded */}
                  {expandedExpenses && (() => {
                    const codeKeys = Array.from(new Set(
                      rowData.flatMap(r => Object.keys(r.nominalBreakdown || {}))
                    )).filter(c => {
                      if (c.startsWith('__')) return false;
                      if (hideZeroNominals) {
                        const ytdSum = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[c] || 0), 0);
                        const ytdPaidSum = rowData.reduce((acc, r) => acc + (r.nominalPaidBreakdown?.[c] || 0), 0);
                        const ytdProjSum = rowData.reduce((acc, r) => acc + (r.nominalProjectedBreakdown?.[c] || 0), 0);
                        if (ytdSum === 0 && ytdPaidSum === 0 && ytdProjSum === 0) return false;
                      }
                      return true;
                    }).sort();

                    return codeKeys.map(code => {
                      const isExcluded = isNominalExcluded(code);
                      const ytdSum = rowData.reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0);
                      const ytdPaidSum = rowData.reduce((acc, r) => acc + (r.nominalPaidBreakdown?.[code] || 0), 0);
                      const ytdProjSum = rowData.reduce((acc, r) => acc + (r.nominalProjectedBreakdown?.[code] || 0), 0);
                      const ytvSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalBreakdown?.[code] || 0), 0);
                      const ytvPaidSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.nominalPaidBreakdown?.[code] || 0), 0);
                      const displayYtd = overheadViewMode === 'paid' ? ytdPaidSum : overheadViewMode === 'projected' ? ytdProjSum : ytdSum;
                      const displayYtv = overheadViewMode === 'paid' ? ytvPaidSum : ytvSum;
                      return (
                        <tr 
                          key={code} 
                          style={{ 
                            fontSize: '11px', 
                            color: isExcluded ? 'var(--text-muted)' : 'var(--text-secondary)',
                            backgroundColor: isExcluded ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                            opacity: isExcluded ? 0.6 : 1
                          }}
                        >
                          <td 
                            style={{ paddingLeft: '48px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}
                          >
                            <span style={{ color: 'var(--text-muted)' }}>↳</span>
                            <span 
                              style={{ 
                                cursor: 'pointer', 
                                textDecoration: isExcluded ? 'line-through' : 'none',
                                fontWeight: isExcluded ? 400 : 500
                              }}
                              onClick={() => handleCellClick(`Nominal Cost: ${code}`, 'nominal', null, ytdSum, code)}
                              title={`Click to view all itemized ${code} transactions for full period`}
                            >
                              {code} 🔍
                            </span>
                            {isExcluded ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleToggleNominalInclusion(code); }}
                                style={{
                                   fontSize: '9px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  color: '#22c55e',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontStyle: 'normal'
                                }}
                                title="Include this nominal code in overheads calculation"
                              >
                                + Include
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleToggleNominalInclusion(code); }}
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontStyle: 'normal'
                                }}
                                title="Exclude this nominal code from Apportioned Overheads"
                              >
                                ✕ Exclude
                              </button>
                            )}
                          </td>
                          {rowData.map((row, idx) => {
                            const monthKey = monthsList[idx];
                            const val = row.nominalBreakdown?.[code] || 0;
                            const paidVal = row.nominalPaidBreakdown?.[code] || 0;
                            const projVal = row.nominalProjectedBreakdown?.[code] || 0;
                            const displayVal = overheadViewMode === 'paid' ? paidVal : overheadViewMode === 'projected' ? projVal : val;
                            return (
                              <td 
                                key={idx} 
                                style={{ 
                                  textAlign: 'right', 
                                  opacity: isExcluded ? 0.35 : (displayVal > 0 || paidVal > 0 || projVal > 0 ? 0.9 : 0.4), 
                                  cursor: (displayVal > 0 || paidVal > 0 || projVal > 0) ? 'pointer' : 'default',
                                  fontWeight: displayVal > 0 ? 600 : 400,
                                  textDecoration: isExcluded ? 'line-through' : 'none',
                                  verticalAlign: 'middle'
                                }}
                                onClick={() => (val > 0 || paidVal > 0 || projVal > 0) && handleCellClick(`Nominal Cost: ${code}`, 'nominal', monthKey, val, code)}
                                title={`Nominal: ${code} (${monthKey})\n• P&L Recognized: ${formatGBP(val)}\n• Paid from Bank: ${formatGBP(paidVal)}\n• Projected Budget: ${formatGBP(projVal)}${monthKey <= reconciledCutoffMonth ? ' (Closed - Reconciled by Bank Statements)' : ''}`}
                              >
                                {overheadViewMode === 'compare' ? (
                                  <div>
                                    <div style={{ fontWeight: val > 0 ? 600 : 400 }}>{formatGBP(val)}</div>
                                    <div style={{ fontSize: '9px', display: 'flex', gap: '3px', justifyContent: 'flex-end', marginTop: '1px' }}>
                                      <span style={{ color: '#10b981', fontWeight: 600 }} title="Paid from bank statements">P:{formatGBP(paidVal)}</span>
                                      <span style={{ color: '#a855f7', fontWeight: 600 }} title="Projected from policies/contracts">Pr:{formatGBP(projVal)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span>{formatGBP(displayVal)}</span>
                                    {overheadViewMode === 'all' && projVal > 0 && monthKey > reconciledCutoffMonth && (
                                      <span style={{ fontSize: '9px', marginLeft: '2px', color: '#a855f7', fontWeight: 700 }} title={`Includes ${formatGBP(projVal)} forecast projection`}>●</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: 600, 
                              backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                              borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                              cursor: 'pointer',
                              textDecoration: isExcluded ? 'line-through' : 'none',
                              opacity: isExcluded ? 0.4 : 1,
                              verticalAlign: 'middle'
                            }}
                            onClick={() => handleCellClick(`Nominal Cost: ${code}`, 'nominal', 'ytv', ytvSum, code)}
                            title={`Click to view reconciled ${code} transactions through ${reconciledCutoffDate}`}
                          >
                            {overheadViewMode === 'compare' ? (
                              <div>
                                <div>{formatGBP(ytvSum)}</div>
                                <div style={{ fontSize: '9px', display: 'flex', gap: '3px', justifyContent: 'flex-end', marginTop: '1px' }}>
                                  <span style={{ color: '#10b981', fontWeight: 600 }} title="Paid actuals through cutoff">P:{formatGBP(ytvPaidSum)}</span>
                                </div>
                              </div>
                            ) : (
                              formatGBP(displayYtv)
                            )}
                          </td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: 700, 
                              backgroundColor: 'rgba(255,255,255,0.02)', 
                              cursor: 'pointer',
                              textDecoration: isExcluded ? 'line-through' : 'none',
                              opacity: isExcluded ? 0.4 : 1,
                              verticalAlign: 'middle'
                            }}
                            onClick={() => handleCellClick(`Nominal Cost: ${code}`, 'nominal', null, ytdSum, code)}
                          >
                            {overheadViewMode === 'compare' ? (
                              <div>
                                <div>{formatGBP(ytdSum)}</div>
                                <div style={{ fontSize: '9px', display: 'flex', gap: '3px', justifyContent: 'flex-end', marginTop: '1px' }}>
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>P:{formatGBP(ytdPaidSum)}</span>
                                  <span style={{ color: '#a855f7', fontWeight: 600 }}>Pr:{formatGBP(ytdProjSum)}</span>
                                </div>
                              </div>
                            ) : (
                              formatGBP(displayYtd)
                            )}
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
                    {(() => {
                      const ytvNetProfit = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + r.netProfit, 0);
                      return (
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: ytvNetProfit >= 0 ? 'var(--success)' : 'var(--danger)', 
                          backgroundColor: 'rgba(99, 102, 241, 0.04)',
                          borderLeft: '1px solid rgba(99, 102, 241, 0.15)' 
                        }} title={`Reconciled EBITDA Net Profit through ${reconciledCutoffDate}`}>
                          {formatGBP(ytvNetProfit)}
                        </td>
                      );
                    })()}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      {formatGBP(rowData.reduce((acc, r) => acc + r.netProfit, 0))}
                    </td>
                  </tr>

                  {/* Cumulative Carry-Forward P&L Row */}
                  {(() => {
                    let cumulativePnl = 0;
                    const cumulativeThroughCutoff = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + r.netProfit, 0);
                    return (
                      <tr style={{ fontWeight: 800, backgroundColor: 'rgba(59, 130, 246, 0.07)', fontSize: '13px', borderTop: '1px dashed rgba(59, 130, 246, 0.3)' }}>
                        <td style={{ color: '#38bdf8' }}>📈 Cumulative Carry-Forward P&L</td>
                        {rowData.map((row, idx) => {
                          cumulativePnl += row.netProfit;
                          return (
                            <td key={idx} style={{ textAlign: 'right', color: cumulativePnl >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                              {formatGBP(cumulativePnl)}
                            </td>
                          );
                        })}
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: cumulativeThroughCutoff >= 0 ? 'var(--success)' : 'var(--danger)', 
                          backgroundColor: 'rgba(99, 102, 241, 0.06)',
                          borderLeft: '1px solid rgba(99, 102, 241, 0.15)'
                        }} title={`Cumulative Carry-Forward P&L through ${reconciledCutoffDate}`}>
                          {formatGBP(cumulativeThroughCutoff)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: cumulativePnl >= 0 ? 'var(--success)' : 'var(--danger)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                          {formatGBP(cumulativePnl)}
                        </td>
                      </tr>
                    );
                  })()}

                  <tr style={{ borderBottom: '1px solid var(--border-color)', height: '12px' }} />

                  <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <td>Non-P&L Balance Sheet Items (Cash Flow Only)</td>
                    <td colSpan={monthsList.length + 2} />
                  </tr>

                  <tr style={{ fontWeight: 400 }}>
                    <td style={{ paddingLeft: '24px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setExpandedBalanceSheet(!expandedBalanceSheet)}>
                      <span style={{ fontSize: '10px', color: 'var(--accent)' }}>{expandedBalanceSheet ? '▼' : '▶'}</span>
                      <span style={{ fontWeight: 600 }}>Refundable Deposits & Prepayments</span>
                    </td>
                    {rowData.map((row, idx) => {
                      const monthKey = monthsList[idx];
                      const val = row.balanceSheetTotal || 0;
                      return (
                        <td 
                          key={idx} 
                          style={{ textAlign: 'right', cursor: val > 0 ? 'pointer' : 'default', color: 'var(--text-muted)' }}
                          onClick={() => val > 0 && handleCellClick('Refundable Deposits & Prepayments', 'balanceSheet', monthKey, val)}
                          title={val > 0 ? `Click to view balance sheet items for ${monthKey}` : undefined}
                        >
                          {val > 0 ? formatGBP(val) : '—'}
                        </td>
                      );
                    })}
                    {(() => {
                      const ytvBsTotal = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row.balanceSheetTotal || 0), 0);
                      return (
                        <td 
                          style={{ 
                            textAlign: 'right', 
                            fontWeight: 600, 
                            backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                            borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                            cursor: 'pointer',
                            color: 'var(--text-muted)'
                          }}
                          onClick={() => handleCellClick('Refundable Deposits & Prepayments', 'balanceSheet', 'ytv', ytvBsTotal)}
                          title={`Click to view reconciled balance sheet items through ${reconciledCutoffDate}`}
                        >
                          {ytvBsTotal > 0 ? formatGBP(ytvBsTotal) : '—'}
                        </td>
                      );
                    })()}
                    <td 
                      style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-muted)' }}
                      onClick={() => handleCellClick('Refundable Deposits & Prepayments', 'balanceSheet', null, rowData.reduce((acc, row) => acc + (row.balanceSheetTotal || 0), 0))}
                    >
                      {formatGBP(rowData.reduce((acc, row) => acc + (row.balanceSheetTotal || 0), 0))}
                    </td>
                  </tr>

                  {/* Sub-rows for each balance sheet nominal code when expanded */}
                  {expandedBalanceSheet && (() => {
                    const codeKeys = Array.from(new Set(
                      rowData.flatMap(r => Object.keys(r.balanceSheetBreakdown || {}))
                    )).filter(c => {
                      if (hideZeroNominals) {
                        const ytdSum = rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[c] || 0), 0);
                        if (ytdSum === 0) return false;
                      }
                      return true;
                    }).sort();

                    return codeKeys.map(code => {
                      const ytdSum = rowData.reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0);
                      const ytvSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r.balanceSheetBreakdown?.[code] || 0), 0);
                      return (
                        <tr key={code} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <td 
                            style={{ paddingLeft: '48px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            onClick={() => handleCellClick(`Balance Sheet Item: ${code}`, 'balanceSheet', null, ytdSum, code)}
                            title={`Click to view all itemized ${code} transactions for full period`}
                          >
                            <span style={{ color: 'var(--text-muted)' }}>↳</span> {code} 🔍
                          </td>
                          {rowData.map((row, idx) => {
                            const monthKey = monthsList[idx];
                            const val = row.balanceSheetBreakdown?.[code] || 0;
                            return (
                              <td 
                                key={idx} 
                                style={{ 
                                  textAlign: 'right', 
                                  opacity: val > 0 ? 0.9 : 0.4, 
                                  cursor: val > 0 ? 'pointer' : 'default',
                                  fontWeight: val > 0 ? 600 : 400
                                }}
                                onClick={() => val > 0 && handleCellClick(`Balance Sheet Item: ${code}`, 'balanceSheet', monthKey, val, code)}
                                title={val > 0 ? `Click to view itemized ${code} transactions for ${monthKey}` : undefined}
                              >
                                {val > 0 ? formatGBP(val) : '—'}
                              </td>
                            );
                          })}
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: 600, 
                              backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                              borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                              cursor: 'pointer',
                              color: 'var(--text-muted)'
                            }}
                            onClick={() => handleCellClick(`Balance Sheet Item: ${code}`, 'balanceSheet', 'ytv', ytvSum, code)}
                            title={`Click to view reconciled ${code} items through ${reconciledCutoffDate}`}
                          >
                            {ytvSum > 0 ? formatGBP(ytvSum) : '—'}
                          </td>
                          <td 
                            style={{ 
                              textAlign: 'right', 
                              fontWeight: 700, 
                              backgroundColor: 'rgba(255,255,255,0.02)', 
                              cursor: 'pointer' 
                            }}
                            onClick={() => handleCellClick(`Balance Sheet Item: ${code}`, 'balanceSheet', null, ytdSum, code)}
                          >
                            {formatGBP(ytdSum)}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                  <tr style={{ borderBottom: '1px solid var(--border-color)', height: '12px' }} />

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
                    <td style={{ textAlign: 'right', backgroundColor: 'rgba(99, 102, 241, 0.04)', borderLeft: '1px solid rgba(99, 102, 241, 0.15)' }}>—</td>
                    <td style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.02)' }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        );
      })()}


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
                    
                    const pay = getStaffPayrollForMonth(s, mKey);
                    if (mKey > '2026-06') {
                      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                      let targetNominal = policy?.nominalCode;
                      if (!targetNominal && policy) {
                        if (policy.type === 'freelance') {
                          const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                          targetNominal = contractorNominal || '1001 - Freelancer Payments';
                        } else {
                          const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                          targetNominal = salaryNominal || '1002 - Salary';
                        }
                      }

                      if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
                        if (s.companyId && s.companyId !== 'comp-1782789370085') {
                          if (companyDataMap[s.companyId] && (deptFilter.includes('all') || deptFilter.includes(s.department))) {
                            companyDataMap[s.companyId].salaries += pay.salaries;
                            companyDataMap[s.companyId].commissions += pay.commissions;
                          }
                        } else {
                          const activeStaffInMonth = staff.filter(st => {
                            const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                            return daysWorked >= 10;
                          });
                          const targetCompanyIds = (s.allocatedCompanyIds && s.allocatedCompanyIds.length > 0) ? s.allocatedCompanyIds : null;
                          const otherStaff = activeStaffInMonth.filter(os => {
                            const comp = companies.find(c => c.id === os.companyId);
                            const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== s.companyId;
                            return comp && comp.includeInConsolidation !== false && compMatch;
                          });

                          if (otherStaff.length > 0) {
                            const perStaffShareSal = pay.salaries / otherStaff.length;
                            const perStaffShareComm = pay.commissions / otherStaff.length;
                            otherStaff.forEach(os => {
                              if (companyDataMap[os.companyId] && (deptFilter.includes('all') || deptFilter.includes(os.department))) {
                                companyDataMap[os.companyId].salaries += perStaffShareSal;
                                companyDataMap[os.companyId].commissions += perStaffShareComm;
                              }
                            });
                          } else {
                            if (companyDataMap[s.companyId] && (deptFilter.includes('all') || deptFilter.includes(s.department))) {
                              companyDataMap[s.companyId].salaries += pay.salaries;
                              companyDataMap[s.companyId].commissions += pay.commissions;
                            }
                          }
                        }
                      } else {
                        if (companyDataMap[s.companyId]) {
                          companyDataMap[s.companyId].salaries += pay.salaries;
                          companyDataMap[s.companyId].commissions += pay.commissions;
                        }
                      }
                    }
                  });

                  // Shared overheads
                  const activeStaffInMonth = staff.filter(st => {
                    const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                    return daysWorked >= 10;
                  });
                  const activeStaffInMonthIds = activeStaffInMonth.map(st => st.id);
                  const monthExpenses = expenses.filter(e => e.plMonth === mKey && !isNominalExcluded(e.nominalCode) && !isExpenseSupersededByPayroll(e));

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
                        const cProfit = companyDataMap[c.id].revenue - companyDataMap[c.id].salaries - companyDataMap[c.id].overheads;
                        return (
                          <td key={c.id} style={{ textAlign: 'right', color: cProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatGBP(cProfit)}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(companies.reduce((sum, c) => {
                          return sum + (companyDataMap[c.id].revenue - companyDataMap[c.id].salaries - companyDataMap[c.id].overheads);
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
                    
                    const pay = getStaffPayrollForMonth(s, mKey);
                    if (mKey > '2026-06') {
                      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                      let targetNominal = policy?.nominalCode;
                      if (!targetNominal && policy) {
                        if (policy.type === 'freelance') {
                          const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                          targetNominal = contractorNominal || '1001 - Freelancer Payments';
                        } else {
                          const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                          targetNominal = salaryNominal || '1002 - Salary';
                        }
                      }

                      if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
                        if (s.companyId && s.companyId !== 'comp-1782789370085') {
                          if (deptDataMap[s.department] && activeCompanyIds.includes(s.companyId)) {
                            deptDataMap[s.department].salaries += pay.salaries;
                            deptDataMap[s.department].commissions += pay.commissions;
                          }
                        } else {
                          const activeStaffInMonth = staff.filter(st => {
                            const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                            return daysWorked >= 10;
                          });
                          const targetCompanyIds = (s.allocatedCompanyIds && s.allocatedCompanyIds.length > 0) ? s.allocatedCompanyIds : null;
                          const otherStaff = activeStaffInMonth.filter(os => {
                            const comp = companies.find(c => c.id === os.companyId);
                            const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== s.companyId;
                            return comp && comp.includeInConsolidation !== false && compMatch;
                          });

                          if (otherStaff.length > 0) {
                            const perStaffShareSal = pay.salaries / otherStaff.length;
                            const perStaffShareComm = pay.commissions / otherStaff.length;
                            otherStaff.forEach(os => {
                              if (deptDataMap[os.department] && activeCompanyIds.includes(os.companyId)) {
                                deptDataMap[os.department].salaries += perStaffShareSal;
                                deptDataMap[os.department].commissions += perStaffShareComm;
                              }
                            });
                          } else {
                            if (deptDataMap[s.department] && activeCompanyIds.includes(s.companyId)) {
                              deptDataMap[s.department].salaries += pay.salaries;
                              deptDataMap[s.department].commissions += pay.commissions;
                            }
                          }
                        }
                      } else {
                        if (deptDataMap[s.department]) {
                          deptDataMap[s.department].salaries += pay.salaries;
                          deptDataMap[s.department].commissions += pay.commissions;
                        }
                      }
                    }
                  });

                  // Overheads apportionment
                  const activeStaffInMonth = staff.filter(st => {
                    const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                    return daysWorked >= 10;
                  });
                  const activeStaffInMonthIds = activeStaffInMonth.map(st => st.id);
                  const monthExpenses = expenses.filter(e => e.plMonth === mKey && !isNominalExcluded(e.nominalCode) && !isExpenseSupersededByPayroll(e));

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
                        const dProfit = deptDataMap[d].revenue - deptDataMap[d].salaries - deptDataMap[d].overheads;
                        return (
                          <td key={d} style={{ textAlign: 'right', color: dProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatGBP(dProfit)}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', color: 'var(--success)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        {formatGBP(depts.reduce((sum, d) => {
                          return sum + (deptDataMap[d].revenue - deptDataMap[d].salaries - deptDataMap[d].overheads);
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
          TAB 5: SALARY-TO-BILLINGS RATIO
          ============================================================== */}
      {activeTab === 'ratios' && (
        <div className="table-container">
          <table className="entity-table dense">
            <thead>
              <tr>
                <th onClick={() => handleRatiosHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Recruiter Name{renderRatiosSortIndicator('fullName')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('deptCompany')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Department / Company{renderRatiosSortIndicator('deptCompany')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('tenureInMonths')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}>
                  Tenure (Months){renderRatiosSortIndicator('tenureInMonths')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('wagesPaid')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Wages Paid (GBP){renderRatiosSortIndicator('wagesPaid')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('commissionsPaid')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Commissions Paid (GBP){renderRatiosSortIndicator('commissionsPaid')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('totalPaid')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', fontWeight: 600 }}>
                  Total Compensation (GBP){renderRatiosSortIndicator('totalPaid')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('periodBillings')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Revenue Generated (GBP){renderRatiosSortIndicator('periodBillings')}
                </th>
                <th onClick={() => handleRatiosHeaderClick('ratio')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', fontWeight: 700 }}>
                  Cost-to-Revenue Ratio{renderRatiosSortIndicator('ratio')}
                </th>
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

                if (recruitersList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                        No recruiters found matching the filtered company or department.
                      </td>
                    </tr>
                  );
                }

                const recruitersData = recruitersList.map(rec => {
                  const employer = companies.find(c => c.id === rec.companyId);
                  const deptCompany = `${rec.department || 'General'} • ${employer ? employer.name : 'Group'}`;
                  
                  const currentMonthKey = new Date().toISOString().substring(0, 7);

                  // Tenure in months calculation
                  const tenureInMonths = (() => {
                    if (!rec.startDate) return 0;
                    const start = new Date(rec.startDate);
                    if (isNaN(start.getTime())) return 0;
                    const end = rec.exitDate ? new Date(rec.exitDate) : new Date();
                    if (isNaN(end.getTime())) return 0;
                    const yearsDiff = end.getFullYear() - start.getFullYear();
                    const monthsDiff = end.getMonth() - start.getMonth();
                    return Math.max(0, yearsDiff * 12 + monthsDiff);
                  })();

                  // Period Billings (within selected start and end months range, up to current month)
                  const periodPlacements = placements.filter(p => {
                    if (!p.startDate || p.status === 'dns') return false;
                    const startMonthKey = p.startDate.substring(0, 7);
                    if (startMonthKey < startMonth || startMonthKey > endMonth || startMonthKey > currentMonthKey) return false;
                    return p.splits?.some(s => s.staffId === rec.id);
                  });

                  const periodBillings = periodPlacements.reduce((sum, p) => {
                    const splitObj = p.splits.find(s => s.staffId === rec.id);
                    const share = splitObj ? (Number(p.netScoreValue) * splitObj.percentage) / 100 : 0;
                    return sum + toGBP(share, 'GBP');
                  }, 0);

                  // Calculate actual wages & commissions paid during selected period (up to current month)
                  let wagesPaid = 0;
                  let commissionsPaid = 0;
                  const activeMonthsList = monthsList.filter(m => m <= currentMonthKey);
                  activeMonthsList.forEach(m => {
                    const pay = getStaffPayrollForMonth(rec, m);
                    
                    // Apportionment check matching P&L
                    const policy = payrollPolicies.find(p => p.id === rec.payrollPolicyId);
                    let targetNominal = policy?.nominalCode;
                    if (!targetNominal && policy) {
                      if (policy.type === 'freelance') {
                        const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                        targetNominal = contractorNominal || '1001 - Freelancer Payments';
                      } else {
                        const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                        targetNominal = salaryNominal || '1002 - Salary';
                      }
                    }

                    if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
                      const groupActiveStaff = staff.filter(st => {
                        const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, m);
                        return daysWorked >= 10;
                      });
                      const otherStaff = groupActiveStaff.filter(os => {
                        const comp = companies.find(c => c.id === os.companyId);
                        return comp && comp.includeInConsolidation !== false && os.companyId !== rec.companyId;
                      });

                      if (otherStaff.length > 0) {
                        let activeOtherStaffCount = 0;
                        otherStaff.forEach(os => {
                          const isComp = activeCompanyIds.includes(os.companyId);
                          const isDept = deptFilter.includes('all') || deptFilter.includes(os.department);
                          if (isComp && isDept) {
                            activeOtherStaffCount++;
                          }
                        });
                        const shareFactor = activeOtherStaffCount / otherStaff.length;
                        wagesPaid += pay.salaries * shareFactor;
                        commissionsPaid += pay.commissions * shareFactor;
                      } else {
                        const isComp = activeCompanyIds.includes(rec.companyId);
                        const isDept = deptFilter.includes('all') || deptFilter.includes(rec.department);
                        if (isComp && isDept) {
                          wagesPaid += pay.salaries;
                          commissionsPaid += pay.commissions;
                        }
                      }
                    } else {
                      // Standard direct routing
                      const isComp = activeCompanyIds.includes(rec.companyId);
                      const isDept = deptFilter.includes('all') || deptFilter.includes(rec.department);
                      if (isComp && isDept) {
                        wagesPaid += pay.salaries;
                        commissionsPaid += pay.commissions;
                      }
                    }
                  });

                  const totalPaid = wagesPaid + commissionsPaid;
                  const ratio = periodBillings > 0 ? (totalPaid / periodBillings) * 100 : 0;

                  return {
                    rec,
                    fullName: rec.fullName || '',
                    deptCompany,
                    tenureInMonths,
                    wagesPaid,
                    commissionsPaid,
                    totalPaid,
                    periodBillings,
                    ratio,
                    status: rec.status
                  };
                });

                // Sort the recruiters data based on the selected field & direction
                const sortedRecData = [...recruitersData].sort((a, b) => {
                  let valA = a[ratiosSortField];
                  let valB = b[ratiosSortField];

                  if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                  }

                  if (valA < valB) return ratiosSortDirection === 'asc' ? -1 : 1;
                  if (valA > valB) return ratiosSortDirection === 'asc' ? 1 : -1;
                  return 0;
                });

                const activeRecs = sortedRecData.filter(item => item.status !== 'exited');
                const exitedRecs = sortedRecData.filter(item => item.status === 'exited');

                const renderRecRow = (item) => {
                  const { rec, fullName, deptCompany, tenureInMonths, wagesPaid, commissionsPaid, totalPaid, periodBillings, ratio } = item;

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
                        {fullName} {rec.status === 'exited' && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>(Exited)</span>}
                      </td>
                      <td>{deptCompany}</td>
                      <td 
                        style={{ textAlign: 'center', fontFamily: 'monospace', cursor: 'pointer', textDecoration: 'underline decoration-dotted' }}
                        onClick={() => setDrilldownState({
                          title: `Hiring & Tenure Details: ${fullName}`,
                          label: `Hiring Details for ${fullName}`,
                          categoryKey: 'recruiterTenure',
                          recruiterId: rec.id,
                          amount: tenureInMonths
                        })}
                        title={`Click to view hiring date for ${fullName}`}
                      >
                        {tenureInMonths} mos
                      </td>
                      <td 
                        style={{ textAlign: 'right', fontFamily: 'monospace', cursor: wagesPaid > 0 ? 'pointer' : 'default', textDecoration: wagesPaid > 0 ? 'underline decoration-dotted' : 'none' }}
                        onClick={() => wagesPaid > 0 && setDrilldownState({
                          title: `Monthly Wages Paid: ${fullName}`,
                          label: `Base Wages details for ${fullName}`,
                          categoryKey: 'recruiterWages',
                          recruiterId: rec.id,
                          amount: wagesPaid
                        })}
                        title={wagesPaid > 0 ? `Click to view wages breakdown for ${fullName}` : undefined}
                      >
                        {formatGBP(wagesPaid)}
                      </td>
                      <td 
                        style={{ textAlign: 'right', fontFamily: 'monospace', cursor: commissionsPaid > 0 ? 'pointer' : 'default', textDecoration: commissionsPaid > 0 ? 'underline decoration-dotted' : 'none' }}
                        onClick={() => commissionsPaid > 0 && setDrilldownState({
                          title: `Monthly Commissions Paid: ${fullName}`,
                          label: `Commissions details for ${fullName}`,
                          categoryKey: 'recruiterCommissions',
                          recruiterId: rec.id,
                          amount: commissionsPaid
                        })}
                        title={commissionsPaid > 0 ? `Click to view commissions breakdown for ${fullName}` : undefined}
                      >
                        {formatGBP(commissionsPaid)}
                      </td>
                      <td 
                        style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, cursor: totalPaid > 0 ? 'pointer' : 'default', textDecoration: totalPaid > 0 ? 'underline decoration-dotted' : 'none' }}
                        onClick={() => totalPaid > 0 && setDrilldownState({
                          title: `Total Compensation Breakdown: ${fullName}`,
                          label: `Wages & Commissions details for ${fullName}`,
                          categoryKey: 'recruiterTotalCompensation',
                          recruiterId: rec.id,
                          amount: totalPaid
                        })}
                        title={totalPaid > 0 ? `Click to view total compensation breakdown for ${fullName}` : undefined}
                      >
                        {formatGBP(totalPaid)}
                      </td>
                      <td 
                        style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--success)', cursor: periodBillings > 0 ? 'pointer' : 'default', textDecoration: periodBillings > 0 ? 'underline decoration-dotted' : 'none' }}
                        onClick={() => periodBillings > 0 && setDrilldownState({
                          title: `Revenue Generated (Billings Share): ${fullName}`,
                          label: `Fee billings placements share for ${fullName}`,
                          categoryKey: 'recruiterRevenue',
                          recruiterId: rec.id,
                          amount: periodBillings
                        })}
                        title={periodBillings > 0 ? `Click to view placements revenue share for ${fullName}` : undefined}
                      >
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
                          <td colSpan="9" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
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
      {activeTab === 'leagues' && (
        <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Recruiter Leagues Leaderboard</h3>
          <table className="entity-table dense">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th onClick={() => handleLeaguesHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Recruiter Name{renderLeaguesSortIndicator('fullName')}
                </th>
                <th onClick={() => handleLeaguesHeaderClick('totalVal')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Total Billings (GBP){renderLeaguesSortIndicator('totalVal')}
                </th>
                <th onClick={() => handleLeaguesHeaderClick('count')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  Placements Count{renderLeaguesSortIndicator('count')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const recruitersLeagueList = staff.map(rec => {
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

                  const splitWeightedCount = recPlacements.reduce((sum, p) => {
                    const split = p.splits.find(s => s.staffId === rec.id);
                    const percentage = split ? (Number(split.percentage) || 0) : 0;
                    return sum + (percentage / 100);
                  }, 0);

                  return {
                    rec,
                    fullName: rec.fullName || '',
                    totalVal,
                    count: splitWeightedCount,
                    rawPlacements: recPlacements,
                    status: rec.status
                  };
                })
                .filter(Boolean)
                .filter(item => item.totalVal > 0 || item.count > 0);

                if (recruitersLeagueList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                        No billings or placements recorded matching active filters.
                      </td>
                    </tr>
                  );
                }

                // Sort list by leaguesSortField and leaguesSortDirection
                const sortedLeagues = [...recruitersLeagueList].sort((a, b) => {
                  let valA = a[leaguesSortField];
                  let valB = b[leaguesSortField];

                  if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                  }

                  if (valA < valB) return leaguesSortDirection === 'asc' ? -1 : 1;
                  if (valA > valB) return leaguesSortDirection === 'asc' ? 1 : -1;
                  return 0;
                });

                const activeRank = sortedLeagues.filter(item => item.status !== 'exited');
                const exitedRank = sortedLeagues.filter(item => item.status === 'exited');

                return (
                  <>
                    {activeRank.map((item, idx) => (
                      <tr key={item.rec.id}>
                        <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.fullName}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
                          {formatGBP(item.totalVal)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => setSelectedRecruiterPlacements({
                              recruiterName: item.fullName,
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
                          onClick={() => setExpandedExitedLeaguesLeaguesBillings(!expandedExitedLeaguesLeaguesBillings)}
                          style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <td colSpan="4" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ marginRight: '6px' }}>{expandedExitedLeaguesBillings ? '▼' : '▶'}</span>
                            Exited Staff ({exitedRank.length})
                          </td>
                        </tr>
                        {expandedExitedLeaguesBillings && exitedRank.map((item) => (
                          <tr key={item.rec.id} style={{ opacity: 0.75 }}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>—</td>
                            <td>{item.fullName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Exited)</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
                              {formatGBP(item.totalVal)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button 
                                onClick={() => setSelectedRecruiterPlacements({
                                  recruiterName: item.fullName,
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

              const nominalBreakdown = getNominalBreakdownForMonth(m, indiaCompanyId);
              const overheadsExpenses = Object.entries(nominalBreakdown)
                .filter(([code, v]) => !code.startsWith('__') && typeof v === 'number' && !isNaN(v) && !isNominalExcluded(code))
                .reduce((sum, [, v]) => sum + v, 0);

              const grossProfit = revenue;
              const totalOverheads = overheadsExpenses;
              const netProfit = revenue - totalOverheads;

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
                  Object.entries(nominalBreakdown)
                    .filter(([k, v]) => !k.startsWith('__') && typeof v === 'number' && !isNaN(v))
                    .map(([k, v]) => [k, toINR(v)])
                ),
                headcount: activeStaff.length
              };
            });

            const renderIndiaRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
              const ytdSum = rowData.reduce((acc, row) => acc + (row[key] || 0), 0);
              const ytvSum = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, row) => acc + (row[key] || 0), 0);
              return (
                <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                  <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                  {rowData.map((row, idx) => (
                    <td key={idx} style={{ textAlign: 'right', color }}>
                      {formatINR(row[key] || 0)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 600, color, backgroundColor: 'rgba(99, 102, 241, 0.04)', borderLeft: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    {formatINR(ytvSum)}
                  </td>
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
                      <th style={{ 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        color: 'var(--primary)',
                        borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
                        whiteSpace: 'nowrap'
                      }} title={`Year-To-Date Bank Actuals (Reconciled through ${reconciledCutoffDate})`}>
                        YTV
                      </th>
                      <th style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.04)' }}>Period Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Revenue Credits (INR)</td>
                      <td colSpan={monthsList.length + 2} />
                    </tr>
                    {renderIndiaRow('Net Placements Fee Billings', 'revenue', false, true, 'var(--success)')}
                    
                    <tr style={{ borderBottom: '1px dashed var(--border-color)', height: '8px' }} />

                    <tr style={{ fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Overheads & Staff Expenses (INR)</td>
                      <td colSpan={monthsList.length + 2} />
                    </tr>
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
                      {(() => {
                        const ytvNetProfit = rowData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + r.netProfit, 0);
                        return (
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 700, 
                            color: ytvNetProfit >= 0 ? 'var(--success)' : 'var(--danger)', 
                            backgroundColor: 'rgba(99, 102, 241, 0.04)',
                            borderLeft: '1px solid rgba(99, 102, 241, 0.15)' 
                          }}>
                            {formatINR(ytvNetProfit)}
                          </td>
                        );
                      })()}
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
                      <td style={{ textAlign: 'right', backgroundColor: 'rgba(99, 102, 241, 0.04)', borderLeft: '1px solid rgba(99, 102, 241, 0.15)' }}>—</td>
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

            const monthExpenses = expenses.filter(e => e.plMonth === targetMonth && !isNominalExcluded(e.nominalCode) && !isExpenseSupersededByPayroll(e));
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
          return activeCompanyIds.includes(companyId);
        };

        const isDeptMatch = (deptName) => {
          if (deptFilter.includes('all')) return true;
          return deptFilter.includes(deptName);
        };

        const getDrilldownItems = () => {
          const { categoryKey, monthKey, nominalCode } = drilldownState;
          if (!categoryKey) return [];

          if (categoryKey === 'recruiterTenure') {
            const { recruiterId } = drilldownState;
            const sObj = staff.find(s => s.id === recruiterId);
            if (!sObj) return [];
            return [{
              fullName: sObj.fullName,
              startDate: sObj.startDate || 'Not set',
              exitDate: sObj.exitDate || 'Active in business',
              status: sObj.status,
              department: sObj.department,
              companyName: companies.find(c => c.id === sObj.companyId)?.name || 'Unknown Company'
            }];
          }

          if (categoryKey === 'recruiterWages' || categoryKey === 'recruiterTotalCompensation') {
            const { recruiterId } = drilldownState;
            const sObj = staff.find(s => s.id === recruiterId);
            if (!sObj) return [];

            const results = [];
            const activeMonthsList = monthsList.filter(m => m <= new Date().toISOString().substring(0, 7));
            activeMonthsList.forEach(m => {
              const pay = getStaffPayrollForMonth(sObj, m);
              
              const policy = payrollPolicies.find(p => p.id === sObj.payrollPolicyId);
              let targetNominal = policy?.nominalCode;
              if (!targetNominal && policy) {
                if (policy.type === 'freelance') {
                  const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                  targetNominal = contractorNominal || '1001 - Freelancer Payments';
                } else {
                  const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                  targetNominal = salaryNominal || '1002 - Salary';
                }
              }

              let shareFactor = 1.0;
              let isShared = false;

              if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
                const groupActiveStaff = staff.filter(st => {
                  const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, m);
                  return daysWorked >= 10;
                });
                const targetCompanyIds = (sObj.allocatedCompanyIds && sObj.allocatedCompanyIds.length > 0) ? sObj.allocatedCompanyIds : null;
                const otherStaff = groupActiveStaff.filter(os => {
                  const comp = companies.find(c => c.id === os.companyId);
                  const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== sObj.companyId;
                  return comp && comp.includeInConsolidation !== false && compMatch;
                });

                if (otherStaff.length > 0) {
                  let activeOtherStaffCount = 0;
                  otherStaff.forEach(os => {
                    const isComp = activeCompanyIds.includes(os.companyId);
                    const isDept = deptFilter.includes('all') || deptFilter.includes(os.department);
                    if (isComp && isDept) {
                      activeOtherStaffCount++;
                    }
                  });
                  shareFactor = activeOtherStaffCount / otherStaff.length;
                  isShared = true;
                }
              }

              const wagesPaid = pay.salaries * shareFactor;
              const commissionsPaid = pay.commissions * shareFactor;

              if (wagesPaid > 0 || commissionsPaid > 0) {
                results.push({
                  month: m,
                  baseSalary: pay.salaries,
                  shareFactor,
                  isShared,
                  wagesPaid,
                  commissionsPaid,
                  totalPaid: wagesPaid + commissionsPaid
                });
              }
            });
            return results;
          }

          if (categoryKey === 'recruiterCommissions') {
            const { recruiterId } = drilldownState;
            const sObj = staff.find(s => s.id === recruiterId);
            if (!sObj) return [];

            const results = [];
            const activeMonthsList = monthsList.filter(m => m <= new Date().toISOString().substring(0, 7));
            activeMonthsList.forEach(m => {
              const pay = getStaffPayrollForMonth(sObj, m);
              
              const policy = payrollPolicies.find(p => p.id === sObj.payrollPolicyId);
              let targetNominal = policy?.nominalCode;
              if (!targetNominal && policy) {
                if (policy.type === 'freelance') {
                  const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                  targetNominal = contractorNominal || '1001 - Freelancer Payments';
                } else {
                  const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                  targetNominal = salaryNominal || '1002 - Salary';
                }
              }

              let shareFactor = 1.0;
              let isShared = false;

              if (targetNominal && (targetNominal.startsWith('1004') || targetNominal.toLowerCase().includes('shared'))) {
                const groupActiveStaff = staff.filter(st => {
                  const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, m);
                  return daysWorked >= 10;
                });
                const targetCompanyIds = (sObj.allocatedCompanyIds && sObj.allocatedCompanyIds.length > 0) ? sObj.allocatedCompanyIds : null;
                const otherStaff = groupActiveStaff.filter(os => {
                  const comp = companies.find(c => c.id === os.companyId);
                  const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== sObj.companyId;
                  return comp && comp.includeInConsolidation !== false && compMatch;
                });

                if (otherStaff.length > 0) {
                  let activeOtherStaffCount = 0;
                  otherStaff.forEach(os => {
                    const isComp = activeCompanyIds.includes(os.companyId);
                    const isDept = deptFilter.includes('all') || deptFilter.includes(os.department);
                    if (isComp && isDept) {
                      activeOtherStaffCount++;
                    }
                  });
                  shareFactor = activeOtherStaffCount / otherStaff.length;
                  isShared = true;
                }
              }

              const commissionsPaid = pay.commissions * shareFactor;

              if (commissionsPaid > 0) {
                results.push({
                  month: m,
                  rawCommissions: pay.commissions,
                  shareFactor,
                  isShared,
                  commissionsPaid
                });
              }
            });
            return results;
          }

          if (categoryKey === 'recruiterRevenue') {
            const { recruiterId } = drilldownState;
            const currentMonthKey = new Date().toISOString().substring(0, 7);

            return (placements || []).filter(p => {
              if (!p.startDate || p.status === 'dns') return false;
              const startMonthKey = p.startDate.substring(0, 7);
              if (startMonthKey < startMonth || startMonthKey > endMonth || startMonthKey > currentMonthKey) return false;
              return p.splits?.some(s => s.staffId === recruiterId);
            }).map(p => {
              const splitObj = p.splits.find(s => s.staffId === recruiterId);
              const pct = splitObj ? splitObj.percentage : 100;
              const netFee = toGBP(p.netScoreValue, 'GBP');
              const recruiterShare = (netFee * pct) / 100;
              return {
                id: p.id,
                placementId: p.placementId || p.pId || p.id,
                candidateName: p.candidateName,
                clientName: p.clientName,
                jobTitle: p.jobTitle,
                startDate: p.startDate,
                percentage: pct,
                netScoreValue: netFee,
                amount: recruiterShare
              };
            });
          }

          if (categoryKey === 'revenue') {
            return (placements || []).filter(p => {
              if (!p.startDate || p.status === 'dns') return false;
              const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
                const d = new Date(p.startDate);
                d.setMonth(d.getMonth() + 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })();
              if (monthKey === 'ytv') {
                if (pMonth > reconciledCutoffMonth) return false;
              } else if (monthKey && pMonth !== monthKey) {
                return false;
              }

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
              const mList = monthKey === 'ytv' 
                ? monthsList.filter(m => m <= reconciledCutoffMonth) 
                : (monthKey ? [monthKey] : monthsList);
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
            const staffPrefixes = ['1001', '1002', '1003', '1004'];
            const mList = monthKey === 'ytv' 
              ? monthsList.filter(m => m <= reconciledCutoffMonth) 
              : (monthKey ? [monthKey] : monthsList);
            
            mList.forEach(m => {
              if (m <= reconciledCutoffMonth) {
                const actualItems = (expenses || []).filter(e => {
                  if (e.status === 'dns' || e.status === 'cancelled') return false;
                  const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
                  if (eMonth !== m) return false;
                  const cleanCode = e.nominalCode?.split(' - ')[0]?.trim() || '';
                  const isStaff = staffPrefixes.includes(cleanCode);
                  if (!isStaff) return false;
                  
                  if (e.allocationType === 'staff' || e.recipientType === 'staff') {
                    const targetStaffIds = Array.isArray(e.allocationTarget) ? e.allocationTarget : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                    const matchedStaff = staff.filter(s => targetStaffIds.includes(s.id));
                    const hasDeptMatch = matchedStaff.some(s => isDeptMatch(s.department));
                    const hasCompMatch = matchedStaff.some(s => isCompanyMatch(s.companyId));
                    if (!hasDeptMatch || !hasCompMatch) return false;
                  }
                  return true;
                });
                
                actualItems.forEach(e => {
                  results.push({
                    staffName: e.payee || 'Salary transaction',
                    jobTitle: e.nominalCode || 'Imported Expense',
                    department: 'General',
                    companyName: 'Group',
                    monthKey: m,
                    amount: e.amount
                  });
                });
              } else {
                const groupActiveStaff = staff.filter(st => {
                  const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, m);
                  return daysWorked >= 10;
                });
                groupActiveStaff.forEach(s => {
                  const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                  if (!policy) return;
                  
                  let staffCost = 0;
                  const comm = calculateCommissionForRecruiter(s.id, m);
                  if (policy.type === 'freelance') {
                    const totalBusinessDays = getBusinessDaysInMonth(m, s);
                    
                    const year = m.substring(0, 4);
                    const yearLeaves = leaveRequests.filter(req => 
                      req.staffId === s.id && 
                      req.status === 'approved' && 
                      req.startDate && 
                      req.startDate.substring(0, 4) === year
                    );
                    const sortedLeaves = [...yearLeaves].sort((a, b) => a.startDate.localeCompare(b.startDate));
                    const lp = leavePolicies.find(p => p.id === s.leavePolicyId);
                    
                    let annualAllowed = 20;
                    if (lp) {
                      if (lp.name?.toLowerCase().includes('global recruiters')) {
                        if (s.startDate) {
                          const start = new Date(s.startDate);
                          if (!isNaN(start.getTime())) {
                            const today = new Date();
                            let years = today.getFullYear() - start.getFullYear();
                            const mNum = today.getMonth() - start.getMonth();
                            if (mNum < 0 || (mNum === 0 && today.getDate() < start.getDate())) {
                              years--;
                            }
                            const calculated = 20 + Math.max(0, years);
                            annualAllowed = Math.min(25, calculated);
                          }
                        }
                      } else {
                        annualAllowed = lp.annualAllowance || 20;
                      }
                    }
                    const sickAllowed = lp ? (lp.sickAllowance ?? 10) : 10;

                    let annualUsed = 0;
                    let sickUsed = 0;
                    let unpaidDaysInTargetMonth = 0;

                    sortedLeaves.forEach(req => {
                      const reqMonth = req.startDate.substring(0, 7);
                      const reqDays = Number(req.totalDays) || 0;
                      let unpaidDaysForThisRequest = 0;

                      if (req.leaveType === 'unpaid') {
                        unpaidDaysForThisRequest = reqDays;
                      } else if (req.leaveType === 'annual') {
                        const newTotal = annualUsed + reqDays;
                        if (newTotal > annualAllowed) {
                          const unpaidPart = Math.max(0, newTotal - annualAllowed);
                          unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                          annualUsed = annualAllowed;
                        } else {
                          annualUsed = newTotal;
                        }
                      } else if (req.leaveType === 'sick') {
                        const newTotal = sickUsed + reqDays;
                        if (newTotal > sickAllowed) {
                          const unpaidPart = Math.max(0, newTotal - sickAllowed);
                          unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                          sickUsed = sickAllowed;
                        } else {
                          sickUsed = newTotal;
                        }
                      }

                      if (reqMonth === m) {
                        unpaidDaysInTargetMonth += unpaidDaysForThisRequest;
                      }
                    });

                    const attendanceDays = Math.max(0, totalBusinessDays - unpaidDaysInTargetMonth);

                    let dailyRate = 0;
                    if (s.salary && Number(s.salary) > 0) {
                      dailyRate = (Number(s.salary) / 12) / totalBusinessDays;
                    } else if (s.attendanceRate && Number(s.attendanceRate) > 0) {
                      dailyRate = Number(s.attendanceRate);
                    } else {
                      dailyRate = Number(policy.dailyRateDefault || 0);
                    }

                    let val = toGBP(dailyRate * attendanceDays, s.currency || 'GBP');
                    if (s.startDate && s.startDate.substring(0, 7) === m) {
                      const [y, mNum, d] = s.startDate.split('-').map(Number);
                      const daysInMonth = new Date(y, mNum, 0).getDate();
                      const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                      val = val * proration;
                    }
                    staffCost = val + comm;
                  } else {
                    let basicGBP = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
                    let proration = 1.0;
                    if (s.startDate && s.startDate.substring(0, 7) === m) {
                      const [y, mNum, d] = s.startDate.split('-').map(Number);
                      const daysInMonth = new Date(y, mNum, 0).getDate();
                      proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                      basicGBP = basicGBP * proration;
                    }
                    staffCost = basicGBP + comm;
                  }

                  let routedNominal = policy.nominalCode;
                  if (!routedNominal) {
                    if (policy.type === 'freelance') {
                      const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                      routedNominal = contractorNominal || '1001 - Freelancer Payments';
                    } else {
                      const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                      routedNominal = salaryNominal || '1002 - Salary';
                    }
                  }

                  const isStaff = staffPrefixes.some(pref => routedNominal.startsWith(pref));
                  if (isStaff && staffCost > 0) {
                    const isComp = isCompanyMatch(s.companyId);
                    const isDept = isDeptMatch(s.department);
                    if (isComp && isDept) {
                      results.push({
                        staffName: comm > 0 ? `${s.fullName} (${policy.type === 'freelance' ? 'Freelancer' : 'Salary'} + £${Math.round(comm).toLocaleString()} Comm)` : s.fullName,
                        jobTitle: routedNominal,
                        department: s.department,
                        companyName: companies.find(c => c.id === s.companyId)?.name || 'Group',
                        monthKey: m,
                        amount: staffCost
                      });
                    }
                  }
                });
              }
            });
            return results;
          }

          if (categoryKey === 'staffCount') {
            const results = [];
            const mList = monthKey === 'ytv' 
              ? monthsList.filter(m => m <= reconciledCutoffMonth) 
              : (monthKey ? [monthKey] : monthsList);
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

          if (categoryKey === 'balanceSheet') {
            const actualItems = (expenses || []).filter(e => {
              if (e.status === 'dns' || e.status === 'cancelled') return false;
              if (!e.nominalCode?.trim().startsWith('9')) return false;
              const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
              if (monthKey === 'ytv') {
                if (eMonth > reconciledCutoffMonth) return false;
                if (e.date && e.date.length >= 10 && e.date > reconciledCutoffDate) return false;
              } else if (monthKey && eMonth !== monthKey) {
                return false;
              }
              if (nominalCode) {
                const cleanN1 = nominalCode.split(' - ')[0]?.trim() || nominalCode;
                const cleanN2 = e.nominalCode?.split(' - ')[0]?.trim() || e.nominalCode || '';
                const matchExact = e.nominalCode === nominalCode;
                const matchId = cleanN1 === cleanN2;
                const matchPrefix = e.nominalCode?.startsWith(nominalCode) || nominalCode.startsWith(e.nominalCode);
                if (!matchExact && !matchId && !matchPrefix) return false;
              }

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
            return actualItems;
          }

          if (categoryKey === 'overheadsExpenses' || categoryKey === 'nominal' || categoryKey === 'totalOverheads') {
            const actualItems = (expenses || []).filter(e => {
              if (e.status === 'dns' || e.status === 'cancelled') return false;
              if (e.amortize === true) return false;
              if (e.nominalCode?.trim().startsWith('9')) return false;
              if ((categoryKey === 'overheadsExpenses' || categoryKey === 'totalOverheads') && isNominalExcluded(e.nominalCode)) return false;
              if (isExpenseSupersededByPayroll(e)) return false;
              const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
              if (monthKey === 'ytv') {
                if (eMonth > reconciledCutoffMonth) return false;
                if (e.date && e.date.length >= 10 && e.date > reconciledCutoffDate) return false;
              } else if (monthKey && eMonth !== monthKey) {
                return false;
              }
              if (nominalCode) {
                const cleanN1 = nominalCode.split(' - ')[0]?.trim() || nominalCode;
                const cleanN2 = e.nominalCode?.split(' - ')[0]?.trim() || e.nominalCode || '';
                const matchExact = e.nominalCode === nominalCode;
                const matchId = cleanN1 === cleanN2;
                const matchPrefix = e.nominalCode?.startsWith(nominalCode) || nominalCode.startsWith(e.nominalCode);
                if (!matchExact && !matchId && !matchPrefix) return false;
              }

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

            const amortizedShares = [];
            const amortizedExpensesList = (expenses || []).filter(e => e.amortize === true);
            
            const targetAmortizeMonths = monthKey === 'ytv' 
              ? monthsList.filter(m => m <= reconciledCutoffMonth) 
              : (monthKey ? [monthKey] : monthsList);
            
            targetAmortizeMonths.forEach(mKey => {
              amortizedExpensesList.forEach(e => {
                if (e.status === 'dns' || e.status === 'cancelled') return;
                const startM = (e.amortizeStartMonth && /^\d{4}-\d{2}$/.test(e.amortizeStartMonth.trim())) 
                   ? e.amortizeStartMonth.trim() 
                   : (e.plMonth || (e.date ? e.date.substring(0, 7) : ''));
                if (!startM) return;
                const N = Number(e.amortizeMonths || 36);
                
                const [y1, mo1] = mKey.split('-').map(Number);
                const [y2, mo2] = startM.split('-').map(Number);
                const diff = (y1 - y2) * 12 + (mo1 - mo2);
                
                if (diff >= 0 && diff < N) {
                  const targetCode = e.amortizeNominalCode || e.nominalCode;
                  if ((categoryKey === 'overheadsExpenses' || categoryKey === 'totalOverheads') && isNominalExcluded(targetCode)) return;
                  if (nominalCode) {
                    const cleanN1 = nominalCode.split(' - ')[0]?.trim() || nominalCode;
                    const cleanN2 = targetCode?.split(' - ')[0]?.trim() || targetCode || '';
                    const matchExact = targetCode === nominalCode;
                    const matchId = cleanN1 === cleanN2;
                    const matchPrefix = targetCode?.startsWith(nominalCode) || nominalCode.startsWith(targetCode);
                    if (!matchExact && !matchId && !matchPrefix) return;
                  }

                  // Check allocation matches
                  let matchesFilter = true;
                  if (e.allocationType === 'staff' || e.recipientType === 'staff') {
                    const targetStaffIds = Array.isArray(e.allocationTarget) ? e.allocationTarget : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                    const matchedStaff = staff.filter(s => targetStaffIds.includes(s.id));
                    const hasDeptMatch = matchedStaff.some(s => isDeptMatch(s.department));
                    const hasCompMatch = matchedStaff.some(s => isCompanyMatch(s.companyId));
                    if (!hasDeptMatch || !hasCompMatch) matchesFilter = false;
                  } else if (e.allocationType === 'department') {
                    const targetDepts = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
                    if (!deptFilter.includes('all') && !targetDepts.some(d => deptFilter.includes(d))) matchesFilter = false;
                  } else if (e.allocationType === 'company') {
                    const targetComps = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
                    if (!companyFilter.includes('all') && !targetComps.some(c => companyFilter.includes(c))) matchesFilter = false;

                    if (!deptFilter.includes('all')) {
                      const hasDeptStaff = staff.some(s => targetComps.includes(s.companyId) && deptFilter.includes(s.department));
                      if (!hasDeptStaff) matchesFilter = false;
                    }
                  }

                  if (matchesFilter) {
                    const shareAmount = (Number(e.amount) || 0) / N;
                    amortizedShares.push({
                      id: `virtual-amort-${e.id}-${mKey}`,
                      date: `${mKey}-01`,
                      plMonth: mKey,
                      payee: `Amortization (${diff + 1}/${N}): ${e.payee}`,
                      nominalCode: targetCode,
                      amount: shareAmount,
                      currency: e.currency || 'GBP',
                      isAmortizedShare: true
                    });
                  }
                }
              });
            });

            const finalItems = [...actualItems, ...amortizedShares];

            // Unbilled Projection Items for 7001, 7002, 7003, 7004 & future nominal cells
            const projectedItems = [];
            const targetMonths = monthKey === 'ytv' 
              ? [] 
              : (monthKey ? [monthKey] : monthsList);

            targetMonths.forEach(mKey => {
              const isReconciledMonth = mKey <= reconciledCutoffMonth;
              
              const monthActualExpenses = (expenses || []).filter(e => {
                if (e.status === 'dns' || e.status === 'cancelled') return false;
                if (e.amortize === true) return false;
                if (e.nominalCode?.trim().startsWith('9')) return false;
                const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
                return eMonth === mKey;
              });

              const groupActiveStaff = staff.filter(st => {
                const daysWorked = getDaysWorkedInMonth(st.startDate, st.exitDate, mKey);
                return daysWorked >= 10;
              });
              // 1. Vendor Contracts Projections (7001, 7002 or explicit nominalCode)
              contracts.forEach(contract => {
                if (!contract.startDate || !contract.endDate) return;
                const startM = contract.startDate.substring(0, 7);
                const endM = contract.endDate.substring(0, 7);

                const matchedVendor = vendors.find(v => v.id === contract.vendorId || (v.name && contract.vendorName && v.name.toLowerCase() === contract.vendorName.toLowerCase()));
                const vendorContracts = contracts.filter(con => con.vendorId === contract.vendorId || (matchedVendor && con.vendorId === matchedVendor.id));
                const vendorContractsIds = vendorContracts.map(vc => vc.id);

                const vendorHasReconciledInMonth = (expenses || []).some(e => {
                  if (e.status === 'dns' || e.status === 'cancelled') return false;
                  const expMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
                  if (expMonth !== mKey) return false;

                  // 1. Explicit link
                  if (e.linkedVendorCellId) {
                    const parts = e.linkedVendorCellId.split(',').map((s) => s.trim()).filter(Boolean);
                    const matches = parts.some(part => {
                      const cid = part.split('_')[0];
                      return vendorContractsIds.includes(cid);
                    });
                    if (matches) return true;
                  }
                  if (e.linkedContractId && vendorContractsIds.includes(e.linkedContractId)) {
                    return true;
                  }

                  // 2. Payee name match
                  if (matchedVendor && matchedVendor.name && e.payee && e.payee.toLowerCase().includes(matchedVendor.name.toLowerCase())) {
                    return true;
                  }

                  // 3. Recipient type match
                  if (e.recipientType === 'vendor' && (e.recipientId === contract.vendorId || (matchedVendor && e.recipientId === matchedVendor.id))) {
                    return true;
                  }

                  return false;
                });

                if (vendorHasReconciledInMonth) return;

                if (mKey >= startM && mKey <= endM) {
                  const totalSeats = contract.quantityPurchased || 1;
                  let unitMonthlyCost = Number(contract.unitCost || 0);
                  if (contract.costInterval === 'annual') {
                    unitMonthlyCost = unitMonthlyCost / 12;
                  } else if (contract.costInterval === 'one-time' && startM !== mKey) {
                    unitMonthlyCost = 0;
                  }

                  const assignedSeats = assetAssignments.filter(a => a.contractId === contract.id);
                  const taxFactor = 1 + (Number(contract.taxRate || 0) / 100);

                  activeCompanyIds.forEach(compId => {
                    let deptProration = 1.0;
                    if (!deptFilter.includes('all')) {
                      const compActiveStaff = groupActiveStaff.filter(s => s.companyId === compId);
                      const deptActiveStaff = compActiveStaff.filter(s => deptFilter.includes(s.department));
                      deptProration = compActiveStaff.length > 0 ? (deptActiveStaff.length / compActiveStaff.length) : 0;
                    }

                    let compGbpCost = 0;
                    let compRecipientStaffNames = [];
                    let compAssignedSeats = [];

                    if (assignedSeats.length > 0) {
                      const costPerSeat = unitMonthlyCost;
                      let companyAssignedCount = 0;
                      let activeAssignedTotalCount = 0;
                      assignedSeats.forEach(a => {
                        const member = staff.find(s => s.id === a.staffId);
                        if (member) {
                          const isActiveInMonth = groupActiveStaff.some(st => st.id === member.id);
                          if (isActiveInMonth) {
                            activeAssignedTotalCount++;
                            const staffComp = companies.find(co => co.id === member.companyId);
                            const effectiveCompanyId = staffComp?.country === 'India' ? contract.companyId : member.companyId;
                            if (effectiveCompanyId === compId) {
                              const isDept = deptFilter.includes('all') || deptFilter.includes(member.department);
                              if (isDept) {
                                companyAssignedCount++;
                                compRecipientStaffNames.push(member.fullName);
                                compAssignedSeats.push(a);
                              }
                            }
                          }
                        }
                      });

                      const assignedCost = companyAssignedCount * costPerSeat;

                      const unusedCount = Math.max(0, totalSeats - activeAssignedTotalCount);
                      let unusedCost = 0;
                      if (unusedCount > 0) {
                        if (contract.unusedCostTag?.companyId) {
                          if (contract.unusedCostTag.companyId === compId) {
                            const isDept = deptFilter.includes('all') || deptFilter.includes(contract.unusedCostTag.department);
                            if (isDept) {
                              unusedCost = unusedCount * costPerSeat;
                            }
                          }
                        } else {
                          const baseShare = getContractCompanyShare(contract, mKey, compId);
                          if (baseShare > 0) {
                            unusedCost = unusedCount * costPerSeat * baseShare * deptProration;
                          }
                        }
                      }

                      if (assignedCost > 0 || unusedCost > 0) {
                        compGbpCost = toGBP(assignedCost + unusedCost, contract.currency || 'GBP') * taxFactor;
                      }
                    } else {
                      const baseShare = getContractCompanyShare(contract, mKey, compId);
                      if (baseShare > 0) {
                        const cost = unitMonthlyCost * totalSeats * baseShare * deptProration;
                        compGbpCost = toGBP(cost, contract.currency || 'GBP') * taxFactor;
                      }
                    }

                    if (compGbpCost <= 0) return;

                    const vendorObj = vendors.find(v => v.id === contract.vendorId);
                    let assignedNominal = contract.nominalCode || vendorObj?.nominalCode;
                    if (!assignedNominal) {
                      const nameLower = contract.name.toLowerCase();
                      if (nameLower.includes('rent') || nameLower.includes('office') || nameLower.includes('lease')) {
                        const rentMatch = nominalCodes.find(nc => nc.code.toLowerCase().includes('rent') || nc.code.toLowerCase().includes('rates') || nc.code.startsWith('700'));
                        assignedNominal = rentMatch ? rentMatch.code : 'Unassigned';
                      } else {
                        const swMatch = nominalCodes.find(nc => nc.code.toLowerCase().includes('software') || nc.code.toLowerCase().includes('subscrip') || nc.code.startsWith('750'));
                        assignedNominal = swMatch ? swMatch.code : 'Unassigned';
                      }
                    }

                    if ((categoryKey === 'overheadsExpenses' || categoryKey === 'totalOverheads') && isNominalExcluded(assignedNominal)) {
                      return;
                    }

                    if (nominalCode && !assignedNominal.startsWith(nominalCode) && assignedNominal !== nominalCode) {
                      return;
                    }

                    const compObj = companies.find(co => co.id === compId);
                    let payeeLabel = vendorObj ? `${vendorObj.name} (${contract.name})` : contract.name;
                    if (compRecipientStaffNames.length > 0) {
                      payeeLabel += ` [${compRecipientStaffNames.length} Seats: ${compRecipientStaffNames.join(', ')}]`;
                    }
                    if (compObj) {
                      payeeLabel += ` - ${compObj.name} Share`;
                    }

                    projectedItems.push({
                      id: `proj-contract-${contract.id}-${compId}-${mKey}`,
                      date: `${mKey}-01`,
                      plMonth: mKey,
                      payee: payeeLabel,
                      linkedContractId: contract.id,
                      nominalCode: assignedNominal,
                      allocationType: compRecipientStaffNames.length > 0 ? 'staff' : 'company',
                      allocationTarget: compRecipientStaffNames.length > 0 ? compAssignedSeats.map(a => a.staffId) : [compId],
                      amount: compGbpCost,
                      currency: 'GBP',
                      isProjection: true,
                      isClosedReconciled: isReconciledMonth,
                      isSuppressed: (suppressedProjections || []).includes(`proj-contract-${contract.id}-${mKey}`)
                    });
                  });
                }
              });

              // 2. Staff Payroll Taxes & Pension Projections
              staff.forEach(s => {
                const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, mKey);
                if (daysWorked < 10) return;
                if (!isCompanyMatch(s.companyId) || !isDeptMatch(s.department)) return;

                const sPolicy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                const isContractor = s.employmentStatus === 'contractor' || s.employmentStatus === 'freelance' || (sPolicy && sPolicy.type === 'freelance');
                if (!isContractor) {
                  const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code || '1002 - Salary';
                  const taxNominal = nominalCodes.find(nc => nc.id === '501' || nc.code?.includes('501') || nc.code?.toLowerCase().includes('paye') || nc.code?.toLowerCase().includes('tax') || /\bni\b/i.test(nc.code) || nc.code?.toLowerCase().includes('pension'))?.code || salaryNominal;

                  if ((categoryKey === 'overheadsExpenses' || categoryKey === 'totalOverheads') && isNominalExcluded(taxNominal)) return;
                  if (!nominalCode || taxNominal === nominalCode || taxNominal.startsWith(nominalCode)) {
                    // Check if this staff member already has actual payments under salary (1002), freelance (1001), or tax (501)
                    const cleanTaxCode = taxNominal?.split(' - ')[0]?.trim() || '';
                    const hasActualPayment = monthActualExpenses.some(e => {
                      const cleanCode = e.nominalCode?.split(' - ')[0]?.trim() || '';
                      if (cleanCode !== cleanTaxCode && cleanCode !== '1002' && cleanCode !== '1001') return false;

                      const targetStaffIds = Array.isArray(e.allocationTarget) 
                        ? e.allocationTarget 
                        : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                      const matchesId = targetStaffIds.includes(s.id) || e.recipientId === s.id;
                      const matchesName = e.payee?.toLowerCase().includes(s.fullName.toLowerCase());
                      return matchesId || matchesName;
                    });
                    if (hasActualPayment) return;

                    let basicGBP = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
                    let proration = 1.0;
                    if (s.startDate && s.startDate.substring(0, 7) === mKey) {
                      const [y, m, d] = s.startDate.split('-').map(Number);
                      const daysInMonth = new Date(y, m, 0).getDate();
                      proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                      basicGBP = basicGBP * proration;
                    }

                    let empNi = 0;
                    let empPension = 0;
                    const comm = calculateCommissionForRecruiter(s.id, mKey);
                    const gross = basicGBP + comm;
                    const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                    if (!policy) return;

                    if (policy.employerNiSlabs && policy.employerNiSlabs.length > 0) {
                      empNi = calculateSlabCost(gross, policy.employerNiSlabs);
                    } else if (policy.employerNiRate > 0) {
                      const thresholdGBP = toGBP(Number(policy.employerNiThreshold || 0), 'GBP');
                      const taxableNiAmount = Math.max(0, gross - thresholdGBP);
                      empNi = (taxableNiAmount * Number(policy.employerNiRate)) / 100;
                    }
                    if (policy.employerPensionRate > 0) {
                      empPension = (gross * Number(policy.employerPensionRate)) / 100;
                    }
                    empNi = empNi * proration;
                    empPension = empPension * proration;

                    const totalTaxes = empNi + empPension;
                    if (totalTaxes > 0) {
                      projectedItems.push({
                        id: `proj-7003-${s.id}-${mKey}`,
                        date: `${mKey}-01`,
                        plMonth: mKey,
                        payee: `Employer NI & Pension (${s.fullName})`,
                        nominalCode: taxNominal,
                        recipientType: 'staff',
                        recipientId: s.id,
                        amount: totalTaxes,
                        currency: 'GBP',
                        isProjection: true,
                        isClosedReconciled: isReconciledMonth,
                        isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`)
                      });
                    }
                  }
                }
              });

              // 3. Freelancers & Subcontractors Projections (7004)
              if (!nominalCode || nominalCode.startsWith('7004') || nominalCode === '7004 - Freelancers & Subcontractors') {
                staff.forEach(s => {
                  const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, mKey);
                  if (daysWorked < 10) return;
                  if (!isCompanyMatch(s.companyId) || !isDeptMatch(s.department)) return;

                  const sPolicy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                  const isContractor = s.employmentStatus === 'contractor' || s.employmentStatus === 'freelance' || (sPolicy && sPolicy.type === 'freelance');
                  if (isContractor) {
                    // Check if this contractor has actual payments under 7004 or 1001
                    const hasActualPayment = monthActualExpenses.some(e => {
                      const cleanCode = e.nominalCode?.split(' - ')[0]?.trim() || '';
                      if (cleanCode !== '7004' && cleanCode !== '1001') return false;

                      const targetStaffIds = Array.isArray(e.allocationTarget) 
                        ? e.allocationTarget 
                        : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                      const matchesId = targetStaffIds.includes(s.id) || e.recipientId === s.id;
                      const matchesName = e.payee?.toLowerCase().includes(s.fullName.toLowerCase());
                      return matchesId || matchesName;
                    });
                    if (hasActualPayment) return;

                    const [yearNum, monthNum] = mKey.split('-').map(Number);
                    const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
                    let totalBusinessDays = 0;
                    for (let day = 1; day <= totalDaysInMonth; day++) {
                      const dayOfWeek = new Date(Date.UTC(yearNum, monthNum - 1, day)).getUTCDay();
                      if (dayOfWeek !== 0 && dayOfWeek !== 6) totalBusinessDays++;
                    }
                    const attendanceDays = daysWorked || totalBusinessDays;
                    const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                    if (!policy) return;
                    let dailyRate = 0;
                    if (s.salary && Number(s.salary) > 0) {
                      dailyRate = (Number(s.salary) / 12) / totalBusinessDays;
                    } else if (s.attendanceRate && Number(s.attendanceRate) > 0) {
                      dailyRate = Number(s.attendanceRate);
                    } else {
                      dailyRate = Number(policy.dailyRateDefault || 0);
                    }

                    let val = toGBP(dailyRate * attendanceDays, s.currency || 'GBP');
                    if (s.startDate && s.startDate.substring(0, 7) === mKey) {
                      const [y, m, d] = s.startDate.split('-').map(Number);
                      const daysInMonth = new Date(y, m, 0).getDate();
                      const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                      val = val * proration;
                    }

                    if (val > 0) {
                      projectedItems.push({
                        id: `proj-7004-${s.id}-${mKey}`,
                        date: `${mKey}-01`,
                        plMonth: mKey,
                        payee: `Contractor Rate (${s.fullName})`,
                        nominalCode: '7004 - Freelancers & Subcontractors',
                        recipientType: 'staff',
                        recipientId: s.id,
                        amount: val,
                        currency: 'GBP',
                        isProjection: true,
                        isClosedReconciled: isReconciledMonth,
                        isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`) || (suppressedProjections || []).includes(`proj-7004-${s.id}-${mKey}`)
                      });
                    }
                  }
                });
              }

              // 4. Staff Payroll/Freelance/Consulting Projections (1001, 1002, 1003, 1004)

              staff.forEach(s => {
                const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, mKey);
                if (daysWorked < 10) return;

                const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
                if (!policy) return;

                let staffCost = 0;
                const comm = calculateCommissionForRecruiter(s.id, mKey);
                if (policy.type === 'freelance') {
                  const totalBusinessDays = getBusinessDaysInMonth(mKey, s);
                  
                  const year = mKey.substring(0, 4);
                  const yearLeaves = leaveRequests.filter(req => 
                    req.staffId === s.id && 
                    req.status === 'approved' && 
                    req.startDate && 
                    req.startDate.substring(0, 4) === year
                  );
                  const sortedLeaves = [...yearLeaves].sort((a, b) => a.startDate.localeCompare(b.startDate));
                  const lp = leavePolicies.find(p => p.id === s.leavePolicyId);
                  
                  let annualAllowed = 20;
                  if (lp) {
                    if (lp.name?.toLowerCase().includes('global recruiters')) {
                      if (s.startDate) {
                        const start = new Date(s.startDate);
                        if (!isNaN(start.getTime())) {
                          const today = new Date();
                          let years = today.getFullYear() - start.getFullYear();
                          const mNum = today.getMonth() - start.getMonth();
                          if (mNum < 0 || (mNum === 0 && today.getDate() < start.getDate())) {
                            years--;
                          }
                          const calculated = 20 + Math.max(0, years);
                          annualAllowed = Math.min(25, calculated);
                        }
                      }
                    } else {
                      annualAllowed = lp.annualAllowance || 20;
                    }
                  }
                  const sickAllowed = lp ? (lp.sickAllowance ?? 10) : 10;

                  let annualUsed = 0;
                  let sickUsed = 0;
                  let unpaidDaysInTargetMonth = 0;

                  sortedLeaves.forEach(req => {
                    const reqMonth = req.startDate.substring(0, 7);
                    const reqDays = Number(req.totalDays) || 0;
                    let unpaidDaysForThisRequest = 0;

                    if (req.leaveType === 'unpaid') {
                      unpaidDaysForThisRequest = reqDays;
                    } else if (req.leaveType === 'annual') {
                      const newTotal = annualUsed + reqDays;
                      if (newTotal > annualAllowed) {
                        const unpaidPart = Math.max(0, newTotal - annualAllowed);
                        unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                        annualUsed = annualAllowed;
                      } else {
                        annualUsed = newTotal;
                      }
                    } else if (req.leaveType === 'sick') {
                      const newTotal = sickUsed + reqDays;
                      if (newTotal > sickAllowed) {
                        const unpaidPart = Math.max(0, newTotal - sickAllowed);
                        unpaidDaysForThisRequest = Math.min(reqDays, unpaidPart);
                        sickUsed = sickAllowed;
                      } else {
                        sickUsed = newTotal;
                      }
                    }

                    if (reqMonth === mKey) {
                      unpaidDaysInTargetMonth += unpaidDaysForThisRequest;
                    }
                  });

                  const attendanceDays = Math.max(0, totalBusinessDays - unpaidDaysInTargetMonth);

                  let dailyRate = 0;
                  if (s.salary && Number(s.salary) > 0) {
                    dailyRate = (Number(s.salary) / 12) / totalBusinessDays;
                  } else if (s.attendanceRate && Number(s.attendanceRate) > 0) {
                    dailyRate = Number(s.attendanceRate);
                  } else {
                    dailyRate = Number(policy.dailyRateDefault || 0);
                  }

                  let val = toGBP(dailyRate * attendanceDays, s.currency || 'GBP');
                  if (s.startDate && s.startDate.substring(0, 7) === mKey) {
                    const [y, mNum, d] = s.startDate.split('-').map(Number);
                    const daysInMonth = new Date(y, mNum, 0).getDate();
                    const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                    val = val * proration;
                  }
                  staffCost = val + comm;
                } else {
                  let basicGBP = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
                  let proration = 1.0;
                  if (s.startDate && s.startDate.substring(0, 7) === mKey) {
                    const [y, mNum, d] = s.startDate.split('-').map(Number);
                    const daysInMonth = new Date(y, mNum, 0).getDate();
                    proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
                    basicGBP = basicGBP * proration;
                  }
                  staffCost = basicGBP + comm;
                }

                let routedNominal = policy.nominalCode;
                if (!routedNominal) {
                  if (policy.type === 'freelance') {
                    const contractorNominal = nominalCodes.find(nc => nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('subcontractor'))?.code;
                    routedNominal = contractorNominal || '1001 - Freelancer Payments';
                  } else {
                    const salaryNominal = nominalCodes.find(nc => nc.id === '1002' || nc.code?.startsWith('1002'))?.code;
                    routedNominal = salaryNominal || '1002 - Salary';
                  }
                }

                // Check if this staff member already has actual payments under routedNominal in this month
                const cleanTarget = routedNominal?.split(' - ')[0]?.trim() || '';
                const hasActualPayment = monthActualExpenses.some(e => {
                  const cleanCode = e.nominalCode?.split(' - ')[0]?.trim() || '';
                  if (cleanCode !== cleanTarget) return false;

                  const targetStaffIds = Array.isArray(e.allocationTarget) 
                    ? e.allocationTarget 
                    : (e.recipientId ? [e.recipientId] : e.selectedStaffIds || []);
                  const matchesId = targetStaffIds.includes(s.id) || e.recipientId === s.id;
                  const matchesName = e.payee?.toLowerCase().includes(s.fullName.toLowerCase());
                  return matchesId || matchesName;
                });
                if (hasActualPayment) return;

                // Apply company & department matches
                if (routedNominal.startsWith('1004') || routedNominal.toLowerCase().includes('shared')) {
                  if (s.companyId && s.companyId !== 'comp-1782789370085') {
                    if (isCompanyMatch(s.companyId) && isDeptMatch(s.department)) {
                      if (!nominalCode || routedNominal === nominalCode || routedNominal.startsWith(nominalCode)) {
                        projectedItems.push({
                          id: `proj-staff-${s.id}-${mKey}`,
                          date: `${mKey}-01`,
                          plMonth: mKey,
                          payee: `${s.fullName} (Shared Cost - Direct)`,
                          nominalCode: routedNominal,
                          recipientType: 'staff',
                          recipientId: s.id,
                          amount: staffCost,
                          currency: 'GBP',
                          isProjection: true,
                          isClosedReconciled: isReconciledMonth,
                          isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`)
                        });
                      }
                    }
                  } else {
                    const targetCompanyIds = (s.allocatedCompanyIds && s.allocatedCompanyIds.length > 0) ? s.allocatedCompanyIds : null;
                    const otherStaff = groupActiveStaff.filter(os => {
                      const comp = companies.find(c => c.id === os.companyId);
                      const compMatch = targetCompanyIds ? targetCompanyIds.includes(os.companyId) : os.companyId !== s.companyId;
                      return comp && comp.includeInConsolidation !== false && compMatch;
                    });

                    if (otherStaff.length > 0) {
                      const perStaffShare = staffCost / otherStaff.length;
                      otherStaff.forEach(os => {
                        if (isCompanyMatch(os.companyId) && isDeptMatch(os.department)) {
                          if (!nominalCode || routedNominal === nominalCode || routedNominal.startsWith(nominalCode)) {
                            projectedItems.push({
                              id: `proj-staff-${s.id}-${mKey}-${os.companyId}`,
                              date: `${mKey}-01`,
                              plMonth: mKey,
                              payee: `${s.fullName} (Shared Cost Share via ${os.fullName})`,
                              nominalCode: routedNominal,
                              recipientType: 'staff',
                              recipientId: s.id,
                              amount: perStaffShare,
                              currency: 'GBP',
                              isProjection: true,
                              isClosedReconciled: isReconciledMonth,
                              isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`)
                            });
                          }
                        }
                      });
                    } else {
                      if (isCompanyMatch(s.companyId) && isDeptMatch(s.department)) {
                        if (!nominalCode || routedNominal === nominalCode || routedNominal.startsWith(nominalCode)) {
                          projectedItems.push({
                            id: `proj-staff-${s.id}-${mKey}`,
                            date: `${mKey}-01`,
                            plMonth: mKey,
                            payee: `${s.fullName} (Shared Cost - Direct)`,
                            nominalCode: routedNominal,
                            recipientType: 'staff',
                            recipientId: s.id,
                            amount: staffCost,
                            currency: 'GBP',
                            isProjection: true,
                            isClosedReconciled: isReconciledMonth,
                            isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`)
                          });
                        }
                      }
                    }
                  }
                } else {
                  if (isCompanyMatch(s.companyId) && isDeptMatch(s.department)) {
                    if (!nominalCode || routedNominal === nominalCode || routedNominal.startsWith(nominalCode)) {
                      projectedItems.push({
                        id: `proj-staff-${s.id}-${mKey}`,
                        date: `${mKey}-01`,
                        plMonth: mKey,
                        payee: comm > 0 ? `${s.fullName} (${policy.type === 'freelance' ? 'Freelancer' : 'Salary'} + £${Math.round(comm).toLocaleString()} Comm)` : s.fullName,
                        nominalCode: routedNominal,
                        recipientType: 'staff',
                        recipientId: s.id,
                        amount: staffCost,
                        currency: 'GBP',
                        isProjection: true,
                        isClosedReconciled: isReconciledMonth,
                        isSuppressed: (suppressedProjections || []).includes(`proj-staff-${s.id}-${mKey}`)
                      });
                    }
                  }
                }
              });
            });

            return [...finalItems, ...projectedItems];
          }

          return [];
        };

        const rawItems = getDrilldownItems();
        const isOverheadDrilldown = drilldownState.categoryKey === 'overheadsExpenses' || drilldownState.categoryKey === 'nominal' || drilldownState.categoryKey === 'totalOverheads' || drilldownState.categoryKey === 'balanceSheet';

        const paidItems = rawItems.filter(item => !item.isProjected);
        const projectedItems = rawItems.filter(item => item.isProjected);
        const activeProjectedItems = projectedItems.filter(item => !item.isSuppressed && !item.isClosedReconciled);

        const totalPaid = paidItems.reduce((acc, item) => acc + toGBP(item.amount || 0, item.currency || 'GBP'), 0);
        const totalProjected = activeProjectedItems.reduce((acc, item) => acc + toGBP(item.amount || 0, item.currency || 'GBP'), 0);

        const typeFilteredItems = rawItems.filter(item => {
          if (!isOverheadDrilldown || drilldownTypeFilter === 'all') return true;
          if (drilldownTypeFilter === 'paid') return !item.isProjected;
          if (drilldownTypeFilter === 'projected') return item.isProjected;
          return true;
        });

        const q = drilldownSearch.toLowerCase().trim();
        const filteredItems = typeFilteredItems.filter(item => {
          if (!q) return true;
          return JSON.stringify(item).toLowerCase().includes(q);
        });

        const v1Data = drilldownState.monthKey ? getFilteredMonthlyData(drilldownState.monthKey) : null;
        let v1Value = 0;
        if (v1Data) {
          if (drilldownState.categoryKey === 'revenue') v1Value = v1Data.revenue;
          else if (drilldownState.categoryKey === 'commissions') v1Value = v1Data.commissions;
          else if (drilldownState.categoryKey === 'totalOverheads' || drilldownState.categoryKey === 'overheadsExpenses') v1Value = v1Data.overheadsExpenses;
          else if (drilldownState.categoryKey === 'nominal') {
            v1Value = v1Data.nominalBreakdown?.[drilldownState.nominalCode] || 0;
          }
        }

        const handleExportDrilldownExcel = () => {
          try {
            if (!filteredItems || filteredItems.length === 0) {
              if (onShowToast) onShowToast("No records to export in current view.", "warning");
              return;
            }

            const wb = XLSX.utils.book_new();
            const rawTitle = drilldownState?.label || drilldownState?.title || "P&L_Itemization";
            const sanitizedTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 31);

            const rows = [];
            rows.push([`P&L Itemization: ${drilldownState?.label || ''}`]);
            rows.push(["Period:", drilldownState.monthKey || 'Full Period']);
            rows.push(["Generated on:", new Date().toLocaleDateString('en-GB')]);
            rows.push(["Total Records:", filteredItems.length]);
            rows.push([]);

            if (drilldownState.categoryKey === 'revenue') {
              rows.push(["Placement ID", "Candidate", "Client / Company", "Job Role", "Start Date", "Net Fee (GBP)"]);
              filteredItems.forEach(item => {
                rows.push([
                  item.placementId || item.id || '',
                  item.candidateName || '',
                  item.clientName || '',
                  item.jobTitle || '',
                  item.startDate || '',
                  Math.round(toGBP(item.netScoreValue || 0, item.currency || 'GBP'))
                ]);
              });
            } else if (drilldownState.categoryKey === 'commissions') {
              rows.push(["Recruiter Name", "Department", "Month", "Commission Tier Policy", "Accrued Commission (GBP)"]);
              filteredItems.forEach(item => {
                rows.push([
                  item.recruiterName || '',
                  item.department || '',
                  item.monthKey || '',
                  item.policy || '',
                  Math.round(item.commVal || 0)
                ]);
              });
            } else if (drilldownState.categoryKey === 'salaries') {
              rows.push(["Staff Member", "Job Title", "Department", "Company", "Month", "Salary (GBP)"]);
              filteredItems.forEach(item => {
                rows.push([
                  item.staffName || '',
                  item.jobTitle || '',
                  item.department || '',
                  item.companyName || '',
                  item.monthKey || '',
                  Math.round(item.amount || 0)
                ]);
              });
            } else if (drilldownState.categoryKey === 'staffCount') {
              rows.push(["Staff Member", "Job Title", "Department", "Company", "Month", "Start Date", "Days Worked"]);
              filteredItems.forEach(item => {
                rows.push([
                  item.staffName || '',
                  item.jobTitle || '',
                  item.department || '',
                  item.companyName || '',
                  item.monthKey || '',
                  item.startDate || '',
                  item.daysWorked || 0
                ]);
              });
            } else {
              // Overheads / Nominals / Total Overheads / Balance Sheet
              rows.push([
                "Date",
                "P&L Month",
                "Payee / Vendor",
                "Linked Contract",
                "Nominal Code",
                "Allocated To (For Whom)",
                "Bank / Source",
                "Tax Rate (%)",
                "Status / Nature",
                "Amount (Gross GBP)",
                "Invoice / Receipt URL"
              ]);

              filteredItems.forEach(item => {
                const contractObj = contracts.find(c => c.id === item.linkedContractId);
                let targetStr = 'Group Corporate Overhead';
                if (item.recipientType === 'staff' && item.recipientId) {
                  const sObj = staff.find(s => s.id === item.recipientId);
                  targetStr = `Direct Staff: ${sObj?.fullName || 'Staff Member'}`;
                } else if (item.allocationType === 'staff') {
                  const ids = Array.isArray(item.allocationTarget) ? item.allocationTarget : (item.selectedStaffIds || []);
                  const names = ids.map(id => staff.find(s => s.id === id)?.fullName).filter(Boolean);
                  targetStr = names.length > 0 ? `${names.length} Staff Seats: ${names.join(', ')}` : 'Staff Seats';
                } else if (item.allocationType === 'company') {
                  const ids = Array.isArray(item.allocationTarget) ? item.allocationTarget : [item.allocationTarget].filter(Boolean);
                  const names = ids.map(id => companies.find(c => c.id === id)?.name).filter(Boolean);
                  targetStr = names.length > 0 ? `Entity Overhead: ${names.join(', ')}` : 'Entity Overhead';
                }

                let natureStr = 'Bank Paid';
                if (item.isProjected) {
                  natureStr = item.isSuppressed ? 'Projected (Suppressed)' : (item.isClosedReconciled ? 'Closed (Reconciled)' : 'Projected Forecast');
                } else if (item.status) {
                  natureStr = item.status;
                }

                rows.push([
                  item.date || '',
                  item.plMonth || '',
                  item.payee || '',
                  contractObj?.name || (item.linkedContractId ? 'Contract' : 'General Vendor'),
                  item.nominalCode || '',
                  targetStr,
                  item.bankAccount || (item.isProjection ? '— (Forecast)' : 'Bank'),
                  item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== '' ? `${item.taxRate}%` : '—',
                  natureStr,
                  Math.round(toGBP(item.amount || 0, item.currency || 'GBP')),
                  (item.invoiceUrl && item.invoiceUrl !== '#') ? item.invoiceUrl : ''
                ]);
              });
            }

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
              { wch: 14 },
              { wch: 12 },
              { wch: 28 },
              { wch: 24 },
              { wch: 20 },
              { wch: 28 },
              { wch: 16 },
              { wch: 14 },
              { wch: 20 },
              { wch: 18 },
              { wch: 35 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Itemized Records");

            const filename = `${sanitizedTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            if (onShowToast) {
              onShowToast(`Exported to ${filename}`, 'success');
            }
          } catch (err) {
            console.error("Failed to export drilldown to Excel:", err);
            if (onShowToast) {
              onShowToast("Failed to export to Excel.", "error");
            }
          }
        };

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
                    Period: <strong>{drilldownState.monthKey || 'YTD Full Period'}</strong> • {drilldownState.categoryKey === 'recruiterTenure' ? (
                      <>Total Tenure: <strong style={{ color: 'var(--primary)' }}>{drilldownState.amount} months</strong></>
                    ) : (
                      <>Total Value: <strong style={{ color: 'var(--primary)' }}>{formatGBP(drilldownState.amount)}</strong></>
                    )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Filter by payee, recruiter, client, or role..." 
                  value={drilldownSearch} 
                  onChange={(e) => setDrilldownSearch(e.target.value)} 
                  className="search-input" 
                  style={{ width: '100%', maxWidth: '380px' }}
                />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Showing {filteredItems.length} of {rawItems.length} records
                  </span>

                  {isOverheadDrilldown && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setShowDrilldownColPicker(prev => !prev)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: showDrilldownColPicker ? 'var(--primary)' : 'var(--bg-secondary)',
                          color: showDrilldownColPicker ? '#fff' : 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                        title="Choose which columns appear in this itemization pop-up"
                      >
                        <Settings size={13} /> Columns ({Object.values(drilldownVisibleCols).filter(Boolean).length})
                      </button>

                      {showDrilldownColPicker && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          zIndex: 250,
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px',
                          minWidth: '220px',
                          boxShadow: 'var(--shadow-xl)',
                          marginTop: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                              Choose Columns
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const resetCols = {
                                  date: true,
                                  plMonth: true,
                                  payee: true,
                                  contract: true,
                                  nominal: true,
                                  allocation: true,
                                  status: true,
                                  amount: true,
                                  tax: false,
                                  bank: false,
                                  receipt: false
                                };
                                setDrilldownVisibleCols(resetCols);
                                try { localStorage.setItem('bm-drilldown-expense-cols', JSON.stringify(resetCols)); } catch (e) {}
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '10px', fontWeight: 600, padding: 0 }}
                            >
                              Reset
                            </button>
                          </div>
                          {[
                            { key: 'date', label: 'Transaction Date' },
                            { key: 'plMonth', label: 'P&L Month' },
                            { key: 'payee', label: 'Payee / Supplier' },
                            { key: 'contract', label: 'Linked Contract' },
                            { key: 'nominal', label: 'Nominal Code' },
                            { key: 'allocation', label: 'Allocation (For Whom)' },
                            { key: 'bank', label: 'Bank / Source' },
                            { key: 'tax', label: 'Tax Rate (VAT)' },
                            { key: 'status', label: 'Status / Nature' },
                            { key: 'amount', label: 'Amount (Gross GBP)' },
                            { key: 'receipt', label: 'Invoice / Receipt' }
                          ].map(col => (
                            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', cursor: 'pointer', margin: 0, color: 'var(--text-primary)' }}>
                              <input 
                                type="checkbox"
                                checked={!!drilldownVisibleCols[col.key]}
                                onChange={() => handleToggleDrilldownCol(col.key)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span>{col.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExportDrilldownExcel}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--success)',
                      cursor: 'pointer'
                    }}
                    title="Export current itemized records to Excel (.xlsx)"
                  >
                    <FileSpreadsheet size={13} /> Export Excel
                  </button>
                </div>
              </div>

              {/* Overhead Projected vs Paid Summary Cards & Filter Tabs */}
              {isOverheadDrilldown && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>💳 BANK PAID (ACTUALS)</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>{formatGBP(totalPaid)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{paidItems.length} bank-cleared / amortized lines</div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>🔮 PROJECTED FORECAST</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>{formatGBP(totalProjected)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {activeProjectedItems.length} active ({projectedItems.length - activeProjectedItems.length} closed/suppressed)
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>📊 NET P&L RECOGNIZED</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{formatGBP(totalPaid + totalProjected)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Paid + unbilled active projections</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Show:</span>
                    <div style={{ display: 'inline-flex', padding: '2px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setDrilldownTypeFilter('all')}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: drilldownTypeFilter === 'all' ? 'var(--primary)' : 'transparent',
                          color: drilldownTypeFilter === 'all' ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        All Items ({rawItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrilldownTypeFilter('paid')}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: drilldownTypeFilter === 'paid' ? 'var(--success)' : 'transparent',
                          color: drilldownTypeFilter === 'paid' ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        💳 Bank Paid Only ({paidItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrilldownTypeFilter('projected')}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: drilldownTypeFilter === 'projected' ? 'var(--accent)' : 'transparent',
                          color: drilldownTypeFilter === 'projected' ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        🔮 Projected Only ({projectedItems.length})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Version 2 vs Version 1 (Actual Database Generated Pipeline) Comparison Card */}
              {pnlVersion === 'v2' && drilldownState.monthKey && drilldownState.monthKey > reconciledCutoffMonth && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                      VERSION 2 FORECAST (3-MONTH AVERAGE)
                    </span>
                    <strong style={{ fontSize: '18px', color: 'var(--accent)' }}>
                      {formatGBP(drilldownState.amount)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Flat-lined running average (April - June 2026)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                      ACTUAL GENERATED / DATABASE PIPELINE
                    </span>
                    <strong style={{ fontSize: '18px', color: 'var(--success)' }}>
                      {formatGBP(v1Value)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Actual pipeline placements / explicit projected items in database
                    </span>
                  </div>
                </div>
              )}

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
                      {isOverheadDrilldown && (
                        <>
                          {drilldownVisibleCols.date && <th>Date</th>}
                          {drilldownVisibleCols.plMonth && <th>P&L Month</th>}
                          {drilldownVisibleCols.payee && <th>Payee / Vendor</th>}
                          {drilldownVisibleCols.contract && <th>Linked Contract</th>}
                          {drilldownVisibleCols.nominal && <th>Nominal Code</th>}
                          {drilldownVisibleCols.allocation && <th>Allocated To (For Whom)</th>}
                          {drilldownVisibleCols.bank && <th>Bank / Source</th>}
                          {drilldownVisibleCols.tax && <th style={{ textAlign: 'right' }}>Tax (VAT)</th>}
                          {drilldownVisibleCols.status && <th>Status / Nature</th>}
                          {drilldownVisibleCols.amount && <th style={{ textAlign: 'right' }}>Amount (Gross)</th>}
                          {drilldownVisibleCols.receipt && <th style={{ textAlign: 'center' }}>Receipt</th>}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={isOverheadDrilldown ? Object.values(drilldownVisibleCols).filter(Boolean).length : 7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
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

                        let statusBadge = null;
                        if (!item.isProjected) {
                          statusBadge = (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
                              💳 Bank Paid
                            </span>
                          );
                        } else if (item.isSuppressed) {
                          statusBadge = (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' }}>
                                ✕ Suppressed
                              </span>
                              {item.projectionKey && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuppressProjection(item.projectionKey)}
                                  title="Restore this projection to P&L"
                                  style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                >
                                  ↺ Restore
                                </button>
                              )}
                            </div>
                          );
                        } else if (item.isClosedReconciled) {
                          statusBadge = (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-muted)' }} title={`Reconciled month (${reconciledCutoffMonth}) - unbilled projection closed off`}>
                              🔒 Closed (Reconciled)
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent)' }}>
                                🔮 Active Forecast
                              </span>
                              {item.projectionKey && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuppressProjection(item.projectionKey)}
                                  title="Close off / suppress this projection from P&L"
                                  style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', cursor: 'pointer', color: 'var(--danger)', fontWeight: 600 }}
                                >
                                  ✕ Close Off
                                </button>
                              )}
                            </div>
                          );
                        }

                        const isMuted = item.isClosedReconciled || item.isSuppressed;

                        return (
                          <tr key={item.id || idx} style={isMuted ? { opacity: 0.6 } : undefined}>
                            {drilldownVisibleCols.date && <td>{item.date}</td>}
                            {drilldownVisibleCols.plMonth && <td>{item.plMonth}</td>}
                            {drilldownVisibleCols.payee && <td style={{ fontWeight: 600 }}>{item.payee}</td>}
                            {drilldownVisibleCols.contract && <td>{contracts.find(c => c.id === item.linkedContractId)?.name || (item.linkedContractId ? 'Contract' : 'General Vendor')}</td>}
                            {drilldownVisibleCols.nominal && <td>{item.nominalCode}</td>}
                            {drilldownVisibleCols.allocation && <td style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>{targetStr}</td>}
                            {drilldownVisibleCols.bank && <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.bankAccount || (item.isProjection ? '— (Forecast)' : 'Bank')}</td>}
                            {drilldownVisibleCols.tax && <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== '' ? `${item.taxRate}%` : '—'}</td>}
                            {drilldownVisibleCols.status && <td>{statusBadge}</td>}
                            {drilldownVisibleCols.amount && (
                              <td style={{ textAlign: 'right', fontWeight: 700, color: isMuted ? 'var(--text-muted)' : (item.isProjected ? 'var(--accent)' : 'inherit'), textDecoration: isMuted ? 'line-through' : 'none' }}>
                                {formatGBP(toGBP(item.amount || 0, item.currency || 'GBP'))}
                                {isMuted && (
                                  <div style={{ fontSize: '9px', fontWeight: 'normal', color: 'var(--text-muted)', textDecoration: 'none' }}>
                                    (Not in P&L)
                                  </div>
                                )}
                              </td>
                            )}
                            {drilldownVisibleCols.receipt && (
                              <td style={{ textAlign: 'center' }}>
                                {item.invoiceUrl && item.invoiceUrl !== '#' ? (
                                  <a href={item.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600 }} title="Open Invoice / Receipt">
                                    📄 View
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                                )}
                              </td>
                            )}
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
