import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Eye, Edit3, Search, Settings, AlertTriangle } from 'lucide-react';
// @ts-ignore
import MultiSelectFilter from '../MultiSelectFilter';
import { useBoundStore } from '../../store/useBoundStore';
import { toGBP } from '../../utils/currency';
import { symbolMap } from './shared';

interface ExpensesTableProps {
  handleEditExpense: (expense: any) => void;
  setLinkingPayrollExpId: (id: string | null) => void;
  setLinkingStaffId: (id: string | null) => void;
  setLinkingMonth: (month: string | null) => void;
  setAllocatingRowId: (id: string | null) => void;
  setAllocatingType: (type: string) => void;
  setAllocatingTarget: (target: string[]) => void;
  setAllocatingStaffIds: (ids: string[]) => void;
  setAllocatingMode: (mode: string) => void;
  setAllocatingManualShares: (shares: Record<string, number>) => void;
  setExpandedSections: React.Dispatch<React.SetStateAction<{ company: boolean; department: boolean; staff: boolean }>>;
  setAllocationSearch: (search: string) => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

const EMPTY_ARRAY: any[] = [];

export default function ExpensesTable({
  handleEditExpense,
  setLinkingPayrollExpId: _setLinkingPayrollExpId,
  setLinkingStaffId: _setLinkingStaffId,
  setLinkingMonth: _setLinkingMonth,
  setAllocatingRowId: _setAllocatingRowId,
  setAllocatingType: _setAllocatingType,
  setAllocatingTarget: _setAllocatingTarget,
  setAllocatingStaffIds: _setAllocatingStaffIds,
  setAllocatingMode: _setAllocatingMode,
  setAllocatingManualShares: _setAllocatingManualShares,
  setExpandedSections: _setExpandedSections,
  setAllocationSearch: _setAllocationSearch,
  onShowToast
}: ExpensesTableProps) {
  const expenses = useBoundStore(state => state.expenses);
  const companies = useBoundStore(state => state.companies);
  const staff = useBoundStore(state => state.staff);
  const vendors = useBoundStore(state => state.vendors);
  const placements = useBoundStore(state => state.placements);
  const nominalCodes = useBoundStore(state => state.nominalCodes);
  const contracts = useBoundStore(state => state.contracts) || EMPTY_ARRAY;
  const assetAssignments = useBoundStore(state => state.assetAssignments) || EMPTY_ARRAY;

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;
  const deleteExpense = useBoundStore(state => state.deleteExpense);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [nominalFilter, setNominalFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [plMonthFilter, setPlMonthFilter] = useState('all');
  const [bankAccountFilter, setBankAccountFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState<string[]>(['all']);
  const [deptFilter, setDeptFilter] = useState<string[]>(['all']);
  const [staffFilter, setStaffFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [onlyUnmappedFilter, setOnlyUnmappedFilter] = useState(false);

  const unmappedExpensesCount = useMemo(() => {
    return (expenses || []).filter(e => (!e.recipientType || e.recipientType === 'other' || !e.nominalCode) && e.status !== 'dns' && e.status !== 'cancelled').length;
  }, [expenses]);

  // Column Visibility
  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    select: true,
    date: true,
    plMonth: true,
    payee: true,
    bank: true,
    nominal: true,
    allocation: true,
    tax: true,
    amount: true,
    receipt: true,
    actions: true
  });

  // Sorting State
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Selection State
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  // High Risk Action Confirmation Modal states
  const [showHighRiskModal, setShowHighRiskModal] = useState(false);
  const [highRiskAction, setHighRiskAction] = useState<'reset' | 'bulk-delete' | null>(null);
  const [highRiskMessage, setHighRiskMessage] = useState('');
  const [highRiskTimer, setHighRiskTimer] = useState(20);
  const [highRiskUnderstandChecked, setHighRiskUnderstandChecked] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (showHighRiskModal && highRiskTimer > 0) {
      interval = setInterval(() => {
        setHighRiskTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showHighRiskModal, highRiskTimer]);

  // Retroactively auto-map all existing unmapped expenses on mount
  useEffect(() => {
    if (expenses.length > 0 && (vendors.length > 0 || staff.length > 0)) {
      const unmapped = expenses.filter(exp => {
        if (exp.recipientType && exp.recipientType !== 'other') return false;
        const payeeStr = (exp.payee || '').toLowerCase();
        const mStaff = staff.some(s => s.fullName && payeeStr.includes(s.fullName.toLowerCase()));
        const mVendor = vendors.some(v => v.name && payeeStr.includes(v.name.toLowerCase()));
        return mStaff || mVendor;
      });

      if (unmapped.length > 0) {
        handleAutoMapPayeesAndVendors();
      }
    }
  }, [expenses.length, vendors.length, staff.length]);

  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
      if (typeof c === 'string') {
        const parts = c.split(' - ');
        return { id: parts[0] || c, code: c, type: 'indirect' };
      }
      if (c && typeof c === 'object') {
        return {
          id: c.id || '',
          code: c.code || '',
          type: c.type || 'indirect'
        };
      }
      return null;
    }).filter((c): c is { id: string; code: string; type: string } => c !== null && !!c.code);
  }, [nominalCodes]);

  const allAvailableDepts = useMemo(() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach((d: any) => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  }, [companies, staff]);

  // Filter Ledger transactions list
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(exp => {
      if (!exp) return false;
      const expNominal = exp.nominalCode || '';
      const expPlMonth = exp.plMonth || '';

      if (onlyUnmappedFilter) {
        const isUnmapped = !exp.recipientType || exp.recipientType === 'other' || !exp.nominalCode;
        if (!isUnmapped) return false;
      }

      if (nominalFilter !== 'all' && expNominal !== nominalFilter) return false;
      if (plMonthFilter !== 'all' && expPlMonth !== plMonthFilter) return false;
      if (bankAccountFilter !== 'all' && exp.bankAccountId !== bankAccountFilter) return false;

      // Company filter
      if (!companyFilter.includes('all')) {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
        if (exp.allocationType !== 'company' || !targets.some(t => t && companyFilter.includes(t))) return false;
      }

      // Department filter
      if (!deptFilter.includes('all')) {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
        if (exp.allocationType !== 'department' || !targets.some(t => t && deptFilter.includes(t))) return false;
      }

      // Staff filter
      if (staffFilter !== 'all') {
        if (exp.allocationType !== 'staff') return false;
        const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
        if (!ids.includes(staffFilter)) return false;
      }

      // Vendor / Recipient Filter
      if (vendorFilter !== 'all') {
        if (exp.recipientId !== vendorFilter) return false;
      }

      // Start / End Date Filter
      if (startDateFilter && exp.date < startDateFilter) return false;
      if (endDateFilter && exp.date > endDateFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPayee = String(exp.payee || '').toLowerCase().includes(q);
        const matchDesc = String(exp.description || '').toLowerCase().includes(q);
        const matchNom = String(exp.nominalCode || '').toLowerCase().includes(q);
        return matchPayee || matchDesc || matchNom;
      }
      return true;
    });
  }, [
    expenses, nominalFilter, plMonthFilter, bankAccountFilter,
    companyFilter, deptFilter, staffFilter, vendorFilter,
    startDateFilter, endDateFilter, searchQuery
  ]);

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let valA: any = a[sortBy as keyof typeof a] || '';
      let valB: any = b[sortBy as keyof typeof b] || '';

      if (sortBy === 'amount' || sortBy === 'taxRate') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortBy === 'date') {
        valA = new Date(valA || '1970-01-01');
        valB = new Date(valB || '1970-01-01');
      } else if (sortBy === 'bank') {
        valA = String(a.bankAccountRef || '').toLowerCase();
        valB = String(b.bankAccountRef || '').toLowerCase();
      } else if (sortBy === 'allocation') {
        valA = String(a.allocationType || '').toLowerCase();
        valB = String(b.allocationType || '').toLowerCase();
      } else if (sortBy === 'receipt') {
        valA = a.invoiceUrl && a.invoiceUrl !== '#' ? 1 : 0;
        valB = b.invoiceUrl && b.invoiceUrl !== '#' ? 1 : 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredExpenses, sortBy, sortOrder]);

  const uniquePlMonths = useMemo(() => {
    return Array.from(new Set((expenses || []).map(e => e?.plMonth).filter(Boolean))).sort();
  }, [expenses]);

  const allBankAccounts = useMemo(() => {
    const list: { id: string; ref: string }[] = [];
    companies.forEach(c => {
      if (c.bankAccounts) {
        c.bankAccounts.forEach(b => {
          list.push({
            id: b.id,
            ref: `${b.bankName} - ${b.accountName} (${c.name})`
          });
        });
      }
    });
    return list;
  }, [companies]);

  const companyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Companies' },
      ...companies.map(c => ({ value: c.id, label: c.name }))
    ];
  }, [companies]);

  const ledgerDeptOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Departments' },
      ...allAvailableDepts.map(d => ({ value: d, label: d }))
    ];
  }, [allAvailableDepts]);

  const handleHeaderClick = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    }
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // Bulk Actions
  const handleBulkUpdateNominal = async (nominalCode: string) => {
    if (!nominalCode || selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        const original = expenses.find(e => e.id === id);
        if (original) {
          await saveExpense({
            ...original,
            nominalCode
          });
          count++;
        }
      }
      onShowToast(`Bulk updated Nominal Code for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err: any) {
      onShowToast(`Error bulk updating: ${err.message}`, "warning");
    }
  };

  const handleBulkUpdatePLMonth = async (monthVal: string) => {
    if (!monthVal || selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        const original = expenses.find(e => e.id === id);
        if (original) {
          await saveExpense({
            ...original,
            plMonth: monthVal
          });
          count++;
        }
      }
      onShowToast(`Bulk updated P&L Month for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err: any) {
      onShowToast(`Error bulk updating P&L Month: ${err.message}`, "warning");
    }
  };

  const handleBulkUpdateRecipient = async (val: string) => {
    if (selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      const [type, id] = val === 'other' ? ['other', ''] : val.split(':');
      
      const mappedName = type === 'vendor'
        ? vendors.find(v => v.id === id)?.name
        : type === 'staff'
          ? staff.find(s => s.id === id)?.fullName
          : null;

      for (const expId of selectedExpenseIds) {
        const original = expenses.find(e => e.id === expId);
        if (original) {
          await saveExpense({
            ...original,
            recipientType: type,
            recipientId: id,
            payee: mappedName || original.payee,
            ...(type === 'staff' ? { allocationType: 'staff', allocationTarget: [id] } : {})
          });
          count++;
        }
      }
      onShowToast(`Bulk updated Payee/Recipient mapping for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err: any) {
      onShowToast(`Error bulk updating payee: ${err.message}`, "warning");
    }
  };

  const handleBulkUpdateAllocation = async (
    type: string,
    target: string[],
    mode: string,
    manualShares: Record<string, number>
  ) => {
    if (selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        const original = expenses.find(e => e.id === id);
        if (original) {
          await saveExpense({
            ...original,
            allocationType: type,
            allocationTarget: target,
            allocationMode: mode,
            manualAllocationShares: manualShares
          });
          count++;
        }
      }
      onShowToast(`Bulk updated Cost Allocation for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err: any) {
      onShowToast(`Error bulk updating allocations: ${err.message}`, "warning");
    }
  };

  const handleBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;
    setHighRiskAction('bulk-delete');
    setHighRiskMessage(`You are about to permanently delete ${selectedExpenseIds.length} selected expense transaction records from the ledger database.`);
    setHighRiskTimer(20);
    setHighRiskUnderstandChecked(false);
    setShowHighRiskModal(true);
  };

  const handleExecuteHighRiskAction = async () => {
    if (highRiskTimer > 0 || !highRiskUnderstandChecked) return;
    
    setShowHighRiskModal(false);
    
    if (highRiskAction === 'bulk-delete') {
      try {
        let count = 0;
        for (const id of selectedExpenseIds) {
          await deleteExpense(id);
          count++;
        }
        onShowToast(`Permanently deleted ${count} expense records.`, "success");
        setSelectedExpenseIds([]);
      } catch (err: any) {
        onShowToast(`Error bulk deleting: ${err.message}`, "warning");
      }
    }
  };

  const handleExportExpenses = () => {
    const headers = [
      "Date",
      "PL Month",
      "Payee/Vendor",
      "Nominal Code",
      "Bank Account",
      "Allocation Type",
      "Allocation Target",
      "Tax Rate (%)",
      "Amount",
      "Currency",
      "Description",
      "Linked Placement ID"
    ];
    const rows = filteredExpenses.map(exp => [
      exp.date || '',
      exp.plMonth || '',
      exp.payee || '',
      exp.nominalCode || '',
      exp.bankAccountRef || 'Manual',
      exp.allocationType || 'company',
      (() => {
        const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
        if (exp.allocationType === 'company') {
          return targets.map(tid => companies.find(c => c.id === tid)?.name || tid).join(', ');
        }
        return targets.join(', ');
      })(),
      exp.taxRate || 0,
      exp.amount || 0,
      exp.currency || 'GBP',
      exp.description || '',
      exp.linkedPlacementId || ''
    ]);
    
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', "Expenses_Ledger.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Expenses ledger exported to CSV successfully.", "success");
  };

  const handleAutoMapPayeesAndVendors = async () => {
    let mappedCount = 0;
    for (const exp of expenses) {
      const payeeStr = (exp.payee || '').toLowerCase();
      
      // Match registered Staff member
      let matchedStaff = staff.find(s => s.fullName && payeeStr.includes(s.fullName.toLowerCase()));
      if (!matchedStaff) {
        matchedStaff = staff.find(s => {
          if (!s.fullName) return false;
          const parts = s.fullName.split(' ');
          return parts.some(p => p.length > 3 && payeeStr.includes(p.toLowerCase()));
        });
      }

      // Match registered Vendor asset
      let matchedVendor = vendors.find(v => v.name && payeeStr.includes(v.name.toLowerCase()));

      if (matchedStaff) {
        await saveExpense({
          ...exp,
          recipientType: 'staff',
          recipientId: matchedStaff.id,
          payee: matchedStaff.fullName,
          allocationType: 'staff',
          allocationTarget: [matchedStaff.id]
        });
        mappedCount++;
      } else if (matchedVendor) {
        await saveExpense({
          ...exp,
          recipientType: 'vendor',
          recipientId: matchedVendor.id,
          payee: matchedVendor.name
        });
        mappedCount++;
      }
    }
    if (mappedCount > 0) {
      onShowToast(`⚡ Successfully auto-mapped ${mappedCount} expense records to registered Vendors and Staff profiles!`, 'success');
    } else {
      onShowToast(`All transactions are already mapped or no matching vendor/staff names were detected.`, 'info');
    }
  };

  const [allocationSearch, setAllocationSearchLocal] = useState('');
  const [allocatingRowId, setAllocatingRowIdLocal] = useState<string | null>(null);
  const [allocatingType, setAllocatingTypeLocal] = useState('company');
  const [allocatingTarget, setAllocatingTargetLocal] = useState<string[]>([]);
  const [allocatingStaffIds, setAllocatingStaffIdsLocal] = useState<string[]>([]);
  const [allocatingMode, setAllocatingModeLocal] = useState('auto');
  const [allocatingManualShares, setAllocatingManualSharesLocal] = useState<Record<string, number>>({});
  const [expandedSections, setExpandedSectionsLocal] = useState({ company: true, department: false, staff: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Filter Toolbar */}
      <div className="controls-row" style={{ position: 'relative' }}>
        <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search payee or notes description..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={nominalFilter}
            onChange={(e) => setNominalFilter(e.target.value)}
          >
            <option value="all">All Nominal Codes</option>
            {activeNominalCodes.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={plMonthFilter}
            onChange={(e) => setPlMonthFilter(e.target.value)}
          >
            <option value="all">All P&L Months</option>
            {uniquePlMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={bankAccountFilter}
            onChange={(e) => setBankAccountFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="all">All Bank Accounts</option>
            {allBankAccounts.map(b => (
              <option key={b.id} value={b.id}>{b.ref}</option>
            ))}
          </select>

          <MultiSelectFilter
            options={companyOptions}
            selectedValues={companyFilter}
            onChange={(vals: string[]) => {
              setCompanyFilter(vals);
              setDeptFilter(['all']);
              setStaffFilter('all');
            }}
            placeholder="Select Companies"
          />

          <MultiSelectFilter
            options={ledgerDeptOptions}
            selectedValues={deptFilter}
            onChange={(vals: string[]) => setDeptFilter(vals)}
            placeholder="Select Departments"
          />

          <select 
            className="select-filter"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">All Staff Allocated</option>
            {staff
              .filter(s => companyFilter.includes('all') || companyFilter.includes(s.companyId))
              .map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.name}</option>
              ))}
          </select>

          {/* Date range wrapper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>From:</span>
            <input 
              type="date" 
              value={startDateFilter} 
              onChange={(e) => setStartDateFilter(e.target.value)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>To:</span>
            <input 
              type="date" 
              value={endDateFilter} 
              onChange={(e) => setEndDateFilter(e.target.value)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
            />
            {(startDateFilter || endDateFilter) && (
              <button type="button" onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>
            )}
          </div>

          {/* Columns Selector */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => setShowColPicker(!showColPicker)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
            >
              <Settings size={14} /> Columns
            </button>
            {showColPicker && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                right: 0, 
                zIndex: 100, 
                backgroundColor: 'var(--bg-sidebar)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '12px', 
                minWidth: '180px', 
                boxShadow: 'var(--shadow-lg)',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  Visible Columns
                </div>
                {[
                  { key: 'select', label: 'Select Checkbox' },
                  { key: 'date', label: 'Date' },
                  { key: 'plMonth', label: 'P&L Month' },
                  { key: 'payee', label: 'Payee / Vendor' },
                  { key: 'bank', label: 'Bank / Source' },
                  { key: 'nominal', label: 'Nominal Bracket' },
                  { key: 'allocation', label: 'Allocation Target' },
                  { key: 'tax', label: 'Tax (VAT)' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'receipt', label: 'Receipt' },
                  { key: 'actions', label: 'Actions' }
                ].map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', margin: 0, color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={visibleCols[col.key]} 
                      onChange={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button 
            type="button" 
            onClick={() => setOnlyUnmappedFilter(!onlyUnmappedFilter)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 12px', 
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: onlyUnmappedFilter ? 'var(--warning)' : 'rgba(245, 158, 11, 0.12)',
              color: onlyUnmappedFilter ? '#fff' : 'var(--warning)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              transition: 'all 0.2s'
            }}
            title="Filter expenses ledger to only show unmapped payees or missing nominal categories"
          >
            ⚠️ Unmapped ({unmappedExpensesCount})
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleExportExpenses}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
          >
            📥 Export CSV
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleAutoMapPayeesAndVendors}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', color: 'var(--primary)', fontWeight: 600, borderColor: 'var(--primary)' }}
            title="Automatically scan transaction payees and map them to registered Vendors & Staff Salary profiles"
          >
            ⚡ Smart Auto-Map Vendors & Staff
          </button>
        </div>
      </div>

      {/* Bulk Actions Panel */}
      {selectedExpenseIds.length > 0 && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1.5px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          fontSize: '12px',
          animation: 'fadeIn 0.2s',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <span style={{ backgroundColor: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
              {selectedExpenseIds.length}
            </span>
            <span>transactions selected for bulk update:</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Nominal:</span>
              <select
                className="select-filter"
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdateNominal(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                <option value="">-- Apply Nominal --</option>
                {activeNominalCodes.map(c => (
                  <option key={c.id} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>P&L Month:</span>
              <input 
                type="month"
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdatePLMonth(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Recipient:</span>
              <select
                className="select-filter"
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdateRecipient(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{ padding: '4px 8px', fontSize: '11px', minWidth: '150px' }}
              >
                <option value="">-- Apply Recipient --</option>
                <option value="other">General / Unlinked</option>
                <optgroup label="Registered Vendors">
                  {vendors.map(v => (
                    <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Staff / Consultants">
                  {staff.map(s => (
                    <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAllocatingRowIdLocal('bulk');
                setAllocatingTypeLocal('company');
                setAllocatingTargetLocal([]);
                setAllocatingStaffIdsLocal([]);
                setExpandedSectionsLocal({ company: true, department: false, staff: false });
                setAllocationSearchLocal('');
              }}
              style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              🎯 Allocate Selected...
            </button>

            <button 
              type="button" 
              className="btn-secondary delete" 
              onClick={handleBulkDelete}
              style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Trash2 size={12} /> Delete Selected
            </button>

            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => setSelectedExpenseIds([])}
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="table-container">
        <table className="entity-table dense">
          <thead>
            <tr>
              {visibleCols.select && (
                <th style={{ width: '35px', textAlign: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={sortedExpenses.length > 0 && selectedExpenseIds.length === sortedExpenses.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedExpenseIds(sortedExpenses.map(exp => exp.id));
                      } else {
                        setSelectedExpenseIds([]);
                      }
                    }}
                  />
                </th>
              )}
              {visibleCols.date && (
                <th onClick={() => handleHeaderClick('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Date {renderSortIndicator('date')}
                </th>
              )}
              {visibleCols.plMonth && (
                <th onClick={() => handleHeaderClick('plMonth')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  P&L Month {renderSortIndicator('plMonth')}
                </th>
              )}
              {visibleCols.payee && (
                <th onClick={() => handleHeaderClick('payee')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Payee / Vendor {renderSortIndicator('payee')}
                </th>
              )}
              {visibleCols.bank && (
                <th onClick={() => handleHeaderClick('bank')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Bank Account / Source {renderSortIndicator('bank')}
                </th>
              )}
              {visibleCols.nominal && (
                <th onClick={() => handleHeaderClick('nominalCode')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Nominal Bracket {renderSortIndicator('nominalCode')}
                </th>
              )}
              {visibleCols.allocation && (
                <th onClick={() => handleHeaderClick('allocation')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Allocation Center Target {renderSortIndicator('allocation')}
                </th>
              )}
              {visibleCols.tax && (
                <th onClick={() => handleHeaderClick('taxRate')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                  Tax (VAT) {renderSortIndicator('taxRate')}
                </th>
              )}
              {visibleCols.amount && (
                <th onClick={() => handleHeaderClick('amount')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                  Amount (Gross) {renderSortIndicator('amount')}
                </th>
              )}
              {visibleCols.receipt && (
                <th onClick={() => handleHeaderClick('receipt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Linked Receipt {renderSortIndicator('receipt')}
                </th>
              )}
              {visibleCols.actions && (
                <th style={{ textAlign: 'right' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedExpenses.map(exp => {
              const symbol = symbolMap[exp.currency] || '£';
              
              // Resolve Allocation Label
              let allocationLabel = 'Whole Corporate Group';
              if (exp.allocationType === 'company') {
                const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                const names = targets.map(tid => companies.find(c => c.id === tid)?.name).filter(Boolean);
                allocationLabel = names.length > 0 ? `Corp: ${names.join(', ')}` : 'Corporate';
              } else if (exp.allocationType === 'department') {
                const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
                allocationLabel = targets.length > 0 ? `Dept: ${targets.join(', ')}` : 'Department';
              } else if (exp.allocationType === 'staff') {
                const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
                allocationLabel = `Staff: ${ids.length} recruiters`;
              }

              const matchedPl = placements.find(p => p.id === exp.linkedPlacementId);
              const isUnmappedRow = !exp.recipientType || exp.recipientType === 'other' || !exp.nominalCode;

              return (
                <tr 
                  key={exp.id}
                  style={{
                    backgroundColor: isUnmappedRow ? 'rgba(245, 158, 11, 0.08)' : undefined
                  }}
                >
                  {visibleCols.select && (
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={selectedExpenseIds.includes(exp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenseIds(prev => [...prev, exp.id]);
                          } else {
                            setSelectedExpenseIds(prev => prev.filter(id => id !== exp.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  {visibleCols.date && <td>{exp.date}</td>}
                  {visibleCols.plMonth && (
                    <td>
                      <input 
                        type="month"
                        value={exp.plMonth || ''}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          if (newVal) {
                            saveExpense({
                              ...exp,
                              plMonth: newVal
                            });
                            onShowToast("P&L Month updated.", "success");
                          }
                        }}
                        className="select-filter"
                        style={{
                          padding: '2px 4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          width: '120px',
                          cursor: 'pointer'
                        }}
                      />
                    </td>
                  )}
                  {visibleCols.payee && (
                    <td>
                      <select
                        value={exp.recipientType && exp.recipientType !== 'other' ? `${exp.recipientType}:${exp.recipientId}` : 'other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'other') {
                            saveExpense({
                              ...exp,
                              recipientType: 'other',
                              recipientId: ''
                            });
                            onShowToast("Payee mapping cleared.", "success");
                          } else {
                            const [type, id] = val.split(':');
                            if (type === 'staff') {
                              const matchedStaff = staff.find(s => s.id === id);
                              saveExpense({
                                ...exp,
                                recipientType: 'staff',
                                recipientId: id,
                                payee: matchedStaff ? matchedStaff.fullName : exp.payee,
                                allocationType: 'staff',
                                allocationTarget: [id]
                              });
                              onShowToast(`Mapped transaction to Staff Salary: ${matchedStaff?.fullName}`, "success");
                            } else if (type === 'vendor') {
                              const matchedVendor = vendors.find(v => v.id === id);
                              saveExpense({
                                ...exp,
                                recipientType: 'vendor',
                                recipientId: id,
                                payee: matchedVendor ? matchedVendor.name : exp.payee
                              });
                              onShowToast(`Mapped transaction to Vendor Asset: ${matchedVendor?.name}`, "success");
                            }
                          }
                        }}
                        className="select-filter"
                        style={{ 
                          padding: '2px 4px', 
                          fontSize: '11px', 
                          width: '100%', 
                          minWidth: '155px',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="other">General: {exp.payee.split(' [Ref:')[0]}</option>
                        <optgroup label="Registered Vendors">
                          {vendors.map(v => (
                            <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Staff / Consultants">
                          {staff.map(s => (
                            <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                          ))}
                        </optgroup>
                      </select>

                      {exp.recipientType === 'vendor' && exp.recipientId && (() => {
                        const vendorContracts = contracts.filter(c => c.vendorId === exp.recipientId);
                        if (vendorContracts.length === 0) return null;

                        return (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <select
                              value={exp.linkedContractId || (exp.contractSplits ? 'split_all' : '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'split_all') {
                                  const totalProjected = vendorContracts.reduce((sum, c) => sum + (toGBP(c.unitCost, c.currency) * (c.quantityPurchased || 1)), 0) || 1;
                                  const expAmount = toGBP(exp.amount, exp.currency || 'GBP');
                                  const splits: Record<string, number> = {};
                                  vendorContracts.forEach(c => {
                                    const cProj = toGBP(c.unitCost, c.currency) * (c.quantityPurchased || 1);
                                    splits[c.id] = Math.round(((cProj / totalProjected) * expAmount) * 100) / 100;
                                  });
                                  const allContractIds = vendorContracts.map(c => c.id);
                                  const assignedStaffIds = assetAssignments.filter(a => allContractIds.includes(a.contractId)).map(a => a.staffId).filter(Boolean);
                                  saveExpense({
                                    ...exp,
                                    linkedContractId: 'split_all',
                                    contractSplits: splits,
                                    allocationType: assignedStaffIds.length > 0 ? 'staff' : exp.allocationType,
                                    allocationTarget: assignedStaffIds.length > 0 ? assignedStaffIds : exp.allocationTarget
                                  });
                                  onShowToast(`⚡ Auto-split payment pro-rata across all ${vendorContracts.length} contracts!`, "success");
                                } else {
                                  const selectedC = vendorContracts.find(c => c.id === val);
                                  const assignedStaffIds = assetAssignments.filter(a => a.contractId === val).map(a => a.staffId).filter(Boolean);
                                  saveExpense({
                                    ...exp,
                                    linkedContractId: val,
                                    contractSplits: null,
                                    allocationType: assignedStaffIds.length > 0 ? 'staff' : exp.allocationType,
                                    allocationTarget: assignedStaffIds.length > 0 ? assignedStaffIds : exp.allocationTarget
                                  });
                                  onShowToast(`Linked transaction to contract: ${selectedC?.name || 'General Vendor'}`, "success");
                                }
                              }}
                              style={{
                                padding: '2px 4px',
                                fontSize: '10px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-secondary)',
                                color: exp.linkedContractId ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              <option value="">-- Choose Contract Package --</option>
                              {vendorContracts.length > 1 && (
                                <option value="split_all" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                                  ⚡ Split Across All {vendorContracts.length} Contracts
                                </option>
                              )}
                              {vendorContracts.map(c => (
                                <option key={c.id} value={c.id}>
                                  💻 {c.name} ({c.quantityPurchased || 0} seats)
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.bank && (
                    <td>
                      {exp.bankCompanyId ? (
                        <div style={{ fontSize: '11px' }}>
                          <div style={{ fontWeight: 600 }}>{companies.find(c => c.id === exp.bankCompanyId)?.name || 'Company'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            🏦 {exp.bankAccountRef || 'Main Account'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manual (No Bank)</span>
                      )}
                    </td>
                  )}
                  {visibleCols.nominal && <td style={{ fontSize: '11px' }}>{exp.nominalCode}</td>}
                  {visibleCols.allocation && (
                    <td>
                      <span 
                        onClick={() => {
                          setAllocatingRowIdLocal(exp.id);
                          const rawTarget = exp.allocationTarget || [];
                          const targetArray = Array.isArray(rawTarget) ? rawTarget : [rawTarget].filter(Boolean);
                          const type = exp.allocationType || 'company';
                          const validTarget = type === 'company'
                            ? targetArray.filter(tid => companies.some(c => c.id === tid))
                            : type === 'department'
                              ? targetArray.filter(d => allAvailableDepts.includes(d))
                              : targetArray;
                          setAllocatingTypeLocal(type);
                          setAllocatingTargetLocal(validTarget);
                          setAllocatingStaffIdsLocal(type === 'staff' ? targetArray.filter(sid => staff.some(s => s.id === sid)) : []);
                          setAllocatingModeLocal(exp.allocationMode || 'auto');
                          setAllocatingManualSharesLocal(exp.manualAllocationShares || {});
                          setExpandedSectionsLocal({
                            company: type === 'company' || !type,
                            department: type === 'department',
                            staff: type === 'staff'
                          });
                          setAllocationSearchLocal('');
                        }}
                        title="Click to modify allocation target"
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: 500, 
                          color: exp.allocationType === 'staff' ? 'var(--warning)' : exp.allocationType === 'department' ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textDecoration: 'underline dashed rgba(255,255,255,0.3)',
                          display: 'inline-block'
                        }}
                      >
                        {allocationLabel}
                      </span>
                      {exp.description && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{exp.description}</div>}
                    </td>
                  )}
                  {visibleCols.tax && <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{exp.taxRate}%</td>}
                  {visibleCols.amount && (
                    <td style={{ textAlign: 'right', fontWeight: 700, color: exp.nominalCode?.includes('Wages') || exp.nominalCode?.includes('Rent') ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {exp.currency === 'GBP' ? (
                        `£${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : (
                        `£${toGBP(exp.amount, exp.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${symbol}${exp.amount.toLocaleString()})`
                      )}
                    </td>
                  )}
                  {visibleCols.receipt && (
                    <td>
                      {matchedPl ? (
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }} title={`Settles placement invoice ${matchedPl.placementId}`}>
                          Settle: {matchedPl.placementId}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                  )}
                  {visibleCols.actions && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {exp.invoiceUrl && exp.invoiceUrl !== '#' && (
                          <button className="btn-icon" onClick={() => window.open(exp.invoiceUrl, '_blank')} title="Preview Invoice">
                            <Eye size={12} />
                          </button>
                        )}
                        <button className="btn-icon" onClick={() => handleEditExpense(exp)} title="Edit Transaction">
                          <Edit3 size={12} />
                        </button>
                        <button 
                          className="btn-icon delete" 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete this expense record?`)) {
                              deleteExpense(exp.id);
                              onShowToast("Deleted transaction.", "info");
                            }
                          }}
                          title="Delete transaction"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {sortedExpenses.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No expenses logged matching selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* High Risk Action Confirmation Modal */}
      {showHighRiskModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            border: '2px solid var(--danger)',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            animation: 'fadeIn 0.2s',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <AlertTriangle size={32} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>🚨 High-Risk Mass Deletion Warning</h3>
            </div>
            
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {highRiskMessage}
            </p>

            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: 'var(--danger)',
              fontWeight: 500
            }}>
              ⚠️ WARNING: This action is permanent and cannot be undone. All apportionments and calculations associated with these transactions will be recalculated.
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              lineHeight: 1.4,
              userSelect: 'none',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <input 
                type="checkbox"
                checked={highRiskUnderstandChecked}
                onChange={(e) => setHighRiskUnderstandChecked(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>I understand that this action is irreversible and permanently removes these records from the server.</span>
            </label>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              fontWeight: 600,
              color: highRiskTimer > 0 ? 'var(--text-secondary)' : 'var(--success)'
            }}>
              {highRiskTimer > 0 ? (
                <span>⏳ Please wait {highRiskTimer} seconds to confirm...</span>
              ) : (
                <span>✅ Safety verification unlocked. You may confirm.</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={highRiskTimer > 0 || !highRiskUnderstandChecked}
                onClick={handleExecuteHighRiskAction}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (highRiskTimer > 0 || !highRiskUnderstandChecked) ? 'var(--bg-secondary)' : 'var(--danger)',
                  borderColor: (highRiskTimer > 0 || !highRiskUnderstandChecked) ? 'var(--border-color)' : 'var(--danger)',
                  color: (highRiskTimer > 0 || !highRiskUnderstandChecked) ? 'var(--text-muted)' : '#ffffff',
                  opacity: (highRiskTimer > 0 || !highRiskUnderstandChecked) ? 0.6 : 1,
                  cursor: (highRiskTimer > 0 || !highRiskUnderstandChecked) ? 'not-allowed' : 'pointer'
                }}
              >
                Confirm Deletion
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowHighRiskModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Allocation Modal Overlay */}
      {allocatingRowId !== null && allocatingRowId !== 'manual' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10050,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {allocatingRowId === 'bulk' ? 'Bulk Allocate Cost Centers' : 'Select Target Allocation Cost Center'}
                </h3>
              </div>
              <button type="button" onClick={() => setAllocatingRowIdLocal(null)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" placeholder="Search allocation targets by name..." value={allocationSearch} onChange={(e) => setAllocationSearchLocal(e.target.value)} style={{ fontSize: '12px', padding: '8px', width: '100%' }} />
            </div>

            {allocatingType !== 'global' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Split Allocation Mode:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAllocatingModeLocal('auto')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'auto' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'auto' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Automatic (Staff Weighted)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocatingModeLocal('manual')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'manual' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'manual' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Manual Override (%)
                  </button>
                </div>
              </div>
            )}

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                onClick={() => {
                  setAllocatingTypeLocal('global');
                  setAllocatingTargetLocal([]);
                  setAllocatingStaffIdsLocal([]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  backgroundColor: allocatingType === 'global' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: allocatingType === 'global' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <input type="radio" checked={allocatingType === 'global'} readOnly />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>🌎 Whole Corporate Group</div>
                </div>
              </div>

              <div>
                <div onClick={() => setExpandedSectionsLocal(prev => ({ ...prev, company: !prev.company }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>🏢 Companies {allocatingType === 'company' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.company && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {companies.filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase())).map(c => {
                      const isChecked = allocatingType === 'company' && allocatingTarget.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{c.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[c.id] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualSharesLocal(prev => ({ ...prev, [c.id]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'company' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(c.id);
                                } else {
                                  current = current.filter(id => id !== c.id);
                                }
                                setAllocatingTypeLocal('company');
                                setAllocatingTargetLocal(current);
                                setAllocatingStaffIdsLocal([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSectionsLocal(prev => ({ ...prev, department: !prev.department }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>📂 Departments {allocatingType === 'department' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.department && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {allAvailableDepts.filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase())).map(d => {
                      const isChecked = allocatingType === 'department' && allocatingTarget.includes(d);
                      return (
                        <label key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{d}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[d] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualSharesLocal(prev => ({ ...prev, [d]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'department' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(d);
                                } else {
                                  current = current.filter(id => id !== d);
                                }
                                setAllocatingTypeLocal('department');
                                setAllocatingTargetLocal(current);
                                setAllocatingStaffIdsLocal([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSectionsLocal(prev => ({ ...prev, staff: !prev.staff }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>👥 Staff / Users Seats {allocatingType === 'staff' && `(${allocatingStaffIds.length} selected)`}</span>
                </div>
                {expandedSections.staff && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                    
                    {/* Load Seat Users from Vendor Contract Button */}
                    {(() => {
                      const currentExp = expenses.find(e => e.id === allocatingRowId);
                      const vendorObj = currentExp ? vendors.find(v => v.id === currentExp.recipientId || (currentExp.payee && currentExp.payee.toLowerCase().includes(v.name.toLowerCase()))) : null;
                      if (!vendorObj) return null;

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            // Find assigned staff IDs for this vendor
                            const vendorContracts = contracts.filter(c => c.vendorId === vendorObj.id || (c.vendorName && c.vendorName.toLowerCase().includes(vendorObj.name.toLowerCase())));
                            const vContractIds = vendorContracts.map(c => c.id);
                            
                            const assignedStaffIds = assetAssignments
                              .filter(a => vContractIds.includes(a.contractId))
                              .map(a => a.staffId)
                              .filter(Boolean);

                            // Also check contract splits for user targets
                            vendorContracts.forEach(c => {
                              (c.splits || []).forEach((sp: any) => {
                                if (sp.type === 'user' && sp.targetId && !assignedStaffIds.includes(sp.targetId)) {
                                  assignedStaffIds.push(sp.targetId);
                                }
                              });
                            });

                            if (assignedStaffIds.length > 0) {
                              setAllocatingTypeLocal('staff');
                              setAllocatingStaffIdsLocal(assignedStaffIds);
                              setAllocatingTargetLocal([]);
                              onShowToast(`⚡ Auto-loaded ${assignedStaffIds.length} seat users from Vendor Asset (${vendorObj.name})!`, "success");
                            } else {
                              onShowToast(`No assigned seat users found for Vendor "${vendorObj.name}" in Vendor Management.`, "info");
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid var(--primary)',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%'
                          }}
                        >
                          ⚡ Load Seat Users from Vendor Asset ({vendorObj.name})
                        </button>
                      );
                    })()}

                    {/* Per-User Cost Apportionment Real-Time Summary */}
                    {allocatingType === 'staff' && allocatingStaffIds.length > 0 && (() => {
                      const currentExp = expenses.find(e => e.id === allocatingRowId);
                      const amount = currentExp ? toGBP(currentExp.amount, currentExp.currency || 'GBP') : 0;
                      const perUserCost = amount > 0 ? (amount / allocatingStaffIds.length) : 0;
                      const userPct = (100 / allocatingStaffIds.length).toFixed(1);

                      return (
                        <div style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--primary)' }}>
                            <span>Per-User Seat Cost:</span>
                            <span>£{perUserCost.toFixed(2)} / user ({userPct}%)</span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            Total Expense (£{amount.toLocaleString()}) split across {allocatingStaffIds.length} assigned staff users.
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {staff.filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase())).map(s => {
                        const isChecked = allocatingType === 'staff' && allocatingStaffIds.includes(s.id);
                        return (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                            <span>{s.fullName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({s.department || 'Staff'})</span></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isChecked && allocatingMode === 'manual' && (
                                <input 
                                  type="number" 
                                  value={allocatingManualShares[s.id] || ''} 
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                    setAllocatingManualSharesLocal(prev => ({ ...prev, [s.id]: val }));
                                  }} 
                                  style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                                />
                              )}
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={(e) => {
                                  let current = allocatingType === 'staff' ? [...allocatingStaffIds] : [];
                                  if (e.target.checked) {
                                    current.push(s.id);
                                  } else {
                                    current = current.filter(id => id !== s.id);
                                  }
                                  setAllocatingTypeLocal('staff');
                                  setAllocatingStaffIdsLocal(current);
                                  setAllocatingTargetLocal([]);
                                }} 
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={async () => {
                  let finalTarget = allocatingTarget;
                  if (allocatingType === 'company') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(tid => companies.some(c => c.id === tid));
                    if (finalTarget.length === 0 && companies[0]) {
                      finalTarget = [companies[0].id];
                    }
                  } else if (allocatingType === 'department') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(d => allAvailableDepts.includes(d));
                    if (finalTarget.length === 0 && allAvailableDepts[0]) {
                      finalTarget = [allAvailableDepts[0]];
                    }
                  } else if (allocatingType === 'staff') {
                    if (allocatingStaffIds.length === 0) {
                      onShowToast("Please select at least one staff member.", "warning");
                      return;
                    }
                    finalTarget = allocatingStaffIds;
                  }

                  if (allocatingType !== 'global' && allocatingMode === 'manual') {
                    let totalPercent = 0;
                    finalTarget.forEach(tid => {
                      totalPercent += parseInt(String(allocatingManualShares[tid] || 0), 10);
                    });
                    if (totalPercent !== 100) {
                      onShowToast(`Manual split percentages must sum to exactly 100% (currently ${totalPercent}%).`, "warning");
                      return;
                    }
                  }

                  if (allocatingRowId === 'bulk') {
                    await handleBulkUpdateAllocation(allocatingType, finalTarget, allocatingMode, allocatingManualShares);
                  } else {
                    const original = expenses.find(e => e.id === allocatingRowId);
                    if (original) {
                      await saveExpense({
                        ...original,
                        allocationType: allocatingType,
                        allocationTarget: finalTarget,
                        allocationMode: allocatingMode,
                        manualAllocationShares: allocatingManualShares
                      });
                      onShowToast("Cost allocation updated for transaction.", "success");
                    }
                  }
                  setAllocatingRowIdLocal(null);
                }}
              >
                Apply
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAllocatingRowIdLocal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
