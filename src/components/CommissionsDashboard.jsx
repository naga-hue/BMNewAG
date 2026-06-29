import React, { useState } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Building2, 
  Users, 
  Percent, 
  Settings, 
  Briefcase,
  HelpCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Lock,
  Wallet,
  ArrowRight,
  Info
} from 'lucide-react';

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

export default function CommissionsDashboard({ 
  companies = [], 
  staff = [], 
  commissionPolicies = [], 
  placements = [],
  onSavePolicy, 
  onDeletePolicy, 
  onUpdateStaff,
  onShowToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('policies'); // policies, assignments, payroll

  // Form states - Scheme creator
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [type, setType] = useState('individual'); // individual | manager
  const [effectiveFrom, setEffectiveFrom] = useState('day_one'); // day_one | one_year_service
  const [monthlyThreshold, setMonthlyThreshold] = useState('3000');
  const [teamOverridePercent, setTeamOverridePercent] = useState('2.5');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Slabs setup
  const [slabs, setSlabs] = useState([
    { minAmount: 0, maxAmount: 10000, rate: 10 },
    { minAmount: 10000, maxAmount: 15000, rate: 15 },
    { minAmount: 15000, maxAmount: 999999, rate: 20 }
  ]);

  // Central Payroll Month state
  const [payrollMonth, setPayrollMonth] = useState('2026-06');

  // Filters & Sorting states
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');

  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc'); // asc or desc

  const handleHeaderClick = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const handleAddSlabRow = () => {
    const lastSlab = slabs[slabs.length - 1];
    const nextMin = lastSlab ? lastSlab.maxAmount : 0;
    setSlabs(prev => [...prev, { minAmount: nextMin, maxAmount: nextMin + 5000, rate: 10 }]);
  };

  const handleRemoveSlabRow = (index) => {
    if (slabs.length <= 1) {
      onShowToast("Policy must have at least one billing slab.", "warning");
      return;
    }
    setSlabs(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSlab = (index, field, value) => {
    setSlabs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(value) };
      return copy;
    });
  };

  // Submit Policy Creation
  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !companyId || !monthlyThreshold) {
      onShowToast("Please enter all required scheme fields.", "warning");
      return;
    }

    const sortedSlabs = [...slabs].sort((a, b) => a.minAmount - b.minAmount);

    const newPolicy = {
      id: `comm-${Date.now()}`,
      name: name.trim(),
      companyId,
      type,
      effectiveFrom,
      monthlyThreshold: Number(monthlyThreshold),
      slabs: sortedSlabs,
      teamOverridePercent: type === 'manager' ? Number(teamOverridePercent) : 0,
      description: description.trim()
    };

    try {
      await onSavePolicy(newPolicy);
      onShowToast(`Successfully created commission scheme "${name}"`, "success");
      
      // Reset form
      setName('');
      setDescription('');
      setType('individual');
      setEffectiveFrom('day_one');
      setMonthlyThreshold('3000');
      setTeamOverridePercent('2.5');
      setSlabs([
        { minAmount: 0, maxAmount: 10000, rate: 10 },
        { minAmount: 10000, maxAmount: 15000, rate: 15 },
        { minAmount: 15000, maxAmount: 999999, rate: 20 }
      ]);
      setShowForm(false);
    } catch (err) {
      onShowToast(`Error saving scheme: ${err.message}`, "warning");
    }
  };

  // Assign policy to user
  const handleAssignPolicy = async (staffId, policyId) => {
    const employee = staff.find(s => s.id === staffId);
    if (!employee) return;

    const updatedEmployee = { ...employee, commissionPolicyId: policyId || '' };
    try {
      await onUpdateStaff(updatedEmployee);
      onShowToast(`Updated commission mapping for ${employee.fullName}`, 'success');
    } catch (err) {
      onShowToast(`Error updating assignment: ${err.message}`, 'warning');
    }
  };

  // Cash-Received Payroll Calculation Math
  const calculateCashReceivedCommission = (member, policy, monthStr) => {
    if (!policy) {
      return { 
        billing: 0, 
        baseEarned: 0, 
        withheld: 0, 
        paidNow: 0, 
        released: 0, 
        totalPayout: 0, 
        currentPlacements: [], 
        releasedPlacements: [], 
        historicalWithheld: [] 
      };
    }

    const [payYear, payMonth] = monthStr.split('-').map(Number);
    
    // Placements evaluated are those starting in the PREVIOUS month
    let cycleYear = payYear;
    let cycleMonth = payMonth - 1;
    if (cycleMonth === 0) {
      cycleMonth = 12;
      cycleYear = payYear - 1;
    }

    const teamMembers = staff.filter(s => s.reportingManagerId === member.id);
    const targetStaffIds = policy.type === 'manager' 
      ? [member.id, ...teamMembers.map(s => s.id)]
      : [member.id];

    // Helper to calculate total recruiter split billing for a specific start month
    const getRecruiterBillingForStartMonth = (yearVal, monthVal) => {
      let sum = 0;
      placements.forEach(p => {
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

    // Helper to apply slabs to a billing amount
    const getPolicyCommission = (billingAmt) => {
      const thresh = Number(policy.monthlyThreshold) || 0;
      const commissionable = Math.max(0, billingAmt - thresh);
      const slabs = policy.slabs || [];
      let earned = 0;
      let remaining = commissionable;

      if (commissionable > 0) {
        for (const slab of slabs) {
          const min = Number(slab.minAmount) || 0;
          const max = Number(slab.maxAmount) || 999999;
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

    const currentPlacements = [];
    let totalPaidNow = 0;
    let totalWithheld = 0;

    placements.forEach(p => {
      if (!p.startDate) return;
      const pStart = new Date(p.startDate);
      if (pStart.getFullYear() === cycleYear && (pStart.getMonth() + 1) === cycleMonth) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
          const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;
          
          // Proportional commission share
          const myCommShare = currentCycleBilling > 0 
            ? (myBillingShare / currentCycleBilling) * baseEarned 
            : 0;

          const isPaid = p.clientPaymentStatus === 'paid';
          if (isPaid) {
            totalPaidNow += myCommShare;
          } else {
            totalWithheld += myCommShare;
          }

          currentPlacements.push({
            id: p.id,
            placementId: p.placementId,
            clientCompany: p.clientCompany,
            candidateName: p.candidateName,
            startDate: p.startDate,
            netScoreValue: p.netScoreValue,
            mySplitPct: totalSplitPct,
            myBillingShare,
            myCommShare,
            paymentStatus: p.clientPaymentStatus,
            clientPaidDate: p.clientPaidDate
          });
        }
      }
    });

    // 2. Releases from Prior Withholds (starts before the previous month)
    const releasedPlacements = [];
    const historicalWithheld = [];
    let totalReleased = 0;

    placements.forEach(p => {
      if (!p.startDate) return;
      const pStart = new Date(p.startDate);
      const pStartYear = pStart.getFullYear();
      const pStartMonth = pStart.getMonth() + 1;

      // strictly prior to the current cycle month
      const isPriorStart = pStartYear < cycleYear || (pStartYear === cycleYear && pStartMonth < cycleMonth);

      if (isPriorStart) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
          const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;

          // Reconstruct historical month's aggregate
          const histCycleBilling = getRecruiterBillingForStartMonth(pStartYear, pStartMonth);
          const histBaseEarned = getPolicyCommission(histCycleBilling);

          const myCommShare = histCycleBilling > 0 
            ? (myBillingShare / histCycleBilling) * histBaseEarned 
            : 0;

          if (myCommShare > 0) {
            const isPaid = p.clientPaymentStatus === 'paid';
            
            // Check if clientPaidDate falls in the current payroll month
            let paidInCurrentMonth = false;
            if (p.clientPaidDate) {
              const pPaidDate = new Date(p.clientPaidDate);
              paidInCurrentMonth = pPaidDate.getFullYear() === payYear && (pPaidDate.getMonth() + 1) === payMonth;
            }

            if (isPaid && paidInCurrentMonth) {
              totalReleased += myCommShare;
              releasedPlacements.push({
                id: p.id,
                placementId: p.placementId,
                clientCompany: p.clientCompany,
                candidateName: p.candidateName,
                startDate: p.startDate,
                myBillingShare,
                myCommShare,
                clientPaidDate: p.clientPaidDate
              });
            } else if (!isPaid) {
              historicalWithheld.push({
                id: p.id,
                placementId: p.placementId,
                clientCompany: p.clientCompany,
                candidateName: p.candidateName,
                startDate: p.startDate,
                myBillingShare,
                myCommShare
              });
            }
          }
        }
      }
    });

    return {
      billing: currentCycleBilling,
      baseEarned,
      withheld: totalWithheld,
      paidNow: totalPaidNow,
      released: totalReleased,
      totalPayout: totalPaidNow + totalReleased,
      currentPlacements,
      releasedPlacements,
      historicalWithheld
    };
  };

  // Mark monthly commission as paid/unpaid
  const handleTogglePayment = async (member, isPaid) => {
    const paidMonths = member.paidCommissions || [];
    let updatedPaid = [];
    
    if (isPaid) {
      if (!paidMonths.includes(payrollMonth)) {
        updatedPaid = [...paidMonths, payrollMonth];
      } else {
        updatedPaid = paidMonths;
      }
    } else {
      updatedPaid = paidMonths.filter(m => m !== payrollMonth);
    }

    const updated = {
      ...member,
      paidCommissions: updatedPaid
    };

    try {
      await onUpdateStaff(updated);
      onShowToast(
        isPaid 
          ? `Marked ${member.fullName}'s commission for ${payrollMonth} as Paid.` 
          : `Reset ${member.fullName}'s commission for ${payrollMonth} to Unpaid.`, 
        "success"
      );
    } catch (err) {
      onShowToast(`Error updating payment state: ${err.message}`, "warning");
    }
  };

  // Compile full payroll listing for selected month
  const getPayrollLedger = () => {
    let totalBilled = 0;
    let totalPayable = 0;
    let totalPaid = 0;

    const list = staff
      .filter(s => s.commissionPolicyId) // mapped staff
      .map(member => {
        const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
        const calc = calculateCashReceivedCommission(member, policy, payrollMonth);
        const isPaid = member.paidCommissions?.includes(payrollMonth) || false;

        totalBilled += calc.billing;
        totalPayable += calc.totalPayout;
        if (isPaid) {
          totalPaid += calc.totalPayout;
        }

        return {
          member,
          policy,
          calc,
          isPaid
        };
      });

    return {
      list,
      totalBilled,
      totalPayable,
      totalPaid,
      totalUnpaid: Math.max(0, totalPayable - totalPaid)
    };
  };

  const ledgerData = getPayrollLedger();

  // Helper to extract name of cycle month, e.g. "2026-06" -> "May 2026"
  const getCycleMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const date = new Date(prevYear, prevMonth - 1, 15);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tab Navigation */}
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
          { key: 'policies', label: 'Commission Schemes' },
          { key: 'assignments', label: 'Recruiter Assignments' },
          { key: 'payroll', label: 'Commissions Payroll Ledger' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              color: activeSubTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==============================================================
          SUB-TAB 1: SCHEMES CONFIGURATOR
          ============================================================== */}
      {activeSubTab === 'policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Commission Scheme Configurator</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage tiered brackets, thresholds, and override bonuses across the group.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowForm(prev => !prev)}>
              <Plus size={16} /> Create Incentive Plan
            </button>
          </div>

          {/* Creation Form */}
          {showForm && (
            <form onSubmit={handlePolicySubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> Create Corporate Incentive Plan
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Plan Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. UK Consultant day-one scheme"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Employer Company <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Scheme Type <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="individual">Recruiter / consultant billing</option>
                    <option value="manager">Manager Team-Billing Plan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Delay Rule <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="day_one">Starts Day One</option>
                    <option value="one_year_service">Unlocked after 1 Year of Service</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Monthly Deductible Threshold <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="Billing limit"
                    value={monthlyThreshold}
                    onChange={(e) => setMonthlyThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Dynamic Slabs Setup */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Commission slabs / billing brackets</label>
                  <button type="button" className="btn-secondary" onClick={handleAddSlabRow} style={{ padding: '4px 10px', fontSize: '11px' }}>
                    + Add Bracket Row
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {slabs.map((slab, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Min Billings</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={slab.minAmount}
                          onChange={(e) => handleUpdateSlab(idx, 'minAmount', e.target.value)}
                          required 
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Billings</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={slab.maxAmount}
                          onChange={(e) => handleUpdateSlab(idx, 'maxAmount', e.target.value)}
                          required 
                        />
                      </div>
                      <div style={{ width: '100px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Rate (%)</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={slab.rate}
                          onChange={(e) => handleUpdateSlab(idx, 'rate', e.target.value)}
                          required 
                        />
                      </div>
                      <button 
                        type="button" 
                        className="btn-icon delete" 
                        onClick={() => handleRemoveSlabRow(idx)}
                        style={{ marginTop: '14px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Brief Description</label>
                <textarea 
                  className="form-input" 
                  rows="2"
                  placeholder="Additional eligibility parameters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Save Commission Scheme
              </button>
            </form>
          )}

          {/* Schemes grid */}
          <div className="entities-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {commissionPolicies.map(p => {
              const matchedComp = companies.find(c => c.id === p.companyId);
              const mappedStaffCount = staff.filter(s => s.commissionPolicyId === p.id).length;
              const symbol = matchedComp ? (symbolMap[matchedComp.currency] || '£') : '£';

              return (
                <div key={p.id} className="entity-card" style={{ height: 'auto', padding: '16px' }}>
                  <div className="entity-card-header" style={{ marginBottom: '8px' }}>
                    <div className="entity-title-group">
                      <span className="entity-name" style={{ fontSize: '15px' }}>{p.name}</span>
                      <span className="entity-legal-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={12} />
                        {matchedComp ? matchedComp.name : 'Unknown Employer'}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {p.description || "No description provided."}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                    <div>Type: <strong style={{ textTransform: 'capitalize' }}>{p.type === 'manager' ? 'Manager Team-Billing' : 'Recruiter'} plan</strong></div>
                    <div>Unlocks: <strong>{p.effectiveFrom === 'day_one' ? 'Day One' : 'After 1 year service'}</strong></div>
                    <div>Monthly Threshold: <strong>{symbol}{Number(p.monthlyThreshold).toLocaleString()}</strong></div>
                  </div>

                  {/* Slabs summary */}
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Incentive Brackets</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(p.slabs || []).map((slab, idx) => (
                        <span 
                          key={idx} 
                          style={{ 
                            fontSize: '11px', 
                            background: 'rgba(255,255,255,0.04)', 
                            border: '1px solid var(--border-color)', 
                            padding: '3px 8px', 
                            borderRadius: '4px' 
                          }}
                        >
                          {symbol}{slab.minAmount >= 999999 ? '∞' : Math.round(slab.minAmount/1000) + 'K'}-{slab.maxAmount >= 999999 ? '∞' : Math.round(slab.maxAmount/1000) + 'K'}: <strong>{slab.rate}%</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} /> {mappedStaffCount} Assigned
                    </span>
                    <button 
                      className="btn-icon delete" 
                      onClick={() => {
                        if (mappedStaffCount > 0) {
                          onShowToast("Cannot delete scheme. Staff profiles are currently mapped to this commission scheme.", "warning");
                          return;
                        }
                        if (window.confirm(`Are you sure you want to delete scheme "${p.name}"?`)) {
                          onDeletePolicy(p.id);
                          onShowToast(`Deleted scheme "${p.name}"`, "info");
                        }
                      }}
                      title="Delete Policy"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 2: ASSIGNMENT DESK
          ============================================================== */}
      {activeSubTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Recruiter Assignment Desk</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Map employees to their respective group commission structures.</p>
          </div>

          {/* Universal Filters Toolbar */}
          <div className="controls-row" style={{ marginTop: 0 }}>
            <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <select 
                className="select-filter"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="all">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Allocated</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th onClick={() => handleHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Employee Name {renderSortIndicator('fullName')}
                  </th>
                  <th onClick={() => handleHeaderClick('companyId')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Employer Entity {renderSortIndicator('companyId')}
                  </th>
                  <th onClick={() => handleHeaderClick('jobTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Designation / Title {renderSortIndicator('jobTitle')}
                  </th>
                  <th>Commission Scheme Allocation</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredAssignmentsStaff = staff.filter(s => {
                    if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
                    if (deptFilter !== 'all' && s.department !== deptFilter) return false;
                    if (staffFilter !== 'all' && s.id !== staffFilter) return false;
                    return true;
                  });

                  const sortedAssignmentsStaff = [...filteredAssignmentsStaff].sort((a, b) => {
                    let valA = a[sortBy] || '';
                    let valB = b[sortBy] || '';

                    if (sortBy === 'fullName' || sortBy === 'jobTitle') {
                      valA = String(valA).toLowerCase();
                      valB = String(valB).toLowerCase();
                    } else if (sortBy === 'companyId') {
                      const compA = companies.find(c => c.id === a.companyId)?.name || '';
                      const compB = companies.find(c => c.id === b.companyId)?.name || '';
                      valA = compA.toLowerCase();
                      valB = compB.toLowerCase();
                    }

                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                  });

                  if (sortedAssignmentsStaff.length === 0) {
                    return (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                          No staff matches the filters.
                        </td>
                      </tr>
                    );
                  }

                  return sortedAssignmentsStaff.map(s => {
                    const employer = companies.find(c => c.id === s.companyId);
                    const companyPolicies = commissionPolicies.filter(p => p.companyId === s.companyId);

                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                        <td>{employer ? employer.name : 'Group'}</td>
                        <td>{s.jobTitle}</td>
                        <td>
                          <select 
                            className="select-filter"
                            value={s.commissionPolicyId || ''}
                            onChange={(e) => handleAssignPolicy(s.id, e.target.value)}
                            style={{ width: '100%', maxWidth: '280px', padding: '6px' }}
                          >
                            <option value="">-- No Incentive Plan --</option>
                            {companyPolicies.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: COMMISSIONS PAYROLL LEDGER (CASH BASIS)
          ============================================================== */}
      {activeSubTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Commissions Payroll & Payables Ledger</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Cash-Received Basis: Evaluates placements starting in **{getCycleMonthName(payrollMonth)}** reviewed on the 25th of **{payrollMonth}**.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Select Payroll Month:</span>
              <input
                type="month"
                className="select-filter"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                style={{ padding: '6px' }}
              />
            </div>
          </div>

          {/* Group Payout KPI Summaries */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            
            <div className="metric-card" style={{ '--card-accent': 'var(--primary)', '--card-accent-light': 'var(--primary-light)', padding: '16px' }}>
              <div className="metric-info">
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Cycle Split Billings ({getCycleMonthName(payrollMonth)})</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>£{ledgerData.totalBilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Gross placements score</div>
              </div>
            </div>

            <div className="metric-card" style={{ '--card-accent': 'var(--warning)', '--card-accent-light': 'var(--warning-light)', padding: '16px' }}>
              <div className="metric-info">
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Payable Payout (Cash Basis)</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--warning)' }}>£{ledgerData.totalPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Paid current + released priors</div>
              </div>
            </div>

            <div className="metric-card" style={{ '--card-accent': 'var(--success)', '--card-accent-light': 'var(--success-light)', padding: '16px' }}>
              <div className="metric-info">
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Payouts Marked Disbursed</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>£{ledgerData.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Paid with wages this month</div>
              </div>
            </div>

            <div className="metric-card" style={{ '--card-accent': 'var(--danger)', '--card-accent-light': 'var(--danger-light)', padding: '16px' }}>
              <div className="metric-info">
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Outstanding Period Balance</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--danger)' }}>£{ledgerData.totalUnpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Owed to consultants</div>
              </div>
            </div>

          </div>

          {/* Cash Received Explanation Note */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            padding: '12px 16px', 
            backgroundColor: 'rgba(99, 102, 241, 0.05)', 
            border: '1px solid rgba(99, 102, 241, 0.15)', 
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            alignItems: 'center'
          }}>
            <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div>
              <strong>Cash-Received Rule</strong>: Recruiters are paid commissions for placements starting in the previous month, provided the client settles the invoice. Unpaid client invoices trigger a commission <strong>Withhold</strong>. If the client pays in subsequent months, the withheld share is <strong>Released</strong> and added to the current period payout.
            </div>
          </div>

          {/* Universal Filters Toolbar */}
          <div className="controls-row" style={{ marginTop: 0 }}>
            <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <select 
                className="select-filter"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="all">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Allocated</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="table-container">
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th onClick={() => handleHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Recruiter Name {renderSortIndicator('fullName')}
                  </th>
                  <th>Incentive Plan</th>
                  <th onClick={() => handleHeaderClick('billing')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Cycle Billings {renderSortIndicator('billing')}
                  </th>
                  <th onClick={() => handleHeaderClick('baseEarned')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Base Earned {renderSortIndicator('baseEarned')}
                  </th>
                  <th onClick={() => handleHeaderClick('withheld')} style={{ textAlign: 'right', color: 'var(--danger)', cursor: 'pointer', userSelect: 'none' }}>
                    Withheld (Unpaid) {renderSortIndicator('withheld')}
                  </th>
                  <th onClick={() => handleHeaderClick('released')} style={{ textAlign: 'right', color: 'var(--success)', cursor: 'pointer', userSelect: 'none' }}>
                    Released (Settled) {renderSortIndicator('released')}
                  </th>
                  <th onClick={() => handleHeaderClick('netPayable')} style={{ textAlign: 'right', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>
                    Net Payable Payout {renderSortIndicator('netPayable')}
                  </th>
                  <th>Disbursal Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredLedger = ledgerData.list.filter(row => {
                    const s = row.member;
                    if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
                    if (deptFilter !== 'all' && s.department !== deptFilter) return false;
                    if (staffFilter !== 'all' && s.id !== staffFilter) return false;
                    return true;
                  });

                  const sortedLedger = [...filteredLedger].sort((a, b) => {
                    let valA = a.member[sortBy] || '';
                    let valB = b.member[sortBy] || '';

                    if (sortBy === 'fullName') {
                      valA = String(valA).toLowerCase();
                      valB = String(valB).toLowerCase();
                    } else if (sortBy === 'billing' || sortBy === 'baseEarned' || sortBy === 'withheld' || sortBy === 'released' || sortBy === 'netPayable') {
                      const keyMap = {
                        billing: 'billing',
                        baseEarned: 'baseEarned',
                        withheld: 'withheld',
                        released: 'released',
                        netPayable: 'payablePayout'
                      };
                      const resolvedKey = keyMap[sortBy];
                      valA = Number(a.calc[resolvedKey]) || 0;
                      valB = Number(b.calc[resolvedKey]) || 0;
                    }

                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
                  });

                  if (sortedLedger.length === 0) {
                    return (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          No ledger records match search criteria.
                        </td>
                      </tr>
                    );
                  }

                  return sortedLedger.map(row => {
                  const matchedComp = companies.find(c => c.id === row.member.companyId);
                  const symbol = matchedComp ? (symbolMap[matchedComp.currency] || '£') : '£';

                  return (
                    <tr key={row.member.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.member.fullName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.member.jobTitle}</div>
                      </td>
                      <td style={{ fontSize: '11px' }}>{row.policy ? row.policy.name : '—'}</td>
                      
                      {/* Cycle billings (previous month starts) */}
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {symbol}{row.calc.billing.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      
                      {/* Base earned */}
                      <td style={{ textAlign: 'right' }}>
                        {symbol}{row.calc.baseEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Withheld portion (unpaid invoices in cycle) */}
                      <td style={{ textAlign: 'right', color: row.calc.withheld > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {row.calc.withheld > 0 ? `-${symbol}${row.calc.withheld.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>

                      {/* Released portion (priors settled this month) */}
                      <td style={{ textAlign: 'right', color: row.calc.released > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {row.calc.released > 0 ? `+${symbol}${row.calc.released.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>

                      {/* Net payout (Paid Now + Released) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: row.calc.totalPayout > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                        {symbol}{row.calc.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td>
                        {row.calc.totalPayout <= 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                            No Payout Due
                          </span>
                        ) : row.isPaid ? (
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: 'var(--success)', 
                            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                            padding: '3px 8px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(16, 185, 129, 0.2)' 
                          }}>
                            Paid Statement
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            color: 'var(--danger)', 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                            padding: '3px 8px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.2)' 
                          }}>
                            Payable (Unpaid)
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {row.calc.totalPayout > 0 && (
                            row.isPaid ? (
                              <button 
                                className="btn-secondary"
                                onClick={() => handleTogglePayment(row.member, false)}
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                Reset to Unpaid
                              </button>
                            ) : (
                              <button 
                                className="btn-primary"
                                onClick={() => handleTogglePayment(row.member, true)}
                                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}
                              >
                                Mark as Paid
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
              {ledgerData.list.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No staff members mapped to commission structures.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
