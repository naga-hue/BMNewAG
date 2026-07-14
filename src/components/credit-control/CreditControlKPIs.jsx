import React from 'react';
import { AlertTriangle, ShieldAlert, Clock, TrendingUp } from 'lucide-react';

export default function CreditControlKPIs({
  dashboardStats,
  debtorsOver60,
  collapseAnalytics,
  setCollapseAnalytics,
  expandDebtors60,
  setExpandDebtors60,
  handleOpenDetail
}) {
  return (
    <>
      {/* Sleek dashboard summary control bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '8px', 
        padding: '10px 16px',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📈 Credit Analytics</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span>Overdue: <strong style={{ color: 'var(--danger)', fontFamily: 'monospace' }}>£{dashboardStats.overdueTotal.toLocaleString()}</strong></span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Legal: <strong style={{ color: '#fca5a5', fontFamily: 'monospace' }}>£{dashboardStats.legalTotal.toLocaleString()}</strong></span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Expected (30d): <strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>£{dashboardStats.next30DaysTotal.toLocaleString()}</strong></span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>This Month: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>£{dashboardStats.thisMonthTotal.toLocaleString()}</strong></span>
          </div>
        </div>
        <button
          onClick={() => setCollapseAnalytics(!collapseAnalytics)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {collapseAnalytics ? '📊 Show Dashboard Overview' : 'Hide Dashboard Overview'}
        </button>
      </div>

      {!collapseAnalytics && (
        <>
          {/* DASHBOARD HEADERS & RISK BLOCKS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
            
            {/* KPI OVERDUE CARD */}
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '140px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔴 Cash Overdue (Outstanding)
                  </span>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 2px 0', color: 'var(--danger)', fontFamily: 'monospace' }}>
                    £{dashboardStats.overdueTotal.toLocaleString()}
                  </h2>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
                  <AlertTriangle size={20} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px', borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <div>
                  📁 <strong>Direct:</strong> £{dashboardStats.overdueDirect.toLocaleString()}
                </div>
                <div>
                  💼 <strong>Simplicity:</strong> £{dashboardStats.overdueSimplicity.toLocaleString()}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  ⚠️ <strong>Oldest Overdue Item:</strong> {dashboardStats.overdueOldestDays} Days Overdue
                </div>
              </div>
            </div>

            {/* HIGH RISK / LEGAL INVOICES CARD */}
            <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.05)', border: '1px solid rgba(127, 29, 29, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '140px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⚖️ Legal Actions Cases
                  </span>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0 0', color: '#fca5a5', fontFamily: 'monospace' }}>
                    £{dashboardStats.legalTotal.toLocaleString()}
                  </h2>
                </div>
                <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', color: '#ef4444', padding: '8px', borderRadius: '8px' }}>
                  <ShieldAlert size={20} />
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, fontSize: '10px', color: 'var(--text-secondary)' }}>
                {dashboardStats.legalList.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed rgba(127, 29, 29, 0.1)' }}>
                    <span>{inv.clientCompany} ({inv.invoiceNumber || 'No Inv'})</span>
                    <span style={{ fontWeight: 'bold', color: '#ef4444' }}>£{inv.balanceOutstanding.toLocaleString()}</span>
                  </div>
                ))}
                {dashboardStats.legalList.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>No active legal cases.</span>
                )}
              </div>
            </div>

            {/* CASH FORECAST METRIC TILES */}
            <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected (Next 7 Days)</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>£{dashboardStats.next7DaysTotal.toLocaleString()}</div>
                </div>
                <div style={{ color: 'var(--primary)' }}><Clock size={16} /></div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected (Next 30 Days)</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>£{dashboardStats.next30DaysTotal.toLocaleString()}</div>
                </div>
                <div style={{ color: 'var(--accent)' }}><TrendingUp size={16} /></div>
              </div>
            </div>

          </div>

          {/* MONTH FORECAST BREAKDOWNS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expected This Month</div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0', fontFamily: 'monospace', color: 'var(--accent)' }}>£{dashboardStats.thisMonthTotal.toLocaleString()}</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Direct: £{dashboardStats.thisMonthDirect.toLocaleString()} | Simplicity: £{dashboardStats.thisMonthSimplicity.toLocaleString()}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                📬 <strong>{dashboardStats.thisMonthList.length} Invoices</strong> due
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expected Next Month</div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0', fontFamily: 'monospace' }}>£{dashboardStats.nextMonthTotal.toLocaleString()}</h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Direct: £{dashboardStats.nextMonthDirect.toLocaleString()} | Simplicity: £{dashboardStats.nextMonthSimplicity.toLocaleString()}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                📬 <strong>{dashboardStats.nextMonthList.length} Invoices</strong> due
              </div>
            </div>
          </div>
        </>
      )}

      {/* DISPUTED INVOICES BANNER PANEL */}
      {dashboardStats.disputedList.length > 0 && (
        <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f97316' }}>
            <AlertTriangle size={18} />
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>⚠️ Client Disputed Billing Cases (Outstanding: £{dashboardStats.disputedTotal.toLocaleString()})</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {dashboardStats.disputedList.map(inv => (
              <div key={inv.id} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '11.5px', cursor: 'pointer' }} onClick={() => handleOpenDetail(inv)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                  <span>{inv.clientCompany}</span>
                  <span style={{ color: '#f97316' }}>£{inv.balanceOutstanding.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text-secondary)' }}>
                  <div>👨‍💼 <strong>Candidate:</strong> {inv.candidateName}</div>
                  <div>🚨 <strong>Dispute Reason:</strong> <span style={{ color: 'var(--text-primary)' }}>{inv.disputeReason || 'Unresolved dispute'}</span></div>
                  <div>📅 <strong>Dispute Raised:</strong> {inv.disputeDate || 'N/A'} | 🧑‍💼 <strong>Owner:</strong> {inv.disputeOwner || 'HR'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEBTORS OVER 60 DAYS BANNER PANEL */}
      {debtorsOver60.length > 0 && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '16px 20px', marginTop: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
              <AlertTriangle size={18} />
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>
                ⚠️ Ageing Debtors Over 60 Days (Total Outstanding: £{debtorsOver60.reduce((sum, inv) => sum + inv.balanceOutstanding, 0).toLocaleString()})
              </h4>
            </div>
            <button
              onClick={() => setExpandDebtors60(!expandDebtors60)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {expandDebtors60 ? 'Collapse Details' : 'Expand Details'}
            </button>
          </div>

          {expandDebtors60 && (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Client Company</th>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Candidate</th>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Invoice No</th>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Due Date</th>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Outstanding</th>
                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorsOver60.map(inv => (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                      onClick={() => handleOpenDetail(inv)}
                    >
                      <td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>{inv.clientCompany}</td>
                      <td style={{ padding: '8px' }}>{inv.candidateName}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{inv.invoiceNumber || 'N/A'}</td>
                      <td style={{ padding: '8px', color: 'var(--danger)' }}>{inv.invoiceDueDate}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--danger)' }}>£{inv.balanceOutstanding.toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          backgroundColor: inv.clientPaymentStatus === 'legal' ? 'rgba(127,29,29,0.2)' : 'rgba(239,68,68,0.1)',
                          color: inv.clientPaymentStatus === 'legal' ? '#fca5a5' : '#ef4444',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          {inv.clientPaymentStatus.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
