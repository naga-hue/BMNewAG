import React, { useState, useMemo } from 'react';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';
import { Check, Sparkles, Filter, AlertTriangle, ArrowRight, ShieldAlert, Plus, Layers, UserCheck } from 'lucide-react';
import { firebaseService } from '../../services/firebase';

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
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick Contract Registration Modal state
  const [showQuickContractModal, setShowQuickContractModal] = useState(false);
  const [quickContractRowId, setQuickContractRowId] = useState<string | null>(null);
  const [quickVendorId, setQuickVendorId] = useState('');
  const [quickVendorName, setQuickVendorName] = useState('');
  const [newContractName, setNewContractName] = useState('');
  const [newContractSeats, setNewContractSeats] = useState(50);
  const [newContractUnitCost, setNewContractUnitCost] = useState(10);
  const [newContractCurrency, setNewContractCurrency] = useState('GBP');
  const [newContractCompanyId, setNewContractCompanyId] = useState('');

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
          compensationCategory: 'salary',
          allocationType: 'staff',
          allocationTarget: [matchedStaff.id]
        });
        mapped++;
      } else if (matchedVendor) {
        const vContracts = contracts.filter(c => c.vendorId === matchedVendor.id || (c.vendorName && c.vendorName.toLowerCase() === matchedVendor.name.toLowerCase()));
        const matchedContract = vContracts[0];
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
          linkedContractId: matchedContract?.id || '',
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

  // Retroactively auto-link contracts & compensation categories to all existing records
  useEffect(() => {
    if (expenses.length > 0 && (vendors.length > 0 || staff.length > 0)) {
      expenses.forEach(exp => {
        if (exp.recipientType === 'vendor' && exp.recipientId && !exp.linkedContractId) {
          const vContracts = contracts.filter(c => c.vendorId === exp.recipientId);
          if (vContracts.length > 0) {
            const matchedContract = vContracts[0];
            const assignedStaffIds = assetAssignments.filter(a => a.contractId === matchedContract.id).map(a => a.staffId).filter(Boolean);
            saveExpense({
              ...exp,
              linkedContractId: matchedContract.id,
              allocationType: assignedStaffIds.length > 0 ? 'staff' : (exp.allocationType || 'company'),
              allocationTarget: assignedStaffIds.length > 0 ? assignedStaffIds : exp.allocationTarget
            });
          }
        } else if (exp.recipientType === 'staff' && exp.recipientId && !exp.compensationCategory) {
          saveExpense({
            ...exp,
            compensationCategory: 'salary',
            allocationType: 'staff',
            allocationTarget: [exp.recipientId]
          });
        }
      });
    }
  }, [expenses.length, vendors.length, contracts.length]);

  const handleUpdateRow = async (expense: any, field: string, val: any) => {
    let updated = { ...expense, [field]: val };

    if (field === 'recipient') {
      if (val === 'other') {
        updated.recipientType = 'other';
        updated.recipientId = '';
        updated.linkedContractId = '';
      } else {
        const [type, id] = val.split(':');
        updated.recipientType = type;
        updated.recipientId = id;

        if (type === 'staff') {
          const sObj = staff.find(s => s.id === id);
          if (sObj) {
            updated.payee = sObj.fullName;
            updated.compensationCategory = updated.compensationCategory || 'salary';
            updated.allocationType = 'staff';
            updated.allocationTarget = [id];
          }
        } else if (type === 'vendor') {
          const vObj = vendors.find(v => v.id === id);
          if (vObj) {
            updated.payee = vObj.name;
            const vContracts = contracts.filter(c => c.vendorId === id || (c.vendorName && c.vendorName.toLowerCase() === vObj.name.toLowerCase()));
            const firstContract = vContracts[0];
            updated.linkedContractId = firstContract?.id || '';

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
    } else if (field === 'linkedContractId') {
      if (val === 'register_new_contract') {
        const vObj = vendors.find(v => v.id === expense.recipientId);
        setQuickVendorId(expense.recipientId || '');
        setQuickVendorName(vObj?.name || expense.payee || 'Vendor');
        setQuickContractRowId(expense.id);
        setNewContractName(`${vObj?.name || 'Vendor'} License Package`);
        setNewContractCompanyId(companies[0]?.id || '');
        setShowQuickContractModal(true);
        return;
      }

      if (val === 'split_all_contracts') {
        const vContracts = contracts.filter(c => c.vendorId === expense.recipientId);
        const totalProjected = vContracts.reduce((sum, c) => sum + (toGBP(c.unitCost, c.currency) * (c.quantityPurchased || 1)), 0) || 1;
        const expAmount = toGBP(expense.amount, expense.currency || 'GBP');
        const splits: Record<string, number> = {};

        vContracts.forEach(c => {
          const cProj = toGBP(c.unitCost, c.currency) * (c.quantityPurchased || 1);
          const cShare = (cProj / totalProjected) * expAmount;
          splits[c.id] = Math.round(cShare * 100) / 100;
        });

        updated.linkedContractId = 'split_all';
        updated.contractSplits = splits;

        const allContractIds = vContracts.map(c => c.id);
        const assignedStaffIds = assetAssignments.filter(a => allContractIds.includes(a.contractId)).map(a => a.staffId).filter(Boolean);
        if (assignedStaffIds.length > 0) {
          updated.allocationType = 'staff';
          updated.allocationTarget = assignedStaffIds;
        }
      } else {
        updated.linkedContractId = val;
        updated.contractSplits = null;
        const contractObj = contracts.find(c => c.id === val);
        if (contractObj) {
          const assignedStaffIds = assetAssignments.filter(a => a.contractId === val).map(a => a.staffId).filter(Boolean);
          if (assignedStaffIds.length > 0) {
            updated.allocationType = 'staff';
            updated.allocationTarget = assignedStaffIds;
          }
        }
      }
    }

    await saveExpense(updated);
    onShowToast(`Updated categorisation for ${updated.payee}`, 'success');
  };

  const handleCreateNewContractModalSave = async () => {
    if (!newContractName.trim()) {
      onShowToast('Please enter a contract package name.', 'error');
      return;
    }

    const newContractId = `contract-${Date.now()}`;
    const newContract = {
      id: newContractId,
      vendorId: quickVendorId,
      vendorName: quickVendorName,
      name: newContractName,
      quantityPurchased: Number(newContractSeats) || 1,
      unitCost: Number(newContractUnitCost) || 0,
      currency: newContractCurrency || 'GBP',
      billingFrequency: 'Monthly',
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      splits: [
        { targetId: newContractCompanyId || (companies[0]?.id || ''), percentage: 100, type: 'company' }
      ]
    };

    try {
      await firebaseService.saveContract(newContract);
      onShowToast(`Created new contract "${newContractName}" (${newContractSeats} seats) successfully!`, 'success');

      if (quickContractRowId) {
        const targetExp = expenses.find(e => e.id === quickContractRowId);
        if (targetExp) {
          await saveExpense({
            ...targetExp,
            recipientType: 'vendor',
            recipientId: quickVendorId,
            linkedContractId: newContractId
          });
        }
      }
      setShowQuickContractModal(false);
    } catch (err: any) {
      onShowToast(`Error saving contract: ${err.message}`, 'error');
    }
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
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '90px' }}>Date</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '200px' }}>Bank Statement Payee</th>
              <th style={{ padding: '10px', textAlign: 'right', minWidth: '100px' }}>Amount</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '110px' }}>P&L Month</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '180px' }}>Mapped Vendor / Staff</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '180px' }}>Contract / Compensation Type</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '150px' }}>Nominal Category</th>
              <th style={{ padding: '10px', textAlign: 'left', minWidth: '220px' }}>Apportionment & Unused Capacity</th>
            </tr>
          </thead>
          <tbody>
            {unmappedExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Check size={32} color="var(--success)" />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>No Unmapped Expenses Found!</span>
                    <span style={{ fontSize: '12px' }}>All transactions in your ledger are mapped to vendors, contracts, staff, and nominal categories.</span>
                  </div>
                </td>
              </tr>
            ) : (
              unmappedExpenses.map(exp => {
                const isRecipientUnmapped = !exp.recipientType || exp.recipientType === 'other';
                const isNominalUnmapped = !exp.nominalCode;
                const recipientVal = exp.recipientType !== 'other' ? `${exp.recipientType}:${exp.recipientId}` : 'other';

                const vendorContracts = exp.recipientType === 'vendor' ? contracts.filter(c => c.vendorId === exp.recipientId) : [];
                const currentContract = contracts.find(c => c.id === exp.linkedContractId);

                // Unused seats & staff seats calculation
                let totalSeats = currentContract?.quantityPurchased || 0;
                let assignedStaff = currentContract ? assetAssignments.filter(a => a.contractId === currentContract.id) : [];
                let assignedCount = assignedStaff.length;
                let unusedCount = Math.max(0, totalSeats - assignedCount);

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

                    {/* Contract / Compensation Type */}
                    <td style={{ padding: '8px 10px' }}>
                      {exp.recipientType === 'vendor' ? (
                        <select
                          value={exp.linkedContractId || ''}
                          onChange={(e) => handleUpdateRow(exp, 'linkedContractId', e.target.value)}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                          <option value="">-- General Vendor Payment --</option>
                          {vendorContracts.length > 1 && (
                            <option value="split_all_contracts" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                              ⚡ Split Pro-Rata Across All {vendorContracts.length} Contracts
                            </option>
                          )}
                          {vendorContracts.map(c => (
                            <option key={c.id} value={c.id}>💻 {c.name} ({c.quantityPurchased || 0} seats)</option>
                          ))}
                          <option value="register_new_contract" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                            ➕ Register New Contract Package...
                          </option>
                        </select>
                      ) : exp.recipientType === 'staff' ? (
                        <select
                          value={exp.compensationCategory || 'salary'}
                          onChange={(e) => handleUpdateRow(exp, 'compensationCategory', e.target.value)}
                          style={{ width: '100%', padding: '6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                          <option value="salary">💰 Monthly Basic Salary</option>
                          <option value="commission">📈 Sales Commission</option>
                          <option value="reimbursement">🧾 Expense Reimbursement</option>
                          <option value="bonus">🎁 Performance Bonus</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Select Recipient first</span>
                      )}
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

                    {/* Apportionment Breakdown Card */}
                    <td style={{ padding: '8px 10px' }}>
                      {exp.recipientType === 'staff' ? (
                        <div style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                          👤 Direct Staff Compensation
                        </div>
                      ) : currentContract ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 700 }}>
                            <UserCheck size={12} />
                            <span>{assignedCount} Staff Seats Assigned</span>
                          </div>
                          {unusedCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 600 }}>
                              <Layers size={12} />
                              <span>{unusedCount} Unused Seats → Corporate Overhead</span>
                            </div>
                          )}
                        </div>
                      ) : exp.allocationType === 'company' ? (
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontWeight: 600 }}>
                          🏢 Company Share
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          🌐 Corporate Overhead
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

      {/* Quick Contract Creation Drawer/Modal */}
      {showQuickContractModal && (
        <div className="form-wizard-overlay" onClick={() => setShowQuickContractModal(false)} style={{ zIndex: 1100 }}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Register New Contract Package
                </h3>
              </div>
              <button type="button" onClick={() => setShowQuickContractModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Vendor Partner</label>
                <input type="text" value={quickVendorName} disabled style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Contract Package Name *</label>
                <input 
                  type="text" 
                  value={newContractName} 
                  onChange={(e) => setNewContractName(e.target.value)} 
                  placeholder="e.g. Microsoft Business Basic" 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Licenses / Seats *</label>
                  <input 
                    type="number" 
                    value={newContractSeats} 
                    onChange={(e) => setNewContractSeats(Number(e.target.value))} 
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Unit Cost / Seat *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={newContractUnitCost} 
                    onChange={(e) => setNewContractUnitCost(Number(e.target.value))} 
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Primary Billed Company *</label>
                <select 
                  value={newContractCompanyId} 
                  onChange={(e) => setNewContractCompanyId(e.target.value)} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>🏢 {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowQuickContractModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleCreateNewContractModalSave}>Save & Link Contract</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
