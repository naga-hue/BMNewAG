import React, { useState, useMemo, useEffect } from 'react';
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

  // Find currently linked expense
  const currentLinkedExp = useMemo(() => {
    if (!contract || !monthKey) return undefined;
    return expenses?.find(
      e => e.linkedVendorCellId === `${contract.id}_${monthKey}`
    );
  }, [expenses, contract?.id, monthKey]);

  useEffect(() => {
    if (currentLinkedExp) {
      setSelectedExpenseId(currentLinkedExp.id);
    } else {
      setSelectedExpenseId('');
    }
  }, [currentLinkedExp, reconcilingCell]);

  // Candidate filter: same month, and not linked to payroll/other vendors (unless it's the current one)
  const candidates = useMemo(() => {
    if (!contract || !monthKey) return [];
    const list = (expenses || []).filter(e => {
      if (!e.date || !e.date.startsWith(monthKey)) return false;
      if (e.id === currentLinkedExp?.id) return true; // keep current
      return !e.linkedPayrollCellId && (!e.linkedVendorCellId || e.linkedVendorCellId === `${contract.id}_${monthKey}`);
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
  }, [expenses, monthKey, currentLinkedExp, contract?.id, vendorName]);

  if (!reconcilingCell) return null;

  const handleSaveLink = async () => {
    if (!selectedExpenseId) {
      onShowToast('Please select a payment transaction to link.', 'error');
      return;
    }
    const chosenExp = expenses.find(e => e.id === selectedExpenseId);
    if (!chosenExp) return;

    // Save linkage
    const updatedExp = {
      ...chosenExp,
      linkedVendorCellId: `${contract.id}_${monthKey}`,
      recipientType: 'vendor',
      recipientId: contract.vendorId
    };
    
    try {
      await onSaveExpense(updatedExp);
      onShowToast(`Linked payment successfully!`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Failed to link payment: ${err.message}`, 'warning');
    }
  };

  const handleUnlink = async () => {
    if (!currentLinkedExp) return;
    const updatedExp = {
      ...currentLinkedExp,
      linkedVendorCellId: ''
    };
    try {
      await onSaveExpense(updatedExp);
      onShowToast(`Unlinked payment successfully!`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Failed to unlink payment: ${err.message}`, 'warning');
    }
  };

  const displayMonth = new Date(monthKey + '-02').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const term = vendorName.toLowerCase();

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
                Reconcile Vendor Payment
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Link contract matrix cell to bank/ledger expense</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>
            ✕
          </button>
        </div>

        <div className="wizard-body" style={{ padding: '16px', overflowY: 'auto' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Projected Budget:</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                {symbolMap[forecastCurrency] || '£'}{Math.round(projectedAmount).toLocaleString()}
              </span>
            </div>
          </div>

          {currentLinkedExp ? (
            <div style={{ marginTop: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>✅</span> Currently Reconciled & Paid
                </h4>
                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bank Date:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentLinkedExp.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Payee Description:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentLinkedExp.payee}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Actual Paid Amount:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontFamily: 'monospace' }}>
                      £{Number(currentLinkedExp.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {currentLinkedExp.notes && (
                    <div style={{ marginTop: '4px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Notes:</span>
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{currentLinkedExp.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  Unlink Payment Transaction
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                Select bank statement transaction to reconcile:
              </h3>
              {candidates.length === 0 ? (
                <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  No unlinked expense transactions found for {displayMonth}.
                  Please upload or log a transaction in the Ledger/Expenses tab first.
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <select
                    className="select-filter"
                    value={selectedExpenseId}
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  >
                    <option value="">-- Choose Transaction --</option>
                    {candidates.map(e => {
                      const isNameMatch = e.payee?.toLowerCase().includes(term) || term.includes(e.payee?.toLowerCase() || '');
                      return (
                        <option key={e.id} value={e.id}>
                          {isNameMatch ? '⭐ ' : ''}{e.date} | {e.payee} - £{Number(e.amount).toLocaleString()}
                        </option>
                      );
                    })}
                  </select>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    ⭐ indicates matching payee name suggested for this vendor.
                  </span>
                </div>
              )}

              <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleSaveLink}
                  disabled={!selectedExpenseId}
                >
                  Reconcile with Selected Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
