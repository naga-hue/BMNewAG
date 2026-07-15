import React, { useState, useMemo } from 'react';
import MultiSelectFilter from '../MultiSelectFilter';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';
import { getDaysWorkedInMonth } from './shared';

export default function YtdAllocationMatrix({
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

  // Matrix Filter states
  const [matrixYear, setMatrixYear] = useState('2026');
  const [matrixCompanyFilter, setMatrixCompanyFilter] = useState(['all']);
  const [matrixDeptFilter, setMatrixDeptFilter] = useState(['all']);
  const [matrixStaffFilter, setMatrixStaffFilter] = useState('all');
  const [matrixGroupingMode, setMatrixGroupingMode] = useState('company-first'); // company-first, nominal-first
  const [matrixExpandedKeys, setMatrixExpandedKeys] = useState({});

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

  const matrixDeptOptions = useMemo(() => {
    const depts = [];
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return [
      { value: 'all', label: 'All Departments' },
      ...depts.sort().map(d => ({ value: d, label: d }))
    ];
  }, [companies, staff]);

  const { flatRowsForMatrix, computedMatrixData } = useMemo(() => {
    const staffOverhead = {};
    const staffTrans = {};
    staff.forEach(s => {
      staffOverhead[s.id] = Array(12).fill(0);
      staffTrans[s.id] = Array.from({ length: 12 }, () => []);
    });

    const yearExpenses = (expenses || []).filter(e => e.plMonth && e.plMonth.startsWith(matrixYear));

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const monthKey = `${matrixYear}-${String(mIdx + 1).padStart(2, '0')}`;
      const activeStaff = staff.filter(s => {
        const daysWorked = getDaysWorkedInMonth(s.startDate, s.exitDate, monthKey);
        return daysWorked >= 10;
      });
      const activeStaffIds = activeStaff.map(s => s.id);
      const monthExpenses = yearExpenses.filter(e => e.plMonth === monthKey);

      monthExpenses.forEach(exp => {
        const gbpAmt = toGBP(exp.amount, exp.currency);

        if (exp.allocationType === 'company') {
          const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
          if (targets.length > 0) {
            if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
              targets.forEach(compId => {
                const percent = parseInt(exp.manualAllocationShares[compId] || 0, 10);
                const companyShare = gbpAmt * (percent / 100);
                const compStaff = activeStaff.filter(s => s.companyId === compId);
                const compHead = compStaff.length || 1;
                const perStaffShare = companyShare / compHead;
                compStaff.forEach(s => {
                  staffOverhead[s.id][mIdx] += perStaffShare;
                  staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: `Company Custom Split (${percent}%)` });
                });
              });
            } else {
              const eligibleStaff = activeStaff.filter(s => targets.includes(s.companyId));
              const totalHead = eligibleStaff.length || 1;
              const perStaffShare = gbpAmt / totalHead;
              eligibleStaff.forEach(s => {
                staffOverhead[s.id][mIdx] += perStaffShare;
                staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Company Apportionment' });
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
                const deptStaff = activeStaff.filter(s => s.department === dept);
                const deptHead = deptStaff.length || 1;
                const perStaffShare = deptShare / deptHead;
                deptStaff.forEach(s => {
                  staffOverhead[s.id][mIdx] += perStaffShare;
                  staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: `Department Custom Split (${percent}%)` });
                });
              });
            } else {
              const eligibleStaff = activeStaff.filter(s => targets.includes(s.department));
              const totalHead = eligibleStaff.length || 1;
              const perStaffShare = gbpAmt / totalHead;
              eligibleStaff.forEach(s => {
                staffOverhead[s.id][mIdx] += perStaffShare;
                staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Department Apportionment' });
              });
            }
          }
        } else if (exp.allocationType === 'staff') {
          const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
          if (targets.length > 0) {
            if (exp.allocationMode === 'manual' && exp.manualAllocationShares) {
              targets.forEach(staffId => {
                if (activeStaffIds.includes(staffId)) {
                  const percent = parseInt(exp.manualAllocationShares[staffId] || 0, 10);
                  const perStaffShare = gbpAmt * (percent / 100);
                  staffOverhead[staffId][mIdx] += perStaffShare;
                  staffTrans[staffId][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: `Direct Staff Custom Split (${percent}%)` });
                }
              });
            } else {
              const perStaffShare = gbpAmt / targets.length;
              targets.forEach(staffId => {
                if (activeStaffIds.includes(staffId)) {
                  staffOverhead[staffId][mIdx] += perStaffShare;
                  staffTrans[staffId][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Direct Staff Split' });
                }
              });
            }
          }
        } else {
          const groupHead = activeStaff.length || 1;
          activeStaff.forEach(s => {
            staffOverhead[s.id][mIdx] += gbpAmt / groupHead;
            staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: gbpAmt / groupHead, shareReason: 'Group-wide Allocation' });
          });
        }
      });
    }

    const computedData = [];

    if (matrixGroupingMode === 'nominal-first') {
      const visibleCompanies = companies.filter(c => matrixCompanyFilter.includes('all') || matrixCompanyFilter.includes(c.id));
      const visibleCompaniesIds = visibleCompanies.map(c => c.id);

      activeNominalCodes.forEach(nominal => {
        const nominalMonths = Array(12).fill(0);
        const nominalTransactionsByMonth = Array.from({ length: 12 }, () => []);
        const companiesMap = {};

        staff.forEach(member => {
          if (matrixStaffFilter !== 'all' && member.id !== matrixStaffFilter) return false;
          if (!matrixDeptFilter.includes('all') && !matrixDeptFilter.includes(member.department)) return false;
          if (!visibleCompaniesIds.includes(member.companyId)) return false;

          const memberTransactionsByMonth = staffTrans[member.id] || Array.from({ length: 12 }, () => []);

          for (let m = 0; m < 12; m++) {
            const monthTrans = memberTransactionsByMonth[m] || [];
            monthTrans.forEach(t => {
              if (t.nominalCode !== nominal.code) return;

              const compId = member.companyId;
              const compName = companies.find(c => c.id === compId)?.name || 'Unknown Company';
              const payee = (() => {
                if (t.recipientType === 'vendor' && t.recipientId) {
                  const v = vendors.find(item => item.id === t.recipientId);
                  if (v) return v.name;
                }
                if (t.recipientType === 'staff' && t.recipientId) {
                  const s = staff.find(item => item.id === t.recipientId);
                  if (s) return s.fullName;
                }
                return (t.payee || 'Unknown Payee').split(' [Ref:')[0].trim();
              })();
              const share = t.apportionedShare !== undefined ? t.apportionedShare : toGBP(t.amount, t.currency);

              if (!companiesMap[compName]) {
                companiesMap[compName] = {
                  id: compId,
                  months: Array(12).fill(0),
                  transactionsByMonth: Array.from({ length: 12 }, () => []),
                  parties: {}
                };
              }

              companiesMap[compName].months[m] += share;
              companiesMap[compName].transactionsByMonth[m].push(t);

              if (!companiesMap[compName].parties[payee]) {
                companiesMap[compName].parties[payee] = {
                  months: Array(12).fill(0),
                  transactionsByMonth: Array.from({ length: 12 }, () => [])
                };
              }

              companiesMap[compName].parties[payee].months[m] += share;
              companiesMap[compName].parties[payee].transactionsByMonth[m].push(t);

              nominalMonths[m] += share;
              nominalTransactionsByMonth[m].push(t);
            });
          }
        });

        const compRows = [];
        Object.keys(companiesMap).sort().forEach(compName => {
          const compData = companiesMap[compName];
          const partyRows = [];

          Object.keys(compData.parties).sort().forEach(payee => {
            const partyData = compData.parties[payee];
            partyRows.push({
              id: `party-${nominal.code}-${compData.id}-${payee}`,
              name: payee,
              type: 'party',
              targetVal: payee,
              months: partyData.months,
              transactionsByMonth: partyData.transactionsByMonth,
              total: partyData.months.reduce((a, b) => a + b, 0),
              children: []
            });
          });

          compRows.push({
            id: `company-${nominal.code}-${compData.id}`,
            name: compName,
            type: 'company',
            targetVal: compName,
            months: compData.months,
            transactionsByMonth: compData.transactionsByMonth,
            total: compData.months.reduce((a, b) => a + b, 0),
            children: partyRows
          });
        });

        computedData.push({
          id: `nominal-${nominal.code}`,
          name: nominal.code,
          type: 'nominal',
          targetVal: nominal.code,
          months: nominalMonths,
          transactionsByMonth: nominalTransactionsByMonth,
          total: nominalMonths.reduce((a, b) => a + b, 0),
          children: compRows
        });
      });

    } else {
      const visibleCompanies = companies.filter(c => matrixCompanyFilter.includes('all') || matrixCompanyFilter.includes(c.id));
      visibleCompanies.forEach(company => {
        const companyStaff = staff.filter(s => {
          if (s.companyId !== company.id) return false;
          if (!matrixDeptFilter.includes('all') && !matrixDeptFilter.includes(s.department)) return false;
          if (matrixStaffFilter !== 'all' && s.id !== matrixStaffFilter) return false;
          return true;
        });

        const companyMonths = Array(12).fill(0);
        const companyTransactionsByMonth = Array.from({ length: 12 }, () => []);
        const nominalsMap = {};

        companyStaff.forEach(member => {
          const memberTransactionsByMonth = staffTrans[member.id] || Array.from({ length: 12 }, () => []);

          for (let m = 0; m < 12; m++) {
            const monthTrans = memberTransactionsByMonth[m] || [];
            monthTrans.forEach(t => {
              const nom = t.nominalCode || 'Uncategorized';
              const payee = (() => {
                if (t.recipientType === 'vendor' && t.recipientId) {
                  const v = vendors.find(item => item.id === t.recipientId);
                  if (v) return v.name;
                }
                if (t.recipientType === 'staff' && t.recipientId) {
                  const s = staff.find(item => item.id === t.recipientId);
                  if (s) return s.fullName;
                }
                return (t.payee || 'Unknown Payee').split(' [Ref:')[0].trim();
              })();
              const share = t.apportionedShare !== undefined ? t.apportionedShare : toGBP(t.amount, t.currency);

              if (!nominalsMap[nom]) {
                nominalsMap[nom] = {
                  months: Array(12).fill(0),
                  transactionsByMonth: Array.from({ length: 12 }, () => []),
                  parties: {}
                };
              }

              nominalsMap[nom].months[m] += share;
              nominalsMap[nom].transactionsByMonth[m].push(t);

              if (!nominalsMap[nom].parties[payee]) {
                nominalsMap[nom].parties[payee] = {
                  months: Array(12).fill(0),
                  transactionsByMonth: Array.from({ length: 12 }, () => [])
                };
              }

              nominalsMap[nom].parties[payee].months[m] += share;
              nominalsMap[nom].parties[payee].transactionsByMonth[m].push(t);

              companyMonths[m] += share;
              companyTransactionsByMonth[m].push(t);
            });
          }
        });

        const nominalRows = [];
        Object.keys(nominalsMap).sort().forEach(nom => {
          const nomData = nominalsMap[nom];
          const partyRows = [];

          Object.keys(nomData.parties).sort().forEach(payee => {
            const partyData = nomData.parties[payee];
            partyRows.push({
              id: `party-${company.id}-${nom}-${payee}`,
              name: payee,
              type: 'party',
              targetVal: payee,
              months: partyData.months,
              transactionsByMonth: partyData.transactionsByMonth,
              total: partyData.months.reduce((a, b) => a + b, 0),
              children: []
            });
          });

          nominalRows.push({
            id: `nominal-${company.id}-${nom}`,
            name: nom,
            type: 'nominal',
            targetVal: nom,
            months: nomData.months,
            transactionsByMonth: nomData.transactionsByMonth,
            total: nomData.months.reduce((a, b) => a + b, 0),
            children: partyRows
          });
        });

        computedData.push({
          id: `company-${company.id}`,
          name: company.name,
          type: 'company',
          targetVal: company.name,
          months: companyMonths,
          transactionsByMonth: companyTransactionsByMonth,
          total: companyMonths.reduce((a, b) => a + b, 0),
          children: nominalRows
        });
      });
    }

    const flatRows = [];
    computedData.forEach(compRow => {
      flatRows.push(compRow);
      if (matrixExpandedKeys[compRow.id]) {
        compRow.children.forEach(nomRow => {
          flatRows.push(nomRow);
          if (matrixExpandedKeys[nomRow.id]) {
            nomRow.children.forEach(partyRow => {
              flatRows.push(partyRow);
            });
          }
        });
      }
    });

    return { flatRowsForMatrix: flatRows, computedMatrixData: computedData };
  }, [
    staff, vendors, expenses, companies, activeNominalCodes,
    matrixYear, matrixCompanyFilter, matrixDeptFilter, matrixStaffFilter, matrixGroupingMode, matrixExpandedKeys
  ]);

  const colTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    computedMatrixData.forEach(compRow => {
      for (let m = 0; m < 12; m++) {
        totals[m] += compRow.months[m];
      }
    });
    return totals;
  }, [computedMatrixData]);

  const grandTotal = useMemo(() => {
    return colTotals.reduce((a, b) => a + b, 0);
  }, [colTotals]);

  const toggleKey = (key) => {
    setMatrixExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const expandAll = () => {
    const newKeys = {};
    computedMatrixData.forEach(compRow => {
      newKeys[compRow.id] = true;
      compRow.children.forEach(nomRow => {
        newKeys[nomRow.id] = true;
      });
    });
    setMatrixExpandedKeys(newKeys);
  };

  const collapseAll = () => {
    setMatrixExpandedKeys({});
  };

  const monthNamesAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
      
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>YTD Expenses & Shared Apportionments Matrix</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Apportioned overhead costs distributed dynamically down to departments and individuals</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select-filter"
            value={matrixYear}
            onChange={(e) => setMatrixYear(e.target.value)}
            style={{ padding: '6px', fontSize: '12px', width: '80px' }}
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>

          <MultiSelectFilter
            options={companyOptions}
            selectedValues={matrixCompanyFilter}
            onChange={(vals) => {
              setMatrixCompanyFilter(vals);
              setMatrixDeptFilter(['all']);
              setMatrixStaffFilter('all');
            }}
            placeholder="Select Companies"
          />

          <MultiSelectFilter
            options={matrixDeptOptions}
            selectedValues={matrixDeptFilter}
            onChange={(vals) => {
              setMatrixDeptFilter(vals);
              setMatrixStaffFilter('all');
            }}
            placeholder="Select Departments"
          />

          <select
            className="select-filter"
            value={matrixStaffFilter}
            onChange={(e) => setMatrixStaffFilter(e.target.value)}
            style={{ padding: '6px', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="all">👥 All Recruiters</option>
            {(() => {
              const visibleStaff = matrixCompanyFilter.includes('all')
                ? staff
                : staff.filter(s => matrixCompanyFilter.includes(s.companyId));
              const activeVisibleStaff = visibleStaff.filter(s => {
                if (!matrixDeptFilter.includes('all') && !matrixDeptFilter.includes(s.department)) return false;
                return true;
              });
              return activeVisibleStaff.map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.name}</option>
              ));
            })()}
          </select>

          <select
            className="select-filter"
            value={matrixGroupingMode}
            onChange={(e) => setMatrixGroupingMode(e.target.value)}
            style={{ padding: '6px', fontSize: '12px', minWidth: '160px', backgroundColor: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', fontWeight: 600, border: '1px solid rgba(99, 102, 241, 0.2)' }}
          >
            <option value="company-first">🏢 Company ➔ Nominal ➔ Party</option>
            <option value="nominal-first">📂 Nominal ➔ Company ➔ Party</option>
          </select>

          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={expandAll}>
            Expand All
          </button>
          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="entity-table dense" style={{ minWidth: '1200px', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <th style={{ width: '280px' }}>Corporate / Cost Center Hierarchy</th>
              {monthNamesAbbr.map(m => (
                <th key={m} style={{ textAlign: 'right', width: '75px' }}>{m}</th>
              ))}
              <th style={{ textAlign: 'right', width: '100px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)' }}>YTD Total</th>
            </tr>
          </thead>
          <tbody>
            {flatRowsForMatrix.length === 0 ? (
              <tr>
                <td colSpan="14" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No corporate entities configured.
                </td>
              </tr>
            ) : (
              flatRowsForMatrix.map(row => {
                const isLevel1 = (matrixGroupingMode === 'company-first' && row.type === 'company') || (matrixGroupingMode === 'nominal-first' && row.type === 'nominal');
                const isLevel2 = (matrixGroupingMode === 'company-first' && row.type === 'nominal') || (matrixGroupingMode === 'nominal-first' && row.type === 'company');
                const isLevel3 = row.type === 'party';

                const paddingLeft = isLevel1 ? '12px' : isLevel2 ? '32px' : '52px';
                const hasChildren = isLevel1 || isLevel2;
                const isExpanded = matrixExpandedKeys[row.id];

                return (
                  <tr 
                    key={row.id}
                    style={{ 
                      backgroundColor: isLevel1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      borderBottom: isLevel1 ? '1px solid var(--border-color)' : '1px dashed rgba(255,255,255,0.04)'
                    }}
                  >
                    <td style={{ 
                      paddingLeft, 
                      fontWeight: isLevel1 ? 700 : isLevel2 ? 600 : 400,
                      color: isLevel1 ? 'var(--text-primary)' : isLevel2 ? 'var(--text-secondary)' : 'var(--text-muted)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {hasChildren ? (
                          <button
                            type="button"
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
                          <span style={{ width: '14px', display: 'inline-block', textAlign: 'center', opacity: 0.3 }}>•</span>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDrilldownMonthIdx('ytd');
                              setDrilldownRowId(row.id);
                              setDrilldownRowType(row.type);
                              setDrilldownTargetVal(`${row.name} (Full Year YTD)`);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              textAlign: 'left',
                              padding: 0,
                              cursor: 'pointer',
                              fontWeight: isLevel1 ? 700 : isLevel2 ? 600 : 500,
                              textDecoration: 'underline dashed rgba(255,255,255,0.2)'
                            }}
                            title="Click to view full year YTD details"
                          >
                            {row.name}
                          </button>
                          {isLevel3 && row.subtitle && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>{row.subtitle}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {row.months.map((val, mIdx) => {
                      const cellVal = parseFloat(val.toFixed(2));
                      return (
                        <td key={mIdx} style={{ textAlign: 'right' }}>
                          {cellVal > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDrilldownMonthIdx(mIdx);
                                setDrilldownRowId(row.id);
                                setDrilldownRowType(row.type);
                                setDrilldownTargetVal(row.name);
                              }}
                              style={{
                                background: isLevel1 ? 'rgba(239, 68, 68, 0.08)' : isLevel2 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                                border: isLevel1 ? '1px solid rgba(239, 68, 68, 0.2)' : isLevel2 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
                                borderRadius: '4px',
                                color: isLevel1 ? 'var(--danger)' : isLevel2 ? 'var(--warning)' : 'var(--accent)',
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
                              £{Math.round(cellVal).toLocaleString()}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                          )}
                        </td>
                      );
                    })}

                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      backgroundColor: 'rgba(255,255,255,0.01)', 
                      color: isLevel1 ? 'var(--danger)' : isLevel2 ? 'var(--warning)' : 'var(--accent)'
                    }}>
                      {row.total > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDrilldownMonthIdx('ytd');
                            setDrilldownRowId(row.id);
                            setDrilldownRowType(row.type);
                            setDrilldownTargetVal(`${row.name} (YTD Total)`);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontWeight: 700,
                            color: isLevel1 ? 'var(--danger)' : isLevel2 ? 'var(--warning)' : 'var(--accent)',
                            cursor: 'pointer',
                            textDecoration: 'underline dashed rgba(255,255,255,0.3)',
                            padding: 0,
                            width: '100%',
                            textAlign: 'right'
                          }}
                        >
                          £{Math.round(row.total).toLocaleString()}
                        </button>
                      ) : (
                        <span>£0</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}

            {/* Column totals footer */}
            <tr style={{ fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.03)', borderTop: '2px solid var(--border-color)' }}>
              <td style={{ paddingLeft: '12px' }}>Monthly Totals (Group Expenses)</td>
              {colTotals.map((tot, idx) => (
                <td key={idx} style={{ textAlign: 'right', color: 'var(--danger)' }}>
                  {tot > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDrilldownMonthIdx(idx);
                        setDrilldownRowId('group-total');
                        setDrilldownRowType('group-total');
                        setDrilldownTargetVal('Group Expenses Total');
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '4px',
                        color: 'var(--danger)',
                        fontWeight: 700,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        textAlign: 'right'
                      }}
                    >
                      £{Math.round(tot).toLocaleString()}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                  )}
                </td>
              ))}
              <td style={{ textAlign: 'right', color: 'var(--danger)', fontSize: '13px' }}>
                {grandTotal > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDrilldownMonthIdx('ytd');
                      setDrilldownRowId('group-total');
                      setDrilldownRowType('group-total');
                      setDrilldownTargetVal('Group Expenses (Grand Total)');
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '4px',
                      color: 'var(--danger)',
                      fontWeight: 700,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      textAlign: 'right'
                    }}
                  >
                    £{Math.round(grandTotal).toLocaleString()}
                  </button>
                ) : (
                  <span>£0</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
