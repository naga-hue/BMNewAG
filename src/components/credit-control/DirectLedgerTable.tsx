import React from 'react';
import { FileDown } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { PAYMENT_STATUSES, getCurrencySymbol } from './shared';

interface Column {
  id: string;
  label: string;
}

interface DirectLedgerTableProps {
  partitionedInvoices: {
    disputedLegal: any[];
    liveOutstanding: any[];
    closed: any[];
  };
  activeColumns: Column[];
  selectedInvoiceIds: Set<string>;
  handleToggleSelectAll: (list: any[]) => void;
  handleToggleSelectRow: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  handleOpenDetail: (invoice: any) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: string) => void;
  renderSortIndicator: (field: string) => React.ReactNode;
  todayStr: string;
  onShowToast: (msg: string, type?: string) => void;
}

export default function DirectLedgerTable({
  partitionedInvoices,
  activeColumns,
  selectedInvoiceIds,
  handleToggleSelectAll,
  handleToggleSelectRow,
  handleOpenDetail,
  sortBy,
  sortOrder,
  handleSort,
  renderSortIndicator,
  todayStr,
  onShowToast
}: DirectLedgerTableProps) {
  const placements = useBoundStore(state => state.placements);
  const companies = useBoundStore(state => state.companies);
  const updatePlacement = useBoundStore(state => state.updatePlacement);

  const handleTogglePlacementField = async (placementId: string, fieldName: string, currentValue: boolean) => {
    const originalPlacement = placements.find(p => p.id === placementId);
    if (!originalPlacement) return;

    const updatedPlacement = {
      ...originalPlacement,
      [fieldName]: !currentValue
    };

    try {
      await updatePlacement(updatedPlacement);
      onShowToast(`Updated ${fieldName}`, "success");
    } catch (e: any) {
      onShowToast(`Failed to update ${fieldName}: ${e.message}`, "warning");
    }
  };

  const renderTableHeaderCell = (col: Column) => {
    const isSortable = ['placementId', 'clientCompany', 'internalCompany', 'candidateName', 'recruiter', 'dueDate', 'amount', 'status', 'outstanding', 'startDate', 'scoredDate', 'invoiceNumber', 'invoiceRaisedDate', 'paymentTermsDays'].includes(col.id);
    const sortFieldMap: Record<string, string> = {
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

  const renderTableBodyCell = (inv: any, col: Column) => {
    const symbol = getCurrencySymbol(inv, companies);
    const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
    const isMonetary = ['netTotal', 'factoredGross', 'vat', 'totalInclVat', 'amount', 'outstanding'].includes(col.id);

    let cellContent: React.ReactNode = null;
    
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
                  } catch (err: any) {
                    onShowToast(`Failed to update Client Number: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e: any) => {
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
                  } catch (err: any) {
                    onShowToast(`Failed to update Credit Limit: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e: any) => {
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
                  } catch (err: any) {
                    onShowToast(`Failed to update Invoice Number: ${err.message}`, "warning");
                  }
                }
              }
            }}
            onKeyDown={(e: any) => {
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
                      } catch (err: any) {
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

  const renderDirectTable = (title: string, list: any[], headerBg: string, titleColor: string, statusInfo: string) => {
    return (
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
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
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{statusInfo}</span>
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
                  <tr key={inv.id} onClick={() => handleOpenDetail(inv)} style={{ cursor: 'pointer' }} className="table-row-hover">
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', width: '40px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <span style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: '14px', userSelect: 'none' }} title="Drag handle">⠿</span>
                        <input 
                          type="checkbox" 
                          checked={selectedInvoiceIds.has(inv.id)}
                          onChange={(e: any) => handleToggleSelectRow(inv.id, e)}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                      </div>
                    </td>
                    {activeColumns.map(col => renderTableBodyCell(inv, col))}
                  </tr>
                );
              })}
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
      {/* 1. DISPUTED & LEGAL DIRECT INVOICES */}
      {renderDirectTable(
        "⚠️ Disputed & Legal Proceedings Invoices",
        partitionedInvoices.disputedLegal,
        "rgba(239, 68, 68, 0.04)",
        "var(--danger)",
        "Action Required"
      )}

      {/* 2. LIVE OUTSTANDING DIRECT INVOICES */}
      {renderDirectTable(
        "⏳ Live Outstanding & Overdue Invoices",
        partitionedInvoices.liveOutstanding,
        "rgba(99, 102, 241, 0.04)",
        "var(--primary)",
        "Active Ledger"
      )}

      {/* 3. CLOSED DIRECT INVOICES */}
      {renderDirectTable(
        "✅ Closed & Historical Settled Invoices",
        partitionedInvoices.closed,
        "rgba(16, 185, 129, 0.04)",
        "var(--success)",
        "Archived / Paid"
      )}
    </div>
  );
}
