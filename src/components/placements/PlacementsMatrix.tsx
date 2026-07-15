import React, { useState } from 'react';
import { Company, Staff } from '../../types';
import { ExtendedPlacement } from './shared';

interface PlacementsMatrixProps {
  companies: Company[];
  staff: Staff[];
  placements: ExtendedPlacement[];
  matrixYear: string;
  setMatrixYear: (year: string) => void;
  matrixViewType: 'count' | 'value';
  setMatrixViewType: (type: 'count' | 'value') => void;
  onDrilldown: (placements: any[], clientName: string, monthName: string) => void;
}

export default function PlacementsMatrix({
  companies,
  staff,
  placements,
  matrixYear,
  setMatrixYear,
  matrixViewType,
  setMatrixViewType,
  onDrilldown
}: PlacementsMatrixProps) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleKey = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const expandAll = () => {
    const keys: Record<string, boolean> = {};
    companies.forEach(company => {
      keys[company.id] = true;
      const companyStaff = staff.filter(s => s.companyId === company.id);
      const configuredDepts = (company.departments || []).map((d: any) => d.name || d);
      const companyDepts = Array.from(
        new Set([...configuredDepts, ...companyStaff.map(s => s.department).filter(Boolean)])
      );
      companyDepts.forEach(dept => {
        keys[`${company.id}-${dept}`] = true;
      });
    });
    setExpandedKeys(keys);
  };

  const collapseAll = () => {
    setExpandedKeys({});
  };

  const year = Number(matrixYear);
  const matrixData: any[] = [];
  const colTotals = Array(12).fill(0);
  let grandTotal = 0;

  companies.forEach(company => {
    const companyStaff = staff.filter(s => s.companyId === company.id);
    const configuredDepts = (company.departments || []).map((d: any) => d.name || d);
    const companyDepts = Array.from(
      new Set([...configuredDepts, ...companyStaff.map(s => s.department).filter(Boolean)])
    ).sort();

    const companyMonths = Array(12).fill(0);
    const companyPlacementsByMonth: any[][] = Array.from({ length: 12 }, () => []);
    const deptRows: any[] = [];

    companyDepts.forEach(dept => {
      const deptStaff = companyStaff.filter(s => s.department === dept);
      const deptMonths = Array(12).fill(0);
      const deptPlacementsByMonth: any[][] = Array.from({ length: 12 }, () => []);
      const staffRows: any[] = [];

      deptStaff.forEach(member => {
        const memberMonths = Array(12).fill(0);
        const memberPlacementsByMonth: any[][] = Array.from({ length: 12 }, () => []);

        placements.forEach(p => {
          if (!p.startDate || p.status === 'dns') return;
          const pStart = new Date(p.startDate);
          if (pStart.getFullYear() !== year) return;

          const monthIdx = pStart.getMonth();
          const splitObj = p.splits?.find(sp => sp.staffId === member.id);
          if (splitObj) {
            const weight =
              matrixViewType === 'value'
                ? (Number(p.netScoreValue) || 0) * (Number(splitObj.percentage) || 100) / 100
                : (Number(splitObj.percentage) || 100) / 100;
            memberMonths[monthIdx] += weight;
            memberPlacementsByMonth[monthIdx].push({
              ...p,
              recruiterSplit: splitObj.percentage || 100,
              splitFee: (Number(p.netScoreValue) || 0) * (Number(splitObj.percentage) || 100) / 100
            });
          }
        });

        const memberTotal = memberMonths.reduce((a, b) => a + b, 0);

        staffRows.push({
          id: `member-${company.id}-${dept}-${member.id}`,
          name: member.fullName,
          subtitle: member.jobTitle || '',
          type: 'member',
          months: memberMonths,
          placementsByMonth: memberPlacementsByMonth,
          total: memberTotal
        });

        for (let m = 0; m < 12; m++) {
          deptMonths[m] += memberMonths[m];
          deptPlacementsByMonth[m].push(...memberPlacementsByMonth[m]);
        }
      });

      const deptTotal = deptMonths.reduce((a, b) => a + b, 0);

      deptRows.push({
        id: `dept-${company.id}-${dept}`,
        name: dept,
        type: 'department',
        months: deptMonths,
        placementsByMonth: deptPlacementsByMonth,
        total: deptTotal,
        children: staffRows
      });

      for (let m = 0; m < 12; m++) {
        companyMonths[m] += deptMonths[m];
        companyPlacementsByMonth[m].push(...deptPlacementsByMonth[m]);
      }
    });

    const companyTotal = companyMonths.reduce((a, b) => a + b, 0);

    matrixData.push({
      id: `company-${company.id}`,
      name: company.name,
      type: 'company',
      months: companyMonths,
      placementsByMonth: companyPlacementsByMonth,
      total: companyTotal,
      children: deptRows
    });
  });

  // Calculate column totals from all unique placements to avoid double-counting splits in footer
  placements.forEach(p => {
    if (!p.startDate || p.status === 'dns') return;
    const pStart = new Date(p.startDate);
    if (pStart.getFullYear() !== year) return;
    const monthIdx = pStart.getMonth();

    const value =
      matrixViewType === 'value'
        ? Number(p.netScoreValue) || 0
        : (() => {
            const totalWeight =
              p.splits?.reduce((sum, s) => sum + (Number(s.percentage) || 100) / 100, 0) || 0;
            return totalWeight > 0 ? totalWeight : 1.0;
          })();
    colTotals[monthIdx] += value;
    grandTotal += value;
  });

  // Flatten rows based on expanded states
  const visibleRows: any[] = [];
  matrixData.forEach(compRow => {
    visibleRows.push(compRow);
    if (expandedKeys[compRow.id]) {
      compRow.children.forEach((deptRow: any) => {
        visibleRows.push(deptRow);
        if (expandedKeys[deptRow.id]) {
          deptRow.children.forEach((memberRow: any) => {
            visibleRows.push(memberRow);
          });
        }
      });
    }
  });

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  return (
    <div className="placements-container">
      <div className="placements-header-row">
        <div className="placements-header-info">
          <h2>
            {matrixViewType === 'value'
              ? 'YTD Placements & Fee Billing Value Matrix'
              : 'YTD Placements & Split Count Matrix'}
          </h2>
          <p>
            {matrixViewType === 'value'
              ? 'Track placement split net fee values hierarchically by internal company, department, and recruiters.'
              : 'Track placement split counts hierarchically by internal company, department, and recruiters.'}
          </p>
        </div>

        <div className="placements-matrix-controls">
          {/* Toggle switch between Split Count and Fee Billing Value */}
          <div className="placements-matrix-toggle-group">
            <button
              type="button"
              onClick={() => setMatrixViewType('count')}
              className={`placements-matrix-toggle-btn ${matrixViewType === 'count' ? 'active' : 'inactive'}`}
            >
              Split Counts
            </button>
            <button
              type="button"
              onClick={() => setMatrixViewType('value')}
              className={`placements-matrix-toggle-btn ${matrixViewType === 'value' ? 'active' : 'inactive'}`}
            >
              Fee Values (£)
            </button>
          </div>

          {/* Toggle switch for Expand/Collapse All */}
          <div className="placements-matrix-toggle-group">
            <button
              type="button"
              onClick={expandAll}
              className="placements-matrix-toggle-btn inactive"
              style={{ padding: '6px 10px' }}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="placements-matrix-toggle-btn inactive"
              style={{ padding: '6px 10px' }}
            >
              Collapse All
            </button>
          </div>

          <div className="placements-matrix-year-select">
            <span>Calendar Year:</span>
            <select
              className="select-filter"
              value={matrixYear}
              onChange={e => setMatrixYear(e.target.value)}
            >
              {(() => {
                const currentYr = new Date().getFullYear();
                const yearsList = [];
                for (let y = currentYr - 2; y <= currentYr + 1; y++) {
                  yearsList.push(y);
                }
                return yearsList.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ));
              })()}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
        <table className="entity-table dense placements-matrix-table">
          <thead>
            <tr>
              <th style={{ minWidth: '220px' }}>Internal Company / Department / Recruiter</th>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                <th key={m} style={{ textAlign: 'right', width: '80px' }}>
                  {m}
                </th>
              ))}
              <th
                style={{
                  textAlign: 'right',
                  width: '100px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                YTD Total
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixData.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No parent entities configured.
                </td>
              </tr>
            ) : (
              <>
                {visibleRows.map(row => {
                  const isCompany = row.type === 'company';
                  const isDept = row.type === 'department';
                  const isMember = row.type === 'member';

                  const paddingLeft = isCompany ? '12px' : isDept ? '32px' : '52px';
                  const hasChildren = isCompany || isDept;
                  const isExpanded = expandedKeys[row.id];

                  return (
                    <tr
                      key={row.id}
                      style={{
                        backgroundColor: isCompany ? 'rgba(255,255,255,0.01)' : 'transparent',
                        borderBottom: isCompany
                          ? '1px solid var(--border-color)'
                          : '1px dashed rgba(255,255,255,0.04)'
                      }}
                    >
                      <td
                        style={{
                          paddingLeft,
                          fontWeight: isCompany ? 700 : isDept ? 600 : 400,
                          color: isCompany
                            ? 'var(--text-primary)'
                            : isDept
                              ? 'var(--text-secondary)'
                              : 'var(--text-muted)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {hasChildren ? (
                            <button
                              onClick={() => toggleKey(row.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '9px',
                                padding: '2px',
                                width: '14px',
                                textAlign: 'center',
                                display: 'inline-block'
                              }}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span
                              style={{
                                width: '14px',
                                display: 'inline-block',
                                textAlign: 'center',
                                opacity: 0.3
                              }}
                            >
                              •
                            </span>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{row.name}</span>
                            {isMember && row.subtitle && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {row.subtitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {row.months.map((val: number, monthIdx: number) => {
                        const cellPlacements = row.placementsByMonth[monthIdx] || [];
                        const displayVal = parseFloat(val.toFixed(2));

                        return (
                          <td key={monthIdx} style={{ textAlign: 'right' }}>
                            {displayVal > 0 ? (
                              <button
                                onClick={() => {
                                  // De-duplicate placements to avoid showing same placement twice in modal list due to splits
                                  const uniq = Array.from(new Map(cellPlacements.map(p => [p.id, p])).values());
                                  onDrilldown(uniq, row.name, monthNames[monthIdx]);
                                }}
                                style={{
                                  background: isCompany
                                    ? 'rgba(99, 102, 241, 0.08)'
                                    : isDept
                                      ? 'rgba(245, 158, 11, 0.08)'
                                      : 'rgba(16, 185, 129, 0.08)',
                                  border: isCompany
                                    ? '1px solid rgba(99, 102, 241, 0.2)'
                                    : isDept
                                      ? '1px solid rgba(245, 158, 11, 0.2)'
                                      : '1px solid rgba(16, 185, 129, 0.2)',
                                  borderRadius: '4px',
                                  color: isCompany
                                    ? 'var(--accent)'
                                    : isDept
                                      ? 'var(--warning)'
                                      : 'var(--success)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  cursor: 'pointer',
                                  width: '100%',
                                  textAlign: 'right',
                                  transition: 'all 0.2s'
                                }}
                                title="Click to view details"
                              >
                                {matrixViewType === 'value'
                                  ? `£${Math.round(displayVal).toLocaleString()}`
                                  : displayVal}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                            )}
                          </td>
                        );
                      })}

                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          color: isCompany
                            ? 'var(--accent)'
                            : isDept
                              ? 'var(--warning)'
                              : 'var(--success)'
                        }}
                      >
                        {matrixViewType === 'value'
                          ? `£${Math.round(row.total).toLocaleString()}`
                          : parseFloat(row.total.toFixed(2))}
                      </td>
                    </tr>
                  );
                })}

                {/* Column totals footer */}
                <tr
                  style={{
                    fontWeight: 700,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderTop: '2px solid var(--border-color)'
                  }}
                >
                  <td style={{ paddingLeft: '12px' }}>
                    Monthly Totals ({matrixViewType === 'value' ? 'Fee Values' : 'Placements'})
                  </td>
                  {colTotals.map((tot, idx) => (
                    <td key={idx} style={{ textAlign: 'right', color: 'var(--success)' }}>
                      {matrixViewType === 'value' ? `£${Math.round(tot).toLocaleString()}` : parseFloat(tot.toFixed(2))}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', color: 'var(--accent)', fontSize: '13px' }}>
                    {matrixViewType === 'value' ? `£${Math.round(grandTotal).toLocaleString()}` : parseFloat(grandTotal.toFixed(2))}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
