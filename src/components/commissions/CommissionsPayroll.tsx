import React, { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
// @ts-ignore
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff, Placement } from '../../types';
import { symbolMap, calculateCashReceivedCommission } from './utils';

interface CommissionsPayrollProps {
  companies: Company[];
  staff: Staff[];
  commissionPolicies: any[];
  placements: Placement[];
  onUpdateStaff: (s: Staff) => Promise<any>;
  onSavePlacement: (p: Placement) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  payrollMonth: string;
  setPayrollMonth: (month: string) => void;
  selectedBreakdownRow: any;
  setSelectedBreakdownRow: (row: any) => void;
}

export default function CommissionsPayroll({
  companies,
  staff,
  commissionPolicies,
  placements,
  onUpdateStaff,
  onSavePlacement,
  onShowToast,
  payrollMonth,
  setPayrollMonth,
  selectedBreakdownRow,
  setSelectedBreakdownRow
}: CommissionsPayrollProps) {

  // Filters state
  const [companyFilter, setCompanyFilter] = useState<string[]>(['all']);
  const [deptFilter, setDeptFilter] = useState<string[]>(['all']);
  const [staffFilter, setStaffFilter] = useState('all');

  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedExitedPayroll, setExpandedExitedPayroll] = useState(false);

  const allAvailableDepts = useMemo(() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach((d: any) => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  }, [companies, staff]);

  const companyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Companies' },
      ...companies.map(c => ({ value: c.id, label: c.name }))
    ];
  }, [companies]);

  const departmentOptionsList = useMemo(() => {
    return [
      { value: 'all', label: 'All Departments' },
      ...allAvailableDepts.map(d => ({ value: d, label: d }))
    ];
  }, [allAvailableDepts]);

  const handleHeaderClick = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const handleTogglePayment = async (member: Staff, isPaid: boolean) => {
    const paidMonths = (member as any).paidCommissions || [];
    let updatedPaid = [];
    
    if (isPaid) {
      if (!paidMonths.includes(payrollMonth)) {
        updatedPaid = [...paidMonths, payrollMonth];
      } else {
        updatedPaid = paidMonths;
      }
    } else {
      updatedPaid = paidMonths.filter((m: string) => m !== payrollMonth);
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
    } catch (err: any) {
      onShowToast(`Error updating payment state: ${err.message}`, "warning");
    }
  };

  const ledgerData = useMemo(() => {
    let totalBilled = 0;
    let totalPayable = 0;
    let totalPaid = 0;

    const list = staff
      .filter(s => s.commissionPolicyId)
      .map(member => {
        const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
        const calc = calculateCashReceivedCommission(member, policy, payrollMonth, staff, companies, placements);
        const isPaid = (member as any).paidCommissions?.includes(payrollMonth) || false;

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
  }, [staff, commissionPolicies, placements, payrollMonth, companies]);

  const getCycleMonthName = (monthStr: string) => {
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
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        
        <div className="metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Cycle Split Billings ({getCycleMonthName(payrollMonth)})</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>£{ledgerData.totalBilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Gross placements score</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Payable Payout (Cash Basis)</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--warning)' }}>£{ledgerData.totalPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Paid current + released priors</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Payouts Marked Disbursed</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>£{ledgerData.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Paid with wages this month</div>
          </div>
        </div>

        <div className="metric-card" style={{ padding: '16px' }}>
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
          <MultiSelectFilter
            options={companyOptions}
            selectedValues={companyFilter}
            onChange={(vals: string[]) => {
              setCompanyFilter(vals);
              setDeptFilter(['all']);
            }}
            placeholder="Select Companies"
          />

          <MultiSelectFilter
            options={departmentOptionsList}
            selectedValues={deptFilter}
            onChange={(vals: string[]) => setDeptFilter(vals)}
            placeholder="Select Departments"
          />

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
                if (!companyFilter.includes('all') && !companyFilter.includes(s.companyId)) return false;
                if (!deptFilter.includes('all') && !deptFilter.includes(s.department || '')) return false;
                if (staffFilter !== 'all' && s.id !== staffFilter) return false;
                return true;
              });

              const sortedLedger = [...filteredLedger].sort((a, b) => {
                let valA: any = a.member[sortBy as keyof Staff] || '';
                let valB: any = b.member[sortBy as keyof Staff] || '';

                if (sortBy === 'fullName') {
                  valA = String(valA).toLowerCase();
                  valB = String(valB).toLowerCase();
                } else if (['billing', 'baseEarned', 'withheld', 'released', 'netPayable'].includes(sortBy)) {
                  const keyMap: Record<string, string> = {
                    billing: 'billing',
                    baseEarned: 'baseEarned',
                    withheld: 'withheld',
                    released: 'released',
                    netPayable: 'totalPayout'
                  };
                  const resolvedKey = keyMap[sortBy];
                  valA = Number(a.calc[resolvedKey as keyof typeof a.calc]) || 0;
                  valB = Number(b.calc[resolvedKey as keyof typeof b.calc]) || 0;
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
              });

              if (sortedLedger.length === 0) {
                return (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No ledger records match search criteria.
                    </td>
                  </tr>
                );
              }

              const activeLedger = sortedLedger.filter(row => row.member.status !== 'exited');
              const exitedLedger = sortedLedger.filter(row => row.member.status === 'exited');

              const renderPayrollRow = (row: any) => {
                const matchedComp = companies.find(c => c.id === row.member.companyId);
                const symbol = matchedComp ? (symbolMap[matchedComp.currency] || '£') : '£';

                return (
                  <tr key={row.member.id} style={{ opacity: row.member.status === 'exited' ? 0.75 : 1 }}>
                    <td>
                      <div 
                        style={{ fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'none' }}
                        onClick={() => setSelectedBreakdownRow(row)}
                        title="Click to view detailed calculations"
                      >
                        {row.member.fullName} 🔍 {row.member.status === 'exited' && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>(Exited)</span>}
                      </div>
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button 
                          type="button"
                          className="btn-secondary"
                          onClick={() => setSelectedBreakdownRow(row)}
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          🔍 Breakdown
                        </button>
                        {row.calc.totalPayout > 0 && (
                          row.isPaid ? (
                            <button 
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleTogglePayment(row.member, false)}
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              Reset to Unpaid
                            </button>
                          ) : (
                            <button 
                              type="button"
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
              };

              return (
                <>
                  {activeLedger.map(renderPayrollRow)}
                  {exitedLedger.length > 0 && (
                    <>
                      <tr 
                        onClick={() => setExpandedExitedPayroll(!expandedExitedPayroll)}
                        style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <td colSpan={9} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span style={{ marginRight: '6px' }}>{expandedExitedPayroll ? '▼' : '▶'}</span>
                          Exited Staff ({exitedLedger.length})
                        </td>
                      </tr>
                      {expandedExitedPayroll && exitedLedger.map(renderPayrollRow)}
                    </>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Commission Calculation Breakdown Modal */}
      {selectedBreakdownRow !== null && (
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
            maxWidth: '850px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '85vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                  🔍 Commission Calculation Breakdown
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Recruiter: <strong>{selectedBreakdownRow.member.fullName}</strong> ({selectedBreakdownRow.member.jobTitle}) &bull; Payroll Month: <strong>{payrollMonth}</strong>
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedBreakdownRow(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Summary Metrics Row */}
            {(() => {
              const matchedComp = companies.find(c => c.id === selectedBreakdownRow.member.companyId);
              const symbol = matchedComp ? (symbolMap[matchedComp.currency] || '£') : '£';
              const policy = selectedBreakdownRow.policy;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Scheme Summary Details */}
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <strong>Assigned Incentive Scheme</strong>: {policy ? policy.name : 'No Policy Assigned'}
                      </div>
                      <div>
                        <strong>Scheme Type</strong>: {policy ? (policy.type === 'manager' ? 'Manager / Override Plan' : 'Recruiter Tiered Bracket Plan') : 'N/A'}
                      </div>
                      <div>
                        <strong>Threshold Met Requirement</strong>: {policy ? (policy.monthlyThreshold > 0 ? `${symbol}${policy.monthlyThreshold.toLocaleString()} monthly billing threshold applies` : 'No base threshold (First Year / Starter exception)') : 'N/A'}
                      </div>
                      <div>
                        <strong>Calculated Brackets</strong>: {policy?.slabs ? policy.slabs.map((t: any, idx: number) => `[Tier ${idx+1}: ${symbol}${(t.minAmount/1000).toFixed(0)}k-${t.maxAmount >= 999999 ? '∞' : (t.maxAmount/1000).toFixed(0) + 'k'} @ ${t.rate}%]`).join(' ') : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Financial Counters */}
                  <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div className="metric-card" style={{ padding: '12px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Gross Cycle Billings</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
                        {symbol}{selectedBreakdownRow.calc.billing.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="metric-card" style={{ padding: '12px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Base Earned Comm.</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--warning)', marginTop: '4px' }}>
                        {symbol}{selectedBreakdownRow.calc.baseEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="metric-card" style={{ padding: '12px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Withheld (Unpaid Invoice)</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)', marginTop: '4px' }}>
                        {selectedBreakdownRow.calc.withheld > 0 ? `-${symbol}${selectedBreakdownRow.calc.withheld.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </div>
                    </div>
                    <div className="metric-card" style={{ padding: '12px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Released (Priors Paid)</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
                        {selectedBreakdownRow.calc.released > 0 ? `+${symbol}${selectedBreakdownRow.calc.released.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Net Payout Message */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Net Payable Commission this Period:</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>
                      {symbol}{selectedBreakdownRow.calc.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Table 1: Placements inside Current Cycle */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📂 Current Cycle Placements ({selectedBreakdownRow.calc.currentPlacements?.length || 0})
                    </h4>
                    <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      <table className="entity-table dense" style={{ fontSize: '10px', width: '100%' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <th>Candidate</th>
                            <th>Client Company</th>
                            <th>Start Date</th>
                            <th style={{ textAlign: 'right' }}>My Split Share</th>
                            <th>Invoice Status</th>
                            <th style={{ textAlign: 'right' }}>Commission Share</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBreakdownRow.calc.currentPlacements?.map((p: any) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
                              <td>{p.clientCompany}</td>
                              <td>{p.startDate}</td>
                              <td style={{ textAlign: 'right' }}>{symbol}{p.myBillingShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td>
                                <select
                                  value={p.paymentStatus || 'unpaid'}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    const matched = placements.find(item => item.id === p.id);
                                    if (matched) {
                                      const isPaid = newStatus === 'paid';
                                      const updated = {
                                        ...matched,
                                        clientPaymentStatus: newStatus,
                                        clientPaidDate: isPaid ? new Date().toISOString().split('T')[0] : ''
                                      };
                                      
                                      setSelectedBreakdownRow((prev: any) => {
                                        if (!prev) return prev;
                                        const updatedPlacements = prev.calc.currentPlacements.map((item: any) => {
                                          if (item.id === p.id) {
                                            return {
                                              ...item,
                                              isPaid,
                                              paymentStatus: newStatus,
                                              clientPaidDate: updated.clientPaidDate
                                            };
                                          }
                                          return item;
                                        });

                                        let newPaidNow = 0;
                                        let newWithheld = 0;
                                        updatedPlacements.forEach((x: any) => {
                                          if (x.isPaid) {
                                            newPaidNow += x.myCommShare;
                                          } else {
                                            newWithheld += x.myCommShare;
                                          }
                                        });

                                        return {
                                          ...prev,
                                          calc: {
                                            ...prev.calc,
                                            currentPlacements: updatedPlacements,
                                            paidNow: newPaidNow,
                                            withheld: newWithheld,
                                            totalPayout: newPaidNow + prev.calc.released
                                          }
                                        };
                                      });

                                      await onSavePlacement(updated);
                                      onShowToast(`Updated placement status to ${newStatus === 'paid' ? 'Paid' : 'Unpaid'}.`, "success");
                                    }
                                  }}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    backgroundColor: p.isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: p.isPaid ? 'var(--success)' : 'var(--danger)',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                  }}
                                >
                                  <option value="unpaid" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>Awaiting Payment</option>
                                  <option value="paid" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>Settled (Paid)</option>
                                </select>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  <span>{symbol}{p.myCommShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newVal = prompt(`Override commission share for Candidate ${p.candidateName} (GBP):`, String(p.myCommShare));
                                      if (newVal !== null) {
                                        const parsed = parseFloat(newVal);
                                        if (!isNaN(parsed)) {
                                          setSelectedBreakdownRow((prev: any) => {
                                            if (!prev) return prev;
                                            const updatedPlacements = prev.calc.currentPlacements.map((item: any) => {
                                              if (item.id === p.id) {
                                                return {
                                                  ...item,
                                                  myCommShare: parsed
                                                };
                                              }
                                              return item;
                                            });

                                            let newPaidNow = 0;
                                            let newWithheld = 0;
                                            updatedPlacements.forEach((x: any) => {
                                              if (x.isPaid) {
                                                newPaidNow += x.myCommShare;
                                              } else {
                                                newWithheld += x.myCommShare;
                                              }
                                            });

                                            return {
                                              ...prev,
                                              calc: {
                                                ...prev.calc,
                                                currentPlacements: updatedPlacements,
                                                paidNow: newPaidNow,
                                                withheld: newWithheld,
                                                totalPayout: newPaidNow + prev.calc.released
                                              }
                                            };
                                          });
                                          onShowToast(`Adjusted commission share override to £${parsed.toLocaleString()}`, "success");
                                        }
                                      }
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                                    title="Adjust share"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span style={{ color: p.isPaid ? 'var(--success)' : 'var(--danger)', fontSize: '9px', fontWeight: 600 }}>
                                  {p.isPaid ? 'Payout Included' : 'Withheld (Awaiting Cash)'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {(!selectedBreakdownRow.calc.currentPlacements || selectedBreakdownRow.calc.currentPlacements.length === 0) && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                                No cycle placements recorded starting in this period.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 2: Released Prior Placements */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      💸 Released Prior Placements (Settled Invoices) ({selectedBreakdownRow.calc.releasedPlacements?.length || 0})
                    </h4>
                    <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      <table className="entity-table dense" style={{ fontSize: '10px', width: '100%' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <th>Candidate</th>
                            <th>Client Company</th>
                            <th>Start Date</th>
                            <th>Invoice Settled Date</th>
                            <th style={{ textAlign: 'right' }}>Billing Share</th>
                            <th style={{ textAlign: 'right' }}>Released Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBreakdownRow.calc.releasedPlacements?.map((p: any) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
                              <td>{p.clientCompany}</td>
                              <td>{p.startDate}</td>
                              <td>{p.clientPaidDate || 'Recent'}</td>
                              <td style={{ textAlign: 'right' }}>{symbol}{p.myBillingShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                                +{symbol}{p.myCommShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                          {(!selectedBreakdownRow.calc.releasedPlacements || selectedBreakdownRow.calc.releasedPlacements.length === 0) && (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                                No prior withheld invoices were paid/released this month.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 3: Pending Withheld Placements */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⏳ Outstanding Withheld Placements (Awaiting Client Payment) ({selectedBreakdownRow.calc.historicalWithheld?.length || 0})
                    </h4>
                    <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      <table className="entity-table dense" style={{ fontSize: '10px', width: '100%' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <th>Candidate</th>
                            <th>Client Company</th>
                            <th>Start Date</th>
                            <th style={{ textAlign: 'right' }}>Billing Share</th>
                            <th style={{ textAlign: 'right' }}>Withheld Commission</th>
                            <th>Action Needed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBreakdownRow.calc.historicalWithheld?.map((p: any) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
                              <td>{p.clientCompany}</td>
                              <td>{p.startDate}</td>
                              <td style={{ textAlign: 'right' }}>{symbol}{p.myBillingShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                {symbol}{p.myCommShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ color: 'var(--text-muted)' }}>
                                Awaiting Client Invoice Settlement
                              </td>
                            </tr>
                          ))}
                          {(!selectedBreakdownRow.calc.historicalWithheld || selectedBreakdownRow.calc.historicalWithheld.length === 0) && (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)' }}>
                                No outstanding withheld commissions.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => setSelectedBreakdownRow(null)}
                style={{ minWidth: '100px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
