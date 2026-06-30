import React, { useState } from 'react';
import { toGBP } from '../utils/currency';
import { 
  Building2, 
  Plus, 
  Trash2, 
  FileText, 
  UploadCloud, 
  Eye, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Grid,
  Info,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  Edit3,
  Search,
  Check,
  XCircle,
  HelpCircle,
  PlusCircle,
  Link,
  ArrowRight,
  Settings,
  Clock
} from 'lucide-react';

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

const DEPARTMENTS = ["Sales", "Technology", "Recruitment", "HR", "Finance", "Legal", "Marketing", "Corporate"];

export default function ExpensesDashboard({
  companies = [],
  staff = [],
  placements = [],
  expenses = [],
  nominalCodes = [],
  onSaveExpense,
  onDeleteExpense,
  onSaveNominalCode,
  onDeleteNominalCode,
  onSavePlacement,
  onShowToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('ledger'); // ledger, statement, settings

  // Normalize nominal codes to handle any legacy string arrays gracefully
  const activeNominalCodes = (nominalCodes || []).map(c => {
    if (typeof c === 'string') {
      const parts = c.split(' - ');
      return { id: parts[0] || c, code: c };
    }
    if (c && typeof c === 'object') {
      return {
        id: c.id || '',
        code: c.code || ''
      };
    }
    return null;
  }).filter(c => c && c.code);

  // Ledger Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [nominalFilter, setNominalFilter] = useState('all');
  const [plMonthFilter, setPlMonthFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');

  // Sorting state for expenses ledger table
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc

  const handleHeaderClick = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const sortExpenses = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';

      if (sortBy === 'amount' || sortBy === 'taxRate') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortBy === 'date') {
        valA = new Date(valA || '1970-01-01');
        valB = new Date(valB || '1970-01-01');
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    }
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // Manual Expense Form states
  const [showForm, setShowForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [date, setDate] = useState('');
  const [plMonth, setPlMonth] = useState('');
  const [payee, setPayee] = useState('');
  const [nominalCode, setNominalCode] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [taxRate, setTaxRate] = useState('20');
  const [description, setDescription] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceUrl, setInvoiceUrl] = useState('#');

  // Allocation targets
  const [allocationType, setAllocationType] = useState('company'); // company, department, staff
  const [allocationTarget, setAllocationTarget] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);

  // Linked placement/sales invoice (for credits)
  const [linkedPlacementId, setLinkedPlacementId] = useState('');
  const [showPlacementSelector, setShowPlacementSelector] = useState(false);

  // Recipient linkage states (manual entry)
  const [recipientType, setRecipientType] = useState('other'); // vendor, staff, other
  const [recipientId, setRecipientId] = useState('');

  // Target Allocation Modal states
  const [allocatingRowId, setAllocatingRowId] = useState(null); // row.id or 'manual'
  const [allocationSearch, setAllocationSearch] = useState('');
  const [allocatingType, setAllocatingType] = useState('company');
  const [allocatingTarget, setAllocatingTarget] = useState('');
  const [allocatingStaffIds, setAllocatingStaffIds] = useState([]);

  // Quick Vendor Registration Modal states
  const [quickVendorRowId, setQuickVendorRowId] = useState(null);
  const [quickVendorName, setQuickVendorName] = useState('');
  const [quickVendorCategory, setQuickVendorCategory] = useState('Software License');

  // Bank Statement Categorizer states
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [categorizedRows, setCategorizedRows] = useState([]);
  const [importStep, setImportStep] = useState(1); // 1: upload, 2: map cols, 3: row categorizer

  // Nominal Code setting states
  const [newNominalCodeId, setNewNominalCodeId] = useState('');
  const [newNominalCodeName, setNewNominalCodeName] = useState('');

  // Handle Edit Expense
  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp.id);
    setDate(exp.date);
    setPlMonth(exp.plMonth);
    setPayee(exp.payee);
    setNominalCode(exp.nominalCode);
    setAmount(String(exp.amount));
    setCurrency(exp.currency || 'GBP');
    setTaxRate(String(exp.taxRate || 0));
    setDescription(exp.description || '');
    setInvoiceUrl(exp.invoiceUrl || '#');
    setAllocationType(exp.allocationType || 'company');
    setRecipientType(exp.recipientType || 'other');
    setRecipientId(exp.recipientId || '');

    if (exp.allocationType === 'staff') {
      setSelectedStaffIds(Array.isArray(exp.allocationTarget) ? exp.allocationTarget : []);
      setAllocationTarget('');
    } else {
      setAllocationTarget(String(exp.allocationTarget || ''));
      setSelectedStaffIds([]);
    }

    setLinkedPlacementId(exp.linkedPlacementId || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Expense Form
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    if (!date || !plMonth || !payee.trim() || !nominalCode || !amount) {
      onShowToast("Please enter all required transaction fields.", "warning");
      return;
    }

    let target = allocationTarget;
    if (allocationType === 'staff') {
      if (selectedStaffIds.length === 0) {
        onShowToast("Please select at least one staff member for allocation.", "warning");
        return;
      }
      target = selectedStaffIds;
    } else if (!target) {
      onShowToast("Please select an allocation target (company or department).", "warning");
      return;
    }

    // Attach invoice reader if drag dropped
    let resolvedInvoiceUrl = invoiceUrl;
    if (invoiceFile) {
      resolvedInvoiceUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(invoiceFile);
      });
    }

    const expenseData = {
      id: editingExpenseId || `exp-${Date.now()}`,
      date,
      plMonth,
      payee: payee.trim(),
      nominalCode,
      amount: Number(amount),
      currency,
      taxRate: Number(taxRate) || 0,
      description: description.trim(),
      invoiceUrl: resolvedInvoiceUrl,
      recipientType,
      recipientId,
      allocationType,
      allocationTarget: target,
      linkedPlacementId: linkedPlacementId || null
    };

    try {
      await onSaveExpense(expenseData);

      // If a placement is linked, and this transaction is a payment credit, update the placement payment state!
      if (linkedPlacementId) {
        const matchedPlacement = placements.find(p => p.id === linkedPlacementId);
        if (matchedPlacement && matchedPlacement.clientPaymentStatus !== 'paid') {
          const updatedPlacement = {
            ...matchedPlacement,
            clientPaymentStatus: 'paid',
            clientPaidDate: date
          };
          await onSavePlacement(updatedPlacement);
          onShowToast(`Linked sales credit: Placement ${matchedPlacement.placementId} marked as client paid on ${date}.`, "success");
        }
      }

      onShowToast(
        editingExpenseId 
          ? `Updated expense transaction payee "${payee}"` 
          : `Expense transaction recorded successfully!`, 
        "success"
      );

      // Reset
      setDate('');
      setPlMonth('');
      setPayee('');
      setNominalCode('');
      setAmount('');
      setCurrency('GBP');
      setTaxRate('20');
      setDescription('');
      setInvoiceFile(null);
      setInvoiceUrl('#');
      setRecipientType('other');
      setRecipientId('');
      setAllocationType('company');
      setAllocationTarget('');
      setSelectedStaffIds([]);
      setLinkedPlacementId('');
      setEditingExpenseId(null);
      setShowForm(false);
    } catch (err) {
      onShowToast(`Error saving transaction: ${err.message}`, "warning");
    }
  };

  // Toggle Staff Selection for Allocation
  const handleToggleStaffAllocation = (staffId) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  // Nominals Managers Submit
  const handleNominalSubmit = async (e) => {
    e.preventDefault();
    if (!newNominalCodeId.trim() || !newNominalCodeName.trim()) {
      onShowToast("Please enter both nominal code and description name.", "warning");
      return;
    }

    const codeStr = `${newNominalCodeId.trim()} - ${newNominalCodeName.trim()}`;
    const exists = activeNominalCodes.some(c => c.id === newNominalCodeId.trim() || String(c.code || '').toLowerCase() === codeStr.toLowerCase());
    
    if (exists) {
      onShowToast("A nominal code with this key or description name already exists.", "warning");
      return;
    }

    try {
      await onSaveNominalCode({
        id: newNominalCodeId.trim(),
        code: codeStr
      });
      onShowToast(`Added Nominal code: ${codeStr}`, "success");
      setNewNominalCodeId('');
      setNewNominalCodeName('');
    } catch (err) {
      onShowToast(`Error creating Nominal: ${err.message}`, "warning");
    }
  };

  // CSV Bank Statement parser
  const handleCSVDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processBankStatementFile(e.dataTransfer.files[0]);
    }
  };

  const handleCSVSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processBankStatementFile(e.target.files[0]);
    }
  };

  const processBankStatementFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        onShowToast("Bank statement file is empty or invalid.", "warning");
        return;
      }

      // Simple CSV line parser
      const parseCSVLine = (txt) => {
        const result = [];
        let startIdx = 0;
        let insideQuotes = false;
        for (let i = 0; i < txt.length; i++) {
          const char = txt[i];
          if (char === '"') insideQuotes = !insideQuotes;
          else if (char === ',' && !insideQuotes) {
            let val = txt.substring(startIdx, i).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
            result.push(val);
            startIdx = i + 1;
          }
        }
        let lastVal = txt.substring(startIdx).trim();
        if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.substring(1, lastVal.length - 1);
        result.push(lastVal);
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length === headers.length) {
          rows.push(cols);
        }
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvFile(file);

      // Auto-detect columns
      const initialMap = {};
      const mappingsList = [
        { key: 'date', labels: ['date', 'transaction date', 'booking date', 'val date'] },
        { key: 'payee', labels: ['description', 'payee', 'beneficiary', 'details', 'name'] },
        { key: 'amount', labels: ['amount', 'value', 'transaction amount', 'net amount', 'price'] },
        { key: 'reference', labels: ['reference', 'memo', 'ref', 'narrative', 'payment reference'] }
      ];

      mappingsList.forEach(m => {
        const idx = headers.findIndex(h => h && m.labels.some(lbl => h.toLowerCase() === lbl.toLowerCase()));
        if (idx > -1) initialMap[m.key] = headers[idx];
      });

      setColumnMappings(initialMap);
      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const handleApplyBankMappings = () => {
    if (!columnMappings.date || !columnMappings.payee || !columnMappings.amount) {
      onShowToast("Please map the required Date, Payee, and Amount fields.", "warning");
      return;
    }

    const dateColIdx = csvHeaders.indexOf(columnMappings.date);
    const payeeColIdx = csvHeaders.indexOf(columnMappings.payee);
    const amountColIdx = csvHeaders.indexOf(columnMappings.amount);
    const refColIdx = columnMappings.reference ? csvHeaders.indexOf(columnMappings.reference) : -1;

    const parsedRows = csvRows.map((row, idx) => {
      const dateVal = row[dateColIdx] || '';
      const payeeVal = row[payeeColIdx] || '';
      const amtVal = Number(String(row[amountColIdx]).replace(/[^0-9.-]/g, '')) || 0;
      const refVal = refColIdx > -1 ? row[refColIdx] || '' : '';
      
      const parts = dateVal.split(/[-/]/);
      let yyyymm = new Date().toISOString().substring(0, 7);
      if (parts.length >= 3) {
        const year = parts[0].length === 4 ? parts[0] : parts[2];
        const month = parts[0].length === 4 ? parts[1] : parts[1];
        yyyymm = `${year}-${String(month).padStart(2, '0')}`;
      }

      return {
        id: `stmt-row-${idx}-${Date.now()}`,
        date: dateVal,
        plMonth: yyyymm,
        payee: payeeVal,
        reference: refVal,
        amount: amtVal,
        nominalCode: '',
        allocationType: 'company',
        allocationTarget: companies[0]?.id || '',
        selectedStaffIds: [],
        linkedPlacementId: '',
        isCredit: amtVal > 0,
        committed: false
      };
    });

    setCategorizedRows(parsedRows);
    setImportStep(3);
  };

  // Modify row values during bank statement categorizer row mapping
  const handleUpdateCategorizedRow = (rowId, field, value) => {
    setCategorizedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  // Commit categorized bank statements
  const handleCommitBankImports = async () => {
    const mRows = categorizedRows.filter(r => r.nominalCode && !r.committed);
    if (mRows.length === 0) {
      onShowToast("Please map at least one row with a Nominal code before committing.", "warning");
      return;
    }

    try {
      for (const row of mRows) {
        const isStaff = row.allocationType === 'staff';
        const target = isStaff ? row.selectedStaffIds : row.allocationTarget;

        const expenseData = {
          id: `exp-stmt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          date: row.date,
          plMonth: row.plMonth,
          payee: row.payee + (row.reference ? ` [Ref: ${row.reference}]` : ''),
          nominalCode: row.nominalCode,
          amount: Math.abs(row.amount), // gross amount is absolute
          currency: "GBP",
          taxRate: 20, // default tax
          invoiceUrl: "#",
          allocationType: row.allocationType,
          allocationTarget: target,
          linkedPlacementId: row.linkedPlacementId || null
        };

        await onSaveExpense(expenseData);

        // If a placement is linked, mark it as client paid!
        if (row.linkedPlacementId) {
          const matchedPlacement = placements.find(p => p.id === row.linkedPlacementId);
          if (matchedPlacement) {
            await onSavePlacement({
              ...matchedPlacement,
              clientPaymentStatus: 'paid',
              clientPaidDate: row.date
            });
          }
        }
      }

      onShowToast(`Successfully imported and logged ${mRows.length} bank transactions.`, "success");
      
      // Update rows status
      setCategorizedRows(prev => prev.map(r => {
        if (r.nominalCode) {
          return { ...r, committed: true };
        }
        return r;
      }));

      // If all rows committed, reset
      if (categorizedRows.every(r => r.nominalCode || r.committed)) {
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setCategorizedRows([]);
        setImportStep(1);
        setActiveSubTab('ledger');
      }
    } catch (err) {
      onShowToast(`Error committing statement rows: ${err.message}`, "warning");
    }
  };

  // Filter nominal codes & placements lists
  const unpaidPlacements = placements.filter(p => p.clientPaymentStatus !== 'paid' && p.netScoreValue > 0);

  // Filter Ledger transactions list
  const filteredExpenses = (expenses || []).filter(exp => {
    if (!exp) return false;
    const expNominal = exp.nominalCode || '';
    const expPlMonth = exp.plMonth || '';

    if (nominalFilter !== 'all' && expNominal !== nominalFilter) return false;
    if (plMonthFilter !== 'all' && expPlMonth !== plMonthFilter) return false;

    // Company filter
    if (companyFilter !== 'all') {
      if (exp.allocationType !== 'company' || exp.allocationTarget !== companyFilter) return false;
    }

    // Department filter
    if (deptFilter !== 'all') {
      if (exp.allocationType !== 'department' || exp.allocationTarget !== deptFilter) return false;
    }

    // Staff filter
    if (staffFilter !== 'all') {
      if (exp.allocationType !== 'staff') return false;
      const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
      if (!ids.includes(staffFilter)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPayee = String(exp.payee || '').toLowerCase().includes(q);
      const matchDesc = String(exp.description || '').toLowerCase().includes(q);
      const matchNom = String(exp.nominalCode || '').toLowerCase().includes(q);
      return matchPayee || matchDesc || matchNom;
    }
    return true;
  });

  const sortedExpenses = sortExpenses(filteredExpenses);

  // Extract unique P&L months in expenses database
  const uniquePlMonths = Array.from(new Set((expenses || []).map(e => e?.plMonth).filter(Boolean))).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        width: 'fit-content',
        gap: '4px'
      }}>
        {[
          { key: 'ledger', label: 'Expenses Ledger Log' },
          { key: 'statement', label: 'Bank Statement Import & Categorizer' },
          { key: 'settings', label: 'Nominal Codes Setup' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              color: activeSubTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==============================================================
          SUB-TAB 1: EXPENSES REGISTRY LEDGER
          ============================================================== */}
      {activeSubTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>P&L Expenses Transaction Ledger</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Log company overheads, software licenses, staff payrolls, and track cost center allocations.</p>
            </div>
            
            <button className="btn-primary" onClick={() => {
              setEditingExpenseId(null);
              setDate('');
              setPlMonth('');
              setPayee('');
              setNominalCode('');
              setAmount('');
              setCurrency('GBP');
              setTaxRate('20');
              setDescription('');
              setInvoiceFile(null);
              setInvoiceUrl('#');
              setAllocationType('company');
              setAllocationTarget(companies[0]?.id || '');
              setSelectedStaffIds([]);
              setLinkedPlacementId('');
              setShowForm(prev => !prev);
            }}>
              <Plus size={16} /> {showForm ? 'Close Form' : 'Log Expense'}
            </button>
          </div>

          {/* Log Expense Form */}
          {showForm && (
            <form onSubmit={handleExpenseSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> {editingExpenseId ? 'Modify Expense Transaction' : 'Record Overhead Expense'}
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Transaction Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Relates to P&L Month <span>*</span></label>
                  <input 
                    type="month" 
                    className="form-input" 
                    value={plMonth}
                    onChange={(e) => setPlMonth(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Determines which financial period absorbs this cost.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Payee / Recipient Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. LinkedIn, Apex Properties"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Link to Registered Vendor or Staff</label>
                  <select
                    className="select-filter"
                    value={recipientType !== 'other' ? `${recipientType}:${recipientId}` : 'other'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'other') {
                        setRecipientType('other');
                        setRecipientId('');
                      } else {
                        const [type, id] = val.split(':');
                        setRecipientType(type);
                        setRecipientId(id);
                        if (type === 'vendor') {
                          const v = vendors.find(item => item.id === id);
                          if (v) setPayee(v.name);
                        } else if (type === 'staff') {
                          const s = staff.find(item => item.id === id);
                          if (s) setPayee(s.fullName);
                        }
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="other">-- No Linkage / General Payee --</option>
                    <optgroup label="Registered Vendors">
                      {vendors.map(v => (
                        <option key={v.id} value={`vendor:${v.id}`}>{v.name} ({v.category})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Staff / Consultants">
                      {staff.map(s => (
                        <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Nominal Ledger Category <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={nominalCode}
                    onChange={(e) => setNominalCode(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Nominal Code --</option>
                    {activeNominalCodes.map(c => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (Gross Value) <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Value"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select 
                    className="select-filter"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {CURRENCIES.map(curr => (
                      <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Tax / VAT Rate (%)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 20"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Drag or drop supporting Invoice / Receipt</label>
                  <input 
                    type="file" 
                    className="form-input"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                    style={{ padding: '6px' }}
                  />
                </div>
              </div>

              {/* Allocation target section */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="form-label">Cost Allocation Target <span>*</span></label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAllocatingRowId('manual');
                      setAllocatingType(allocationType);
                      setAllocatingTarget(allocationTarget);
                      setAllocatingStaffIds(selectedStaffIds);
                      setAllocationSearch('');
                    }}
                    style={{ 
                      padding: '10px', 
                      width: '100%', 
                      textAlign: 'left',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {(() => {
                        if (allocationType === 'company') {
                          const comp = companies.find(c => c.id === allocationTarget);
                          return `🏢 Company Target: ${comp ? comp.name : 'Click to select Company'}`;
                        }
                        if (allocationType === 'department') {
                          return `📂 Department Cost Center: ${allocationTarget || 'Click to select Department'}`;
                        }
                        if (allocationType === 'staff') {
                          const count = selectedStaffIds?.length || 0;
                          return `👥 Staff Cost splits: ${count} recruiter${count !== 1 ? 's' : ''} selected`;
                        }
                        return '🎯 Click to Select Target Allocation...';
                      })()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Modify Target</span>
                  </button>
                </div>
              </div>

              {/* Linked Credit to Placement Sales Receipt */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox"
                    id="link-credit-checkbox"
                    checked={showPlacementSelector || linkedPlacementId !== ''}
                    onChange={(e) => setShowPlacementSelector(e.target.checked)}
                  />
                  <label htmlFor="link-credit-checkbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                    This transaction is a Client Payment Credit (settles sales invoice)
                  </label>
                </div>

                {(showPlacementSelector || linkedPlacementId !== '') && (
                  <div className="form-group" style={{ marginTop: '12px', maxWidth: '400px', animation: 'fadeIn 0.2s' }}>
                    <label className="form-label">Link to Unpaid Candidate Placement Invoice</label>
                    <select
                      className="select-filter"
                      value={linkedPlacementId}
                      onChange={(e) => setLinkedPlacementId(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      <option value="">-- Choose Placements Invoice --</option>
                      {unpaidPlacements.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.placementId} - {p.candidateName} ({p.clientCompany}) - £{p.netScoreValue.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Brief Description / Notes</label>
                <textarea 
                  className="form-input" 
                  rows="2"
                  placeholder="Additional context on cost center mapping..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editingExpenseId ? 'Update Transaction' : 'Commit Expense'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowForm(false);
                  setEditingExpenseId(null);
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Filter Toolbar */}
          <div className="controls-row">
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
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="all">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Allocated</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="table-container">
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th onClick={() => handleHeaderClick('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Date {renderSortIndicator('date')}
                  </th>
                  <th onClick={() => handleHeaderClick('plMonth')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    P&L Month {renderSortIndicator('plMonth')}
                  </th>
                  <th onClick={() => handleHeaderClick('payee')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Payee / Vendor {renderSortIndicator('payee')}
                  </th>
                  <th onClick={() => handleHeaderClick('nominalCode')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Nominal Bracket {renderSortIndicator('nominalCode')}
                  </th>
                  <th>Allocation Center Target</th>
                  <th onClick={() => handleHeaderClick('taxRate')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Tax (VAT) {renderSortIndicator('taxRate')}
                  </th>
                  <th onClick={() => handleHeaderClick('amount')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Amount (Gross) {renderSortIndicator('amount')}
                  </th>
                  <th>Linked Receipt</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map(exp => {
                  const symbol = symbolMap[exp.currency] || '£';
                  
                  // Resolve Allocation Label
                  let allocationLabel = 'Whole Corporate Group';
                  if (exp.allocationType === 'company') {
                    const comp = companies.find(c => c.id === exp.allocationTarget);
                    allocationLabel = comp ? `Corp: ${comp.name}` : 'Corporate';
                  } else if (exp.allocationType === 'department') {
                    allocationLabel = `Dept: ${exp.allocationTarget}`;
                  } else if (exp.allocationType === 'staff') {
                    const ids = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
                    allocationLabel = `Staff: ${ids.length} recruiters`;
                  }

                  const matchedPl = placements.find(p => p.id === exp.linkedPlacementId);

                  return (
                    <tr key={exp.id}>
                      <td>{exp.date}</td>
                      <td style={{ fontWeight: 600 }}>{exp.plMonth}</td>
                      <td style={{ fontWeight: 600 }}>{exp.payee}</td>
                      <td style={{ fontSize: '11px' }}>{exp.nominalCode}</td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 500, 
                          color: exp.allocationType === 'staff' ? 'var(--warning)' : exp.allocationType === 'department' ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>
                          {allocationLabel}
                        </span>
                        {exp.description && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{exp.description}</div>}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{exp.taxRate}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: exp.nominalCode.includes('Wages') || exp.nominalCode.includes('Rent') ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {exp.currency === 'GBP' ? (
                          `£${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          `£${toGBP(exp.amount, exp.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${symbol}${exp.amount.toLocaleString()})`
                        )}
                      </td>
                      <td>
                        {matchedPl ? (
                          <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }} title={`Settles placement invoice ${matchedPl.placementId}`}>
                            Settle: {matchedPl.placementId}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
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
                                onDeleteExpense(exp.id);
                                onShowToast("Deleted transaction.", "info");
                              }
                            }}
                            title="Delete transaction"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No expenses logged matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 2: BANK STATEMENT IMPORT
          ============================================================== */}
      {activeSubTab === 'statement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Bank Statement Import & Categorizer</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Upload your corporate bank statements (CSV/Excel) and map transactions to Nominal codes and allocations row-by-row.</p>
          </div>

          {importStep === 1 && (
            <div 
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCSVDrop}
              onClick={() => document.getElementById('statement-file-picker').click()}
              style={{ padding: '40px', borderStyle: 'dashed', borderRadius: '8px', cursor: 'pointer' }}
            >
              <input 
                type="file" 
                id="statement-file-picker" 
                accept=".csv" 
                style={{ display: 'none' }}
                onChange={handleCSVSelect}
              />
              <UploadCloud size={48} className="upload-icon" style={{ marginBottom: '16px' }} />
              <span className="upload-text" style={{ fontSize: '16px', fontWeight: 600 }}>Drag and drop statement CSV here or Browse</span>
              <span className="upload-subtext" style={{ marginTop: '8px' }}>Supported header keys: Date, Description/Payee, Amount (credits & debits)...</span>
            </div>
          )}

          {importStep === 2 && (
            <div className="detail-section" style={{ animation: 'fadeIn 0.2s' }}>
              <div className="section-title">
                <Grid size={16} /> Map CSV Headers
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                We parsed headers of file **{csvFile?.name}**. Map them to target categories below:
              </p>

              <div className="form-group-row">
                {[
                  { key: 'date', label: 'Transaction Date *' },
                  { key: 'payee', label: 'Payee / Description *' },
                  { key: 'amount', label: 'Value Amount *' },
                  { key: 'reference', label: 'Reference / Memo (Optional)' }
                ].map(item => (
                  <div key={item.key} className="form-group">
                    <label className="form-label">{item.label}</label>
                    <select
                      className="select-filter"
                      value={columnMappings[item.key] || ''}
                      onChange={(e) => setColumnMappings(prev => ({ ...prev, [item.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      <option value="">-- Choose Column --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn-primary" onClick={handleApplyBankMappings}>
                  Validate & Parse Rows
                </button>
                <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>
                  Back
                </button>
              </div>
            </div>
          )}

          {importStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Row-by-Row Categorization Desk</h3>
                <button className="btn-primary" onClick={handleCommitBankImports}>
                  Commit Mapped Rows ({categorizedRows.filter(r => r.nominalCode && !r.committed).length} rows)
                </button>
              </div>

              <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <table className="entity-table dense" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Description & Ref</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>P&L Month</th>
                      <th>Nominal Category</th>
                      <th>Recipient Linkage</th>
                      <th>Target Allocation</th>
                      <th>Link credit sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedRows.map((row) => (
                      <tr key={row.id} style={{ opacity: row.committed ? 0.6 : 1, backgroundColor: row.committed ? 'var(--bg-secondary)' : 'none' }}>
                        <td>
                          {row.committed ? (
                            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                          ) : row.nominalCode ? (
                            <Check size={14} style={{ color: 'var(--warning)' }} />
                          ) : (
                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </td>
                        <td>{row.date}</td>
                        <td style={{ fontWeight: 600 }}>
                          {row.payee}
                          {row.reference && (
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                              Ref: {row.reference}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: row.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                          £{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* P&L Month Selector */}
                        <td>
                          <input 
                            type="month"
                            value={row.plMonth}
                            onChange={(e) => handleUpdateCategorizedRow(row.id, 'plMonth', e.target.value)}
                            disabled={row.committed}
                            style={{ padding: '4px', fontSize: '11px', width: '110px' }}
                          />
                        </td>

                        {/* Nominal Category Selector */}
                        <td>
                          <select
                            value={row.nominalCode}
                            onChange={(e) => handleUpdateCategorizedRow(row.id, 'nominalCode', e.target.value)}
                            disabled={row.committed}
                            style={{ padding: '4px', fontSize: '11px', width: '160px' }}
                          >
                            <option value="">-- Unmapped --</option>
                             {activeNominalCodes.map(c => (
                              <option key={c.id} value={c.code}>{c.code}</option>
                            ))}
                          </select>
                        </td>

                        {/* Recipient Linkage (Vendor/Staff) */}
                        <td>
                          <select
                            value={row.recipientType !== 'other' ? `${row.recipientType}:${row.recipientId}` : 'other'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'other') {
                                handleUpdateCategorizedRow(row.id, 'recipientType', 'other');
                                handleUpdateCategorizedRow(row.id, 'recipientId', '');
                              } else if (val === 'register_vendor') {
                                setQuickVendorRowId(row.id);
                                setQuickVendorName(row.payee);
                                setQuickVendorCategory('Software License');
                              } else {
                                const [type, id] = val.split(':');
                                handleUpdateCategorizedRow(row.id, 'recipientType', type);
                                handleUpdateCategorizedRow(row.id, 'recipientId', id);
                              }
                            }}
                            disabled={row.committed}
                            style={{ padding: '4px', fontSize: '11px', width: '150px' }}
                          >
                            <option value="other">-- General Recipient --</option>
                            <option value="register_vendor" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                              ➕ Register "{row.payee}"...
                            </option>
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
                        </td>

                        {/* Target Selector Button */}
                        <td>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setAllocatingRowId(row.id);
                              setAllocatingType(row.allocationType || 'company');
                              setAllocatingTarget(row.allocationTarget || '');
                              setAllocatingStaffIds(row.selectedStaffIds || []);
                              setAllocationSearch('');
                            }}
                            disabled={row.committed}
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '11px', 
                              width: '130px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              textAlign: 'left'
                            }}
                          >
                            {(() => {
                              if (row.allocationType === 'company') {
                                const comp = companies.find(c => c.id === row.allocationTarget);
                                return `🏢 ${comp ? comp.name : 'Choose Company'}`;
                              }
                              if (row.allocationType === 'department') {
                                return `📂 Dept: ${row.allocationTarget || 'Choose Dept'}`;
                              }
                              if (row.allocationType === 'staff') {
                                const count = row.selectedStaffIds?.length || 0;
                                return `👥 ${count} staff split${count !== 1 ? 's' : ''}`;
                              }
                              return '🎯 Click to Allocate';
                            })()}
                          </button>
                        </td>

                        {/* Link Credit to placement sales invoice */}
                        <td>
                          {row.isCredit ? (
                            <select
                              value={row.linkedPlacementId}
                              onChange={(e) => handleUpdateCategorizedRow(row.id, 'linkedPlacementId', e.target.value)}
                              disabled={row.committed}
                              style={{ padding: '4px', fontSize: '11px', width: '130px', borderColor: 'var(--success)' }}
                            >
                              <option value="">-- No Link --</option>
                              {unpaidPlacements.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.placementId} ({p.clientCompany})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Debit</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setImportStep(2)}>
                  Back to Mappings
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: NOMINAL SETTINGS
          ============================================================== */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Nominal Codes Manager</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage the nominal ledger codes for categorization of bank statements and manual expense inputs.</p>
            </div>
          </div>

          <form onSubmit={handleNominalSubmit} className="detail-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="section-title">
              <PlusCircle size={14} /> Add Nominal Category
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label">Nominal Code ID (Key) <span>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 7011"
                  value={newNominalCodeId}
                  onChange={(e) => setNewNominalCodeId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Nominal Code Name / Description <span>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Marketing & Advertising Overhead"
                  value={newNominalCodeName}
                  onChange={(e) => setNewNominalCodeName(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
              Create Nominal Bracket
            </button>
          </form>

          {/* Nominal Codes List */}
          <div style={{ maxWidth: '600px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Active Nominal Ledger Bracket Registry</h3>
            <div className="table-container">
              <table className="entity-table dense" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Nominal Code ID</th>
                    <th>Nominal Code Label</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeNominalCodes.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.id}</td>
                      <td>{c.code}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-icon delete" 
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete Nominal Code "${c.code}"?`)) {
                                onDeleteNominalCode(c.id);
                                onShowToast(`Deleted Nominal category: ${c.code}`, "info");
                              }
                            }}
                            title="Delete nominal code"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeNominalCodes.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                        No nominal categories initialized. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==============================================================
          MODAL: TARGET ALLOCATION MULTI-SELECT DESK
          ============================================================== */}
      {allocatingRowId !== null && (
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
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '550px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Select Target Allocation Cost Center</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Assign where this expense amount should be routed.
                </span>
              </div>
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => setAllocatingRowId(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Switch Tabs for Company, Department, Staff */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '2px',
              width: '100%',
              gap: '2px'
            }}>
              {[
                { key: 'company', label: '🏢 Companies' },
                { key: 'department', label: '📂 Departments' },
                { key: 'staff', label: '👥 Staff Splits' }
              ].map(t => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => setAllocatingType(t.key)}
                  style={{
                    flex: 1,
                    background: allocatingType === t.key ? 'var(--bg-sidebar)' : 'none',
                    border: 'none',
                    color: allocatingType === t.key ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search filter box */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search targets by name..."
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
                style={{ fontSize: '12px', padding: '8px' }}
              />
            </div>

            {/* List Container */}
            <div style={{ 
              maxHeight: '250px', 
              overflowY: 'auto', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px', 
              backgroundColor: 'var(--bg-sidebar)',
              padding: '8px'
            }}>
              {allocatingType === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {companies
                    .filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                    .map(c => (
                      <label 
                        key={c.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '8px', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          backgroundColor: allocatingTarget === c.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          border: allocatingTarget === c.id ? '1px solid var(--primary)' : '1px solid transparent'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: allocatingTarget === c.id ? 600 : 'normal' }}>{c.name}</span>
                        <input 
                          type="radio" 
                          name="allocating-company"
                          checked={allocatingTarget === c.id} 
                          onChange={() => setAllocatingTarget(c.id)}
                        />
                      </label>
                    ))}
                  {companies.filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>No matching companies.</div>
                  )}
                </div>
              )}

              {allocatingType === 'department' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {DEPARTMENTS
                    .filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase()))
                    .map(d => (
                      <label 
                        key={d} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '8px', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          backgroundColor: allocatingTarget === d ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          border: allocatingTarget === d ? '1px solid var(--primary)' : '1px solid transparent'
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: allocatingTarget === d ? 600 : 'normal' }}>{d}</span>
                        <input 
                          type="radio" 
                          name="allocating-department"
                          checked={allocatingTarget === d} 
                          onChange={() => setAllocatingTarget(d)}
                        />
                      </label>
                    ))}
                  {DEPARTMENTS.filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>No matching departments.</div>
                  )}
                </div>
              )}

              {allocatingType === 'staff' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', paddingLeft: '4px' }}>
                    Select one or more staff members to split cost:
                  </span>
                  {staff
                    .filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase()))
                    .map(s => {
                      const isChecked = allocatingStaffIds.includes(s.id);
                      return (
                        <label 
                          key={s.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '8px', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid transparent'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: isChecked ? 600 : 'normal' }}>{s.fullName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.department || 'No Dept'}</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAllocatingStaffIds(prev => [...prev, s.id]);
                              } else {
                                setAllocatingStaffIds(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                          />
                        </label>
                      );
                    })}
                  {staff.filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>No matching staff members.</div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1 }}
                onClick={() => {
                  let finalTarget = allocatingTarget;
                  if (allocatingType === 'staff') {
                    if (allocatingStaffIds.length === 0) {
                      onShowToast("Please select at least one staff member.", "warning");
                      return;
                    }
                    finalTarget = allocatingStaffIds;
                  } else {
                    if (!finalTarget) {
                      if (allocatingType === 'company') finalTarget = companies[0]?.id || '';
                      if (allocatingType === 'department') finalTarget = DEPARTMENTS[0];
                    }
                  }

                  if (allocatingRowId === 'manual') {
                    setAllocationType(allocatingType);
                    if (allocatingType === 'staff') {
                      setSelectedStaffIds(allocatingStaffIds);
                      setAllocationTarget('');
                    } else {
                      setAllocationTarget(finalTarget);
                      setSelectedStaffIds([]);
                    }
                  } else {
                    handleUpdateCategorizedRow(allocatingRowId, 'allocationType', allocatingType);
                    if (allocatingType === 'staff') {
                      handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', allocatingStaffIds);
                      handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', '');
                    } else {
                      handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', finalTarget);
                      handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', []);
                    }
                  }
                  setAllocatingRowId(null);
                }}
              >
                Apply Allocation
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setAllocatingRowId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: QUICK REGISTER VENDOR PARTNER
          ============================================================== */}
      {quickVendorRowId !== null && (
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
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!quickVendorName.trim()) return;
              try {
                const newVendorId = `vendor-${Date.now()}`;
                const newVendor = {
                  id: newVendorId,
                  name: quickVendorName.trim(),
                  category: quickVendorCategory,
                  contactEmail: '',
                  phone: '',
                  notes: 'Auto-registered from bank statement importer categorizer Desk.'
                };
                await onSaveVendor(newVendor);
                
                if (quickVendorRowId === 'manual') {
                  setRecipientType('vendor');
                  setRecipientId(newVendorId);
                  setPayee(newVendor.name);
                } else {
                  handleUpdateCategorizedRow(quickVendorRowId, 'recipientType', 'vendor');
                  handleUpdateCategorizedRow(quickVendorRowId, 'recipientId', newVendorId);
                }
                
                onShowToast(`Successfully registered vendor "${quickVendorName}"!`, "success");
                setQuickVendorRowId(null);
              } catch (err) {
                onShowToast(`Error registering vendor: ${err.message}`, "warning");
              }
            }}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '450px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Register New Vendor Partner</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Add this supplier to your database.
                </span>
              </div>
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => setQuickVendorRowId(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Company Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                value={quickVendorName}
                onChange={(e) => setQuickVendorName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category <span>*</span></label>
              <select
                className="select-filter"
                value={quickVendorCategory}
                onChange={(e) => setQuickVendorCategory(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="Software License">Software Licenses (Office, CRM, etc.)</option>
                <option value="Office Rental">Office Rentals & Landlords</option>
                <option value="Telecom">Telecom & Phone Systems</option>
                <option value="AI Service">AI Services (OpenAI, Anthropic)</option>
                <option value="Other">Other Vendors</option>
              </select>
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                Register Vendor Partner
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setQuickVendorRowId(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
