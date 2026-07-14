import React from 'react';
import { FileDown, AlertTriangle } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { PAYMENT_STATUSES, getCurrencySymbol } from './shared';

export default function SimplicityLedgerTable({
  list,
  activeColumns,
  selectedInvoiceIds,
  handleToggleSelectAll,
  handleToggleSelectRow,
  handleOpenDetail,
  handleMoveInvoiceToWeek,
  upcomingFridays,
  simplicityPriorWeeks,
  simplicityActiveWeeks,
  simplicityPaid,
  simplicityLegal,
  simplicityOverdue,
  sortBy,
  sortOrder,
  handleSort,
  renderSortIndicator,
  todayStr,
  onShowToast
}) {
  const placements = useBoundStore(state => state.placements);
  const companies = useBoundStore(state => state.companies);
  const updatePlacement = useBoundStore(state => state.updatePlacement);

  const handleTogglePlacementField = async (placementId, fieldName, currentValue) => {
    const originalPlacement = placements.find(p => p.id === placementId);
    if (!originalPlacement) return;

    const updatedPlacement = {
      ...originalPlacement,
      [fieldName]: !currentValue
    };

    try {
      await updatePlacement(updatedPlacement);
      onShowToast(`Updated ${fieldName}`, "success");
    } catch (e) {
      onShowToast(`Failed to update ${fieldName}: ${e.message}`, "warning");
    }
  };

  const renderTableHeaderCell = (col) => {
    const isSortable = ['placementId', 'clientCompany', 'internalCompany', 'candidateName', 'recruiter', 'dueDate', 'amount', 'status', 'outstanding', 'startDate', 'scoredDate', 'invoiceNumber', 'invoiceRaisedDate', 'paymentTermsDays'].includes(col.id);
    const sortFieldMap = {
      clientCompany: 'client',
      recruiter: 'recruiter',
      amount: 'amount',
      outstanding: 'outstanding'
    };
    const sortField = sortFieldMap[col.id] || col.id;
    const isMonetary = ['netTotal', 'factoredGross', 'vat', 'totalInclVat', 'amount', 'outstanding'].includes(col.id);

    return (
      <th 
        key={col.id}
        style={{ 
          border: '1px solid var(--border-color)', 
          padding: '8px 10px', 
          backgroundColor: 'var(--bg-secondary)', 
          color: 'var(--text-primary)', 
          fontWeight: 700, 
          fontSize: '11px', 
          textTransform: 'uppercase', 
          textAlign: isMonetary ? 'right' : 'left', 
          whiteSpace: 'nowrap',
          cursor: isSortable ? 'pointer' : 'default',
          userSelect: 'none'
        }}
        onClick={isSortable ? () => handleSort(sortField) : undefined}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {col.label} {isSortable && renderSortIndicator(sortField)}
        </div>
      </th>
    );
  };

  const renderTableBodyCell = (inv, col) => {
    const symbol = getCurrencySymbol(inv, companies);
    const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
    const isMonetary = ['netTotal', 'factoredGross', 'vat', 'totalInclVat', 'amount', 'outstanding'].includes(col.id);

    let cellContent = null;
    
    switch (col.id) {
      case 'simplicityClientNo':
        cellContent = (
          <input
            type="text"
            defaultValue={inv.simplicityClientNo || ''}
            placeholder="Client No"
            onBlur={async (e) => {
              const val = e.target.value;
              if (val !== inv.simplicityClientNo) {
                const original = placements.find(p => p.id === inv.id);
                if (original) {
                  try {
                    await updatePlacement({ ...original, simplicityClientNo: val });
                    onShowToast(`Updated Client Number to ${val}`, "success");
                  } catch (err) {
                    onShowToast(`Failed to update Client Number: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          />
        );
        break;
      case 'simplicityCreditLimit':
        cellContent = (
          <input
            type="text"
            defaultValue={inv.simplicityCreditLimit || ''}
            placeholder="Limit"
            onBlur={async (e) => {
              const val = e.target.value;
              if (val !== inv.simplicityCreditLimit) {
                const original = placements.find(p => p.id === inv.id);
                if (original) {
                  try {
                    await updatePlacement({ ...original, simplicityCreditLimit: val });
                    onShowToast(`Updated Credit Limit to ${val}`, "success");
                  } catch (err) {
                    onShowToast(`Failed to update Credit Limit: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          />
        );
        break;
      case 'ems':
        cellContent = (
          <input 
            type="checkbox"
            checked={!!inv.ems}
            onChange={() => handleTogglePlacementField(inv.id, 'ems', !!inv.ems)}
            onClick={(e) => e.stopPropagation()}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
        );
        break;
      case 'noaRequired':
        cellContent = (
          <input 
            type="checkbox"
            checked={!!inv.noaRequired}
            onChange={() => handleTogglePlacementField(inv.id, 'noaRequired', !!inv.noaRequired)}
            onClick={(e) => e.stopPropagation()}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
        );
        break;
      case 'consultantInvoiceReceived':
        cellContent = (
          <input 
            type="checkbox"
            checked={!!inv.consultantInvoiceReceived}
            onChange={() => handleTogglePlacementField(inv.id, 'consultantInvoiceReceived', !!inv.consultantInvoiceReceived)}
            onClick={(e) => e.stopPropagation()}
            style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
          />
        );
        break;
      case 'payoutDate':
        cellContent = inv.overridePayoutDate || inv.simplicityPayoutDate || '—';
        break;
      case 'placementId':
        cellContent = inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id);
        break;
      case 'internalCompany':
        const matchedCo = companies.find(c => c.id === inv.companyId);
        cellContent = matchedCo ? matchedCo.name : '—';
        break;
      case 'startDate':
        cellContent = inv.startDate || '—';
        break;
      case 'scoredDate':
        cellContent = inv.scoredDate || '—';
        break;
      case 'invoiceNumber':
        cellContent = (
          <input
            type="text"
            defaultValue={inv.invoiceNumber || ''}
            placeholder="Inv#"
            onBlur={async (e) => {
              const val = e.target.value;
              if (val !== inv.invoiceNumber) {
                const original = placements.find(p => p.id === inv.id);
                if (original) {
                  try {
                    await updatePlacement({ ...original, invoiceNumber: val });
                    onShowToast(`Updated Invoice Number to ${val}`, "success");
                  } catch (err) {
                    onShowToast(`Failed to update Invoice Number: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          />
        );
        break;
      case 'invoiceRaisedDate':
        cellContent = inv.invoiceRaisedDate || '—';
        break;
      case 'paymentTermsDays':
        cellContent = inv.paymentTermsDays ? `${inv.paymentTermsDays} Days` : '—';
        break;
      case 'clientCompany':
        cellContent = (
          <div>
            <strong>{inv.clientCompany}</strong>
            {inv.invoiceType === 'simplicity' && (
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: 1.2 }}>
                <span>Client No: <strong style={{ color: 'var(--text-secondary)' }}>{inv.simplicityClientNo || '—'}</strong></span>
                <span>Limit: <strong style={{ color: 'var(--primary)' }}>{inv.simplicityCreditLimit || '—'}</strong></span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                  {inv.noaRequired && <span style={{ color: '#38bdf8', fontSize: '8px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.08)', padding: '1px 3px', borderRadius: '2px' }}>NOA</span>}
                  {inv.consultantInvoiceReceived && <span style={{ color: 'var(--success)', fontSize: '8px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '1px 3px', borderRadius: '2px' }}>Consultant Inv</span>}
                </div>
              </div>
            )}
          </div>
        );
        break;
      case 'candidateName':
        cellContent = inv.candidateName;
        break;
      case 'recruiter':
        cellContent = <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.recruiterNames}</span>;
        break;
      case 'dueDate':
        cellContent = (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{inv.invoiceDueDate}</span>
            {inv.paymentStatus === 'overdue' && <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>({inv.overdueDays}d overdue)</span>}
          </div>
        );
        break;
      case 'riskTimeline':
        cellContent = inv.balanceOutstanding > 0 ? (() => {
          const days = inv.daysSinceStart;
          if (days >= 120) {
            return <span style={{ color: 'var(--danger)', fontSize: '10.5px', fontWeight: 'bold' }}>🟥 Recourse (D{days})</span>;
          } else if (days >= 90) {
            return <span style={{ color: 'var(--warning)', fontSize: '10.5px', fontWeight: 'bold' }}>🟧 Credit Loss (D{days})</span>;
          } else if (days >= 31) {
            return <span style={{ color: '#38bdf8', fontSize: '10.5px', fontWeight: '600' }}>🟨 Follow-up (D{days})</span>;
          } else {
            return <span style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>Grace (D{days})</span>;
          }
        })() : (
          <span style={{ color: 'var(--success)', fontSize: '10.5px' }}>Paid / Settled</span>
        );
        break;
      case 'netTotal':
        cellContent = symbol + (Number(inv.grossBillAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'factoredGross':
        cellContent = symbol + ((Number(inv.grossBillAmount) || 0) * 0.9704).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'vat':
        cellContent = symbol + ((Number(inv.grossBillAmount) || 0) * 0.9704 * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'totalInclVat':
        cellContent = symbol + ((Number(inv.grossBillAmount) || 0) * 0.9704 * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'amount':
        cellContent = symbol + (inv.totalInvoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'status':
        cellContent = (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ backgroundColor: `${statusObj.color}15`, color: statusObj.color, border: `1px solid ${statusObj.color}30`, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              {statusObj.label}
            </span>
            {inv.paymentStatus !== 'paid' && (
              <button
                title="Mark as Paid"
                onClick={async () => {
                  if (window.confirm(`Mark placement for ${inv.candidateName} as Paid?`)) {
                    const original = placements.find(p => p.id === inv.id);
                    if (original) {
                      try {
                        await updatePlacement({ 
                          ...original, 
                          paymentStatus: 'paid', 
                          clientPaymentStatus: 'paid',
                          paymentReceivedDate: todayStr,
                          amountPaid: inv.totalInvoiceAmount
                        });
                        onShowToast(`Marked ${inv.candidateName} as Paid`, "success");
                      } catch (err) {
                        onShowToast(`Failed: ${err.message}`, "warning");
                      }
                    }
                  }
                }}
                style={{
                  background: 'var(--success)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ✓
              </button>
            )}
          </div>
        );
        break;
      case 'outstanding':
        cellContent = symbol + (inv.balanceOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        break;
      case 'doc':
        cellContent = inv.invoiceFileUrl ? (
          <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}>
            <FileDown size={12} />
          </a>
        ) : '-';
        break;
      default:
        cellContent = null;
    }

    return (
      <td 
        key={col.id}
        style={{ 
          border: '1px solid var(--border-color)', 
          padding: '6px 10px', 
          fontSize: '12px',
          color: 'var(--text-primary)',
          textAlign: isMonetary ? 'right' : 'left',
          fontFamily: isMonetary || col.id === 'placementId' || col.id === 'dueDate' ? 'monospace' : 'inherit'
        }}
      >
        {cellContent}
      </td>
    );
  };

  const renderSimplicityTable = (title, list, headerBg, titleColor, statusInfo, isWeekGroup = false, weekDateStr = '') => {
    const netSum = list.reduce((sum, inv) => sum + (Number(inv.grossBillAmount) || 0), 0);
    const factoredSum = list.reduce((sum, inv) => sum + ((Number(inv.grossBillAmount) || 0) * 0.9704), 0);
    const vatSum = factoredSum * 0.20;
    const totalSum = factoredSum * 1.20;

    return (
      <div 
        style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}
        onDragOver={isWeekGroup ? (e) => e.preventDefault() : undefined}
        onDrop={isWeekGroup ? (e) => {
          const invoiceId = e.dataTransfer.getData("text/plain");
          handleMoveInvoiceToWeek(invoiceId, weekDateStr);
        } : undefined}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '10px 14px', 
          backgroundColor: headerBg, 
          borderBottom: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, color: titleColor, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title} ({list.length} Records)
          </h3>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{statusInfo}</span>
        </div>
        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', width: '40px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)' }}>
                  <input 
                    type="checkbox" 
                    checked={list.length > 0 && list.every(inv => selectedInvoiceIds.has(inv.id))}
                    onChange={() => handleToggleSelectAll(list)}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </th>
                {activeColumns.map(col => renderTableHeaderCell(col))}
              </tr>
            </thead>
            <tbody>
              {list.map(inv => {
                return (
                  <tr 
                    key={inv.id} 
                    onClick={() => handleOpenDetail(inv)} 
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", inv.id);
                    }}
                    style={{ cursor: 'grab' }} 
                    className="table-row-hover"
                  >
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', width: '40px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedInvoiceIds.has(inv.id)}
                        onChange={(e) => handleToggleSelectRow(inv.id, e)}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                    </td>
                    {activeColumns.map(col => renderTableBodyCell(inv, col))}
                  </tr>
                );
              })}
              {/* Weekly Aggregated Sum Row */}
              {list.length > 0 && (
                <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                  <td style={{ border: '1px solid var(--border-color)' }} />
                  {activeColumns.map((col, idx) => {
                    const isMonetary = ['netTotal', 'factoredGross', 'vat', 'totalInclVat', 'outstanding'].includes(col.id);
                    let sumVal = null;
                    if (col.id === 'netTotal') sumVal = netSum;
                    else if (col.id === 'factoredGross') sumVal = factoredSum;
                    else if (col.id === 'vat') sumVal = vatSum;
                    else if (col.id === 'totalInclVat') sumVal = totalSum;
                    else if (col.id === 'outstanding') sumVal = list.reduce((sum, inv) => sum + (Number(inv.balanceOutstanding) || 0), 0);

                    return (
                      <td 
                        key={col.id} 
                        style={{ 
                          border: '1px solid var(--border-color)', 
                          padding: '6px 10px', 
                          fontSize: '11px',
                          textAlign: isMonetary ? 'right' : 'left',
                          fontFamily: isMonetary ? 'monospace' : 'inherit',
                          color: col.id === 'factoredGross' ? 'var(--success)' : (col.id === 'totalInclVat' ? 'var(--primary)' : 'inherit')
                        }}
                      >
                        {idx === 0 ? "📊 TOTALS: " : ""}
                        {sumVal !== null ? "£" + sumVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      </td>
                    );
                  })}
                </tr>
              )}
              {list.length === 0 && (
                <tr>
                  <td colSpan={activeColumns.length + 1} style={{ border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No matching invoice records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Simplicity Upcoming Friday Drop Zones */}
      <div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
          📬 Reschedule Expected Payout Week (Drag Invoice Row & Drop Here):
        </span>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
          {upcomingFridays.map(fri => (
            <div 
              key={fri}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const invoiceId = e.dataTransfer.getData("text/plain");
                handleMoveInvoiceToWeek(invoiceId, fri);
              }}
              style={{ 
                flex: '0 0 130px', 
                padding: '8px 10px', 
                backgroundColor: 'rgba(99, 102, 241, 0.03)', 
                border: '1px dashed var(--primary)', 
                borderRadius: '6px', 
                fontSize: '11px',
                textAlign: 'center',
                cursor: 'default',
                color: 'var(--primary)',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onDragEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.03)';
              }}
            >
              📅 Drop to {fri}
            </div>
          ))}
        </div>
      </div>

      {/* 1. LEGAL / DISPUTED SIMPLICITY RECORDS */}
      {simplicityLegal.length > 0 && renderSimplicityTable(
        "⚠️ Disputed & Legal Simplicity Invoices",
        simplicityLegal,
        "rgba(239, 68, 68, 0.04)",
        "var(--danger)",
        "Action Required"
      )}

      {/* 2. OVERDUE SIMPLICITY RECORDS */}
      {simplicityOverdue.length > 0 && renderSimplicityTable(
        "⏳ Overdue Simplicity Invoices",
        simplicityOverdue,
        "rgba(245, 158, 11, 0.04)",
        "var(--warning)",
        "Chaser Pipeline"
      )}

      {/* 3. ACTIVE SIMPLICITY RECORDS GROUPED BY WEEK */}
      <div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '12px', letterSpacing: '0.5px' }}>
          {/* 2b. PRIOR PERIOD SIMPLICITY RECORDS */}
          {simplicityPriorWeeks.length > 0 && renderSimplicityTable(
            "⏳ Outstanding Simplicity Invoices (Prior Periods)",
            simplicityPriorWeeks,
            "rgba(156, 163, 175, 0.04)",
            "var(--text-secondary)",
            "Prior Period Placements"
          )}
          <div style={{ height: '12px' }}></div>
          📅 Active Weekly Pipeline:
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {simplicityActiveWeeks.map(week => {
            return renderSimplicityTable(
              `📅 Week Ending Friday: ${week.weekDate} (${week.invoices.length} Starters)`,
              week.invoices,
              "rgba(99, 102, 241, 0.04)",
              "var(--primary)",
              "Drag invoice here to reschedule",
              true,
              week.weekDate
            );
          })}
        </div>
      </div>

      {/* 4. PAID / HISTORICAL SETTLED SIMPLICITY RECORDS */}
      {simplicityPaid.length > 0 && renderSimplicityTable(
        "✅ Settled & Paid Simplicity Invoices",
        simplicityPaid,
        "rgba(16, 185, 129, 0.04)",
        "var(--success)",
        "Archived Records"
      )}

      {/* fallback empty state */}
      {simplicityLegal.length === 0 && simplicityOverdue.length === 0 && simplicityActiveWeeks.length === 0 && simplicityPaid.length === 0 && (
        <div style={{ padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No simplicity invoice records found matching the active search or filters.
        </div>
      )}
    </div>
  );
}
