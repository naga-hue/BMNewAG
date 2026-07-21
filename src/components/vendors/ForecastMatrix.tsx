import React, { useState, useMemo } from 'react';
import { Company, Staff, Expense, Vendor } from '../../types';
import { 
  symbolMap, 
  getContractCompanyShare 
} from './shared';
import { toGBP, FX_RATES } from '../../utils/currency';

interface ForecastMatrixProps {
  contracts: any[];
  vendors: Vendor[];
  companies: Company[];
  staff: Staff[];
  expenses: Expense[];
  assetAssignments: any[];
  onCellClick: (contract: any, year: number, monthIndex: number, projectedVal: number) => void;
}

export default function ForecastMatrix({
  contracts,
  vendors,
  companies,
  staff,
  expenses,
  assetAssignments,
  onCellClick
}: ForecastMatrixProps) {
  const [forecastCurrency, setForecastCurrency] = useState('GBP');
  const [forecastCompanyFilter, setForecastCompanyFilter] = useState('all');
  const [expandedVendorIds, setExpandedVendorIds] = useState<Record<string, boolean>>({});

  const toggleVendorExpand = (vendorId: string) => {
    setExpandedVendorIds(prev => ({
      ...prev,
      [vendorId]: !prev[vendorId]
    }));
  };

  const activeCurrencySymbol = symbolMap[forecastCurrency] || '£';

  const forecastMonths = [
    { label: 'Jan', year: 2026, monthIndex: 0 },
    { label: 'Feb', year: 2026, monthIndex: 1 },
    { label: 'Mar', year: 2026, monthIndex: 2 },
    { label: 'Apr', year: 2026, monthIndex: 3 },
    { label: 'May', year: 2026, monthIndex: 4 },
    { label: 'Jun', year: 2026, monthIndex: 5 },
    { label: 'Jul', year: 2026, monthIndex: 6 },
    { label: 'Aug', year: 2026, monthIndex: 7 },
    { label: 'Sep', year: 2026, monthIndex: 8 },
    { label: 'Oct', year: 2026, monthIndex: 9 },
    { label: 'Nov', year: 2026, monthIndex: 10 },
    { label: 'Dec', year: 2026, monthIndex: 11 }
  ];

  const softwareContracts = useMemo(() => {
    return contracts.filter(c => {
      const v = vendors.find(vend => vend.id === c.vendorId);
      return v && v.category === 'Software License';
    });
  }, [contracts, vendors]);

  const leaseContracts = useMemo(() => {
    return contracts.filter(c => {
      const v = vendors.find(vend => vend.id === c.vendorId);
      return !v || v.category !== 'Software License';
    });
  }, [contracts, vendors]);

  const expensesMap = useMemo(() => {
    const map: Record<string, Expense> = {};
    (expenses || []).forEach(e => {
      if (e.linkedVendorCellId) {
        map[e.linkedVendorCellId] = e;
      }
    });
    return map;
  }, [expenses]);

  const getContractCostForMonth = (c: any, year: number, monthIndex: number) => {
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const linkedExp = expensesMap[`${c.id}_${monthKey}`];
    
    if (linkedExp) {
      const actualGBP = Number(linkedExp.amount) || 0;
      let actualTarget = actualGBP;
      if (forecastCurrency !== 'GBP') {
        actualTarget = actualGBP / (FX_RATES[forecastCurrency] || 1.0);
      }
      if (forecastCompanyFilter !== 'all') {
        const share = getContractCompanyShare(c, staff, companies, forecastCompanyFilter, year, monthIndex);
        return actualTarget * share;
      }
      return actualTarget;
    }

    const parseContractDate = (dateStr: any, fallbackYear: number, fallbackMonth: number) => {
      if (!dateStr) return new Date(fallbackYear, fallbackMonth, 1);
      const cleanStr = String(dateStr).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
        return new Date(cleanStr);
      }
      if (/^\d{4}-\d{2}$/.test(cleanStr)) {
        return new Date(cleanStr + '-02');
      }
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) return d;
      return new Date(fallbackYear, fallbackMonth, 1);
    };

    const cStart = parseContractDate(c.startDate, 2026, 0);
    const cEnd = parseContractDate(c.endDate, 2026, 11);
    const currentMonthDate = new Date(year, monthIndex, 1);
    const endOfMonthDate = new Date(year, monthIndex + 1, 0);
    
    if (cStart <= endOfMonthDate && cEnd >= currentMonthDate) {
      let monthlyTotal = 0;
      const unitCostGBP = toGBP(c.unitCost, c.currency);
      
      let unitCostTarget = unitCostGBP;
      if (forecastCurrency !== 'GBP') {
        unitCostTarget = unitCostGBP / (FX_RATES[forecastCurrency] || 1.0);
      }
      
      if (c.costInterval === 'monthly') {
        monthlyTotal = unitCostTarget * c.quantityPurchased;
      } else if (c.costInterval === 'annual') {
        monthlyTotal = (unitCostTarget * c.quantityPurchased) / 12;
      } else if (c.costInterval === 'one_time' || c.costInterval === 'one-off') {
        const parseDate = (dStr: any) => {
          if (!dStr) return new Date(year, monthIndex, 1);
          return new Date(String(dStr).trim());
        };
        const dateRef = parseDate(c.endDate || c.startDate);
        if (!isNaN(dateRef.getTime()) && dateRef.getMonth() === monthIndex && dateRef.getFullYear() === year) {
          monthlyTotal = unitCostTarget * c.quantityPurchased;
        }
      }

      const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
      const fullCost = monthlyTotal * taxFactor;

      if (forecastCompanyFilter !== 'all') {
        const share = getContractCompanyShare(c, staff, companies, forecastCompanyFilter, year, monthIndex);
        return fullCost * share;
      }

      return fullCost;
    }
    return 0;
  };

  // Computations for subtotals
  const { monthlyFixedTotal, monthlyAssignedTotal, monthlyUnusedTotal } = useMemo(() => {
    const fixed = Array(12).fill(0);
    const assigned = Array(12).fill(0);
    const unused = Array(12).fill(0);

    forecastMonths.forEach((m, idx) => {
      contracts.forEach(c => {
        const cost = getContractCostForMonth(c, m.year, m.monthIndex);
        if (cost > 0) {
          const v = vendors.find(vend => vend.id === c.vendorId);
          const isSoftware = v && v.category === 'Software License';
          
          if (!isSoftware) {
            fixed[idx] += cost;
          } else {
            const unitCostGBP = toGBP(c.unitCost, c.currency);
            let unitCostTarget = unitCostGBP;
            if (forecastCurrency !== 'GBP') {
              unitCostTarget = unitCostGBP / (FX_RATES[forecastCurrency] || 1.0);
            }
            const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
            
            let monthlyTotalTarget = 0;
            if (c.costInterval === 'monthly') {
              monthlyTotalTarget = unitCostTarget;
            } else if (c.costInterval === 'annual') {
              monthlyTotalTarget = unitCostTarget / 12;
            } else if (c.costInterval === 'one_time' || c.costInterval === 'one-off') {
              const parseDate = (dStr: any) => {
                if (!dStr) return new Date(m.year, m.monthIndex, 1);
                return new Date(String(dStr).trim());
              };
              const dateRef = parseDate(c.endDate || c.startDate);
              if (!isNaN(dateRef.getTime()) && dateRef.getMonth() === m.monthIndex && dateRef.getFullYear() === m.year) {
                monthlyTotalTarget = unitCostTarget;
              }
            }
            
            const allAssigned = assetAssignments.filter(a => a.contractId === c.id);
            const totalSeats = c.quantityPurchased || 1;

            if (c.splitPackageCost) {
              const totalContractCost = monthlyTotalTarget * totalSeats * taxFactor;
              if (allAssigned.length === 0) {
                let filteredUnusedCost = totalContractCost;
                if (forecastCompanyFilter !== 'all') {
                  const share = getContractCompanyShare(c, staff, companies, forecastCompanyFilter, m.year, m.monthIndex);
                  filteredUnusedCost = totalContractCost * share;
                }
                unused[idx] += filteredUnusedCost;
              } else {
                let filteredAssignedCost = totalContractCost;
                if (forecastCompanyFilter !== 'all') {
                  const assignedInFilter = allAssigned.filter(a => {
                    const member = staff.find(s => s.id === a.staffId);
                    return member && member.companyId === forecastCompanyFilter;
                  }).length;
                  filteredAssignedCost = totalContractCost * (assignedInFilter / allAssigned.length);
                }
                assigned[idx] += filteredAssignedCost;
              }
            } else {
              const costPerSeat = monthlyTotalTarget * taxFactor;
              const unusedCountRaw = Math.max(0, totalSeats - allAssigned.length);

              let filteredAssignedCount = allAssigned.length;
              if (forecastCompanyFilter !== 'all') {
                filteredAssignedCount = allAssigned.filter(a => {
                  const member = staff.find(s => s.id === a.staffId);
                  return member && member.companyId === forecastCompanyFilter;
                }).length;
              }
              assigned[idx] += filteredAssignedCount * costPerSeat;

              let filteredUnusedCost = unusedCountRaw * costPerSeat;
              if (forecastCompanyFilter !== 'all') {
                const share = getContractCompanyShare(c, staff, companies, forecastCompanyFilter, m.year, m.monthIndex);
                filteredUnusedCost = (unusedCountRaw * costPerSeat) * share;
              }
              unused[idx] += filteredUnusedCost;
            }
          }
        }
      });
    });

    return { monthlyFixedTotal: fixed, monthlyAssignedTotal: assigned, monthlyUnusedTotal: unused };
  }, [contracts, vendors, forecastCurrency, forecastCompanyFilter, assetAssignments, staff, companies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>12-Month Expense & Vendor Matrix (Jan - Dec 2026)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            View full year-to-date and forecasted software license seat allocations, landlord leases, and unused capacities in a spreadsheet row ledger.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Filter by Billed Company:</span>
            <select 
              className="select-filter"
              value={forecastCompanyFilter}
              onChange={(e) => setForecastCompanyFilter(e.target.value)}
            >
              <option value="all">🏢 All Group Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>🏢 {c.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Forecast Currency:</span>
            <select 
              className="select-filter"
              value={forecastCurrency}
              onChange={(e) => setForecastCurrency(e.target.value)}
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="AED">AED (AED)</option>
              <option value="INR">INR (₹)</option>
              <option value="ZAR">ZAR (R)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="entity-table dense" style={{ minWidth: '1100px', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ minWidth: '180px', padding: '8px 10px', textAlign: 'left' }}>Vendor & Contract / Expense Row</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Type</th>
              {forecastMonths.map((m, idx) => (
                <th key={idx} style={{ textAlign: 'right', fontSize: '11px', padding: '8px 10px' }}>{m.label}</th>
              ))}
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '8px 10px' }}>Total ({activeCurrencySymbol})</th>
            </tr>
          </thead>
          <tbody>
            {/* Category 1: Software Licenses & Seat Pools */}
            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)' }}>
              <td colSpan={15} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary)', padding: '8px 10px' }}>
                SOFTWARE LICENSES (SEAT POOLS)
              </td>
            </tr>
            {(() => {
              const grouped: Record<string, any[]> = {};
              softwareContracts.forEach(c => {
                const vId = c.vendorId || 'unknown';
                if (!grouped[vId]) grouped[vId] = [];
                grouped[vId].push(c);
              });

              const vendorIds = Object.keys(grouped);

              return vendorIds.map(vId => {
                const vendor = vendors.find(v => v.id === vId);
                const vendorName = vendor ? vendor.name : 'Unknown Vendor';
                const isExpanded = !!expandedVendorIds[vId];
                const vendorContracts = grouped[vId];

                const monthlySums = Array(12).fill(0);
                forecastMonths.forEach((m, idx) => {
                  vendorContracts.forEach(c => {
                    monthlySums[idx] += getContractCostForMonth(c, m.year, m.monthIndex);
                  });
                });
                const groupTotal = monthlySums.reduce((a, b) => a + b, 0);

                return (
                  <React.Fragment key={vId}>
                    <tr 
                      onClick={() => toggleVendorExpand(vId)}
                      style={{ cursor: 'pointer', backgroundColor: 'rgba(99, 102, 241, 0.05)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td style={{ paddingLeft: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '8px 10px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                          ▶
                        </span>
                        {vendorName}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px 10px' }}>Software Vendor</td>
                      {monthlySums.map((val, idx) => (
                        <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                          {val > 0 ? Math.round(val).toLocaleString() : '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', padding: '8px 10px' }}>
                        {Math.round(groupTotal).toLocaleString()}
                      </td>
                    </tr>

                    {isExpanded && vendorContracts.map(c => {
                      let rowSum = 0;
                      return (
                        <tr key={c.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.005)', borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ paddingLeft: '32px', color: 'var(--text-secondary)', padding: '6px 10px' }}>
                            ↳ {c.name}
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 10px' }}>License Type</td>
                          {forecastMonths.map((m, idx) => {
                            const val = getContractCostForMonth(c, m.year, m.monthIndex);
                            rowSum += val;
                            const monthKey = `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}`;
                            const matchedVendor = vendors.find(v => v.id === c.vendorId || (v.name && c.vendorName && v.name.toLowerCase() === c.vendorName.toLowerCase()));

                            const linkedExp = (expenses || []).find(e => {
                              if (e.status === 'dns' || e.status === 'cancelled') return false;
                              if (e.linkedVendorCellId === `${c.id}_${monthKey}`) return true;
                              const expMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
                              if (expMonth !== monthKey) return false;
                              return (e.recipientType === 'vendor' && (e.recipientId === c.vendorId || e.recipientId === matchedVendor?.id)) ||
                                     (e.payee && matchedVendor && e.payee.toLowerCase().includes(matchedVendor.name.toLowerCase()));
                            });

                            const actualVal = linkedExp ? toGBP(linkedExp.amount, linkedExp.currency || 'GBP') : null;

                            return (
                              <td 
                                key={idx} 
                                onClick={() => onCellClick(c, m.year, m.monthIndex, val)}
                                style={{ 
                                  textAlign: 'right', 
                                  fontFamily: 'monospace', 
                                  cursor: 'pointer',
                                  backgroundColor: linkedExp ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                  color: linkedExp ? 'var(--success)' : 'var(--text-muted)',
                                  transition: 'all 0.15s',
                                  padding: '6px 10px'
                                }}
                                title={linkedExp ? `✅ Reconciled & Paid from Bank Statement\nPlanned: £${Math.round(val).toLocaleString()}\nActual Paid: £${Math.round(actualVal || 0).toLocaleString()} on ${linkedExp.date}\nPayee: ${linkedExp.payee}\nClick to review/reconcile` : `Planned Forecast: £${Math.round(val).toLocaleString()}\nStatus: Pending Bank Statement Payment\nClick to reconcile`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  {linkedExp && <span style={{ fontSize: '9px', fontWeight: 800 }}>✓</span>}
                                  <span>{linkedExp ? Math.round(actualVal || 0).toLocaleString() : (val > 0 ? Math.round(val).toLocaleString() : '-')}</span>
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '6px 10px' }}>
                            {Math.round(rowSum).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
            {softwareContracts.length === 0 && (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                  No software seat pool contracts found.
                </td>
              </tr>
            )}

            {/* Category 2: Leases & Fixed Contracts */}
            <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
              <td colSpan={15} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--success)', padding: '8px 10px' }}>
                LANDLORD LEASES & FIXED VENDORS
              </td>
            </tr>
            {(() => {
              const grouped: Record<string, any[]> = {};
              leaseContracts.forEach(c => {
                const vId = c.vendorId || 'unknown';
                if (!grouped[vId]) grouped[vId] = [];
                grouped[vId].push(c);
              });

              const vendorIds = Object.keys(grouped);

              return vendorIds.map(vId => {
                const vendor = vendors.find(v => v.id === vId);
                const vendorName = vendor ? vendor.name : 'Unknown Vendor';
                const isExpanded = !!expandedVendorIds[vId];
                const vendorContracts = grouped[vId];

                const monthlySums = Array(12).fill(0);
                forecastMonths.forEach((m, idx) => {
                  vendorContracts.forEach(c => {
                    monthlySums[idx] += getContractCostForMonth(c, m.year, m.monthIndex);
                  });
                });
                const groupTotal = monthlySums.reduce((a, b) => a + b, 0);

                return (
                  <React.Fragment key={vId}>
                    <tr 
                      onClick={() => toggleVendorExpand(vId)}
                      style={{ cursor: 'pointer', backgroundColor: 'rgba(16, 185, 129, 0.05)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td style={{ paddingLeft: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '8px 10px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                          ▶
                        </span>
                        {vendorName}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '8px 10px' }}>Operating / Lease Vendor</td>
                      {monthlySums.map((val, idx) => (
                        <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                          {val > 0 ? Math.round(val).toLocaleString() : '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--success)', padding: '8px 10px' }}>
                        {Math.round(groupTotal).toLocaleString()}
                      </td>
                    </tr>

                    {isExpanded && vendorContracts.map(c => {
                      let rowSum = 0;
                      return (
                        <tr key={c.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.005)', borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ paddingLeft: '32px', color: 'var(--text-secondary)', padding: '6px 10px' }}>
                            ↳ {c.name}
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 10px' }}>Lease / Expense Type</td>
                          {forecastMonths.map((m, idx) => {
                            const val = getContractCostForMonth(c, m.year, m.monthIndex);
                            rowSum += val;
                            const monthKey = `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}`;
                            const linkedExp = expenses?.find(e => e.linkedVendorCellId === `${c.id}_${monthKey}`);
                            return (
                              <td 
                                key={idx} 
                                onClick={() => onCellClick(c, m.year, m.monthIndex, val)}
                                style={{ 
                                  textAlign: 'right', 
                                  fontFamily: 'monospace', 
                                  cursor: 'pointer',
                                  backgroundColor: linkedExp ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                  color: linkedExp ? 'var(--success)' : 'var(--text-muted)',
                                  transition: 'all 0.15s',
                                  padding: '6px 10px'
                                }}
                                title={linkedExp ? `Reconciled & Paid\nActual: £${Math.round(linkedExp.amount).toLocaleString()} on ${linkedExp.date}\nPayee: ${linkedExp.payee}\nClick to unlink/change` : `Projected Cost: £${Math.round(val).toLocaleString()}\nClick to reconcile with bank payment`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  {linkedExp && <span style={{ fontSize: '9px', fontWeight: 800 }}>🔗</span>}
                                  <span>{val > 0 ? Math.round(val).toLocaleString() : '-'}</span>
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '6px 10px' }}>
                            {Math.round(rowSum).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
            {leaseContracts.length === 0 && (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                  No leases or fixed cost vendor contracts found.
                </td>
              </tr>
            )}

            {/* Summary Breakdowns */}
            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 600 }}>
              <td colSpan={2} style={{ color: 'var(--text-secondary)', padding: '8px 10px' }}>Subtotal: Fixed Leases & Rents (incl. tax)</td>
              {monthlyFixedTotal.map((val, idx) => (
                <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                  {val > 0 ? Math.round(val).toLocaleString() : '0'}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                {Math.round(monthlyFixedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
              </td>
            </tr>

            <tr style={{ fontWeight: 600 }}>
              <td colSpan={2} style={{ color: 'var(--text-secondary)', padding: '8px 10px' }}>Subtotal: Assigned Software Seats (incl. tax)</td>
              {monthlyAssignedTotal.map((val, idx) => (
                <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                  {val > 0 ? Math.round(val).toLocaleString() : '0'}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', padding: '8px 10px' }}>
                {Math.round(monthlyAssignedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
              </td>
            </tr>

            <tr style={{ fontWeight: 600 }}>
              <td colSpan={2} style={{ color: 'var(--warning)', padding: '8px 10px' }}>Subtotal: Unused Seats Waste (incl. tax)</td>
              {monthlyUnusedTotal.map((val, idx) => (
                <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--warning)', padding: '8px 10px' }}>
                  {val > 0 ? Math.round(val).toLocaleString() : '0'}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--warning)', padding: '8px 10px' }}>
                {Math.round(monthlyUnusedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
              </td>
            </tr>

            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, fontSize: '13px', borderTop: '2px solid var(--border-color)' }}>
              <td colSpan={2} style={{ color: 'var(--accent)', padding: '8px 10px' }}>GRAND TOTAL SPEND ({activeCurrencySymbol})</td>
              {forecastMonths.map((m, idx) => {
                const mTotal = monthlyFixedTotal[idx] + monthlyAssignedTotal[idx] + monthlyUnusedTotal[idx];
                return (
                  <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', padding: '8px 10px' }}>
                    {Math.round(mTotal).toLocaleString()}
                  </td>
                );
              })}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '14px', padding: '8px 10px' }}>
                {Math.round(
                  monthlyFixedTotal.reduce((a, b) => a + b, 0) +
                  monthlyAssignedTotal.reduce((a, b) => a + b, 0) +
                  monthlyUnusedTotal.reduce((a, b) => a + b, 0)
                ).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
