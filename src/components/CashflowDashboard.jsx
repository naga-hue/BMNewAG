import React, { useState, useEffect, useMemo } from 'react';
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

const STATIC_FX_RATES = {
  GBP: 1.0,
  USD: 0.79,
  AED: 0.21,
  INR: 0.0094,
  ZAR: 0.043
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

  // Realtime exchange rates from public API
  const [realtimeRates, setRealtimeRates] = useState(null);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/GBP')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          const rates = {};
          // Convert from "1 GBP = X Foreign" to "1 Foreign = Y GBP"
          Object.entries(data.rates).forEach(([code, rate]) => {
            rates[code] = 1 / rate;
          });
          setRealtimeRates(rates);
        }
      })
      .catch(err => {
        console.warn("Failed to fetch realtime exchange rates, falling back to static rates:", err);
      });
  }, []);

  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Currency Converter helper supporting fixed reconciled vs realtime forecast
  const convertToGBP = (amount, currencyCode, isForecast = true) => {
    if (amount === undefined || amount === null || amount === '') return 0;
    const cleanCode = String(currencyCode || 'GBP').toUpperCase().trim();
    if (cleanCode === 'GBP') return Number(amount) || 0;

    if (isForecast && realtimeRates && realtimeRates[cleanCode]) {
      return (Number(amount) || 0) * realtimeRates[cleanCode];
    }
    
    // Fallback to static historical/contractual rates (e.g. for reconciled expenses)
    const rate = STATIC_FX_RATES[cleanCode] || 1.0;
    return (Number(amount) || 0) * rate;
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

  // Calculate Starting Cash in GBP
  const startingCashGBP = useMemo(() => {
    let total = 0;
    companies.forEach(c => {
      if (selectedCompanyId !== 'all' && c.id !== selectedCompanyId) return;

      (c.bankAccounts || []).forEach(acc => {
        if (selectedBankAccountId !== 'all' && acc.id !== selectedBankAccountId) return;
        total += convertToGBP(acc.balance, acc.currency, true); // Starting cash is current, use realtime
      });
    });
    return total;
  }, [companies, selectedCompanyId, selectedBankAccountId, realtimeRates]);

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
      if (p.invoiceType === 'simplicity' && p.startDate) {
        // Simplicity Friday payout date calculation
        try {
          const d = new Date(p.startDate);
          if (!isNaN(d.getTime())) {
            const day = d.getDay();
            let daysToAdd = 0;
            if (day === 1 || day === 2 || day === 3) {
              daysToAdd = 5 - day;
            } else {
              if (day === 0) {
                daysToAdd = 5;
              } else {
                daysToAdd = 5 + (7 - day);
              }
            }
            const payoutDate = new Date(d.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            const y = payoutDate.getFullYear();
            const m = String(payoutDate.getMonth() + 1).padStart(2, '0');
            const dayVal = String(payoutDate.getDate()).padStart(2, '0');
            dueDate = `${y}-${m}-${dayVal}`;
          }
        } catch (e) {}
      } else if (!dueDate && raisedDate) {
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

      const originalCurrency = getCurrencyCode(p.companyId || (companies.find(c => c.name === p.clientCompany)?.id || 'group'));
      const outstandingGBP = convertToGBP(outstanding, originalCurrency, true); // Forecast inflows use realtime

      return {
        id: p.id,
        placementId: p.placementId,
        clientCompany: p.clientCompany,
        candidateName: p.candidateName,
        dueDate: dueDate || raisedDate,
        totalInvoice: total,
        outstanding,
        outstandingGBP,
        status: finalStatus,
        companyId: p.companyId || (companies.find(c => c.name === p.clientCompany)?.id || 'group'),
        originalCurrency,
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
  }, [placements, companies, timeframe, selectedCompanyId, selectedBankAccountInfo, todayStr, realtimeRates]);

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
      const currency = c.currency || 'GBP';

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

          const totalCostGBP = convertToGBP(totalCost, currency, true); // Forecast contract uses realtime

          contractOutflows.push({
            id: `${c.id}-${calculatedDueDate}`,
            agreementName: c.name,
            vendorName,
            dueDate: calculatedDueDate,
            totalCost,
            totalCostGBP,
            frequency,
            companyId: c.companyId,
            currency,
            type: 'contract'
          });
        }
      } else {
        const totalCostGBP = convertToGBP(totalCost, currency, true);

        contractOutflows.push({
          id: c.id,
          agreementName: c.name,
          vendorName,
          dueDate: c.paymentDueDate || c.renewalDate || todayStr,
          totalCost,
          totalCostGBP,
          frequency,
          companyId: c.companyId,
          currency,
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
      const currency = s.currency || 'GBP';

      const thisMonthPayDate = `${currYear}-${pad(currMonth)}-${pad(payDay)}`;

      let nextMonth = currMonth + 1;
      let nextYear = currYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const nextMonthPayDate = `${nextYear}-${pad(nextMonth)}-${pad(payDay)}`;
      const totalCostGBP = convertToGBP(monthlyBasePay, currency, true); // Forecast payroll uses realtime

      payrollOutflows.push({
        id: `payroll-${s.id}-curr`,
        agreementName: `Payroll: ${s.fullName}`,
        vendorName: 'Staff Member',
        dueDate: thisMonthPayDate,
        totalCost: monthlyBasePay,
        totalCostGBP,
        frequency: 'monthly',
        companyId: s.companyId || 'group',
        currency,
        type: 'payroll'
      });

      payrollOutflows.push({
        id: `payroll-${s.id}-next`,
        agreementName: `Payroll: ${s.fullName}`,
        vendorName: 'Staff Member',
        dueDate: nextMonthPayDate,
        totalCost: monthlyBasePay,
        totalCostGBP,
        frequency: 'monthly',
        companyId: s.companyId || 'group',
        currency,
        type: 'payroll'
      });
    });

    const expenseOutflows = expenses.filter(exp => {
      const isFutureOrPending = !exp.isReconciled || exp.date >= todayStr;
      return isFutureOrPending;
    }).map(exp => {
      const currency = exp.currency || 'GBP';
      const isForecast = !exp.isReconciled;
      const totalCostGBP = convertToGBP(Number(exp.amount) || 0, currency, isForecast); // Reconciled uses fixed static rates, pending uses realtime

      return {
        id: `expense-${exp.id}`,
        agreementName: `Expense: ${exp.description || exp.category || 'Direct Expense'}`,
        vendorName: exp.vendor || 'Expense Ledger',
        dueDate: exp.date || todayStr,
        totalCost: Number(exp.amount) || 0,
        totalCostGBP,
        frequency: 'one-off',
        companyId: exp.bankCompanyId || exp.companyId || 'group',
        currency,
        bankAccountId: exp.bankAccountId,
        type: 'expense'
      };
    });

    // Projected Simplicity Clawback Outflows (Day 120 from candidate start date)
    const simplicityClawbacks = [];
    placements.filter(p => p.invoiceType === 'simplicity' && p.clientPaymentStatus !== 'paid' && p.status !== 'dns' && p.status !== 'rebate').forEach(p => {
      if (p.startDate) {
        try {
          const startD = new Date(p.startDate);
          const clawbackDate = new Date(startD.getTime() + 120 * 24 * 60 * 60 * 1000);
          const y = clawbackDate.getFullYear();
          const m = String(clawbackDate.getMonth() + 1).padStart(2, '0');
          const d = String(clawbackDate.getDate()).padStart(2, '0');
          const clawbackDateStr = `${y}-\n${m}-\n${d}`.replace(/\n/g, ''); // cleans newline chars
          
          if (clawbackDateStr >= todayStr) {
            const gross = Number(p.grossBillAmount) || 0;
            const vat = (p.vatAmount !== undefined && p.vatAmount !== null && p.vatAmount !== '') 
              ? (Number(p.vatAmount) || 0) 
              : (Math.round(gross * 0.20 * 100) / 100);
            const totalCost = gross + vat;
            const currency = getCurrencyCode(p.companyId || (companies.find(c => c.name === p.clientCompany)?.id || 'group'));
            const totalCostGBP = convertToGBP(totalCost, currency, true);

            simplicityClawbacks.push({
              id: `clawback-${p.id}`,
              agreementName: `Simplicity Clawback (Unpaid Client): ${p.clientCompany}`,
              vendorName: 'Simplicity Factoring',
              dueDate: clawbackDateStr,
              totalCost,
              totalCostGBP,
              frequency: 'one-off',
              companyId: p.companyId || 'group',
              currency,
              type: 'expense'
            });
          }
        } catch (e) {}
      }
    });

    return [...contractOutflows, ...payrollOutflows, ...expenseOutflows, ...simplicityClawbacks].filter(out => {
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
  }, [contracts, vendors, staff, payrollPolicies, expenses, placements, timeframe, selectedCompanyId, selectedBankAccountId, selectedBankAccountInfo, todayStr, realtimeRates]);

  // 3. Forecast summaries & currency breakdowns in GBP
  const totalInflowGBP = useMemo(() => {
    return inflows.reduce((sum, inv) => sum + inv.outstandingGBP, 0);
  }, [inflows]);

  const totalOutflowGBP = useMemo(() => {
    return outflows.reduce((sum, out) => sum + out.totalCostGBP, 0);
  }, [outflows]);

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

          {/* Metric Tiles (Normalized to GBP) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '16px' }}>
            
            {/* Live Bank Starting Cash */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏦 Live Cash in Bank
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  £{Math.round(startingCashGBP).toLocaleString()}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Total live balance in GBP
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
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--success)', fontFamily: 'monospace' }}>
                  £{Math.round(totalInflowGBP).toLocaleString()}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  💸 <strong>{inflows.length} Sales</strong> (Converted to GBP)
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
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 2px 0', color: 'var(--danger)', fontFamily: 'monospace' }}>
                  £{Math.round(totalOutflowGBP).toLocaleString()}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  💼 <strong>{outflows.length} Payments</strong> (Converted to GBP)
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
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 2px 0', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  £{Math.round(startingCashGBP + totalInflowGBP - totalOutflowGBP).toLocaleString()}
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
                🟢 Expected Sales Collections (GBP Forecast)
              </h3>
              
              <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Due Date</th>
                      <th style={{ padding: '10px 8px' }}>Client & Candidate</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount (GBP)</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflows.map(inv => {
                      const isOverdue = inv.dueDate < todayStr;
                      const origSymbol = CURRENCY_SYMBOLS[inv.originalCurrency] || inv.originalCurrency;

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
                            <div>£{inv.outstandingGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {inv.originalCurrency !== 'GBP' && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                ({origSymbol}{inv.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                              </div>
                            )}
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
                🔴 Scheduled Outflows (GBP Forecast)
              </h3>

              <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Due Date</th>
                      <th style={{ padding: '10px 8px' }}>Beneficiary & Purpose</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount (GBP)</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outflows.map(out => {
                      const isOverdue = out.dueDate < todayStr;
                      const origSymbol = CURRENCY_SYMBOLS[out.currency] || out.currency;

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
                            <div>£{out.totalCostGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {out.currency !== 'GBP' && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                ({origSymbol}{out.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                              </div>
                            )}
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
                        <td colSpan="4" style={{ textLines: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
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
