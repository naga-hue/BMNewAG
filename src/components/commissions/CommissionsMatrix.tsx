import React, { useState, useMemo } from 'react';
// @ts-ignore
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff, Placement } from '../../types';
import { formatGBP } from '../../utils/currency';
import { calculateCashReceivedCommission } from './utils';

interface CommissionsMatrixProps {
  companies: Company[];
  staff: Staff[];
  commissionPolicies: any[];
  placements: Placement[];
  onSelectRecruiterDetail: (member: Staff, policy: any, targetMonth: string) => void;
}

const matrixMonths = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export default function CommissionsMatrix({
  companies,
  staff,
  commissionPolicies,
  placements,
  onSelectRecruiterDetail
}: CommissionsMatrixProps) {
  const [matrixYear, setMatrixYear] = useState('2026');
  const [matrixMeasure, setMatrixMeasure] = useState<'payout' | 'base'>('payout'); // payout, base
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixCompany, setMatrixCompany] = useState<string[]>(['all']);
  const [matrixDept, setMatrixDept] = useState<string[]>(['all']);
  const [expandedExitedMatrix, setExpandedExitedMatrix] = useState(false);

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

  const matrixData = useMemo(() => {
    const filtered = staff.filter(s => {
      if (!s.commissionPolicyId) return false;
      if (matrixSearch && !s.fullName.toLowerCase().includes(matrixSearch.toLowerCase())) return false;
      if (!matrixCompany.includes('all') && !matrixCompany.includes(s.companyId)) return false;
      if (!matrixDept.includes('all') && !matrixDept.includes(s.department || '')) return false;
      return true;
    });

    const rows = filtered.map(member => {
      const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
      
      // Determine target staff IDs for this row member's commission scheme
      let targetStaffIds = [member.id];
      if (policy && policy.type === 'manager') {
        if (policy.assignedDepartments && policy.assignedDepartments.length > 0) {
          const deptStaff = staff.filter(s => policy.assignedDepartments.includes(s.department || ''));
          targetStaffIds = Array.from(new Set([member.id, ...deptStaff.map(s => s.id)]));
        } else {
          const teamMembers = staff.filter(s => s.reportingManagerId === member.id);
          targetStaffIds = [member.id, ...teamMembers.map(s => s.id)];
        }
      }

      // Pre-filter placements where targetStaffIds intersects the placement's splits
      const relevantPlacements = placements.filter(p => 
        p.splits && p.splits.some(split => targetStaffIds.includes(split.staffId))
      );

      const monthlyValues: Record<string, number> = {};
      let rowTotal = 0;

      matrixMonths.forEach(m => {
        const monthStr = `${matrixYear}-${m}`;
        const calc = calculateCashReceivedCommission(member, policy, monthStr, staff, companies, relevantPlacements);
        const val = matrixMeasure === 'payout' ? calc.totalPayout : calc.baseEarned;
        monthlyValues[m] = val;
        rowTotal += val;
      });

      return {
        member,
        policy,
        monthlyValues,
        rowTotal
      };
    });

    // Sort rows by rowTotal descending
    rows.sort((a, b) => b.rowTotal - a.rowTotal);

    const colTotals: Record<string, number> = {};
    let grandTotal = 0;
    matrixMonths.forEach(m => {
      colTotals[m] = rows.reduce((sum, r) => sum + r.monthlyValues[m], 0);
      grandTotal += colTotals[m];
    });

    return {
      rows,
      colTotals,
      grandTotal
    };
  }, [staff, commissionPolicies, placements, matrixYear, matrixSearch, matrixCompany, matrixDept, matrixMeasure, companies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>YTD Month-wise Commission Payout Matrix</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Recruiter-level commission summaries aggregated by calendar months for the selected fiscal year.
          </p>
        </div>

        {/* Quick Export Button */}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const headers = ['Recruiter Name', 'Scheme Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'YTD Total'];
            const csvRows = [headers.join(',')];
            matrixData.rows.forEach(r => {
              const row = [
                `"${r.member.fullName}"`,
                `"${r.policy ? r.policy.name : 'None'}"`,
                ...matrixMonths.map(m => r.monthlyValues[m].toFixed(2)),
                r.rowTotal.toFixed(2)
              ];
              csvRows.push(row.join(','));
            });
            
            // Add totals row
            const totalsRow = [
              '"Total Payouts"',
              '""',
              ...matrixMonths.map(m => matrixData.colTotals[m].toFixed(2)),
              matrixData.grandTotal.toFixed(2)
            ];
            csvRows.push(totalsRow.join(','));

            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `YTD_Commission_Matrix_${matrixYear}.csv`);
            a.click();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
        >
          📥 Export CSV Matrix
        </button>
      </div>

      {/* Filter Bar */}
      <div className="controls-card" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Search Recruiter:</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name..."
            value={matrixSearch}
            onChange={(e) => setMatrixSearch(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Company Filter:</span>
          <MultiSelectFilter
            options={companyOptions}
            selectedValues={matrixCompany}
            onChange={(vals: string[]) => {
              setMatrixCompany(vals);
              setMatrixDept(['all']);
            }}
            placeholder="Select Companies"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department Filter:</span>
          <MultiSelectFilter
            options={departmentOptionsList}
            selectedValues={matrixDept}
            onChange={(vals: string[]) => setMatrixDept(vals)}
            placeholder="Select Departments"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fiscal Year:</span>
          <select
            className="select-filter"
            value={matrixYear}
            onChange={(e) => setMatrixYear(e.target.value)}
            style={{ padding: '8px', fontSize: '13px' }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2027">2027</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Matrix Measure:</span>
          <select
            className="select-filter"
            value={matrixMeasure}
            onChange={(e) => setMatrixMeasure(e.target.value as 'payout' | 'base')}
            style={{ padding: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}
          >
            <option value="payout">Net Payable Payout (Cash)</option>
            <option value="base">Base Earned Commission</option>
          </select>
        </div>

      </div>

      {/* Matrix Table */}
      <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
        <table className="entity-table dense" style={{ minWidth: '1200px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ position: 'sticky', left: 0, zIndex: 12, backgroundColor: 'var(--bg-secondary)', minWidth: '180px', fontWeight: 700, padding: '12px' }}>Recruiter Name</th>
              <th style={{ position: 'sticky', left: '180px', zIndex: 12, backgroundColor: 'var(--bg-secondary)', minWidth: '150px', fontWeight: 700, padding: '12px' }}>Scheme Name</th>
              {matrixMonths.map(m => {
                const monthName = new Date(`2026-${m}-02`).toLocaleDateString(undefined, { month: 'short' });
                return <th key={m} style={{ textAlign: 'right', fontWeight: 700, padding: '12px' }}>{monthName}</th>;
              })}
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--accent)' }}>YTD Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const activeMatrixRows = matrixData.rows.filter(row => row.member.status !== 'exited');
              const exitedMatrixRows = matrixData.rows.filter(row => row.member.status === 'exited');

              const renderMatrixRow = (row: any) => (
                <tr key={row.member.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: row.member.status === 'exited' ? 0.75 : 1 }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--bg-card)', fontWeight: 600, padding: '12px' }}>
                    <span 
                      style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        onSelectRecruiterDetail(row.member, row.policy, `${matrixYear}-06`);
                      }}
                    >
                      {row.member.fullName}
                    </span>
                    {row.member.status === 'exited' && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>(Exited)</span>}
                  </td>
                  <td style={{ position: 'sticky', left: '180px', zIndex: 10, backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', padding: '12px' }}>
                    {row.policy ? row.policy.name : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None Mapped</span>}
                  </td>
                  {matrixMonths.map(m => {
                    const val = row.monthlyValues[m];
                    return (
                      <td key={m} style={{ textAlign: 'right', padding: '12px', color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {val > 0 ? formatGBP(val) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right', fontWeight: 700, padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.02)', color: 'var(--accent)' }}>
                    {formatGBP(row.rowTotal)}
                  </td>
                </tr>
              );

              return (
                <>
                  {activeMatrixRows.map(renderMatrixRow)}
                  {exitedMatrixRows.length > 0 && (
                    <>
                      <tr 
                        onClick={() => setExpandedExitedMatrix(!expandedExitedMatrix)}
                        style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <td colSpan={15} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', padding: '12px' }}>
                          <span style={{ marginRight: '6px' }}>{expandedExitedMatrix ? '▼' : '▶'}</span>
                          Exited Staff ({exitedMatrixRows.length})
                        </td>
                      </tr>
                      {expandedExitedMatrix && exitedMatrixRows.map(renderMatrixRow)}
                    </>
                  )}
                </>
              );
            })()}

            {matrixData.rows.length === 0 && (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No recruiters match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
          
          {/* Bottom Totals Row */}
          {matrixData.rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={2} style={{ padding: '12px' }}>Total Payouts (GBP)</td>
                {matrixMonths.map(m => (
                  <td key={m} style={{ textAlign: 'right', padding: '12px', color: 'var(--text-primary)' }}>
                    {formatGBP(matrixData.colTotals[m])}
                  </td>
                ))}
                <td style={{ textAlign: 'right', padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', color: 'var(--accent)' }}>
                  {formatGBP(matrixData.grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </div>
  );
}
