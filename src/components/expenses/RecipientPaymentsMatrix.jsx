import React, { useState, useMemo } from 'react';
import MultiSelectFilter from '../MultiSelectFilter';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';

export default function RecipientPaymentsMatrix({
  setDrilldownMonthIdx,
  setDrilldownRowId,
  setDrilldownRowType,
  setDrilldownTargetVal,
  onShowToast
}) {
  const staff = useBoundStore(state => state.staff);
  const vendors = useBoundStore(state => state.vendors);
  const expenses = useBoundStore(state => state.expenses);
  const companies = useBoundStore(state => state.companies);
  const nominalCodes = useBoundStore(state => state.nominalCodes);

  const [recipientCompanyFilter, setRecipientCompanyFilter] = useState(['all']);
  const [recipientNominalFilter, setRecipientNominalFilter] = useState('all');
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const companyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Companies' },
      ...companies.map(c => ({ value: c.id, label: c.name }))
    ];
  }, [companies]);

  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map(c => {
      if (typeof c === 'string') {
        const parts = c.split(' - ');
        return { id: parts[0] || c, code: c, type: 'indirect' };
      }
      if (c && typeof c === 'object') {
        return {
          id: c.id || '',
          code: c.code || '',
          type: c.type || 'indirect'
        };
      }
      return null;
    }).filter(c => c && c.code);
  }, [nominalCodes]);

  const recipientRows = useMemo(() => {
    const rows = [];
    
    staff.forEach(s => {
      rows.push({
        id: `staff:${s.id}`,
        name: s.fullName,
        type: 'Staff / Recruiter',
        rawType: 'staff',
        rawId: s.id
      });
    });

    vendors.forEach(v => {
      rows.push({
        id: `vendor:${v.id}`,
        name: v.name,
        type: 'Registered Vendor',
        rawType: 'vendor',
        rawId: v.id
      });
    });

    const seenNames = new Set(rows.map(r => r.name.toLowerCase()));
    expenses.forEach(e => {
      if (!e.recipientType || e.recipientType === 'other') {
        const cleanPayeeName = (e.payee || '').split(' [Ref:')[0].trim();
        if (cleanPayeeName && !seenNames.has(cleanPayeeName.toLowerCase())) {
          seenNames.add(cleanPayeeName.toLowerCase());
          rows.push({
            id: `other:${cleanPayeeName}`,
            name: cleanPayeeName,
            type: 'General Payee',
            rawType: 'other',
            rawId: cleanPayeeName
          });
        }
      }
    });

    return rows;
  }, [staff, vendors, expenses]);

  const computedRecipientRows = useMemo(() => {
    const searched = recipientRows.filter(r => {
      if (!recipientSearchQuery.trim()) return true;
      return r.name.toLowerCase().includes(recipientSearchQuery.toLowerCase()) || r.type.toLowerCase().includes(recipientSearchQuery.toLowerCase());
    });

    return searched.map(row => {
      const monthlyValues = Array(12).fill(0);
      
      for (let m = 0; m < 12; m++) {
        const monthKey = `2026-${String(m + 1).padStart(2, '0')}`;
        const matchingExps = expenses.filter(e => {
          if (e.plMonth !== monthKey) return false;
          if (!recipientCompanyFilter.includes('all') && !recipientCompanyFilter.includes(e.bankCompanyId)) return false;
          if (recipientNominalFilter !== 'all' && e.nominalCode !== recipientNominalFilter) return false;
          
          if (row.rawType === 'staff') {
            if (e.recipientType === 'staff' && e.recipientId === row.rawId) return true;
            if (!e.recipientType || e.recipientType === 'other') {
              return (e.payee || '').toLowerCase().includes(row.name.toLowerCase());
            }
          } else if (row.rawType === 'vendor') {
            if (e.recipientType === 'vendor' && e.recipientId === row.rawId) return true;
            if (!e.recipientType || e.recipientType === 'other') {
              return (e.payee || '').toLowerCase().includes(row.name.toLowerCase());
            }
          } else if (row.rawType === 'other') {
            const cleanPayee = (e.payee || '').split(' [Ref:')[0].trim().toLowerCase();
            return cleanPayee === row.name.toLowerCase();
          }
          return false;
        });

        monthlyValues[m] = matchingExps.reduce((acc, curr) => acc + toGBP(curr.amount, curr.currency), 0);
      }

      const ytdTotal = monthlyValues.reduce((acc, curr) => acc + curr, 0);

      return {
        ...row,
        monthlyValues,
        ytdTotal
      };
    }).filter(r => r.ytdTotal > 0 || recipientSearchQuery.trim() !== '');
  }, [recipientRows, expenses, recipientCompanyFilter, recipientNominalFilter, recipientSearchQuery]);

  const monthlyGrandTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    computedRecipientRows.forEach(row => {
      for (let m = 0; m < 12; m++) {
        totals[m] += row.monthlyValues[m];
      }
    });
    return totals;
  }, [computedRecipientRows]);

  const ytdGrandTotal = useMemo(() => {
    return monthlyGrandTotals.reduce((acc, curr) => acc + curr, 0);
  }, [monthlyGrandTotals]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Recipient Payments Matrix</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Annual payment log (Jan - Dec) showing amounts paid to staff members, registered vendors, and general payees.
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>ENTITY COMPANY</span>
          <MultiSelectFilter
            options={companyOptions}
            selectedValues={recipientCompanyFilter}
            onChange={(vals) => setRecipientCompanyFilter(vals)}
            placeholder="Select Companies"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>NOMINAL CATEGORY</span>
          <select
            className="select-filter"
            value={recipientNominalFilter}
            onChange={(e) => setRecipientNominalFilter(e.target.value)}
            style={{ width: '220px', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
          >
            <option value="all">All Nominal Codes</option>
            {activeNominalCodes.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>SEARCH RECIPIENT NAME</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by vendor, employee, or general payee name..."
            value={recipientSearchQuery}
            onChange={(e) => setRecipientSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{
        overflowX: 'auto',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-card)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Recipient Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Type</th>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                <th key={m} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, width: '70px' }}>{m}</th>
              ))}
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, width: '90px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>YTD Total</th>
            </tr>
          </thead>
          <tbody>
            {computedRecipientRows.map(row => (
              <tr 
                key={row.id} 
                className="ledger-row-hover"
                style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}
              >
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (row.ytdTotal > 0) {
                        setDrilldownMonthIdx('ytd');
                        setDrilldownRowId(row.id);
                        setDrilldownRowType('recipient');
                        setDrilldownTargetVal(`${row.name} (Full Year YTD)`);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      padding: 0,
                      cursor: row.ytdTotal > 0 ? 'pointer' : 'default',
                      fontWeight: 600,
                      textDecoration: row.ytdTotal > 0 ? 'underline dashed rgba(255,255,255,0.2)' : 'none'
                    }}
                    title={row.ytdTotal > 0 ? "Click to view full year YTD details" : ""}
                    disabled={row.ytdTotal <= 0}
                  >
                    {row.name}
                  </button>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: row.rawType === 'staff' ? 'rgba(245, 158, 11, 0.1)' : row.rawType === 'vendor' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    color: row.rawType === 'staff' ? 'var(--warning)' : row.rawType === 'vendor' ? 'var(--primary)' : 'var(--text-secondary)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {row.type}
                  </span>
                </td>
                {row.monthlyValues.map((val, mIdx) => {
                  const hasVal = val > 0;
                  return (
                    <td key={mIdx} style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {hasVal ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDrilldownMonthIdx(mIdx);
                            setDrilldownRowId(row.id);
                            setDrilldownRowType('recipient');
                            setDrilldownTargetVal(row.name);
                          }}
                          style={{
                            background: row.rawType === 'staff' ? 'rgba(245, 158, 11, 0.08)' : row.rawType === 'vendor' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.04)',
                            border: row.rawType === 'staff' ? '1px solid rgba(245, 158, 11, 0.2)' : row.rawType === 'vendor' ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: row.rawType === 'staff' ? 'var(--warning)' : row.rawType === 'vendor' ? 'var(--accent)' : 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'right',
                            transition: 'all 0.2s'
                          }}
                          title="Click to view transactions"
                        >
                          £{Math.round(val).toLocaleString()}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ 
                  padding: '6px 16px', 
                  textAlign: 'right', 
                  borderLeft: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(99, 102, 241, 0.02)'
                }}>
                  {row.ytdTotal > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDrilldownMonthIdx('ytd');
                        setDrilldownRowId(row.id);
                        setDrilldownRowType('recipient');
                        setDrilldownTargetVal(`${row.name} (YTD Total)`);
                      }}
                      style={{
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '4px',
                        color: 'var(--accent)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'right',
                        transition: 'all 0.2s'
                      }}
                      title="Click to view full year transactions"
                    >
                      £{Math.round(row.ytdTotal).toLocaleString()}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {computedRecipientRows.length === 0 && (
              <tr>
                <td colSpan="15" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No recipient payments found matching selected filters.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
              <td style={{ padding: '12px 16px' }} colSpan="2">Monthly Totals</td>
              {monthlyGrandTotals.map((val, mIdx) => (
                <td key={mIdx} style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  £{Math.round(val).toLocaleString()}
                </td>
              ))}
              <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent)', borderLeft: '1px solid var(--border-color)', backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                £{Math.round(ytdGrandTotal).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}
