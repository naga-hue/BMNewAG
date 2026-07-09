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
  AlertTriangle 
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
  staff = []
}) {
  const [timeframe, setTimeframe] = useState('30'); // 7, 30, 90, overdue, all
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');

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
      // Must be outstanding
      if (inv.outstanding <= 0 || ['paid', 'written-off', 'dns-rebate'].includes(inv.status)) return false;
      
      // Filter by company
      if (selectedCompanyId !== 'all' && inv.companyId !== selectedCompanyId) return false;
      
      // Filter by timeframe
      return isWithinTimeframe(inv.dueDate);
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [placements, companies, timeframe, selectedCompanyId, todayStr]);

  // 2. Outflows: Contract Payments
  const outflows = useMemo(() => {
    return contracts.map(c => {
      const uCost = Number(c.unitCost) || 0;
      const qty = Number(c.quantityPurchased) || 0;
      const vatRate = Number(c.taxRate || 0);
      const subtotal = uCost * qty;
      const totalCost = subtotal * (1 + vatRate / 100);

      const vendor = vendors.find(v => v.id === c.vendorId);
      const vendorName = vendor ? vendor.name : 'Vendor';

      return {
        id: c.id,
        agreementName: c.name,
        vendorName,
        dueDate: c.paymentDueDate || c.renewalDate || todayStr,
        totalCost,
        frequency: c.costInterval || 'monthly',
        companyId: c.companyId,
        currency: c.currency || 'GBP'
      };
    }).filter(out => {
      // Must have a future/overdue payment due date
      if (!out.dueDate) return false;

      // Filter by company
      if (selectedCompanyId !== 'all' && out.companyId !== selectedCompanyId) return false;

      // Filter by timeframe
      return isWithinTimeframe(out.dueDate);
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [contracts, vendors, timeframe, selectedCompanyId, todayStr]);

  // 3. Summaries & Currency breakdowns
  const cashflowSummary = useMemo(() => {
    const inflowTotals = {};
    const outflowTotals = {};
    const netTotals = {};

    inflows.forEach(inv => {
      const curr = getCurrencyCode(inv.companyId);
      inflowTotals[curr] = (inflowTotals[curr] || 0) + inv.outstanding;
      netTotals[curr] = (netTotals[curr] || 0) + inv.outstanding;
    });

    outflows.forEach(out => {
      const curr = out.currency;
      outflowTotals[curr] = (outflowTotals[curr] || 0) + out.totalCost;
      netTotals[curr] = (netTotals[curr] || 0) - out.totalCost;
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
      netText: formatBreakdown(netTotals)
    };
  }, [inflows, outflows, companies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* -------------------------------------------------------------
          FILTER CONTROLS
          ------------------------------------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>Forecast Projections Filter</h3>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            className="select-filter"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ padding: '8px 12px', minWidth: '160px' }}
          >
            <option value="7">Next 7 Days</option>
            <option value="30">Next 30 Days</option>
            <option value="90">Next 90 Days</option>
            <option value="overdue">Overdue Items Only</option>
            <option value="all">All Upcoming / Projected</option>
          </select>

          <select
            className="select-filter"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            style={{ padding: '8px 12px', minWidth: '200px' }}
          >
            <option value="all">All Group Entities</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>
            ))}
          </select>
        </div>
      </div>

      {/* -------------------------------------------------------------
          KPI METRICS TILES
          ------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '20px' }}>
        
        {/* Total Projected Inflows */}
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📈 Projected Inflows (Collections)
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--success)', fontFamily: 'monospace' }}>
              {cashflowSummary.inflowText}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              💸 <strong>{cashflowSummary.inflowCount} Sales</strong> expected
            </span>
          </div>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '10px', borderRadius: '10px' }}>
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Total Projected Outflows */}
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📉 Projected Outflows (Expenses)
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--danger)', fontFamily: 'monospace' }}>
              {cashflowSummary.outflowText}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              💼 <strong>{cashflowSummary.outflowCount} Vendor contracts</strong> due
            </span>
          </div>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '10px', borderRadius: '10px' }}>
            <ArrowDownRight size={22} />
          </div>
        </div>

        {/* Net Projected Cashflow */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚖️ Net Forecast Cash Position
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '6px 0 2px 0', fontFamily: 'monospace', color: '#fff' }}>
              {cashflowSummary.netText}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Projected balance in chosen timeframe
            </span>
          </div>
          <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '10px', borderRadius: '10px' }}>
            <Calendar size={22} />
          </div>
        </div>

      </div>

      {/* -------------------------------------------------------------
          DOUBLE LEDGER GRID VIEW
          ------------------------------------------------------------- */}
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
                          <span style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : '#fff' }}>
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
            🔴 Scheduled Vendor Payments (Cash Outflows)
          </h3>

          <div className="table-container" style={{ margin: 0, overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Due Date</th>
                  <th style={{ padding: '10px 8px' }}>Vendor & Agreement</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount Due</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Freq.</th>
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
                          <span style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : '#fff' }}>
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
                          backgroundColor: 'rgba(217, 119, 6, 0.1)', 
                          color: '#d97706', 
                          padding: '3px 6px', 
                          borderRadius: '8px', 
                          fontSize: '10px',
                          fontWeight: 600
                        }}>
                          {FREQUENCY_LABELS[out.frequency] || out.frequency}
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

    </div>
  );
}
