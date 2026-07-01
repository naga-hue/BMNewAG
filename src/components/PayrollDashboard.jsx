import React, { useState } from 'react';
import { 
  DollarSign, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  Search, 
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Users,
  Briefcase,
  Layers,
  BookOpen,
  Plus
} from 'lucide-react';
import { toGBP, formatGBP } from '../utils/currency';

const MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
];

export default function PayrollDashboard({
  companies = [],
  staff = [],
  commissionPolicies = [],
  placements = [],
  payrollRecords = [],
  expenses = [],
  nominalCodes = [],
  onSavePayrollRecord,
  onSaveExpense,
  onShowToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, reconciled, projected
  
  // Selected cell for override modal
  const [selectedCell, setSelectedCell] = useState(null); // { staffMember, month, basic, commission }
  
  // Modal editor states
  const [isReconciled, setIsReconciled] = useState(false);
  const [basicSalaryOverride, setBasicSalaryOverride] = useState('');
  const [commissionOverride, setCommissionOverride] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [bookExpense, setBookExpense] = useState(true);

  // FX Rates representation
  const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

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

  // Helper to calculate commission on placements starting in a specific month
  const calculateCommissionForRecruiter = (recruiterId, monthKey) => {
    const member = staff.find(s => s.id === recruiterId);
    if (!member) return 0;
    const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
    return calculateCashReceivedCommission(member, policy, monthKey, staff, companies, placements);
  };

  // Get active departments
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))].sort();

  // Helper to fetch cell status and values
  const getCellData = (staffMember, month) => {
    const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);
    
    // Project base monthly salaries in GBP
    const baselineBasic = toGBP(Number(staffMember.salary || 0) / 12, staffMember.currency || 'GBP');
    const baselineCommission = calculateCommissionForRecruiter(staffMember.id, month);

    if (record) {
      return {
        isReconciled: !!record.isReconciled,
        basic: record.isReconciled ? Number(record.basicSalary) : baselineBasic,
        commission: record.isReconciled ? Number(record.commission) : baselineCommission,
        total: record.isReconciled 
          ? (Number(record.basicSalary) + Number(record.commission)) 
          : (baselineBasic + baselineCommission),
        notes: record.notes || '',
        id: record.id
      };
    }

    return {
      isReconciled: false,
      basic: baselineBasic,
      commission: baselineCommission,
      total: baselineBasic + baselineCommission,
      notes: '',
      id: null
    };
  };

  // Open editor modal for specific cell
  const handleCellClick = (staffMember, month) => {
    const data = getCellData(staffMember, month);
    setSelectedCell({ staffMember, month });
    setIsReconciled(data.isReconciled);
    setBasicSalaryOverride(data.basic.toFixed(2));
    setCommissionOverride(data.commission.toFixed(2));
    setReconcileNotes(data.notes);
    setBookExpense(true);
  };

  // Save the override / reconciliation details
  const handleSaveOverride = async () => {
    if (!selectedCell) return;
    const { staffMember, month } = selectedCell;

    const baseVal = Number(basicSalaryOverride) || 0;
    const commVal = Number(commissionOverride) || 0;

    const record = {
      id: `${staffMember.id}_${month}`,
      staffId: staffMember.id,
      month,
      isReconciled,
      basicSalary: baseVal,
      commission: commVal,
      notes: reconcileNotes.trim()
    };

    try {
      // 1. Save the payroll record override
      await onSavePayrollRecord(record);

      // 2. Double-entry bookkeeping: Auto-create Expense if checked and reconciled
      if (isReconciled && bookExpense) {
        const totalPayout = baseVal + commVal;
        
        // Find existing Salaries nominal code, or fallback
        const salaryNominal = nominalCodes.find(c => c.id === '500' || c.code?.includes('500') || c.code?.toLowerCase().includes('salary'))?.code || '500 - Salaries & Wages';

        const expObj = {
          id: `payroll-exp-${staffMember.id}-${month}`,
          date: `${month}-28`, // standard monthly paydate
          payee: `Payroll: ${staffMember.fullName}`,
          amount: totalPayout,
          currency: 'GBP',
          nominalCode: salaryNominal,
          allocationType: 'staff',
          allocationTarget: [staffMember.id],
          plMonth: month,
          notes: `Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
        };

        await onSaveExpense(expObj);
      }

      onShowToast(`Payroll details saved for ${staffMember.fullName} (${month})`, 'success');
      setSelectedCell(null);
    } catch (err) {
      onShowToast(`Error saving overrides: ${err.message}`, 'warning');
    }
  };

  // Roster listing filtering
  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompanyId === 'all' || s.companyId === selectedCompanyId;
    const matchesDept = selectedDept === 'all' || s.department === selectedDept;
    
    // Status check (reconciled vs projected)
    if (selectedStatus !== 'all') {
      const cellStatuses = MONTHS.map(m => getCellData(s, m).isReconciled);
      const hasReconciled = cellStatuses.some(status => status === true);
      if (selectedStatus === 'reconciled' && !hasReconciled) return false;
      if (selectedStatus === 'projected' && hasReconciled && cellStatuses.every(status => status === true)) return false;
    }

    return matchesSearch && matchesCompany && matchesDept;
  });

  // Roster Grouping Logic: Group by Company, then by Department
  const groupedRoster = {};
  filteredStaff.forEach(s => {
    const compId = s.companyId || 'unassigned';
    const dept = s.department || 'Other';

    if (!groupedRoster[compId]) groupedRoster[compId] = {};
    if (!groupedRoster[compId][dept]) groupedRoster[compId][dept] = [];
    groupedRoster[compId][dept].push(s);
  });

  // Calculate monthly summaries for visual indicator row
  const monthlyTotals = MONTHS.map(m => {
    let totalBasic = 0;
    let totalComm = 0;
    let totalPaid = 0;
    let countReconciled = 0;

    filteredStaff.forEach(s => {
      const data = getCellData(s, m);
      totalBasic += data.basic;
      totalComm += data.commission;
      totalPaid += data.total;
      if (data.isReconciled) countReconciled++;
    });

    return {
      month: m,
      basic: totalBasic,
      commission: totalComm,
      total: totalPaid,
      reconciledCount: countReconciled
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      
      {/* Top Banner Details */}
      <div className="detail-section" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
            <DollarSign size={28} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Spreadsheet Forecast & Actuals Ledgers</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Interactive workspace for group-wide salaries and commissions normalized to GBP (£). Click on any monthly cell to reconcile with your bank statement uploads or book expenses directly.
            </p>
          </div>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search staff name..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="all">All Group Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Cell Statuses</option>
            <option value="reconciled">Has Reconciled Months</option>
            <option value="projected">Projections Only</option>
          </select>
        </div>
      </div>

      {/* Roster Spreadsheet Scroll Grid */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table className="entity-table dense" style={{ minWidth: '1600px', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ width: '220px', minWidth: '220px', left: 0, position: 'sticky', backgroundColor: 'var(--bg-secondary)', zIndex: 12, borderRight: '2px solid var(--border-color)' }}>
                Staff Member
              </th>
              <th style={{ width: '130px', minWidth: '130px', borderRight: '1px solid var(--border-color)' }}>
                Basic Salary (Base)
              </th>
              
              {/* Month Columns */}
              {MONTHS.map(m => {
                const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                return (
                  <th key={m} style={{ textAlign: 'center', minWidth: '100px' }}>
                    {label}
                  </th>
                );
              })}
              
              <th style={{ width: '130px', minWidth: '130px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid var(--border-color)' }}>
                Annual Total (£)
              </th>
            </tr>
          </thead>
          <tbody>
            
            {/* Iterating Companies */}
            {companies
              .filter(c => selectedCompanyId === 'all' || c.id === selectedCompanyId)
              .map(c => {
                const depts = groupedRoster[c.id];
                if (!depts || Object.keys(depts).length === 0) return null;

                return (
                  <React.Fragment key={c.id}>
                    
                    {/* Company Roster Subheader */}
                    <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                      <td colSpan={MONTHS.length + 3} style={{ fontWeight: 700, padding: '8px 12px', fontSize: '11px', color: 'var(--accent)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={12} />
                          {c.name.toUpperCase()} ({c.country})
                        </div>
                      </td>
                    </tr>

                    {/* Iterating Departments inside Company */}
                    {Object.keys(depts)
                      .filter(d => selectedDept === 'all' || d === selectedDept)
                      .map(d => {
                        const members = depts[d];
                        if (members.length === 0) return null;

                        return (
                          <React.Fragment key={d}>
                            
                            {/* Department title */}
                            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                              <td colSpan={MONTHS.length + 3} style={{ fontWeight: 600, padding: '6px 16px', fontSize: '10px', color: 'var(--text-secondary)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Layers size={10} />
                                  {d} Team
                                </div>
                              </td>
                            </tr>

                            {/* Recruiter Rows */}
                            {members.map(s => {
                              let annualSum = 0;
                              const symbol = symbolMap[s.currency || 'GBP'] || '£';

                              return (
                                <tr key={s.id} hover="true">
                                  {/* Recruiter Sticky Profile cell */}
                                  <td style={{ 
                                    left: 0, 
                                    position: 'sticky', 
                                    backgroundColor: 'var(--bg-card)', 
                                    zIndex: 6, 
                                    borderRight: '2px solid var(--border-color)',
                                    padding: '8px 12px' 
                                  }}>
                                    <div style={{ fontWeight: 600, fontSize: '12px' }}>
                                      {s.fullName}
                                      {s.status === 'exited' && (
                                        <span style={{ marginLeft: '4px', fontSize: '8px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 3px', borderRadius: '3px' }}>Exited</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.jobTitle}</div>
                                  </td>

                                  {/* Basic Contract Roster */}
                                  <td style={{ fontSize: '11px', borderRight: '1px solid var(--border-color)' }}>
                                    {symbol}{Number(s.salary).toLocaleString()} / yr
                                  </td>

                                  {/* Render Cells dynamically */}
                                  {MONTHS.map(m => {
                                    const cell = getCellData(s, m);
                                    annualSum += cell.total;

                                    return (
                                      <td 
                                        key={m}
                                        onClick={() => handleCellClick(s, m)}
                                        style={{ 
                                          textAlign: 'center', 
                                          cursor: 'pointer', 
                                          fontSize: '11px',
                                          fontWeight: cell.isReconciled ? 600 : 400,
                                          position: 'relative',
                                          transition: 'all 0.15s'
                                        }}
                                        className={`payroll-cell ${cell.isReconciled ? 'reconciled' : 'projected'}`}
                                        title={`${s.fullName} - ${m}\nSalary: £${Math.round(cell.basic).toLocaleString()}\nComm: £${Math.round(cell.commission).toLocaleString()}\nClick to edit override`}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span>£{Math.round(cell.total).toLocaleString()}</span>
                                          {cell.isReconciled ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontSize: '8px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                                              <CheckCircle2 size={7} /> Paid
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                                              Proj
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}

                                  {/* Annual Total Cell */}
                                  <td style={{ 
                                    textAlign: 'right', 
                                    fontWeight: 700, 
                                    fontFamily: 'monospace', 
                                    borderLeft: '2px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    fontSize: '12px'
                                  }}>
                                    £{Math.round(annualSum).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}

            {/* Matrix totals Row */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700 }}>
              <td style={{ left: 0, position: 'sticky', backgroundColor: 'var(--bg-secondary)', zIndex: 8, borderRight: '2px solid var(--border-color)' }}>
                GROUP TOTALS COST
              </td>
              <td style={{ borderRight: '1px solid var(--border-color)' }}>—</td>
              
              {monthlyTotals.map((tot, idx) => (
                <td key={idx} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span>£{Math.round(tot.total).toLocaleString()}</span>
                    <span style={{ fontSize: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      Recon: {tot.reconciledCount}
                    </span>
                  </div>
                </td>
              ))}
              
              <td style={{ textAlign: 'right', borderLeft: '2px solid var(--border-color)', fontSize: '12px', fontFamily: 'monospace' }}>
                £{Math.round(monthlyTotals.reduce((sum, t) => sum + t.total, 0)).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Override Modal */}
      {selectedCell !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  📝 Payroll Override & Reconciliation
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedCell.staffMember.fullName} &bull; {selectedCell.month}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedCell(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Reconciliation Status Toggle */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px', 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>Mark Month Reconciled / Paid</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overwrites baseline formulas and locks cell payout</div>
                </div>
                <input 
                  type="checkbox"
                  checked={isReconciled}
                  onChange={(e) => setIsReconciled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Basic Salary Override Field */}
              <div className="form-group">
                <label className="form-label">
                  Basic Salary Component (£ GBP) <span>*</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={basicSalaryOverride}
                  onChange={(e) => setBasicSalaryOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {/* Commission Override Field */}
              <div className="form-group">
                <label className="form-label">
                  Commission Component (£ GBP) <span>*</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={commissionOverride}
                  onChange={(e) => setCommissionOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {/* Total Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Total Net Payout:</span>
                <span style={{ color: 'var(--success)' }}>
                  £{(Number(basicSalaryOverride) + Number(commissionOverride)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Bookkeeping Notes / Reference</label>
                <textarea 
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Cleared via Barclays Statement Ref #48192"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', resize: 'none' }}
                />
              </div>

              {/* Auto Book Expense option */}
              {isReconciled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox"
                    checked={bookExpense}
                    onChange={(e) => setBookExpense(e.target.checked)}
                    id="auto-book-expense-check"
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="auto-book-expense-check" style={{ cursor: 'pointer' }}>
                    Auto-book matching transaction to nominal ledger category **500 - Salaries**
                  </label>
                </div>
              )}

            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCell(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={handleSaveOverride}
              >
                Save Roster Cell
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
