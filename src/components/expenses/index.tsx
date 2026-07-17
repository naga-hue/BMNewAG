import React, { useState, useMemo } from 'react';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';
import ExpensesTable from './ExpensesTable';
import BankStatementImport from './BankStatementImport';
import YtdAllocationMatrix from './YtdAllocationMatrix';
import RecipientPaymentsMatrix from './RecipientPaymentsMatrix';
import NominalCodesSetup from './NominalCodesSetup';
import ExpenseClaimForm from './ExpenseClaimForm';
import ReimbursementsDesk from './ReimbursementsDesk';
import './expenses.css';

interface ExpensesDashboardProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export default function ExpensesDashboard({ onShowToast }: ExpensesDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState('ledger');
  const [showForm, setShowForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const expenses = useBoundStore(state => state.expenses);
  const staff = useBoundStore(state => state.staff);
  const vendors = useBoundStore(state => state.vendors);
  const companies = useBoundStore(state => state.companies);
  const nominalCodes = useBoundStore(state => state.nominalCodes);

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;
  const savePayrollRecord = useBoundStore(state => state.savePayrollRecord);

  // Drilldown Overlay Modal State
  const [drilldownMonthIdx, setDrilldownMonthIdx] = useState<number | 'ytd' | null>(null);
  const [drilldownRowId, setDrilldownRowId] = useState<string | null>(null);
  const [drilldownRowType, setDrilldownRowType] = useState<string | null>('');
  const [drilldownTargetVal, setDrilldownTargetVal] = useState<string | null>('');

  // Payroll Linkage Modal State
  const [linkingPayrollExpId, setLinkingPayrollExpId] = useState<string | null>(null);
  const [linkingStaffId, setLinkingStaffId] = useState('');
  const [linkingMonth, setLinkingMonth] = useState('2026-07');

  // Drilldown target allocation state
  const [allocatingRowId, setAllocatingRowId] = useState<string | null>(null);
  const [allocatingType, setAllocatingType] = useState('company');
  const [allocatingTarget, setAllocatingTarget] = useState<string[]>([]);
  const [allocatingStaffIds, setAllocatingStaffIds] = useState<string[]>([]);
  const [allocatingMode, setAllocatingMode] = useState('auto');
  const [allocatingManualShares, setAllocatingManualShares] = useState<Record<string, number>>({});
  const [allocationSearch, setAllocationSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({ company: true, department: false, staff: false });

  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
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
    }).filter((c): c is { id: string; code: string; type: string } => c !== null && !!c.code);
  }, [nominalCodes]);

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

  // Rebuild the flat apportionment hierarchy (mirroring Matrix calculations to display drilldown counts correctly)
  const matrixYear = '2026';
  const { flatRowsForMatrix } = useMemo(() => {
    const staffOverhead: Record<string, number[]> = {};
    const staffTrans: Record<string, any[][]> = {};
    staff.forEach(s => {
      staffOverhead[s.id] = Array(12).fill(0);
      staffTrans[s.id] = Array.from({ length: 12 }, () => []);
    });

    const yearExpenses = (expenses || []).filter(e => e.plMonth && e.plMonth.startsWith(matrixYear));

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const monthKey = `${matrixYear}-${String(mIdx + 1).padStart(2, '0')}`;
      const activeStaff = staff.filter(() => {
        // Simple mock of worked days in month
        return true;
      });
      const monthExpenses = yearExpenses.filter(e => e.plMonth === monthKey);

      monthExpenses.forEach(exp => {
        const gbpAmt = toGBP(exp.amount, exp.currency);

        if (exp.allocationType === 'company') {
          const targets = (Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean)) as string[];
          if (targets.length > 0) {
            const eligibleStaff = activeStaff.filter(s => targets.includes(s.companyId));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              staffOverhead[s.id][mIdx] += perStaffShare;
              staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Company Apportionment' });
            });
          }
        } else if (exp.allocationType === 'department') {
          const targets = (Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean)) as string[];
          if (targets.length > 0) {
            const eligibleStaff = activeStaff.filter(s => s.department && targets.includes(s.department));
            const totalHead = eligibleStaff.length || 1;
            const perStaffShare = gbpAmt / totalHead;
            eligibleStaff.forEach(s => {
              staffOverhead[s.id][mIdx] += perStaffShare;
              staffTrans[s.id][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Department Apportionment' });
            });
          }
        } else if (exp.allocationType === 'staff') {
          const targets = (Array.isArray(exp.allocationTarget) ? exp.allocationTarget : []) as string[];
          if (targets.length > 0) {
            const perStaffShare = gbpAmt / targets.length;
            targets.forEach(staffId => {
              staffOverhead[staffId][mIdx] += perStaffShare;
              staffTrans[staffId][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Direct Staff Split' });
            });
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

    const computedData: any[] = [];
    companies.forEach(company => {
      const companyStaff = staff.filter(s => s.companyId === company.id);
      const companyMonths = Array(12).fill(0);
      const companyTransactionsByMonth: any[][] = Array.from({ length: 12 }, () => []);
      const nominalsMap: Record<string, { months: number[]; transactionsByMonth: any[][]; parties: Record<string, { months: number[]; transactionsByMonth: any[][] }> }> = {};

      companyStaff.forEach(member => {
        const memberTransactionsByMonth = staffTrans[member.id] || Array.from({ length: 12 }, () => []);
        for (let m = 0; m < 12; m++) {
          const monthTrans = memberTransactionsByMonth[m] || [];
          monthTrans.forEach(t => {
            const nom = t.nominalCode || 'Uncategorized';
            const payee = t.payee || 'Unknown Payee';
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

      const nominalRows: any[] = [];
      Object.keys(nominalsMap).sort().forEach(nom => {
        const nomData = nominalsMap[nom];
        const partyRows: any[] = [];

        Object.keys(nomData.parties).sort().forEach(payee => {
          const partyData = nomData.parties[payee];
          partyRows.push({
            id: `party-${company.id}-${nom}-${payee}`,
            name: payee,
            type: 'party',
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
        months: companyMonths,
        transactionsByMonth: companyTransactionsByMonth,
        total: companyMonths.reduce((a, b) => a + b, 0),
        children: nominalRows
      });
    });

    const flatRows: any[] = [];
    computedData.forEach(compRow => {
      flatRows.push(compRow);
      compRow.children.forEach((nomRow: any) => {
        flatRows.push(nomRow);
        nomRow.children.forEach((partyRow: any) => {
          flatRows.push(partyRow);
        });
      });
    });

    return { flatRowsForMatrix: flatRows };
  }, [staff, expenses, companies]);

  const handleEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setShowForm(true);
  };

  const handleSavePayrollLinkage = async () => {
    if (!linkingPayrollExpId) return;
    const exp = expenses.find(e => e.id === linkingPayrollExpId);
    if (!exp) return;

    if (!linkingStaffId || !linkingMonth) {
      onShowToast("Please select a staff member and payroll month.", "warning");
      return;
    }

    try {
      await saveExpense({
        ...exp,
        linkedPayrollCellId: `${linkingStaffId}_${linkingMonth}`
      });

      const baseVal = parseFloat(exp.amount.toFixed(2));
      const record = {
        id: `${linkingStaffId}_${linkingMonth}`,
        staffId: linkingStaffId,
        month: linkingMonth,
        isReconciled: true,
        basicSalary: baseVal,
        commission: 0,
        employerNi: 0,
        employerPension: 0,
        employeeTaxNic: 0,
        employeePension: 0,
        notes: `Linked to ledger transaction: ${exp.payee.split(' [Ref:')[0]} on ${exp.date}.`,
        linkedExpenseId: exp.id
      };
      await savePayrollRecord(record);

      onShowToast("Transaction linked to payroll successfully.", "success");
      setLinkingPayrollExpId(null);
    } catch (err: any) {
      onShowToast(`Error linking transaction: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tab Navigation */}
      <div className="expenses-tab-nav">
        {[
          { key: 'ledger', label: 'Expenses Ledger Log' },
          { key: 'statement', label: 'Bank Statement Import & Categorizer' },
          { key: 'reimbursements', label: 'Reimbursement Claims Workflow' },
          { key: 'matrix', label: 'YTD Expenses Allocation Matrix' },
          { key: 'recipients', label: 'Recipient Payments Matrix' },
          { key: 'settings', label: 'Nominal Codes Setup' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              setActiveSubTab(t.key);
              setShowForm(false);
              setEditingExpenseId(null);
            }}
            className={`expenses-tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '-12px' }}>
        {activeSubTab === 'ledger' && !showForm && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            Record Manual Expense Claim
          </button>
        )}
      </div>

      {/* Manual claim drawer form */}
      <ExpenseClaimForm
        editingExpenseId={editingExpenseId}
        setEditingExpenseId={setEditingExpenseId}
        showForm={showForm}
        setShowForm={setShowForm}
        onShowToast={onShowToast}
      />

      {/* Main Tab Routing */}
      {activeSubTab === 'ledger' && (
        <ExpensesTable
          handleEditExpense={handleEditExpense}
          setLinkingPayrollExpId={setLinkingPayrollExpId}
          setLinkingStaffId={setLinkingStaffId}
          setLinkingMonth={setLinkingMonth}
          setAllocatingRowId={setAllocatingRowId}
          setAllocatingType={setAllocatingType}
          setAllocatingTarget={setAllocatingTarget}
          setAllocatingStaffIds={setAllocatingStaffIds}
          setAllocatingMode={setAllocatingMode}
          setAllocatingManualShares={setAllocatingManualShares}
          setExpandedSections={setExpandedSections}
          setAllocationSearch={setAllocationSearch}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'statement' && (
        <BankStatementImport onShowToast={onShowToast} />
      )}

      {activeSubTab === 'reimbursements' && (
        <ReimbursementsDesk onShowToast={onShowToast} />
      )}

      {activeSubTab === 'matrix' && (
        <YtdAllocationMatrix
          setDrilldownMonthIdx={setDrilldownMonthIdx}
          setDrilldownRowId={setDrilldownRowId}
          setDrilldownRowType={setDrilldownRowType}
          setDrilldownTargetVal={setDrilldownTargetVal}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'recipients' && (
        <RecipientPaymentsMatrix
          setDrilldownMonthIdx={setDrilldownMonthIdx}
          setDrilldownRowId={setDrilldownRowId}
          setDrilldownRowType={setDrilldownRowType}
          setDrilldownTargetVal={setDrilldownTargetVal}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'settings' && (
        <NominalCodesSetup onShowToast={onShowToast} />
      )}

      {/* Drill-down modal detail viewer */}
      {drilldownMonthIdx !== null && drilldownRowId !== null && (
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
            width: '90%',
            maxWidth: '850px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                  🏦 Expenses Drill-down: {drilldownTargetVal}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Period: {drilldownMonthIdx === 'ytd' ? 'Full Year YTD' : `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][drilldownMonthIdx]} ${matrixYear}`}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setDrilldownMonthIdx(null);
                  setDrilldownRowId(null);
                  setDrilldownRowType('');
                  setDrilldownTargetVal('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="entity-table dense" style={{ fontSize: '11px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                  <tr>
                    <th>Date</th>
                    <th>P&L Month</th>
                    <th>Payee / Vendor</th>
                    <th>Nominal Category</th>
                    <th style={{ textAlign: 'right' }}>Total Cost (Gross)</th>
                    <th style={{ textAlign: 'right' }}>Your Share / Apportionment</th>
                    <th>Apportionment Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let matchedRow: any = null;
                    const hasFlatRows = typeof flatRowsForMatrix !== 'undefined' && flatRowsForMatrix;
                    
                    if (hasFlatRows) {
                      matchedRow = flatRowsForMatrix.find(r => r.id === drilldownRowId);
                    }
                    
                    if (drilldownRowType === 'recipient') {
                      const [rtype, rid] = (drilldownRowId || '').split(':');
                      const matchedStaff = staff.find(s => s.id === rid);
                      const matchedVendor = vendors.find(v => v.id === rid);
                      const name = rtype === 'staff' ? matchedStaff?.fullName : matchedVendor?.name;

                      const recipientTransactionsByMonth: any[][] = Array.from({ length: 12 }, () => []);
                      for (let m = 0; m < 12; m++) {
                        const monthKey = `2026-${String(m + 1).padStart(2, '0')}`;
                        const monthlyTransactions = expenses.filter(e => {
                          if (e.plMonth !== monthKey) return false;
                          if (e.recipientType === rtype && e.recipientId === rid) return true;
                          if (!e.recipientType || e.recipientType === 'other') {
                            const payeeLower = (e.payee || '').toLowerCase();
                            const nameLower = (name || '').toLowerCase();
                            return payeeLower.includes(nameLower) || nameLower.includes(payeeLower);
                          }
                          return false;
                        });
                        recipientTransactionsByMonth[m].push(...monthlyTransactions);
                      }

                      matchedRow = {
                        id: drilldownRowId,
                        name: name || 'Recipient',
                        transactionsByMonth: recipientTransactionsByMonth
                      };
                    } else if (drilldownRowId === 'group-total') {
                      const allGroupTransactionsByMonth: any[][] = Array.from({ length: 12 }, () => []);
                      if (hasFlatRows) {
                        flatRowsForMatrix.forEach(r => {
                          if (r.type === 'party') {
                            for (let m = 0; m < 12; m++) {
                              allGroupTransactionsByMonth[m].push(...(r.transactionsByMonth[m] || []));
                            }
                          }
                        });
                      }
                      matchedRow = {
                        id: 'group-total',
                        name: 'Group Expenses Total',
                        transactionsByMonth: allGroupTransactionsByMonth
                      };
                    }

                    if (!matchedRow) return null;

                    // De-duplicate transactions
                    const uniq: any[] = [];
                    const seen = new Set();
                    
                    if (drilldownMonthIdx === 'ytd') {
                      for (let m = 0; m < 12; m++) {
                        (matchedRow.transactionsByMonth[m] || []).forEach((t: any) => {
                          if (!seen.has(t.id)) {
                            seen.add(t.id);
                            uniq.push(t);
                          }
                        });
                      }
                    } else if (typeof drilldownMonthIdx === 'number') {
                      (matchedRow.transactionsByMonth[drilldownMonthIdx] || []).forEach((t: any) => {
                        if (!seen.has(t.id)) {
                          seen.add(t.id);
                          uniq.push(t);
                        }
                      });
                    }

                    if (uniq.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                            No expenses allocated in this month.
                          </td>
                        </tr>
                      );
                    }

                    return uniq.map(t => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td>
                          <input 
                            type="month"
                            value={t.plMonth || ''}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              const original = expenses.find(exp => exp.id === t.id);
                              if (original && newVal) {
                                saveExpense({
                                  ...original,
                                  plMonth: newVal
                                });
                                onShowToast("P&L Month updated.", "success");
                              }
                            }}
                            className="select-filter"
                            style={{
                              fontSize: '11px',
                              padding: '2px 4px',
                              fontWeight: 600,
                              width: '100px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={t.recipientType && t.recipientType !== 'other' ? `${t.recipientType}:${t.recipientId}` : 'other'}
                            onChange={(e) => {
                              const val = e.target.value;
                              const original = expenses.find(exp => exp.id === t.id);
                              if (original) {
                                if (val === 'other') {
                                  saveExpense({
                                    ...original,
                                    recipientType: 'other',
                                    recipientId: ''
                                  });
                                  onShowToast("Payee mapping cleared.", "success");
                                } else {
                                  const [type, id] = val.split(':');
                                  const mappedName = type === 'vendor' 
                                    ? vendors.find(v => v.id === id)?.name 
                                    : staff.find(s => s.id === id)?.fullName;
                                  
                                  saveExpense({
                                    ...original,
                                    recipientType: type,
                                    recipientId: id,
                                    payee: mappedName || original.payee
                                  });
                                  onShowToast("Payee mapping updated.", "success");
                                }
                              }
                            }}
                            className="select-filter"
                            style={{ 
                              padding: '2px 4px', 
                              fontSize: '11px', 
                              width: '100%', 
                              minWidth: '155px',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="other">General: {t.payee.split(' [Ref:')[0]}</option>
                            <optgroup label="Registered Vendors">
                              {vendors.map(v => (
                                <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Staff / Consultants">
                              {staff.map(s => (
                                <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td>
                          <select
                            value={t.nominalCode || ''}
                            onChange={(e) => {
                              const newNominal = e.target.value;
                              const original = expenses.find(exp => exp.id === t.id);
                              if (original) {
                                saveExpense({
                                  ...original,
                                  nominalCode: newNominal
                                });
                                onShowToast("Nominal code updated.", "success");
                              }
                            }}
                            className="select-filter"
                            style={{ fontSize: '11px', padding: '2px 4px', width: '100%', minWidth: '130px' }}
                          >
                            <option value="">-- Unmapped --</option>
                            {activeNominalCodes.map(nc => (
                              <option key={nc.code} value={nc.code}>{nc.code}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          £{toGBP(t.amount, t.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                          £{(t.apportionedShare !== undefined ? t.apportionedShare : toGBP(t.amount, t.currency)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span 
                            onClick={() => {
                              const original = expenses.find(exp => exp.id === t.id);
                              if (original) {
                                setAllocatingRowId(original.id);
                                const rawTarget = original.allocationTarget || [];
                                const targetArray = Array.isArray(rawTarget) ? rawTarget : [rawTarget].filter(Boolean);
                                const type = original.allocationType || 'company';
                                const validTarget = type === 'company'
                                  ? targetArray.filter(tid => companies.some(c => c.id === tid))
                                  : type === 'department'
                                    ? targetArray.filter(d => allAvailableDepts.includes(d))
                                    : targetArray;
                                setAllocatingType(type);
                                setAllocatingTarget(validTarget);
                                setAllocatingStaffIds(type === 'staff' ? targetArray.filter(sid => staff.some(s => s.id === sid)) : []);
                                setAllocatingMode(original.allocationMode || 'auto');
                                setAllocatingManualShares(original.manualAllocationShares || {});
                                setExpandedSections({
                                  company: original.allocationType === 'company' || !original.allocationType,
                                  department: original.allocationType === 'department',
                                  staff: original.allocationType === 'staff'
                                });
                                setAllocationSearch('');
                              }
                            }}
                            title="Click to modify allocation target"
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor: 'rgba(99, 102, 241, 0.08)',
                              color: 'var(--accent)',
                              border: '1px dashed rgba(99, 102, 241, 0.3)',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}
                          >
                            {t.shareReason || 'Direct Cost'} ✏️
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => {
                  setDrilldownMonthIdx(null);
                  setDrilldownRowId(null);
                  setDrilldownRowType('');
                  setDrilldownTargetVal('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Linkage Modal overlay */}
      {linkingPayrollExpId !== null && (
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
            width: '90%',
            maxWidth: '450px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔗 Reconcile Transaction with Payroll Roster
              </h3>
              <button 
                type="button"
                onClick={() => setLinkingPayrollExpId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {(() => {
              const matchedRow = expenses.find(e => e.id === linkingPayrollExpId);
              if (!matchedRow) return <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Transaction details not found.</p>;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600 }}>{matchedRow.payee?.split(' [Ref:')[0]}</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Date: {matchedRow.date} &bull; Amount: £{matchedRow.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Staff / Recruiter Member <span>*</span></label>
                    <select
                      className="select-filter"
                      value={linkingStaffId}
                      onChange={(e) => setLinkingStaffId(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      <option value="">-- Select Employee --</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.fullName} ({s.payrollPolicyId ? 'Policy Assigned' : 'No Policy'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Target Payroll Month <span>*</span></label>
                    <select
                      className="select-filter"
                      value={linkingMonth}
                      onChange={(e) => setLinkingMonth(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      {["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setLinkingPayrollExpId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSavePayrollLinkage}
                    >
                      Save Linkage
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Drilldown Target Allocation Popup Modal */}
      {allocatingRowId !== null && (
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
          zIndex: 10050,
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
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Select Target Allocation Cost Center
                </h3>
              </div>
              <button type="button" onClick={() => setAllocatingRowId(null)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" placeholder="Search allocation targets by name..." value={allocationSearch} onChange={(e) => setAllocationSearch(e.target.value)} style={{ fontSize: '12px', padding: '8px', width: '100%' }} />
            </div>

            {allocatingType !== 'global' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Split Allocation Mode:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAllocatingMode('auto')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'auto' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'auto' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Automatic (Staff Weighted)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocatingMode('manual')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'manual' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'manual' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Manual Override (%)
                  </button>
                </div>
              </div>
            )}

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                onClick={() => {
                  setAllocatingType('global');
                  setAllocatingTarget([]);
                  setAllocatingStaffIds([]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  backgroundColor: allocatingType === 'global' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: allocatingType === 'global' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <input type="radio" checked={allocatingType === 'global'} readOnly style={{ cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>🌎 Whole Corporate Group</div>
                </div>
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, company: !prev.company }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>🏢 Companies {allocatingType === 'company' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.company && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {companies.filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase())).map(c => {
                      const isChecked = allocatingType === 'company' && allocatingTarget.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{c.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[c.id] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [c.id]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'company' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(c.id);
                                } else {
                                  current = current.filter(id => id !== c.id);
                                }
                                setAllocatingType('company');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, department: !prev.department }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>📂 Departments {allocatingType === 'department' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.department && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {allAvailableDepts.filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase())).map(d => {
                      const isChecked = allocatingType === 'department' && allocatingTarget.includes(d);
                      return (
                        <label key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{d}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[d] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [d]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'department' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(d);
                                } else {
                                  current = current.filter(id => id !== d);
                                }
                                setAllocatingType('department');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, staff: !prev.staff }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>👥 Recruiters {allocatingType === 'staff' && `(${allocatingStaffIds.length} selected)`}</span>
                </div>
                {expandedSections.staff && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {staff.filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase())).map(s => {
                      const isChecked = allocatingType === 'staff' && allocatingStaffIds.includes(s.id);
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{s.fullName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[s.id] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [s.id]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'staff' ? [...allocatingStaffIds] : [];
                                if (e.target.checked) {
                                  current.push(s.id);
                                } else {
                                  current = current.filter(id => id !== s.id);
                                }
                                setAllocatingType('staff');
                                setAllocatingStaffIds(current);
                                setAllocatingTarget([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={async () => {
                  let finalTarget = allocatingTarget;
                  if (allocatingType === 'company') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(tid => companies.some(c => c.id === tid));
                    if (finalTarget.length === 0 && companies[0]) {
                      finalTarget = [companies[0].id];
                    }
                  } else if (allocatingType === 'department') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(d => allAvailableDepts.includes(d));
                    if (finalTarget.length === 0 && allAvailableDepts[0]) {
                      finalTarget = [allAvailableDepts[0]];
                    }
                  } else if (allocatingType === 'staff') {
                    if (allocatingStaffIds.length === 0) {
                      onShowToast("Please select at least one staff member.", "warning");
                      return;
                    }
                    finalTarget = allocatingStaffIds;
                  }

                  if (allocatingType !== 'global' && allocatingMode === 'manual') {
                    let totalPercent = 0;
                    finalTarget.forEach(tid => {
                      totalPercent += parseInt(String(allocatingManualShares[tid] || 0), 10);
                    });
                    if (totalPercent !== 100) {
                      onShowToast(`Manual split percentages must sum to exactly 100% (currently ${totalPercent}%).`, "warning");
                      return;
                    }
                  }

                  const original = expenses.find(e => e.id === allocatingRowId);
                  if (original) {
                    await saveExpense({
                      ...original,
                      allocationType: allocatingType,
                      allocationTarget: finalTarget,
                      allocationMode: allocatingMode,
                      manualAllocationShares: allocatingManualShares
                    });
                    onShowToast("Cost allocation updated for transaction.", "success");
                  }
                  setAllocatingRowId(null);
                }}
              >
                Apply
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAllocatingRowId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
