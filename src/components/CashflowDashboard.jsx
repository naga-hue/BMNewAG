import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Building2, 
  DollarSign, 
  Filter, 
  Briefcase, 
  Clock, 
  AlertTriangle,
  Wallet,
  CheckCircle,
  Edit2,
  Save,
  X
} from 'lucide-react';

const CURRENCY_SYMBOLS = {
  GBP: '£',
  USD: '$',
  AED: 'AED ',
  ZAR: 'R',
  INR: '₹'
};

const FREQUENCY_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-off': 'One-off'
};

export default function CashflowDashboard({
  placements = [],
  contracts = [],
  vendors = [],
  companies = [],
  staff = [],
  payrollPolicies = [],
  expenses = [],
  onUpdateCompany
}) {
  const [activeSubTab, setActiveSubTab] = useState('projections'); // projections, balances
  const [timeframe, setTimeframe] = useState('30'); // 7, 30, 90, overdue, all
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('all');

  // Inline editing state for bank account balances
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');

  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const getCurrencySymbol = (companyId) => {
    const matched = companies.find(c => c.id === companyId);
    return CURRENCY_SYMBOLS[matched?.currency || 'GBP'] || '£';
  };

  const getCurrencyCode = (companyId) => {
    const matched = companies.find(c => c.id === companyId);
    return matched?.currency || 'GBP';
  };

  // Helper: check if a date falls in our timeframe
  const isWithinTimeframe = (dateStr) => {
    if (!dateStr) return false;
    
    if (timeframe === 'all') return true;
    
    if (timeframe === 'overdue') {
      return dateStr < todayStr;
    }

    // Otherwise timeframe is a number of days
    const limit = new Date();
    limit.setDate(limit.getDate() + Number(timeframe));
    const limitStr = limit.toISOString().split('T')[0];

    return dateStr >= todayStr && dateStr <= limitStr;
  };

  // Resolve current active bank account filters
  const selectedBankAccountInfo = useMemo(() => {
    if (selectedBankAccountId === 'all') return null;
    for (const c of companies) {
      const found = (c.bankAccounts || []).find(a => a.id === selectedBankAccountId);
      if (found) {
        return {
          account: found,
          company: c
        };
      }
    }
    return null;
  }, [companies, selectedBankAccountId]);

  // List of bank accounts available based on Selected Company
  const filteredBankAccountsDropdown = useMemo(() => {
    if (selectedCompanyId === 'all') {
      const allAccs = [];
      companies.forEach(c => {
        (c.bankAccounts || []).forEach(acc => {
          allAccs.push({ ...acc, companyName: c.name });
        });
      });
      return allAccs;
    } else {
      const matchedCompany = companies.find(c => c.id === selectedCompanyId);
      return matchedCompany ? (matchedCompany.bankAccounts || []).map(acc => ({ ...acc, companyName: matchedCompany.name })) : [];
    }
  }, [companies, selectedCompanyId]);

  // Save updated balance to database
  const handleSaveBalance = async (company, accountId) => {
    const updatedAccounts = (company.bankAccounts || []).map(acc => {
      if (acc.id === accountId) {
        return { ...acc, balance: Number(editBalanceValue) || 0 };
      }
      return acc;
    });

    const updatedCompany = { ...company, bankAccounts: updatedAccounts };
    if (onUpdateCompany) {
      try {
        await onUpdateCompany(updatedCompany);
        setEditingAccountId(null);
      } catch (err) {
        alert("Failed to save balance: " + err.message);
      }
    }
  };

  // Calculate Available Starting Cash
  const startingCashTotals = useMemo(() => {
    const totals = {};
    companies.forEach(c => {
      if (selectedCompanyId !== 'all' && c.id !== selectedCompanyId) return;

      (c.bankAccounts || []).forEach(acc => {
        if (selectedBankAccountId !== 'all' && acc.id !== selectedBankAccountId) return;
        totals[acc.currency] = (totals[acc.currency] || 0) + (Number(acc.balance) || 0);
      });
    });

    return Object.entries(totals)
      .map(([curr, val]) => `${CURRENCY_SYMBOLS[curr] || curr}${Math.round(val).toLocaleString()}`)
      .join(' | ') || '£0';
  }, [companies, selectedCompanyId, selectedBankAccountId]);

  // 1. Inflows: Unpaid Placements
  const inflows = useMemo(() => {
    return placements.map(p => {
      const gross = Number(p.grossBillAmount) || 0;
      const vat = (p.vatAmount !== undefined && p.vatAmount !== null && p.vatAmount !== '') 
        ? (Number(p.vatAmount) || 0) 
        : (Math.round(gross * 0.20 * 100) / 100);
      const total = (p.totalInvoiceAmount !== undefined && p.totalInvoiceAmount !== null && p.totalInvoiceAmount !== '') 
        ? (Number(p.totalInvoiceAmount) || 0) 
        : (gross + vat);
      
      const raisedDate = p.invoiceRaisedDate || p.startDate || p.scoredDate || todayStr;
      const termsDays = (p.paymentTermsDays !== undefined && p.paymentTermsDays !== null && p.paymentTermsDays !== '') ? Number(p.paymentTermsDays) : 30;
      
      let dueDate = p.invoiceDueDate;
      if (!dueDate && raisedDate) {
        try {
          const parts = raisedDate.split('-');
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + termsDays);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayVal = String(d.getDate()).padStart(2, '0');
            dueDate = `${y}-${m}-${dayVal}`;
          }
        } catch (e) {
          dueDate = raisedDate;
        }
      }

      const paid = Number(p.amountPaid) || 0;
      const outstanding = Math.max(0, total - paid);

      let finalStatus = p.paymentStatus || 'not-invoiced';
      if (p.clientPaymentStatus === 'paid' || outstanding === 0) {
        finalStatus = 'paid';
      } else if (
        finalStatus !== 'paid' && 
        finalStatus !== 'written-off' && 
        finalStatus !== 'dns-rebate' && 
        finalStatus !== 'legal' && 
        finalStatus !== 'disputed' && 
        dueDate < todayStr
      ) {
        finalStatus = 'overdue';
      }

      return {
        id: p.id,
        placementId: p.placementId,
        clientCompany: p.clientCompany,
        candidateName: p.candidateName,
        dueDate: dueDate || raisedDate,
        totalInvoice: total,
        outstanding,
        status: finalStatus,
        companyId: p.companyId || (companies.find(c => c.name === p.clientCompany)?.id || 'group'),
        invoiceType: p.invoiceType || 'direct'
      };
    }).filter(inv => {
      if (inv.outstanding <= 0 || ['paid', 'written-off', 'dns-rebate'].includes(inv.status)) return false;
      if (selectedCompanyId !== 'all' && inv.companyId !== selectedCompanyId) return false;
      if (selectedBankAccountInfo) {
        if (inv.companyId !== selectedBankAccountInfo.company.id) return false;
      }
      return isWithinTimeframe(inv.dueDate);
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [placements, companies, timeframe, selectedCompanyId, selectedBankAccountInfo, todayStr]);

  // 2. Outflows: Contract Payments + Staff Payroll + Unreconciled Expenses
  const outflows = useMemo(() => {
    const contractOutflows = [];
    contracts.forEach(c => {
      const uCost = Number(c.unitCost) || 0;
      const qty = Number(c.quantityPurchased) || 0;
      const vatRate = Number(c.taxRate || 0);
      const subtotal = uCost * qty;
      const totalCost = subtotal * (1 + vatRate / 100);

      const vendor = vendors.find(v => v.id === c.vendorId);
      const vendorName = vendor ? vendor.name : 'Vendor';
      const frequency = c.costInterval || 'monthly';

      if (frequency === 'monthly') {
        const baseDateStr = c.paymentDueDate || c.startDate || todayStr;
        let billingDay = 25;
        try {
          const parts = baseDateStr.split('-');
          if (parts.length === 3) {
            billingDay = Number(parts[2]) || 25;
          }
        } catch (e) {}

        const start = new Date();
        for (let i = 0; i < 12; i++) {
          const d = new Date(start.getFullYear(), start.getMonth() + i, billingDay);
          const yStr = d.getFullYear();
          const mStr = String(d.getMonth() + 1).padStart(2, '0');
          const dStr = String(d.getDate()).padStart(2, '0');
          const calculatedDueDate = `${yStr}-${mStr}-${dStr}`;

          if (c.startDate && calculatedDueDate < c.startDate) continue;
          if (c.endDate && calculatedDueDate > c.endDate) break;

          contractOutflows.push({
            id: `${c.id}-${calculatedDueDate}`,
            agreementName: c.name,
            vendorName,
            dueDate: calculatedDueDate,
            totalCost,
            frequency,
            companyId: c.companyId,
            currency: c.currency || 'GBP',
            type: 'contract'
          });
        }
      } else {
        contractOutflows.push({
          id: c.id,
          agreementName: c.name,
          vendorName,
          dueDate: c.paymentDueDate || c.renewalDate || todayStr,
          totalCost,
          frequency,
          companyId: c.companyId,
          currency: c.currency || 'GBP',
          type: 'contract'
        });
      }
    });

    const payrollOutflows = [];
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1; // 1-indexed
    const pad = (n) => String(n).padStart(2, '0');

    staff.filter(s => s.status !== 'exited' && s.salary).forEach(s => {
      const monthlyBasePay = (Number(s.salary) || 0) / 12;
      if (monthlyBasePay <= 0) return;

      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
      const payDay = policy ? (policy.paymentDayOfMonth || 25) : 25;

      const thisMonthPayDate = `${currYear}-${pad(currMonth)}-${pad(payDay)}`;

      let nextMonth = currMonth + 1;
      let nextYear = currYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const nextMonthPayDate = `${nextYear}-${pad(nextMonth)}-${pad(payDay)}`;

      payrollOutflows.push({
        id: `payroll-${s.id}-curr`,
        agreementName: `Payroll: ${s.fullName}`,
        vendorName: 'Staff Member',
        dueDate: thisMonthPayDate,
        totalCost: monthlyBasePay,
        frequency: 'monthly',
        companyId: s.companyId || 'group',
        currency: s.currency || 'GBP',
        type: 'payroll'
      });

      payrollOutflows.push({
        id: `payroll-${s.id}-next`,
        agreementName: `Payroll: ${s.fullName}`,
        vendorName: 'Staff Member',
        dueDate: nextMonthPayDate,
        totalCost: monthlyBasePay,
        frequency: 'monthly',
        companyId: s.companyId || 'group',
        currency: s.currency || 'GBP',
        type: 'payroll'
      });
    });

    const expenseOutflows = expenses.filter(exp => {
      const isFutureOrPending = !exp.isReconciled || exp.date >= todayStr;
      return isFutureOrPending;
    }).map(exp => {
      return {
        id: `expense-${exp.id}`,
        agreementName: `Expense: ${exp.description || exp.category || 'Direct Expense'}`,
        vendorName: exp.vendor || 'Expense Ledger',
        dueDate: exp.date || todayStr,
        totalCost: Number(exp.amount) || 0,
        frequency: 'one-off',
        companyId: exp.bankCompanyId || exp.companyId || 'group',
        currency: exp.currency || 'GBP',
        bankAccountId: exp.bankAccountId,
        type: 'expense'
      };
    });

    return [...contractOutflows, ...payrollOutflows, ...expenseOutflows].filter(out => {
      if (!out.dueDate) return false;
      if (selectedCompanyId !== 'all' && out.companyId !== selectedCompanyId) return false;

      if (selectedBankAccountInfo) {
        if (out.bankAccountId) {
          if (out.bankAccountId !== selectedBankAccountId) return false;
        } else {
          if (out.companyId !== selectedBankAccountInfo.company.id) return false;
        }
      }

      return isWithinTimeframe(out.dueDate);
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [contracts, vendors, staff, payrollPolicies, expenses, timeframe, selectedCompanyId, selectedBankAccountId, selectedBankAccountInfo, todayStr]);

  // 3. Forecast summaries & currency breakdowns
  const cashflowSummary = useMemo(() => {
    const inflowTotals = {};
    const outflowTotals = {};
    const netTotals = {};
    const finalProjectedTotals = {};

    companies.forEach(c => {
      if (selectedCompanyId !== 'all' && c.id !== selectedCompanyId) return;
      (c.bankAccounts || []).forEach(acc => {
        if (selectedBankAccountId !== 'all' && acc.id !== selectedBankAccountId) return;
        const curr = acc.currency;
        finalProjectedTotals[curr] = (finalProjectedTotals[curr] || 0) + (Number(acc.balance) || 0);
      });
    });

    inflows.forEach(inv => {
      const curr = getCurrencyCode(inv.companyId);
      inflowTotals[curr] = (inflowTotals[curr] || 0) + inv.outstanding;
      netTotals[curr] = (netTotals[curr] || 0) + inv.outstanding;
      finalProjectedTotals[curr] = (finalProjectedTotals[curr] || 0) + inv.outstanding;
    });

    outflows.forEach(out => {
      const curr = out.currency;
      outflowTotals[curr] = (outflowTotals[curr] || 0) + out.totalCost;
      netTotals[curr] = (netTotals[curr] || 0) - out.totalCost;
      finalProjectedTotals[curr] = (finalProjectedTotals[curr] || 0) - out.totalCost;
    });

    const formatBreakdown = (totalsObj) => {
      return Object.entries(totalsObj)
        .map(([curr, val]) => `${CURRENCY_SYMBOLS[curr] || curr}${Math.round(val).toLocaleString()}`)
        .join(' | ') || '£0';
    };

    return {
      inflowCount: inflows.length,
      inflowText: formatBreakdown(inflowTotals),
      outflowCount: outflows.length,
      outflowText: formatBreakdown(outflowTotals),
      netText: formatBreakdown(netTotals),
      finalProjectedText: formatBreakdown(finalProjectedTotals)
    };
  }, [inflows, outflows, companies, selectedCompanyId, selectedBankAccountId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Selector Header */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          className={`btn-secondary ${activeSubTab === 'projections' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('projections')}
          style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
        >
          📅 Projections & Ledgers
        </button>
        <button 
          className={`btn-secondary ${activeSubTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('balances')}
          style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
        >
          🏦 Banking Balances
        </button>
      </div>

      {/* -------------------------------------------------------------
          SUBTAB: BANK BALANCES
          ------------------------------------------------------------- */}
      {activeSubTab === 'balances' && (
        <div className="detail-section" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Wallet size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Company Banking Portals & Live Cash Balances</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {companies.map(comp => {
              const companyTotalBalance = (comp.bankAccounts || []).reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
              const symbol = CURRENCY_SYMBOLS[comp.currency || 'GBP'] || '£';

              return (
                <div 
                  key={comp.id}
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={16} style={{ color: 'var(--primary)' }} />
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{comp.name}</strong>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)', fontFamily: 'monospace' }}>
                      Total: {symbol}{companyTotalBalance.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(comp.bankAccounts || []).map(acc => {
                      const isEditing = editingAccountId === acc.id;

                      return (
                        <div 
                          key={acc.id}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            backgroundColor: 'var(--bg-card)', 
                            padding: '8px 12px', 
                            borderRadius: '8px' 
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{acc.bankName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{acc.accountName} ({acc.accountNumber})</span>
                          </div>

                          <div>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input 
                                  type="number" 
                                  className="form-input"
                                  value={editBalanceValue}
                                  onChange={(e) => setEditBalanceValue(e.target.value)}
                                  style={{ width: '100px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}
                                  autoFocus
                                />
                                <button 
                                  className="btn-primary" 
                                  onClick={() => handleSaveBalance(comp, acc.id)}
                                  style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}
                                >
                                  <Save size={12} />
                                </button>
                                <button 
                                  className="btn-secondary" 
                                  onClick={() => setEditingAccountId(null)}
                                  style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                                  {CURRENCY_SYMBOLS[acc.currency] || acc.currency}{Number(acc.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <button 
                                  onClick={() => {
                                    setEditingAccountId(acc.id);
                                    setEditBalanceValue(String(acc.balance || 0));
                                  }}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.7, padding: '2px' }}
                                  title="Update Live Balance"
                                >
                                  <Edit2 size={12} style={{ color: 'var(--text-muted)' }} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {(comp.bankAccounts || []).length === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
                        No bank accounts registered.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SUBTAB: FORECAST PROJECTIONS
          ------------------------------------------------------------- */}
      {activeSubTab === 'projections' && (
        <>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Forecast Projections Filter</h3>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                className="select-filter"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                style={{ padding: '8px 12px', minWidth: '130px' }}
              >
                <option value="7">Next 7 Days</option>
                <option value="30">Next 30 Days</option>
                <option value="90">Next 90 Days</option>
                <option value="overdue">Overdue Items</option>
                <option value="all">All Upcoming</option>
              </select>

              <select
                className="select-filter"
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedBankAccountId('all');
                }}
                style={{ padding: '8px 12px', minWidth: '180px' }}
              >
                <option value="all">All Group Entities</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
                ))}
              </select>

              <select
                className="select-filter"
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                style={{ padding: '8px 12px', minWidth: '220px' }}
              >
                <option value="all">All Linked Bank Accounts</option>
                {filteredBankAccountsDropdown.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.companyName}: {acc.bankName} - {acc.accountName} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '16px' }}>
            
            {/* Live Bank Starting Cash */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏦 Live Cash in Bank
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {startingCashTotals}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Current available balances
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                <Wallet size={18} />
              </div>
            </div>

            {/* Total Projected Inflows */}
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.12)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📈 Expected Inflows
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--success)', fontFamily: 'monospace' }}>
                  {cashflowSummary.inflowText}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  💸 <strong>{cashflowSummary.inflowCount} Sales</strong> expected
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)', padding: '8px', borderRadius: '8px' }}>
                <ArrowUpRight size={18} />
              </div>
            </div>

            {/* Total Projected Outflows */}
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.12)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📉 Expected Outflows
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--danger)', fontFamily: 'monospace' }}>
                  {cashflowSummary.outflowText}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  💼 <strong>{cashflowSummary.outflowCount} Payments</strong> due
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
                <ArrowDownRight size={18} />
              </div>
            </div>

            {/* Net Projected Closing Cash */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚖️ Forecasted Closing Cash
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 2px 0', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {cashflowSummary.finalProjectedText}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Projected bank balance after horizon
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                <Calendar size={18} />
              </div>
            </div>

          </div>

          {/* Forecast Ledger Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            {/* 1. Inflows Table */}
            <div className="detail-section" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🟢 Expected Sales Collections (Cash Inflows)
              </h3>
              
              <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Due Date</th>
                      <th style={{ padding: '10px 8px' }}>Client & Candidate</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount Due</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflows.map(inv => {
                      const symbol = getCurrencySymbol(inv.companyId);
                      const isOverdue = inv.dueDate < todayStr;

                      return (
                        <tr 
                          key={inv.id}
                          style={{ 
                            backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                        >
                          <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {inv.dueDate}
                              </span>
                              {isOverdue && (
                                <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>
                                  (Overdue)
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{inv.clientCompany}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.candidateName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {symbol}{inv.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ 
                              backgroundColor: inv.invoiceType === 'direct' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                              color: inv.invoiceType === 'direct' ? '#0ea5e9' : 'var(--primary)', 
                              padding: '3px 6px', 
                              borderRadius: '8px', 
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              {inv.invoiceType === 'direct' ? 'Direct' : 'Simplicity'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {inflows.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No projected inflows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Outflows Table */}
            <div className="detail-section" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔴 Scheduled Outflows (Expenses & Payroll)
              </h3>

              <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Due Date</th>
                      <th style={{ padding: '10px 8px' }}>Beneficiary & Purpose</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount Due</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outflows.map(out => {
                      const symbol = CURRENCY_SYMBOLS[out.currency] || '£';
                      const isOverdue = out.dueDate < todayStr;

                      return (
                        <tr 
                          key={out.id}
                          style={{ 
                            backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                        >
                          <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {out.dueDate}
                              </span>
                              {isOverdue && (
                                <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>
                                  (Overdue)
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{out.vendorName}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{out.agreementName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {symbol}{out.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ 
                              backgroundColor: out.type === 'payroll' 
                                ? 'rgba(16, 185, 129, 0.1)' 
                                : out.type === 'contract' 
                                  ? 'rgba(217, 119, 6, 0.1)' 
                                  : 'rgba(107, 114, 128, 0.1)', 
                              color: out.type === 'payroll' 
                                ? '#10b981' 
                                : out.type === 'contract' 
                                  ? '#d97706' 
                                  : 'var(--text-secondary)', 
                              padding: '3px 6px', 
                              borderRadius: '8px', 
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              {out.type === 'payroll' ? 'Payroll' : out.type === 'contract' ? 'Contract' : 'Expense'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {outflows.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No scheduled outflows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
        </>
      )}

    </div>
  );
}
