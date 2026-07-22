import React, { useState, useMemo } from 'react';
import { Company, Staff, Expense, Vendor } from '../../types';
import { symbolMap } from './shared';

interface ReconcileCellModalProps {
  reconcilingCell: { contract: any; monthKey: string; projectedAmount: number } | null;
  onClose: () => void;
  vendors: Vendor[];
  expenses: Expense[];
  onSaveExpense: (expense: any) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  forecastCurrency?: string;
}

export default function ReconcileCellModal({
  reconcilingCell,
  onClose,
  vendors,
  expenses,
  onSaveExpense,
  onShowToast,
  forecastCurrency = 'GBP'
}: ReconcileCellModalProps) {
  const [selectedExpenseId, setSelectedExpenseId] = useState('');

  const contract = reconcilingCell?.contract;
  const monthKey = reconcilingCell?.monthKey || '';
  const projectedAmount = reconcilingCell?.projectedAmount || 0;
  const vendor = contract ? vendors.find(v => v.id === contract.vendorId) : null;
  const vendorName = vendor ? vendor.name : 'Unknown Vendor';

  // Find currently linked expenses
  const currentLinkedExps = useMemo(() => {
    if (!contract || !monthKey) return [];
    const cellId = `${contract.id}_${monthKey}`;
    return (expenses || []).filter(e => 
      e.linkedVendorCellId && 
      e.linkedVendorCellId.split(',').map(s => s.trim()).includes(cellId)
    );
  }, [expenses, contract?.id, monthKey]);

  // Candidate filter: same month, and not linked to payroll/other cells (unless it's not yet linked to this cell)
  const candidates = useMemo(() => {
    if (!contract || !monthKey) return [];
    const cellId = `${contract.id}_${monthKey}`;
    const list = (expenses || []).filter(e => {
      if (e.status === 'dns' || e.status === 'cancelled') return false;
      if (!e.date || !e.date.startsWith(monthKey)) return false;
      if (e.linkedPayrollCellId) return false;
      
      const parts = e.linkedVendorCellId ? e.linkedVendorCellId.split(',').map(s => s.trim()) : [];
      return !parts.includes(cellId);
    });

    // Sort candidates: matches vendor name substring first
    const term = vendorName.toLowerCase();
    return [...list].sort((a, b) => {
      const aMatch = a.payee?.toLowerCase().includes(term) || term.includes(a.payee?.toLowerCase() || '');
      const bMatch = b.payee?.toLowerCase().includes(term) || term.includes(b.payee?.toLowerCase() || '');
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [expenses, monthKey, contract?.id, vendorName]);

  if (!reconcilingCell) return null;

  const handleSaveLink = async () => {
    if (!selectedExpenseId) {
      onShowToast('Please select a payment transaction to link.', 'error');
      return;
    }
    const chosenExp = expenses.find(e => e.id === selectedExpenseId);
    if (!chosenExp) return;

    const cellId = `${contract.id}_${monthKey}`;
    let newLinkStr = cellId;
    if (chosenExp.linkedVendorCellId) {
      const parts = chosenExp.linkedVendorCellId.split(',').map(s => s.trim());
      if (!parts.includes(cellId)) {
        parts.push(cellId);
      }
      newLinkStr = parts.join(',');
    }

    // Save linkage
    const updatedExp = {
      ...chosenExp,
      linkedVendorCellId: newLinkStr,
      recipientType: 'vendor',
      recipientId: contract.vendorId
    };
    
    try {
      await onSaveExpense(updatedExp);
      onShowToast(`Linked payment successfully!`, 'success');
      setSelectedExpenseId('');
    } catch (err: any) {
      onShowToast(`Failed to link payment: ${err.message}`, 'warning');
    }
  };

  const handleUnlinkExpense = async (expToUnlink: any) => {
    const cellId = `${contract.id}_${monthKey}`;
    let newLinkStr = '';
    if (expToUnlink.linkedVendorCellId) {
      const parts = expToUnlink.linkedVendorCellId.split(',').map(s => s.trim()).filter(p => p !== cellId);
      newLinkStr = parts.join(',');
    }

    const updatedExp = {
      ...expToUnlink,
      linkedVendorCellId: newLinkStr
    };

    try {
      await onSaveExpense(updatedExp);
      onShowToast(`Unlinked payment successfully!`, 'success');
      if (selectedExpenseId === expToUnlink.id) {
        setSelectedExpenseId('');
      }
    } catch (err: any) {
      onShowToast(`Failed to unlink payment: ${err.message}`, 'warning');
    }
  };

  const displayMonth = new Date(monthKey + '-02').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const term = vendorName.toLowerCase();
  const totalLinkedAmount = currentLinkedExps.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="form-wizard-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '8px', borderRadius: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800 }}>🔗</span>
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Reconcile Vendor Payments
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Link contract matrix cell to bank/ledger expense</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>
            ✕
          </button>
        </div>

        <div className="wizard-body" style={{ padding: '16px', overflowY: 'auto' }}>
          {/* Metadata summary */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contract:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contract.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Vendor Partner:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vendorName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Target Month:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayMonth}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Projected Budget:</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                {symbolMap[forecastCurrency] || '£'}{Math.round(projectedAmount).toLocaleString()}
              </span>
            </div>
            {currentLinkedExps.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Total Reconciled:</span>
                <span style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
                  £{totalLinkedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* List of currently linked expenses */}
          {currentLinkedExps.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                ✅ Reconciled & Paid Payments:
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentLinkedExps.map(exp => (
                  <div key={exp.id} style={{ padding: '10px 12px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.payee}</div>
                      <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>Date: {exp.date}</span>
                        {exp.linkedVendorCellId && exp.linkedVendorCellId.includes(',') && (
                          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>(Linked to multiple cells)</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 700, fontFamily: 'monospace', fontSize: '11px' }}>
                        £{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => handleUnlinkExpense(exp)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                        title="Unlink this payment transaction"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link new payment transaction section */}
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
              Link a payment transaction:
            </h3>
            {candidates.length === 0 ? (
              <div style={{ padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                No other matching unlinked bank statement payments found for {displayMonth}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <select
                    className="select-filter"
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="">-- Choose Transaction --</option>
                    {candidates.map(e => {
                      const isNameMatch = e.payee?.toLowerCase().includes(term) || term.includes(e.payee?.toLowerCase() || '');
                      const isAlreadyLinked = e.linkedVendorCellId && e.linkedVendorCellId.length > 0;
                      return (
                        <option key={e.id} value={e.id}>
                          {isNameMatch ? '⭐ ' : ''}{e.date} | {e.payee} - £{Number(e.amount).toLocaleString()} {isAlreadyLinked ? '(Linked)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    ⭐ indicates matching payee name suggested for this vendor.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleSaveLink}
                    disabled={!selectedExpenseId}
                    style={{ padding: '8px 16px', fontSize: '12px' }}
                  >
                    Link Selected Payment
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
