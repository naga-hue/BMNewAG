import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  Award, 
  Percent, 
  Info
} from 'lucide-react';

const FX_RATES = {
  GBP: 1.0,
  USD: 0.79,
  AED: 0.21,
  INR: 0.0094,
  ZAR: 0.043
};

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
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('consolidated'); // consolidated, divisional, departmental, forecast, ratios, leagues
  
  // Global Filters
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-12');

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

  // Helper to calculate exact cash-received commission payout (matching Incentive Commissions ledger)
  const calculateCashReceivedCommission = (member, policy, monthStr, staffList, companiesList, placementsList) => {
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
    
    // Placements evaluated are those starting in the PREVIOUS month
    let cycleYear = payYear;
    let cycleMonth = payMonth - 1;
    if (cycleMonth === 0) {
      cycleMonth = 12;
      cycleYear = payYear - 1;
    }

    const teamMembers = staffList.filter(s => s.reportingManagerId === member.id);
    const targetStaffIds = policy.type === 'manager' 
      ? [member.id, ...teamMembers.map(s => s.id)]
      : [member.id];

    // Helper to calculate total recruiter split billing for a specific start month
    const getRecruiterBillingForStartMonth = (yearVal, monthVal) => {
      let sum = 0;
      placementsList.forEach(p => {
        if (!p.startDate) return;
        const pStart = new Date(p.startDate);
        if (pStart.getFullYear() === yearVal && (pStart.getMonth() + 1) === monthVal) {
          p.splits?.forEach(s => {
            if (targetStaffIds.includes(s.staffId)) {
              sum += (p.netScoreValue * s.percentage) / 100;
            }
          });
        }
      });
      return sum;
    };

    // Helper to apply slabs to a billing amount (normalized to GBP)
    const getPolicyCommission = (billingAmt) => {
      const policyCompany = companiesList.find(c => c.id === policy.companyId);
      const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
      
      const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold, policyCurrency);
      const commissionable = Math.max(0, billingAmt - thresh);
      const slabs = policy.slabs || [];
      let earned = 0;
      let remaining = commissionable;

      if (commissionable > 0) {
        for (const slab of slabs) {
          const min = toGBP(slab.minAmount, policyCurrency);
          const max = toGBP(slab.maxAmount, policyCurrency);
          const rate = Number(slab.rate) || 0;
          const slabCap = max - min;

          if (remaining <= 0) break;
          const applicable = Math.min(remaining, slabCap);
          earned += (applicable * rate) / 100;
          remaining -= applicable;
        }
      }
      return earned;
    };

    // 1. Current Cycle calculations (starts in previous month)
    const currentCycleBilling = getRecruiterBillingForStartMonth(cycleYear, cycleMonth);
    const baseEarned = getPolicyCommission(currentCycleBilling);

    let totalPaidNow = 0;

    placementsList.forEach(p => {
      if (!p.startDate) return;
      const pStart = new Date(p.startDate);
      if (pStart.getFullYear() === cycleYear && (pStart.getMonth() + 1) === cycleMonth) {
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

    // 2. Releases from Prior Withholds (starts before the previous month)
    let totalReleased = 0;

    placementsList.forEach(p => {
      if (!p.startDate) return;
      const pStart = new Date(p.startDate);
      const pStartYear = pStart.getFullYear();
      const pStartMonth = pStart.getMonth() + 1;

      const isPriorStart = pStartYear < cycleYear || (pStartYear === cycleYear && pStartMonth < cycleMonth);

      if (isPriorStart) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
          const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;

          const histCycleBilling = getRecruiterBillingForStartMonth(pStartYear, pStartMonth);
          const histBaseEarned = getPolicyCommission(histCycleBilling);

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

    return totalPaidNow + totalReleased;
  };

  // Recruiter Commission calculator helper
  const calculateCommissionForRecruiter = (recruiterId, monthKey) => {
    const member = staff.find(s => s.id === recruiterId);
    if (!member) return 0;
    const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
    return calculateCashReceivedCommission(member, policy, monthKey, staff, companies, placements);
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
    const baseSal = toGBP(Number(s.salary || 0) / 12, s.currency || 'GBP');
    let salaries = baseSal;
    let commissions = calculateCommissionForRecruiter(s.id, monthKey);

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
          salaries = baseSal * proration;
        }
      }
      if (exitMonth && monthKey === exitMonth && s.additionalExitPayment) {
        salaries += toGBP(Number(s.additionalExitPayment) || 0, s.currency || 'GBP');
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

  // Filtered monthly calculations row generator
  const getFilteredMonthlyData = (monthKey) => {
    // 1. Active staff members matching company & department
    const activeStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      if (daysWorked < 10) return false;
      
      if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
      if (deptFilter !== 'all' && s.department !== deptFilter) return false;
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
          if (companyFilter !== 'all' && member.companyId !== companyFilter) return;
          if (deptFilter !== 'all' && member.department !== deptFilter) return;
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
      salaries += pay.salaries;
      commissions += pay.commissions;
    });

    // 5. Operating expenses + shared overhead apportionments
    const groupActiveStaff = staff.filter(s => {
      const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
      return daysWorked >= 10;
    });
    const groupActiveStaffIds = groupActiveStaff.map(s => s.id);
    let overheadsExpenses = 0;

    const monthExpenses = expenses.filter(e => e.plMonth === monthKey);
    monthExpenses.forEach(exp => {
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
                if (activeStaffIds.includes(s.id)) {
                  overheadsExpenses += perStaffShare;
                }
              });
            });
          } else {
            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.companyId));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              if (activeStaffIds.includes(s.id)) {
                overheadsExpenses += perStaffShare;
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
                  overheadsExpenses += perStaffShare;
                }
              });
            });
          } else {
            const eligibleStaff = groupActiveStaff.filter(s => targets.includes(s.department));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              if (activeStaffIds.includes(s.id)) {
                overheadsExpenses += perStaffShare;
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
                  overheadsExpenses += perStaffShare;
                }
              }
            });
          } else {
            const perStaffShare = gbpAmt / targets.length;
            targets.forEach(staffId => {
              if (groupActiveStaffIds.includes(staffId)) {
                if (activeStaffIds.includes(staffId)) {
                  overheadsExpenses += perStaffShare;
                }
              }
            });
          }
        }
      } else {
        const groupHead = groupActiveStaff.length || 1;
        groupActiveStaff.forEach(s => {
          if (activeStaffIds.includes(s.id)) {
            overheadsExpenses += gbpAmt / groupHead;
          }
        });
      }
    });

    const grossProfit = revenue - commissions;
    const totalOverheads = salaries + overheadsExpenses;
    const netProfit = revenue - commissions - totalOverheads;

    return {
      revenue,
      salaries,
      commissions,
      overheadsExpenses,
      grossProfit,
      totalOverheads,
      netProfit,
      headcount: activeStaff.length
    };
  };

  // Find department options based on company selection
  const departmentOptions = Array.from(
    new Set(
      staff
        .filter(s => companyFilter === 'all' || s.companyId === companyFilter)
        .map(s => s.department)
        .filter(Boolean)
    )
  ).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Dynamic Global Filters Toolbar */}
      <div className="table-container" style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Company Entity:</span>
            <select 
              className="select-filter"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setDeptFilter('all'); // reset division
              }}
              style={{ padding: '6px', minWidth: '220px' }}
            >
              <option value="all">All Companies (Consolidated)</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Division / Department:</span>
            <select 
              className="select-filter"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ padding: '6px', minWidth: '200px' }}
            >
              <option value="all">All Departments / Divisions</option>
              {departmentOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
          { key: 'consolidated', label: 'Company P&L Matrix', icon: <BarChart3 size={14} /> },
          { key: 'divisional', label: 'Divisional Comparisons', icon: <Building2 size={14} /> },
          { key: 'departmental', label: 'Departmental Comparisons', icon: <Users size={14} /> },
          { key: 'forecast', label: 'Forecast Desk', icon: <TrendingUp size={14} /> },
          { key: 'ratios', label: 'Salary-to-Billings Ratio', icon: <Percent size={14} /> },
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

                const renderRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
                  const ytdSum = rowData.reduce((acc, row) => acc + (row[key] || 0), 0);
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                      {rowData.map((row, idx) => (
                        <td key={idx} style={{ textAlign: 'right', color }}>
                          {formatGBP(row[key] || 0)}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, color, backgroundColor: 'rgba(255,255,255,0.02)' }}>
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
                    {renderRow('Apportioned Overheads & SaaS', 'overheadsExpenses', false, true)}
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

                    <tr style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      <td>Staff Count in Apportionment</td>
                      {rowData.map((row, idx) => (
                        <td key={idx} style={{ textAlign: 'right' }}>
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
                {companies.map(c => (
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
                        if (deptFilter === 'all' || rec.department === deptFilter) {
                          const share = (p.netScoreValue * s.percentage) / 100;
                          companyDataMap[rec.companyId].revenue += toGBP(share, 'GBP');
                        }
                      }
                    });
                  });

                  // Salaries & Commissions
                  staff.forEach(s => {
                    if (!s.startDate || s.startDate.substring(0, 7) > mKey) return;
                    if (deptFilter !== 'all' && s.department !== deptFilter) return;
                    
                    if (companyDataMap[s.companyId]) {
                      const pay = getStaffPayrollForMonth(s, mKey);
                      companyDataMap[s.companyId].salaries += pay.salaries;
                      companyDataMap[s.companyId].commissions += pay.commissions;
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
                              if (companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.companyId));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
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
                              if (companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.department));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
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
                              if (st && companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            }
                          });
                        } else {
                          const perStaffShare = gbpAmt / targets.length;
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
                                companyDataMap[st.companyId].overheads += perStaffShare;
                              }
                            }
                          });
                        }
                      }
                    } else {
                      const groupHead = activeStaffInMonth.length || 1;
                      activeStaffInMonth.forEach(st => {
                        if (companyDataMap[st.companyId] && (deptFilter === 'all' || st.department === deptFilter)) {
                          companyDataMap[st.companyId].overheads += gbpAmt / groupHead;
                        }
                      });
                    }
                  });
                });

                const renderSplitRow = (label, key, isBold = false, isSub = false, color = 'var(--text-primary)') => {
                  const totalCons = companies.reduce((sum, c) => sum + companyDataMap[c.id][key], 0);
                  return (
                    <tr style={{ fontWeight: isBold ? 700 : 400 }}>
                      <td style={{ paddingLeft: isSub ? '24px' : '12px', color }}>{label}</td>
                      {companies.map(c => (
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
        <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="entity-table dense" style={{ minWidth: '1000px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ minWidth: '220px' }}>P&L Item (Period Cumulative)</th>
                {["Recruitment", "Sales & Marketing", "Finance", "Operations", "Sourcing", "HR", "Admin"].map(d => (
                  <th key={d} style={{ textAlign: 'right' }}>{d}</th>
                ))}
                <th style={{ textAlign: 'right', fontWeight: 700 }}>Total Consolidated</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const depts = ["Recruitment", "Sales & Marketing", "Finance", "Operations", "Sourcing", "HR", "Admin"];
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
                        if (companyFilter === 'all' || rec.companyId === companyFilter) {
                          const share = (p.netScoreValue * s.percentage) / 100;
                          deptDataMap[rec.department].revenue += toGBP(share, 'GBP');
                        }
                      }
                    });
                  });

                  // Salaries & Commissions
                  staff.forEach(s => {
                    if (!s.startDate || s.startDate.substring(0, 7) > mKey) return;
                    if (companyFilter !== 'all' && s.companyId !== companyFilter) return;

                    if (deptDataMap[s.department]) {
                      const pay = getStaffPayrollForMonth(s, mKey);
                      deptDataMap[s.department].salaries += pay.salaries;
                      deptDataMap[s.department].commissions += pay.commissions;
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
                              if (deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.companyId));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
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
                              if (deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            });
                          });
                        } else {
                          const eligibleStaff = activeStaffInMonth.filter(st => targets.includes(st.department));
                          const totalHead = eligibleStaff.length || 1;
                          const perStaffShare = gbpAmt / totalHead;
                          eligibleStaff.forEach(st => {
                            if (deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
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
                              if (st && deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            }
                          });
                        } else {
                          const perStaffShare = gbpAmt / targets.length;
                          targets.forEach(staffId => {
                            if (activeStaffInMonthIds.includes(staffId)) {
                              const st = activeStaffInMonth.find(item => item.id === staffId);
                              if (st && deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
                                deptDataMap[st.department].overheads += perStaffShare;
                              }
                            }
                          });
                        }
                      }
                    } else {
                      const groupHead = activeStaffInMonth.length || 1;
                      activeStaffInMonth.forEach(st => {
                        if (deptDataMap[st.department] && (companyFilter === 'all' || st.companyId === companyFilter)) {
                          deptDataMap[st.department].overheads += gbpAmt / groupHead;
                        }
                      });
                    }
                  });
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
                    
                    if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
                    if (deptFilter !== 'all' && s.department !== deptFilter) return false;
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
                        if (companyFilter !== 'all' && member.companyId !== companyFilter) return;
                        if (deptFilter !== 'all' && member.department !== deptFilter) return;
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
                    salaries += pay.salaries;
                    commissions += pay.commissions;
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
                <th style={{ textAlign: 'right' }}>Annualized Salary (GBP)</th>
                <th style={{ textAlign: 'right' }}>Period Billings Generated (GBP)</th>
                <th style={{ textAlign: 'right', fontWeight: 700 }}>Salary-to-Billings Ratio</th>
                <th>ROI Grading Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Filter staff members by company/dept/recruiter role
                const recruitersList = staff.filter(s => {
                  if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
                  if (deptFilter !== 'all' && s.department !== deptFilter) return false;
                  
                  return (
                    s.department === 'Recruitment' || 
                    s.department === 'Sales & Marketing' ||
                    s.jobTitle.toLowerCase().includes('consultant')
                  );
                });

                if (recruitersList.length === 0) {
                  return (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                        No recruiters found matching the filtered company or department.
                      </td>
                    </tr>
                  );
                }

                return recruitersList.map(rec => {
                  const employer = companies.find(c => c.id === rec.companyId);
                  
                  // Period Billings (within selected start and end months range)
                  const periodPlacements = placements.filter(p => {
                    if (!p.startDate) return false;
                    const startMonthKey = p.startDate.substring(0, 7);
                    if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
                    return p.splits?.some(s => s.staffId === rec.id);
                  });

                  const periodBillings = periodPlacements.reduce((sum, p) => {
                    const splitObj = p.splits.find(s => s.staffId === rec.id);
                    const share = splitObj ? (Number(p.netScoreValue) * splitObj.percentage) / 100 : 0;
                    return sum + toGBP(share, 'GBP');
                  }, 0);

                  const annualSalaryGBP = toGBP(rec.salary, rec.currency);
                  const ratio = periodBillings > 0 ? (annualSalaryGBP / periodBillings) * 100 : 0;

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
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600 }}>{rec.fullName}</td>
                      <td>{rec.department} &bull; {employer ? employer.name : 'Group'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatGBP(annualSalaryGBP)}</td>
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
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          TAB 6: RECRUITER LEAGUES
          ============================================================== */}
      {activeTab === 'leagues' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Billings rank */}
          <div className="table-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Rankings by Period Billings</h3>
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Rank</th>
                  <th>Recruiter Name</th>
                  <th style={{ textAlign: 'right' }}>Total Billings</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const billingsRankList = staff.map(rec => {
                    // Filter by company/department
                    if (companyFilter !== 'all' && rec.companyId !== companyFilter) return null;
                    if (deptFilter !== 'all' && rec.department !== deptFilter) return null;

                    const recPlacements = placements.filter(p => {
                      if (!p.startDate) return false;
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
                          No billings logged.
                        </td>
                      </tr>
                    );
                  }

                  return billingsRankList.map((item, idx) => (
                    <tr key={item.rec.id}>
                      <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                      <td>{item.rec.fullName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {formatGBP(item.totalVal)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Volume rank */}
          <div className="table-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Rankings by Placement Count</h3>
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>Rank</th>
                  <th>Recruiter Name</th>
                  <th style={{ textAlign: 'right' }}>Placements Count</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const volumeRankList = staff.map(rec => {
                    // Filter by company/department
                    if (companyFilter !== 'all' && rec.companyId !== companyFilter) return null;
                    if (deptFilter !== 'all' && rec.department !== deptFilter) return null;

                    const recPlacementsCount = placements.filter(p => {
                      if (!p.startDate) return false;
                      const startMonthKey = p.startDate.substring(0, 7);
                      if (startMonthKey < startMonth || startMonthKey > endMonth) return false;
                      return p.splits?.some(s => s.staffId === rec.id);
                    }).length;

                    return { rec, count: recPlacementsCount };
                  })
                  .filter(Boolean)
                  .filter(item => item.count > 0)
                  .sort((a, b) => b.count - a.count);

                  if (volumeRankList.length === 0) {
                    return (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                          No placements recorded.
                        </td>
                      </tr>
                    );
                  }

                  return volumeRankList.map((item, idx) => (
                    <tr key={item.rec.id}>
                      <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                      <td>{item.rec.fullName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {item.count} {item.count === 1 ? 'placement' : 'placements'}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
