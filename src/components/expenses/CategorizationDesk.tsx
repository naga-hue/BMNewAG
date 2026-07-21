import React, { useState, useMemo } from 'react';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';
import { Check, Sparkles, Filter, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import MultiSelectFilter from '../MultiSelectFilter';

interface CategorizationDeskProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

const EMPTY_ARRAY: any[] = [];

export default function CategorizationDesk({ onShowToast }: CategorizationDeskProps) {
  const expenses = useBoundStore(state => state.expenses) || EMPTY_ARRAY;
  const vendors = useBoundStore(state => state.vendors) || EMPTY_ARRAY;
  const staff = useBoundStore(state => state.staff) || EMPTY_ARRAY;
  const companies = useBoundStore(state => state.companies) || EMPTY_ARRAY;
  const nominalCodes = useBoundStore(state => state.nominalCodes) || EMPTY_ARRAY;
  const contracts = useBoundStore(state => state.contracts) || EMPTY_ARRAY;
  const assetAssignments = useBoundStore(state => state.assetAssignments) || EMPTY_ARRAY;

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unmapped_recipient' | 'unmapped_nominal'>('all');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter unmapped and uncategorized expenses
  const unmappedExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (e.status === 'dns' || e.status === 'cancelled') return false;
      const isUnmappedRecipient = !e.recipientType || e.recipientType === 'other';
      const isUnmappedNominal = !e.nominalCode;
      
      if (filterType === 'unmapped_recipient') return isUnmappedRecipient;
      if (filterType === 'unmapped_nominal') return isUnmappedNominal;
      return isUnmappedRecipient || isUnmappedNominal;
    }).filter(e => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (e.payee || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q);
    });
  }, [expenses, filterType, searchQuery]);

  const totalExpensesCount = (expenses || []).length;
  const totalUnmappedCount = (expenses || []).filter(e => (!e.recipientType || e.recipientType === 'other' || !e.nominalCode) && e.status !== 'dns' && e.status !== 'cancelled').length;
  const mappedCount = Math.max(0, totalExpensesCount - totalUnmappedCount);
  const percentageMapped = totalExpensesCount > 0 ? Math.round((mappedCount / totalExpensesCount) * 100) : 100;

  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
      if (typeof c === 'string') return { id: c, code: c };
      return { id: c.id || c.code, code: c.code || '' };
    }).filter(c => !!c.code);
  }, [nominalCodes]);

  // Batch 1-Click Auto Map
  const handleAutoMapAll = async () => {
    setIsProcessing(true);
    let mapped = 0;

    for (const exp of unmappedExpenses) {
      const payeeStr = (exp.payee || '').toLowerCase();
      
      const matchedStaff = staff.find(s => s.fullName && payeeStr.includes(s.fullName.toLowerCase()));
      const matchedVendor = vendors.find(v => v.name && payeeStr.includes(v.name.toLowerCase()));

      if (matchedStaff) {
        await saveExpense({
          ...exp,
          recipientType: 'staff',
          recipientId: matchedStaff.id,
          payee: matchedStaff.fullName,
          allocationType: 'staff',
          allocationTarget: [matchedStaff.id]
        });
        mapped++;
      } else if (matchedVendor) {
        const vContracts = contracts.filter(c => c.vendorId === matchedVendor.id || (c.vendorName && c.vendorName.toLowerCase() === matchedVendor.name.toLowerCase()));
        const vContractIds = vContracts.map(c => c.id);
        const assignedStaffIds = assetAssignments.filter(a => vContractIds.includes(a.contractId)).map(a => a.staffId).filter(Boolean);

        let allocType = exp.allocationType || 'company';
        let allocTarget = exp.allocationTarget;

        if (assignedStaffIds.length > 0) {
          allocType = 'staff';
          allocTarget = assignedStaffIds;
        } else if (vContracts.length > 0 && Array.isArray(vContracts[0].splits)) {
          const compTargets = vContracts[0].splits.filter((sp: any) => sp.type === 'company').map((sp: any) => sp.targetId);
          if (compTargets.length > 0) {
            allocType = 'company';
            allocTarget = compTargets;
          }
        }

        await saveExpense({
          ...exp,
          recipientType: 'vendor',
          recipientId: matchedVendor.id,
          payee: matchedVendor.name,
          allocationType: allocType,
          allocationTarget: allocTarget
        });
        mapped++;
      }
    }

    setIsProcessing(false);
    if (mapped > 0) {
      onShowToast(`⚡ Auto-categorized & mapped ${mapped} transaction payees successfully!`, 'success');
    } else {
      onShowToast('No additional automated payee matches found. Please categorize remaining items manually below.', 'info');
    }
  };

  const handleUpdateRow = async (expense: any, field: string, val: any) => {
    let updated = { ...expense, [field]: val };

    if (field === 'recipient') {
      if (val === 'other') {
        updated.recipientType = 'other';
        updated.recipientId = '';
      } else {
        const [type, id] = val.split(':');
        updated.recipientType = type;
        updated.recipientId = id;

        if (type === 'staff') {
          const sObj = staff.find(s => s.id === id);
          if (sObj) {
            updated.payee = sObj.fullName;
            updated.allocationType = 'staff';
            updated.allocationTarget = [id];
          }
        } else if (type === 'vendor') {
          const vObj = vendors.find(v => v.id === id);
          if (vObj) {
            updated.payee = vObj.name;
            const vContracts = contracts.filter(c => c.vendorId === id || (c.vendorName && c.vendorName.toLowerCase() === vObj.name.toLowerCase()));
            const vContractIds = vContracts.map(c => c.id);
            const assignedStaffIds = assetAssignments.filter(a => vContractIds.includes(a.contractId)).map(a => a.staffId).filter(Boolean);

            if (assignedStaffIds.length > 0) {
              updated.allocationType = 'staff';
              updated.allocationTarget = assignedStaffIds;
            } else if (vContracts.length > 0 && Array.isArray(vContracts[0].splits)) {
              const compTargets = vContracts[0].splits.filter((sp: any) => sp.type === 'company').map((sp: any) => sp.targetId);
              if (compTargets.length > 0) {
                updated.allocationType = 'company';
                updated.allocationTarget = compTargets;
              }
            }
          }
        }
      }
    }

    await saveExpense(updated);
    onShowToast(`Updated categorisation for ${updated.payee}`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Overview Metric & Quick Action Card */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            backgroundColor: totalUnmappedCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
            color: totalUnmappedCount > 0 ? 'var(--warning)' : 'var(--success)', 
            padding: '12px', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {totalUnmappedCount > 0 ? <ShieldAlert size={28} /> : <Check size={28} />}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {totalUnmappedCount > 0 ? `⚠️ ${totalUnmappedCount} Unmapped Transactions Require Categorization` : `✅ All Expenses Fully Categorized & Mapped!`}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>Ledger Health: <strong>{percentageMapped}% Mapped</strong></span>
              <span>•</span>
              <span>{mappedCount} of {totalExpensesCount} expenses assigned to vendors & staff</span>
            </div>
            
            {/* Progress Bar */}
            <div style={{ width: '280px', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${percentageMapped}%`, 
                height: '100%', 
                backgroundColor: percentageMapped === 100 ? 'var(--success)' : 'var(--warning)', 
                transition: 'width 0.4s ease' 
              }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleAutoMapAll}
            disabled={isProcessing || totalUnmappedCount === 0}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px', 
              fontSize: '13px', 
              fontWeight: 700, 
              backgroundColor: 'var(--primary)',
              color: '#fff'
            }}
          >
            <Sparkles size={16} /> ⚡ Smart Auto-Map All ({totalUnmappedCount})
          </button>
        </div>
      </div>

      {/* Filter & Toolbar Desk */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Search unmapped payee description..." 
            className="search-input" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ minWidth: '260px' }}
          />

          <select 
            className="select-filter" 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="all">All Unmapped (Recipient or Nominal)</option>
            <option value="unmapped_recipient">⚠️ Missing Recipient / Vendor</option>
            <option value="unmapped_nominal">⚠️ Missing Nominal Code</option>
          </select>
        </div>

        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Showing {unmappedExpenses.length} unmapped transactions
        </span>
      </div>

      {/* Unmapped Expenses Interactive Workspace Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="entity-table dense" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '100px' }}>Date</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '220px' }}>Bank Statement Payee</th>
              <th style={{ padding: '10px', textAlign: 'right', minWidth: '110px' }}>Amount</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '120px' }}>P&L Month</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '200px' }}>Mapped Vendor / Staff</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '160px' }}>Nominal Category</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '180px' }}>Cost Allocation</th>
            </tr>
          </thead>
          <tbody>
            {unmappedExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Check size={32} color="var(--success)" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>No Unmapped Expenses Found!</span>
                    <span style={{ fontSize: '12px' }}>All transactions in your ledger are mapped to vendors, staff, and nominal categories.</span>
                  </div>
                </td>
              </tr>
            ) : (
              unmappedExpenses.map(exp => {
                const isRecipientUnmapped = !exp.recipientType || exp.recipientType === 'other';
                const isNominalUnmapped = !exp.nominalCode;

                const recipientVal = exp.recipientType !== 'other' ? `${exp.recipientType}:${exp.recipientId}` : 'other';

                return (
                  <tr 
                    key={exp.id} 
                    style={{ 
                      backgroundColor: 'rgba(245, 158, 11, 0.04)', 
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    {/* Date */}
                    <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {exp.date}
                    </td>

                    {/* Payee */}
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {exp.payee}
                        </span>
                        {isRecipientUnmapped && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '1px 6px', borderRadius: '4px', width: 'fit-content' }}>
                            ⚠️ Unmapped Payee
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                      £{toGBP(exp.amount, exp.currency || 'GBP').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* P&L Month */}
                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="month" 
                        value={exp.plMonth || exp.date?.substring(0, 7) || '2026-07'} 
                        onChange={(e) => handleUpdateRow(exp, 'plMonth', e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </td>

                    {/* Recipient Dropdown */}
                    <td style={{ padding: '8px 10px' }}>
                      <select 
                        value={recipientVal}
                        onChange={(e) => handleUpdateRow(exp, 'recipient', e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          fontSize: '11px', 
                          borderRadius: '4px', 
                          border: isRecipientUnmapped ? '1px solid var(--warning)' : '1px solid var(--border-color)', 
                          backgroundColor: isRecipientUnmapped ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)', 
                          color: 'var(--text-primary)',
                          fontWeight: isRecipientUnmapped ? 700 : 500
                        }}
                      >
                        <option value="other">⚠️ -- Select Recipient --</option>
                        <optgroup label="Registered Vendors">
                          {vendors.map(v => (
                            <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Staff / Salary Profiles">
                          {staff.map(s => (
                            <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>

                    {/* Nominal Code */}
                    <td style={{ padding: '8px 10px' }}>
                      <select 
                        value={exp.nominalCode || ''}
                        onChange={(e) => handleUpdateRow(exp, 'nominalCode', e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          fontSize: '11px', 
                          borderRadius: '4px', 
                          border: isNominalUnmapped ? '1px solid var(--warning)' : '1px solid var(--border-color)', 
                          backgroundColor: isNominalUnmapped ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)', 
                          color: 'var(--text-primary)',
                          fontWeight: isNominalUnmapped ? 700 : 500
                        }}
                      >
                        <option value="">⚠️ -- Select Nominal Code --</option>
                        {activeNominalCodes.map(c => (
                          <option key={c.id} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                    </td>

                    {/* Allocation Status */}
                    <td style={{ padding: '8px 10px' }}>
                      {exp.allocationType === 'staff' ? (
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                          👥 {Array.isArray(exp.allocationTarget) ? `${exp.allocationTarget.length} Users` : 'Staff'}
                        </span>
                      ) : exp.allocationType === 'company' ? (
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontWeight: 600 }}>
                          🏢 Company Split
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          🌐 Global Overhead
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
