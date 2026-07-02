import React, { useState, useMemo } from 'react';
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
  vendors = [],
  onSaveVendor,
  onSaveExpense,
  onDeleteExpense,
  onSaveNominalCode,
  onDeleteNominalCode,
  onSavePlacement,
  onShowToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // matrix, ledger, statement, settings

  // Compile list of unique departments from both company profiles and active staff records
  const allAvailableDepts = useMemo(() => {
    const depts = [];
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    if (depts.length === 0) {
      return DEPARTMENTS;
    }
    return depts.sort();
  }, [companies, staff]);

  // Normalize nominal codes to handle any legacy string arrays gracefully
  const activeNominalCodes = (nominalCodes || []).map(c => {
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
  }).filter(c => c && c.code);

  // Ledger Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [nominalFilter, setNominalFilter] = useState('all');
  const [plMonthFilter, setPlMonthFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [bankAccountFilter, setBankAccountFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const filteredAvailableDepts = useMemo(() => {
    const depts = [];
    let targetCompanies = companies;
    let targetStaff = staff;

    if (companyFilter !== 'all') {
      targetCompanies = companies.filter(c => c.id === companyFilter);
      targetStaff = staff.filter(s => s.companyId === companyFilter);
    }

    targetCompanies.forEach(c => {
      (c.departments || []).forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    targetStaff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  }, [companyFilter, companies, staff]);

  // Column Choose visibility state
  const [visibleCols, setVisibleCols] = useState({
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
  const [showColPicker, setShowColPicker] = useState(false);

  // Multi-select row selection state
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);



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
  const [manualBankAccountId, setManualBankAccountId] = useState('');
  const [statementBankAccountId, setStatementBankAccountId] = useState('');

  // Recipient linkage states (manual entry)
  const [recipientType, setRecipientType] = useState('other'); // vendor, staff, other
  const [recipientId, setRecipientId] = useState('');

  // Target Allocation Modal states
  const [allocatingRowId, setAllocatingRowId] = useState(null); // row.id, 'manual', or 'bulk'
  const [allocationSearch, setAllocationSearch] = useState('');
  const [allocatingType, setAllocatingType] = useState('company');
  const [allocatingTarget, setAllocatingTarget] = useState([]);
  const [allocatingStaffIds, setAllocatingStaffIds] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    company: true,
    department: false,
    staff: false
  });

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
  const [statementCompanyId, setStatementCompanyId] = useState('');
  const [statementAccountRef, setStatementAccountRef] = useState('Main Current Account');
  const [linkingRowId, setLinkingRowId] = useState(null);
  const [linkingPlacementId, setLinkingPlacementId] = useState('');
  const [placementSearch, setPlacementSearch] = useState('');
  const [matrixYear, setMatrixYear] = useState('2026');
  const [matrixExpandedKeys, setMatrixExpandedKeys] = useState({});
  const [drilldownMonthIdx, setDrilldownMonthIdx] = useState(null);
  const [drilldownRowId, setDrilldownRowId] = useState(null);
  const [drilldownRowType, setDrilldownRowType] = useState('');
  const [drilldownTargetVal, setDrilldownTargetVal] = useState('');

  // Nominal Code setting states
  const [newNominalCodeId, setNewNominalCodeId] = useState('');
  const [newNominalCodeName, setNewNominalCodeName] = useState('');
  const [newNominalType, setNewNominalType] = useState('indirect'); // direct, indirect
  const [nominalMode, setNominalMode] = useState('single'); // single, bulk
  const [bulkInput, setBulkInput] = useState('');
  const [selectedNominalIds, setSelectedNominalIds] = useState([]);
  const [quickAddNominalOpen, setQuickAddNominalOpen] = useState(false);
  const [quickAddRowId, setQuickAddRowId] = useState(null);

  // Handle Edit Expense
  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp.id);
    
    // Normalize date string (e.g. DD/MM/YYYY) to YYYY-MM-DD for date input
    let formattedDate = '';
    if (exp.date) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(exp.date)) {
        formattedDate = exp.date;
      } else {
        const parts = exp.date.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            // Assume DD-MM-YYYY
            const day = parts[0];
            const month = parts[1];
            const year = parts[2];
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } else {
          try {
            const d = new Date(exp.date);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toISOString().substring(0, 10);
            }
          } catch (e) {}
        }
      }
    }
    setDate(formattedDate);
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
    setManualBankAccountId(exp.bankAccountId ? `${exp.bankCompanyId}:${exp.bankAccountId}` : '');
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

    let bankCompanyId = '';
    let bankAccountId = '';
    let bankAccountRef = '';
    if (manualBankAccountId) {
      const [compId, bankId] = manualBankAccountId.split(':');
      const comp = companies.find(c => c.id === compId);
      const bank = comp?.bankAccounts?.find(b => b.id === bankId);
      if (bank) {
        bankCompanyId = compId;
        bankAccountId = bankId;
        bankAccountRef = `${bank.bankName} - ${bank.accountName}`;
      }
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
      linkedPlacementId: linkedPlacementId || null,
      bankCompanyId,
      bankAccountId,
      bankAccountRef
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
      setManualBankAccountId('');
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
        code: codeStr,
        type: newNominalType
      });
      onShowToast(`Added Nominal code: ${codeStr} (${newNominalType === 'direct' ? 'Direct Cost' : 'Indirect Cost'})`, "success");
      setNewNominalCodeId('');
      setNewNominalCodeName('');
      setNewNominalType('indirect');
    } catch (err) {
      onShowToast(`Error creating Nominal: ${err.message}`, "warning");
    }
  };

  // Bulk add nominal codes from textarea input
  const handleBulkNominalSubmit = async (e) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      onShowToast("Please enter nominal codes in the text area.", "warning");
      return;
    }

    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
    let successCount = 0;
    let failCount = 0;
    let existsCount = 0;

    for (let line of lines) {
      let codeId = '';
      let codeName = '';
      let typeVal = 'indirect';

      // Try split by comma
      if (line.includes(',')) {
        const parts = line.split(',');
        codeId = parts[0]?.trim();
        codeName = parts[1]?.trim();
        if (parts[2]) {
          const t = parts[2].trim().toLowerCase();
          if (t === 'direct' || t === 'indirect') {
            typeVal = t;
          }
        }
      } 
      // Try split by dash
      else if (line.includes(' - ')) {
        const parts = line.split(' - ');
        codeId = parts[0]?.trim();
        codeName = parts[1]?.trim();
      }
      else {
        // Fallback: split by whitespace
        const match = line.match(/^(\w+)\s+(.+)$/);
        if (match) {
          codeId = match[1];
          codeName = match[2];
        }
      }

      if (!codeId || !codeName) {
        failCount++;
        continue;
      }

      const codeStr = `${codeId} - ${codeName}`;
      const exists = activeNominalCodes.some(c => c.id === codeId || String(c.code || '').toLowerCase() === codeStr.toLowerCase());

      if (exists) {
        existsCount++;
        continue;
      }

      try {
        await onSaveNominalCode({
          id: codeId,
          code: codeStr,
          type: typeVal
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    onShowToast(`Bulk import complete. Success: ${successCount}, Skipped (Exists): ${existsCount}, Errors: ${failCount}`, successCount > 0 ? "success" : "warning");
    if (successCount > 0) {
      setBulkInput('');
    }
  };

  // Bulk remove selected nominal codes
  const handleBulkDeleteNominals = async () => {
    if (selectedNominalIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedNominalIds.length} selected Nominal category codes?`)) return;

    let successCount = 0;
    try {
      for (const id of selectedNominalIds) {
        await onDeleteNominalCode(id);
        successCount++;
      }
      onShowToast(`Successfully deleted ${successCount} nominal categories.`, "success");
      setSelectedNominalIds([]);
    } catch (err) {
      onShowToast(`Error bulk deleting nominals: ${err.message}`, "warning");
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
    const activeCompanyId = statementCompanyId || (companies[0] ? companies[0].id : '');
    const activeCompany = companies.find(c => c.id === activeCompanyId);
    const activeCompanyBanks = activeCompany?.bankAccounts || [];

    if (activeCompanyBanks.length > 0 && !statementBankAccountId) {
      onShowToast("Please select a registered bank account for the statement import.", "warning");
      return;
    }

    if (!columnMappings.date || !columnMappings.payee || !columnMappings.amount) {
      onShowToast("Please map the required Date, Payee, and Amount fields.", "warning");
      return;
    }

    const dateColIdx = csvHeaders.indexOf(columnMappings.date);
    const payeeColIdx = csvHeaders.indexOf(columnMappings.payee);
    const amountColIdx = csvHeaders.indexOf(columnMappings.amount);
    const refColIdx = columnMappings.reference ? csvHeaders.indexOf(columnMappings.reference) : -1;
    const nominalColIdx = columnMappings.nominal ? csvHeaders.indexOf(columnMappings.nominal) : -1;

    const parsedRows = csvRows.map((row, idx) => {
      const dateVal = row[dateColIdx] || '';
      const payeeVal = row[payeeColIdx] || '';
      const amtVal = Number(String(row[amountColIdx]).replace(/[^0-9.-]/g, '')) || 0;
      const refVal = refColIdx > -1 ? row[refColIdx] || '' : '';
      const nominalVal = nominalColIdx > -1 ? row[nominalColIdx] || '' : '';
      
      const parts = dateVal.split(/[-/]/);
      let yyyymm = new Date().toISOString().substring(0, 7);
      if (parts.length >= 3) {
        const year = parts[0].length === 4 ? parts[0] : parts[2];
        const month = parts[0].length === 4 ? parts[1] : parts[1];
        yyyymm = `${year}-${String(month).padStart(2, '0')}`;
      }

      // Auto-detect recipient matching vendor name or staff member name
      let autoRecType = 'other';
      let autoRecId = '';
      let matchedStaffMember = null;
      const cleanPayee = payeeVal.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanPayee) {
        const matchedVendor = vendors.find(v => v.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPayee) || cleanPayee.includes(v.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
        if (matchedVendor) {
          autoRecType = 'vendor';
          autoRecId = matchedVendor.id;
        } else {
          const matchedStaff = staff.find(s => s.fullName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPayee) || cleanPayee.includes(s.fullName.toLowerCase().replace(/[^a-z0-9]/g, '')));
          if (matchedStaff) {
            autoRecType = 'staff';
            autoRecId = matchedStaff.id;
            matchedStaffMember = matchedStaff;
          }
        }
      }

      // Auto-detect matching nominal category
      let autoNominalCode = '';
      if (nominalVal) {
        const cleanNomVal = String(nominalVal).trim().toLowerCase();
        const matched = activeNominalCodes.find(c => {
          const codeStr = String(c.code || '').toLowerCase();
          const cId = String(c.id).toLowerCase();
          return cId === cleanNomVal || codeStr === cleanNomVal || codeStr.includes(cleanNomVal) || cleanNomVal.includes(codeStr);
        });
        if (matched) {
          autoNominalCode = matched.code;
        }
      }

      // Auto-detect target cost center allocation
      let autoAllocType = 'company';
      let autoAllocTarget = companies[0]?.id || '';
      let autoStaffIds = [];

      if (matchedStaffMember) {
        autoAllocType = 'staff';
        autoAllocTarget = [matchedStaffMember.id];
        autoStaffIds = [matchedStaffMember.id];
      } else {
        // Match payee to registered Company Name
        const matchedComp = companies.find(c => {
          const cName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanPayee.includes(cName) || cName.includes(cleanPayee);
        });
        if (matchedComp) {
          autoAllocType = 'company';
          autoAllocTarget = matchedComp.id;
        } else {
          // Match payee to active Department Name
          const activeDepts = Array.from(new Set(staff.map(s => s.department).filter(Boolean)));
          const matchedDept = activeDepts.find(d => {
            const dName = d.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanPayee.includes(dName);
          });
          if (matchedDept) {
            autoAllocType = 'department';
            autoAllocTarget = [matchedDept];
          }
        }
      }

      return {
        id: `stmt-row-${idx}-${Date.now()}`,
        date: dateVal,
        plMonth: yyyymm,
        payee: payeeVal,
        reference: refVal,
        amount: amtVal,
        nominalCode: autoNominalCode || '',
        recipientType: autoRecType,
        recipientId: autoRecId,
        taxRate: 0, // default to 0% (Exempt)
        allocationType: autoAllocType,
        allocationTarget: autoAllocTarget,
        selectedStaffIds: autoStaffIds,
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
          currency: (() => {
            const comp = companies.find(c => c.id === (statementCompanyId || (companies[0] ? companies[0].id : '')));
            const bank = comp?.bankAccounts?.find(b => b.id === statementBankAccountId);
            return bank?.currency || 'GBP';
          })(),
          taxRate: row.taxRate !== undefined ? row.taxRate : 0,
          recipientType: row.recipientType || 'other',
          recipientId: row.recipientId || '',
          invoiceUrl: "#",
          allocationType: row.allocationType,
          allocationTarget: target,
          linkedPlacementId: row.linkedPlacementId || null,
          bankCompanyId: statementCompanyId || (companies[0] ? companies[0].id : ''),
          bankAccountId: statementBankAccountId,
          bankAccountRef: statementAccountRef || 'Main Current Account'
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
      
      // Update rows status locally first to prevent async state evaluation delay
      const updatedRows = categorizedRows.map(r => {
        if (r.nominalCode) {
          return { ...r, committed: true };
        }
        return r;
      });
      setCategorizedRows(updatedRows);

      // If all rows are committed, reset
      const allDone = updatedRows.every(r => r.committed);
      if (allDone) {
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setCategorizedRows([]);
        setStatementCompanyId('');
        setStatementBankAccountId('');
        setStatementAccountRef('Main Current Account');
        setImportStep(1);
        setActiveSubTab('ledger');
      } else {
        onShowToast(`${updatedRows.filter(r => r.committed).length} rows committed. Map the remaining rows to commit them too.`, "info");
      }
    } catch (err) {
      onShowToast(`Error committing statement rows: ${err.message}`, "warning");
    }
  };

  const handleBulkUpdateNominal = async (nominalCode) => {
    if (!nominalCode || selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        const original = expenses.find(e => e.id === id);
        if (original) {
          await onSaveExpense({
            ...original,
            nominalCode
          });
          count++;
        }
      }
      onShowToast(`Bulk updated Nominal Code for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err) {
      onShowToast(`Error bulk updating: ${err.message}`, "warning");
    }
  };

  const handleBulkUpdateAllocation = async (allocType, allocTarget) => {
    if (selectedExpenseIds.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        const original = expenses.find(e => e.id === id);
        if (original) {
          await onSaveExpense({
            ...original,
            allocationType: allocType,
            allocationTarget: allocTarget
          });
          count++;
        }
      }
      onShowToast(`Bulk updated Allocation for ${count} transactions.`, "success");
      setSelectedExpenseIds([]);
    } catch (err) {
      onShowToast(`Error bulk updating: ${err.message}`, "warning");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExpenseIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedExpenseIds.length} expense records?`)) {
      return;
    }
    try {
      let count = 0;
      for (const id of selectedExpenseIds) {
        await onDeleteExpense(id);
        count++;
      }
      onShowToast(`Permanently deleted ${count} expense records.`, "success");
      setSelectedExpenseIds([]);
    } catch (err) {
      onShowToast(`Error bulk deleting: ${err.message}`, "warning");
    }
  };

  const handleResetExpenses = async () => {
    const targetList = expenses || [];
    if (targetList.length === 0) {
      onShowToast("Ledger is already empty.", "info");
      return;
    }

    if (!window.confirm(`🚨 DANGER ZONE: This will permanently delete ALL ${targetList.length} expense records in the database. This action cannot be undone!\n\nAre you absolutely sure you want to proceed?`)) {
      return;
    }

    try {
      // Parallel delete triggers to avoid sequence locks and freeze delays
      await Promise.all(targetList.map(exp => onDeleteExpense(exp.id)));
      onShowToast("All expense ledger entries have been successfully reset.", "success");
    } catch (err) {
      onShowToast(`Error resetting expenses: ${err.message}`, "warning");
    }
  };



  // Filter nominal codes & placements lists
  const unpaidPlacements = placements.filter(p => p.clientPaymentStatus !== 'paid' && p.netScoreValue > 0);

  const sortedPlacementsForMapping = useMemo(() => {
    return [...placements]
      .filter(p => p.netScoreValue > 0)
      .sort((a, b) => {
        const aPaid = a.clientPaymentStatus === 'paid' ? 1 : 0;
        const bPaid = b.clientPaymentStatus === 'paid' ? 1 : 0;
        return aPaid - bPaid;
      });
  }, [placements]);

  // Filter Ledger transactions list
  const filteredExpenses = (expenses || []).filter(exp => {
    if (!exp) return false;
    const expNominal = exp.nominalCode || '';
    const expPlMonth = exp.plMonth || '';

    if (nominalFilter !== 'all' && expNominal !== nominalFilter) return false;
    if (plMonthFilter !== 'all' && expPlMonth !== plMonthFilter) return false;
    if (bankAccountFilter !== 'all' && exp.bankAccountId !== bankAccountFilter) return false;

    // Company filter
    if (companyFilter !== 'all') {
      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
      if (exp.allocationType !== 'company' || !targets.includes(companyFilter)) return false;
    }

    // Department filter
    if (deptFilter !== 'all') {
      const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
      if (exp.allocationType !== 'department' || !targets.includes(deptFilter)) return false;
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

  const sortedExpenses = sortExpenses(filteredExpenses);

  // Extract unique P&L months in expenses database
  const uniquePlMonths = Array.from(new Set((expenses || []).map(e => e?.plMonth).filter(Boolean))).sort();

  // Extract all registered bank accounts across all companies
  const allBankAccounts = [];
  companies.forEach(c => {
    if (c.bankAccounts) {
      c.bankAccounts.forEach(b => {
        allBankAccounts.push({
          id: b.id,
          ref: `${b.bankName} - ${b.accountName} (${c.name})`
        });
      });
    }
  });

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
          { key: 'matrix', label: 'YTD Expenses Allocation Matrix' },
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
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn-danger" 
                onClick={handleResetExpenses}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} /> Reset Ledger
              </button>
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
                setManualBankAccountId('');
                setShowForm(prev => !prev);
              }}>
                <Plus size={16} /> {showForm ? 'Close Form' : 'Log Expense'}
              </button>
            </div>
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
                <div className="form-group" style={{ flex: 1.5 }}>
                  <label className="form-label">Paid From Bank Account</label>
                  <select 
                    className="select-filter"
                    value={manualBankAccountId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualBankAccountId(val);
                      if (val) {
                        const [compId, bankId] = val.split(':');
                        const comp = companies.find(c => c.id === compId);
                        const bank = comp?.bankAccounts?.find(b => b.id === bankId);
                        if (bank) {
                          setCurrency(bank.currency || 'GBP');
                        }
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="">-- No Mapped Account --</option>
                    {companies.map(c => {
                      const accounts = c.bankAccounts || [];
                      if (accounts.length === 0) return null;
                      return (
                        <optgroup key={c.id} label={c.name}>
                          {accounts.map(acc => (
                            <option key={acc.id} value={`${c.id}:${acc.id}`}>
                              {acc.bankName} - {acc.accountName} ({acc.currency})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 0.8 }}>
                  <label className="form-label">Tax / VAT Rate (%)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 20"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1.5 }}>
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
                          const targets = Array.isArray(allocationTarget) ? allocationTarget : [allocationTarget].filter(Boolean);
                          if (targets.length === 0) return '🏢 Click to select Company';
                          const names = targets.map(tid => companies.find(c => c.id === tid)?.name).filter(Boolean);
                          return `🏢 Company Target: ${names.join(', ')}`;
                        }
                        if (allocationType === 'department') {
                          const targets = Array.isArray(allocationTarget) ? allocationTarget : [allocationTarget].filter(Boolean);
                          if (targets.length === 0) return '📂 Click to select Department';
                          return `📂 Department Cost Center: ${targets.join(', ')}`;
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
                  setManualBankAccountId('');
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

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

              <select 
                className="select-filter"
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setDeptFilter('all');
                  setStaffFilter('all');
                }}
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
                {filteredAvailableDepts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Allocated</option>
                {staff
                  .filter(s => companyFilter === 'all' || s.companyId === companyFilter)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
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
                  <Settings size={14} /> Column Headers
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
                        <span style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

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
              marginBottom: '12px',
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
                {/* Bulk Nominal */}
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

                {/* Bulk Allocation */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setAllocatingRowId('bulk');
                    setAllocatingType('company');
                    setAllocatingTarget([]);
                    setAllocatingStaffIds([]);
                    setExpandedSections({ company: true, department: false, staff: false });
                    setAllocationSearch('');
                  }}
                  style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  🎯 Allocate Selected...
                </button>

                {/* Bulk Delete */}
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

                  return (
                    <tr key={exp.id}>
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
                      {visibleCols.plMonth && <td style={{ fontWeight: 600 }}>{exp.plMonth}</td>}
                      {visibleCols.payee && <td style={{ fontWeight: 600 }}>{exp.payee}</td>}
                      {visibleCols.bank && (
                        <td>
                          {exp.bankCompanyId ? (
                            <div style={{ fontSize: '11px' }}>
                              <div style={{ fontWeight: 600 }}>{companies.find(c => c.id === exp.bankCompanyId)?.name || 'Company'}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                🏦 {exp.bankAccountRef || 'Main Account'}
                                {exp.id.startsWith('exp-stmt-') ? '' : ' (Manual Mapped)'}
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
                              setAllocatingRowId(exp.id);
                              setAllocatingType(exp.allocationType || 'company');
                              setAllocatingTarget(exp.allocationTarget || []);
                              setAllocatingStaffIds(exp.allocationType === 'staff' ? (Array.isArray(exp.allocationTarget) ? exp.allocationTarget : []) : []);
                              setExpandedSections({
                                company: exp.allocationType === 'company' || !exp.allocationType,
                                department: exp.allocationType === 'department',
                                staff: exp.allocationType === 'staff'
                              });
                              setAllocationSearch('');
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
                      )}
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
                  { key: 'reference', label: 'Reference / Memo (Optional)' },
                  { key: 'nominal', label: 'Nominal Code (Optional)' }
                ].map(item => {
                  const isUnmapped = !columnMappings[item.key];
                  const isRequired = ['date', 'payee', 'amount'].includes(item.key);
                  return (
                    <div key={item.key} className="form-group" style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ margin: 0 }}>{item.label}</label>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isUnmapped 
                            ? (isRequired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)') 
                            : 'rgba(34, 197, 94, 0.1)',
                          color: isUnmapped 
                            ? (isRequired ? 'var(--danger)' : 'var(--warning)') 
                            : 'var(--success)',
                          transition: 'all 0.2s'
                        }}>
                          {isUnmapped ? (isRequired ? '⚠️ Required Unmapped' : '⚠️ Unmapped') : '✓ Mapped'}
                        </span>
                      </div>
                      <select
                        className="select-filter"
                        value={columnMappings[item.key] || ''}
                        onChange={(e) => setColumnMappings(prev => ({ ...prev, [item.key]: e.target.value }))}
                        style={{ 
                          width: '100%', 
                          padding: '8px',
                          border: isUnmapped 
                            ? (isRequired 
                                ? '2px solid rgba(239, 68, 68, 0.65)' 
                                : '1px dashed var(--warning)') 
                            : '1.5px solid var(--success)',
                          backgroundColor: isUnmapped 
                            ? (isRequired ? 'rgba(239, 68, 68, 0.02)' : 'transparent')
                            : 'rgba(34, 197, 94, 0.01)',
                          borderRadius: 'var(--radius-sm)',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <option value="">-- Choose Column --</option>
                        {csvHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Target Bank Account and Reference Form */}
              <div 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px', 
                  marginTop: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px' 
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                  🏦 Bank Account & Statement Reference
                </div>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Select Company *</label>
                    <select
                      className="select-filter"
                      value={statementCompanyId || (companies[0] ? companies[0].id : '')}
                      onChange={(e) => {
                        const compId = e.target.value;
                        setStatementCompanyId(compId);
                        // Pre-select first bank account of this company if available
                        const comp = companies.find(c => c.id === compId);
                        const banks = comp?.bankAccounts || [];
                        if (banks.length > 0) {
                          setStatementBankAccountId(banks[0].id);
                          setStatementAccountRef(`${banks[0].bankName} - ${banks[0].accountName}`);
                        } else {
                          setStatementBankAccountId('');
                          setStatementAccountRef('');
                        }
                      }}
                      style={{ width: '100%', padding: '8px' }}
                      required
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Select Bank Account *</label>
                    {(() => {
                      const activeCompId = statementCompanyId || (companies[0] ? companies[0].id : '');
                      const activeComp = companies.find(c => c.id === activeCompId);
                      const activeCompBanks = activeComp?.bankAccounts || [];

                      return (
                        <>
                          <select
                            className="select-filter"
                            value={statementBankAccountId}
                            onChange={(e) => {
                              const bId = e.target.value;
                              setStatementBankAccountId(bId);
                              const acc = activeCompBanks.find(b => b.id === bId);
                              if (acc) {
                                setStatementAccountRef(`${acc.bankName} - ${acc.accountName}`);
                              } else {
                                setStatementAccountRef('');
                              }
                            }}
                            style={{ width: '100%', padding: '8px' }}
                            required
                          >
                            <option value="">-- Select Bank Account --</option>
                            {activeCompBanks.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.bankName} - {acc.accountName} ({acc.currency})
                              </option>
                            ))}
                          </select>
                          {activeCompBanks.length === 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                              ⚠️ No bank accounts configured for this company. Please add one under the Companies tab first!
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
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

              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  padding: '8px 12px', 
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>🏦 <strong>Target Account:</strong> {companies.find(c => c.id === (statementCompanyId || (companies[0] ? companies[0].id : '')))?.name || 'Company'} — <em>{statementAccountRef}</em></span>
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
                      <th>VAT Rate</th>
                      <th>Link credit sales</th>
                      <th>Action</th>
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
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'quick_add_nominal') {
                                setQuickAddRowId(row.id);
                                setNewNominalCodeId('');
                                setNewNominalCodeName('');
                                setNewNominalType('indirect');
                                setQuickAddNominalOpen(true);
                              } else {
                                handleUpdateCategorizedRow(row.id, 'nominalCode', val);
                              }
                            }}
                            disabled={row.committed}
                            style={{ padding: '4px', fontSize: '11px', width: '160px' }}
                          >
                            <option value="">-- Unmapped --</option>
                            <option value="quick_add_nominal" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                              ➕ Add New Nominal Code...
                            </option>
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
                                const targets = Array.isArray(row.allocationTarget) ? row.allocationTarget : [row.allocationTarget].filter(Boolean);
                                if (targets.length === 0) return '🏢 Choose Company';
                                const names = targets.map(tid => companies.find(c => c.id === tid)?.name).filter(Boolean);
                                return `🏢 ${names.join(', ')}`;
                              }
                              if (row.allocationType === 'department') {
                                const targets = Array.isArray(row.allocationTarget) ? row.allocationTarget : [row.allocationTarget].filter(Boolean);
                                if (targets.length === 0) return '📂 Choose Dept';
                                return `📂 Dept: ${targets.join(', ')}`;
                              }
                              if (row.allocationType === 'staff') {
                                const count = row.selectedStaffIds?.length || 0;
                                return `👥 ${count} staff split${count !== 1 ? 's' : ''}`;
                              }
                              return '🎯 Click to Allocate';
                            })()}
                          </button>
                        </td>

                        {/* VAT Rate Selector */}
                        <td>
                          <select
                            value={row.taxRate !== undefined ? row.taxRate : 0}
                            onChange={(e) => handleUpdateCategorizedRow(row.id, 'taxRate', Number(e.target.value))}
                            disabled={row.committed}
                            style={{ padding: '4px', fontSize: '11px', width: '85px' }}
                          >
                            <option value="0">0% (Exempt)</option>
                            <option value="20">20% (Std)</option>
                            <option value="5">5% (Red)</option>
                          </select>
                        </td>

                        {/* Link Credit to placement sales invoice */}
                        <td>
                          {row.isCredit ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setLinkingRowId(row.id);
                                setLinkingPlacementId(row.linkedPlacementId || '');
                                setPlacementSearch('');
                              }}
                              disabled={row.committed}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                width: '150px', 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                textAlign: 'left',
                                border: row.linkedPlacementId ? '1px solid var(--success)' : '1px solid var(--border-color)',
                                color: row.linkedPlacementId ? 'var(--success)' : 'var(--text-primary)'
                              }}
                            >
                              {(() => {
                                if (row.linkedPlacementId) {
                                  const p = placements.find(x => x.id === row.linkedPlacementId);
                                  return p ? `🔗 ${p.placementId} (${p.clientCompany})` : '🔗 Link Placement';
                                }
                                return '🔗 Link Placement';
                              })()}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Debit</span>
                          )}
                        </td>

                        {/* Delete Row Action */}
                        <td>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => {
                              setCategorizedRows(prev => prev.filter(r => r.id !== row.id));
                            }}
                            disabled={row.committed}
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            title="Remove this row"
                          >
                            <Trash2 size={12} />
                          </button>
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
          SUB-TAB 3: YTD EXPENSES ALLOCATION MATRIX
          ============================================================== */}
      {activeSubTab === 'matrix' && (() => {
        // 1. Calculate the overhead spread for each active recruiter for the selected year
        const staffOverheadMap = {};
        const staffTransactionsMap = {};
        staff.forEach(s => {
          staffOverheadMap[s.id] = Array(12).fill(0);
          staffTransactionsMap[s.id] = Array.from({ length: 12 }, () => []);
        });

        const yearExpenses = (expenses || []).filter(e => e.plMonth && e.plMonth.startsWith(matrixYear));

        for (let mIdx = 0; mIdx < 12; mIdx++) {
          const monthKey = `${matrixYear}-${String(mIdx + 1).padStart(2, '0')}`;
          const activeStaff = staff.filter(s => {
            const hasStarted = s.startDate && s.startDate.substring(0, 7) <= monthKey;
            const notExited = !s.exitDate || s.exitDate.substring(0, 7) > monthKey;
            return hasStarted && notExited;
          });
          const activeStaffIds = activeStaff.map(s => s.id);
          const monthExpenses = yearExpenses.filter(e => e.plMonth === monthKey);

          monthExpenses.forEach(exp => {
            const gbpAmt = toGBP(exp.amount, exp.currency);

            if (exp.allocationType === 'company') {
              const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
              if (targets.length > 0) {
                const compShare = gbpAmt / targets.length;
                targets.forEach(targetComp => {
                  const compStaff = activeStaff.filter(s => s.companyId === targetComp);
                  const compHead = compStaff.length || 1;
                  compStaff.forEach(s => {
                    staffOverheadMap[s.id][mIdx] += compShare / compHead;
                    staffTransactionsMap[s.id][mIdx].push({ ...exp, apportionedShare: compShare / compHead, shareReason: 'Company Apportionment' });
                  });
                });
              }
            } else if (exp.allocationType === 'department') {
              const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean);
              if (targets.length > 0) {
                const deptShare = gbpAmt / targets.length;
                targets.forEach(targetDept => {
                  const deptStaff = activeStaff.filter(s => s.department === targetDept);
                  const deptHead = deptStaff.length || 1;
                  deptStaff.forEach(s => {
                    staffOverheadMap[s.id][mIdx] += deptShare / deptHead;
                    staffTransactionsMap[s.id][mIdx].push({ ...exp, apportionedShare: deptShare / deptHead, shareReason: 'Department Apportionment' });
                  });
                });
              }
            } else if (exp.allocationType === 'staff') {
              const targets = Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [];
              if (targets.length > 0) {
                const perStaffShare = gbpAmt / targets.length;
                targets.forEach(staffId => {
                  if (activeStaffIds.includes(staffId)) {
                    staffOverheadMap[staffId][mIdx] += perStaffShare;
                    staffTransactionsMap[staffId][mIdx].push({ ...exp, apportionedShare: perStaffShare, shareReason: 'Direct Staff Split' });
                  }
                });
              }
            } else {
              // Group-wide overhead
              const groupHead = activeStaff.length || 1;
              activeStaff.forEach(s => {
                staffOverheadMap[s.id][mIdx] += gbpAmt / groupHead;
                staffTransactionsMap[s.id][mIdx].push({ ...exp, apportionedShare: gbpAmt / groupHead, shareReason: 'Group-wide Allocation' });
              });
            }
          });
        }

        // 2. Build the hierarchical tree data structure: Companies -> Nominals -> Parties
        const computedMatrixData = [];
        companies.forEach(company => {
          const companyStaff = staff.filter(s => s.companyId === company.id);

          const companyMonths = Array(12).fill(0);
          const companyTransactionsByMonth = Array.from({ length: 12 }, () => []);
          const nominalsMap = {};

          companyStaff.forEach(member => {
            const memberTransactionsByMonth = staffTransactionsMap[member.id] || Array.from({ length: 12 }, () => []);

            for (let m = 0; m < 12; m++) {
              const monthTrans = memberTransactionsByMonth[m] || [];
              monthTrans.forEach(t => {
                const nom = t.nominalCode || 'Uncategorized';
                const payee = t.payee || 'Unknown Payee';
                const share = t.apportionedShare !== undefined ? t.apportionedShare : toGBP(t.amount, t.currency);

                if (!nominalsMap[nom]) {
                  nominalsMap[nom] = {
                    months: Array(12).fill(0),
                    transactionsByMonth: Array.from({ length: 12 }, () => []),
                    parties: {}
                  };
                }

                nominalsMap[nom].months[m] += share;
                nominalsMap[nom].transactionsByMonth[m].push(t);

                if (!nominalsMap[nom].parties[payee]) {
                  nominalsMap[nom].parties[payee] = {
                    months: Array(12).fill(0),
                    transactionsByMonth: Array.from({ length: 12 }, () => [])
                  };
                }

                nominalsMap[nom].parties[payee].months[m] += share;
                nominalsMap[nom].parties[payee].transactionsByMonth[m].push(t);

                // Add to company totals
                companyMonths[m] += share;
                companyTransactionsByMonth[m].push(t);
              });
            }
          });

          const nominalRows = [];
          Object.keys(nominalsMap).sort().forEach(nom => {
            const nomData = nominalsMap[nom];
            const partyRows = [];

            Object.keys(nomData.parties).sort().forEach(payee => {
              const partyData = nomData.parties[payee];
              partyRows.push({
                id: `party-${company.id}-${nom}-${payee}`,
                name: payee,
                type: 'party',
                targetVal: payee,
                months: partyData.months,
                transactionsByMonth: partyData.transactionsByMonth,
                total: partyData.months.reduce((a, b) => a + b, 0),
                children: []
              });
            });

            nominalRows.push({
              id: `nominal-${company.id}-${nom}`,
              name: nom,
              type: 'nominal',
              targetVal: nom,
              months: nomData.months,
              transactionsByMonth: nomData.transactionsByMonth,
              total: nomData.months.reduce((a, b) => a + b, 0),
              children: partyRows
            });
          });

          computedMatrixData.push({
            id: `company-${company.id}`,
            name: company.name,
            type: 'company',
            targetVal: company.name,
            months: companyMonths,
            transactionsByMonth: companyTransactionsByMonth,
            total: companyMonths.reduce((a, b) => a + b, 0),
            children: nominalRows
          });
        });

        // 3. Compute col totals
        const colTotals = Array(12).fill(0);
        let grandTotal = 0;
        for (let m = 0; m < 12; m++) {
          const monthKey = `${matrixYear}-${String(m + 1).padStart(2, '0')}`;
          const monthExpenses = yearExpenses.filter(e => e.plMonth === monthKey);
          colTotals[m] = monthExpenses.reduce((sum, e) => sum + toGBP(e.amount, e.currency), 0);
          grandTotal += colTotals[m];
        }

        // 4. Flatten based on expand states
        const flatRowsForMatrix = [];
        computedMatrixData.forEach(compRow => {
          flatRowsForMatrix.push(compRow);
          if (matrixExpandedKeys[compRow.id]) {
            compRow.children.forEach(nomRow => {
              flatRowsForMatrix.push(nomRow);
              if (matrixExpandedKeys[nomRow.id]) {
                nomRow.children.forEach(partyRow => {
                  flatRowsForMatrix.push(partyRow);
                });
              }
            });
          }
        });

        const toggleKey = (key) => {
          setMatrixExpandedKeys(prev => ({
            ...prev,
            [key]: !prev[key]
          }));
        };

        const expandAll = () => {
          const newKeys = {};
          computedMatrixData.forEach(compRow => {
            newKeys[compRow.id] = true;
            compRow.children.forEach(nomRow => {
              newKeys[nomRow.id] = true;
            });
          });
          setMatrixExpandedKeys(newKeys);
        };

        const collapseAll = () => {
          setMatrixExpandedKeys({});
        };

        const monthNamesAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
            
            {/* Header controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>YTD Expenses & Shared Apportionments Matrix</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Apportioned overhead costs distributed dynamically down to departments and individuals</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  className="select-filter"
                  value={matrixYear}
                  onChange={(e) => setMatrixYear(e.target.value)}
                  style={{ padding: '6px', fontSize: '13px', width: '100px' }}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
                <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={expandAll}>
                  Expand All
                </button>
                <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={collapseAll}>
                  Collapse All
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="entity-table dense" style={{ minWidth: '1200px', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ width: '280px' }}>Corporate / Cost Center Hierarchy</th>
                    {monthNamesAbbr.map(m => (
                      <th key={m} style={{ textAlign: 'right', width: '75px' }}>{m}</th>
                    ))}
                    <th style={{ textAlign: 'right', width: '100px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)' }}>YTD Total</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRowsForMatrix.length === 0 ? (
                    <tr>
                      <td colSpan="14" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No corporate entities configured.
                      </td>
                    </tr>
                  ) : (
                    flatRowsForMatrix.map(row => {
                      const isCompany = row.type === 'company';
                      const isDept = row.type === 'nominal';
                      const isMember = row.type === 'party';

                      const paddingLeft = isCompany ? '12px' : isDept ? '32px' : '52px';
                      const hasChildren = isCompany || isDept;
                      const isExpanded = matrixExpandedKeys[row.id];

                      return (
                        <tr 
                          key={row.id}
                          style={{ 
                            backgroundColor: isCompany ? 'rgba(255,255,255,0.01)' : 'transparent',
                            borderBottom: isCompany ? '1px solid var(--border-color)' : '1px dashed rgba(255,255,255,0.04)'
                          }}
                        >
                          <td style={{ 
                            paddingLeft, 
                            fontWeight: isCompany ? 700 : isDept ? 600 : 400,
                            color: isCompany ? 'var(--text-primary)' : isDept ? 'var(--text-secondary)' : 'var(--text-muted)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleKey(row.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '9px',
                                    padding: '2px',
                                    width: '14px',
                                    textAlign: 'center',
                                    display: 'inline-block'
                                  }}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              ) : (
                                <span style={{ width: '14px', display: 'inline-block', textAlign: 'center', opacity: 0.3 }}>•</span>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{row.name}</span>
                                {isMember && row.subtitle && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>{row.subtitle}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {row.months.map((val, mIdx) => {
                            const cellVal = parseFloat(val.toFixed(2));
                            return (
                              <td key={mIdx} style={{ textAlign: 'right' }}>
                                {cellVal > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrilldownMonthIdx(mIdx);
                                      setDrilldownRowId(row.id);
                                      setDrilldownRowType(row.type);
                                      setDrilldownTargetVal(row.name);
                                    }}
                                    style={{
                                      background: isCompany ? 'rgba(239, 68, 68, 0.08)' : isDept ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                                      border: isCompany ? '1px solid rgba(239, 68, 68, 0.2)' : isDept ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
                                      borderRadius: '4px',
                                      color: isCompany ? 'var(--danger)' : isDept ? 'var(--warning)' : 'var(--accent)',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      cursor: 'pointer',
                                      width: '100%',
                                      textAlign: 'right',
                                      transition: 'all 0.2s'
                                    }}
                                    title="Click to view details"
                                  >
                                    £{Math.round(cellVal).toLocaleString()}
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                                )}
                              </td>
                            );
                          })}

                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 700, 
                            backgroundColor: 'rgba(255,255,255,0.01)', 
                            color: isCompany ? 'var(--danger)' : isDept ? 'var(--warning)' : 'var(--accent)'
                          }}>
                            £{Math.round(row.total).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Column totals footer */}
                  <tr style={{ fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.03)', borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ paddingLeft: '12px' }}>Monthly Totals (Group Expenses)</td>
                    {colTotals.map((tot, idx) => (
                      <td key={idx} style={{ textAlign: 'right', color: 'var(--danger)' }}>
                        £{Math.round(tot).toLocaleString()}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontSize: '13px' }}>
                      £{Math.round(grandTotal).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses Drill-down Modal overlay */}
            {drilldownMonthIdx !== null && drilldownRowId !== null && (
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
                  maxWidth: '850px',
                  padding: '24px',
                  boxShadow: 'var(--shadow-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                        🏦 Expenses Drill-down: {drilldownTargetVal}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Period: {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][drilldownMonthIdx]} {matrixYear}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setDrilldownMonthIdx(null);
                        setDrilldownRowId(null);
                        setDrilldownRowType('');
                        setDrilldownTargetVal('');
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* List Table */}
                  <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table className="entity-table dense" style={{ fontSize: '11px', width: '100%' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                        <tr>
                          <th>Date</th>
                          <th>Payee / Vendor</th>
                          <th>Nominal Category</th>
                          <th style={{ textAlign: 'right' }}>Total Cost (Gross)</th>
                          <th style={{ textAlign: 'right' }}>Your Share / Apportionment</th>
                          <th>Apportionment Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const matchedRow = flatRowsForMatrix.find(r => r.id === drilldownRowId);
                          if (!matchedRow) return null;

                          // De-duplicate transactions
                          const uniq = [];
                          const seen = new Set();
                          (matchedRow.transactionsByMonth[drilldownMonthIdx] || []).forEach(t => {
                            if (!seen.has(t.id)) {
                              seen.add(t.id);
                              uniq.push(t);
                            }
                          });

                          if (uniq.length === 0) {
                            return (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                                  No expenses allocated in this month.
                                </td>
                              </tr>
                            );
                          }

                          return uniq.map(t => (
                            <tr key={t.id}>
                              <td>{t.date}</td>
                              <td style={{ fontWeight: 600 }}>{t.payee}</td>
                              <td>{t.nominalCode}</td>
                              <td style={{ textAlign: 'right' }}>
                                £{toGBP(t.amount, t.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                                £{(t.apportionedShare !== undefined ? t.apportionedShare : toGBP(t.amount, t.currency)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: 'var(--danger)'
                                }}>
                                  {t.shareReason || 'Direct Cost'}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button 
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setDrilldownMonthIdx(null);
                        setDrilldownRowId(null);
                        setDrilldownRowType('');
                        setDrilldownTargetVal('');
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ==============================================================
          SUB-TAB 4: NOMINAL SETTINGS
          ============================================================== */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Nominal Codes Manager</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage the nominal ledger codes for categorization of bank statements and manual expense inputs.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className={nominalMode === 'single' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setNominalMode('single')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Single Nominal Add
              </button>
              <button 
                type="button" 
                className={nominalMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setNominalMode('bulk')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Bulk Nominal Add / Paste List
              </button>
            </div>
          </div>

          {nominalMode === 'single' && (
            <form onSubmit={handleNominalSubmit} className="detail-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="section-title">
                <PlusCircle size={14} /> Add Nominal Category
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ flex: 1 }}>
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

              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label className="form-label">Cost Classification Type <span>*</span></label>
                <select 
                  className="select-filter"
                  value={newNominalType}
                  onChange={(e) => setNewNominalType(e.target.value)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="indirect">Indirect Cost (Overhead / G&A)</option>
                  <option value="direct">Direct Cost (Salaries, Commission, Placements Cost)</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px', marginTop: '4px' }}>
                Create Nominal Bracket
              </button>
            </form>
          )}

          {nominalMode === 'bulk' && (
            <form onSubmit={handleBulkNominalSubmit} className="detail-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="section-title">
                <PlusCircle size={14} /> Bulk Paste Nominal Ledger Codes
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Paste nominal codes one per line. Formats allowed:<br />
                • <code>500 - Salaries &amp; Wages</code> (Code and Name split by dash)<br />
                • <code>500,Salaries &amp; Wages</code> (Code and Name split by comma)<br />
                • <code>500,Salaries &amp; Wages,direct</code> (Include cost type: 'direct' or 'indirect')
              </p>
              <div className="form-group">
                <textarea
                  className="form-input"
                  rows="8"
                  placeholder="e.g.&#10;500,Salaries & Wages,direct&#10;501,HMRC PAYE,direct&#10;7000,Marketing Expenses,indirect"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                Bulk Import Nominals
              </button>
            </form>
          )}

          {/* Nominal Codes List */}
          <div style={{ maxWidth: '750px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Active Nominal Ledger Bracket Registry</h3>
              {selectedNominalIds.length > 0 && (
                <button 
                  onClick={handleBulkDeleteNominals}
                  className="btn-primary" 
                  style={{ fontSize: '11px', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', padding: '4px 10px', gap: '4px' }}
                >
                  <Trash2 size={10} /> Delete Selected ({selectedNominalIds.length})
                </button>
              )}
            </div>
            <div className="table-container">
              <table className="entity-table dense" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={activeNominalCodes.length > 0 && selectedNominalIds.length === activeNominalCodes.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNominalIds(activeNominalCodes.map(c => c.id));
                          } else {
                            setSelectedNominalIds([]);
                          }
                        }}
                      />
                    </th>
                    <th style={{ width: '130px' }}>Nominal Code ID</th>
                    <th>Nominal Code Label</th>
                    <th style={{ width: '130px' }}>Classification</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeNominalCodes.map(c => (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={selectedNominalIds.includes(c.id)}
                          onChange={() => {
                            setSelectedNominalIds(prev => 
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.id}</td>
                      <td>{c.code}</td>
                      <td>
                        <span style={{ 
                          display: 'inline-block',
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: c.type === 'direct' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                          color: c.type === 'direct' ? 'var(--primary)' : 'var(--text-secondary)'
                        }}>
                          {c.type === 'direct' ? 'DIRECT COST' : 'INDIRECT COST'}
                        </span>
                      </td>
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
                      <td colSpan="5" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
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
      {/* ==============================================================
          MODAL: TARGET ALLOCATION MULTI-SELECT DESK (ACCORDION TREE VIEW)
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {allocatingRowId === 'bulk' 
                    ? `Assign cost centers for the ${selectedExpenseIds.length} selected transactions.` 
                    : 'Assign where this expense amount should be routed.'}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setAllocatingRowId(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Search filter box */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search allocation targets by name..."
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
                style={{ fontSize: '12px', padding: '8px', width: '100%' }}
              />
            </div>

            {/* Accordion Tree View Container */}
            <div style={{ 
              maxHeight: '320px', 
              overflowY: 'auto', 
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '4px'
            }}>
              
              {/* Option 1: Global Corporate Allocation */}
              <div 
                onClick={() => {
                  setAllocatingType('global');
                  setAllocatingTarget([]);
                  setAllocatingStaffIds([]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  backgroundColor: allocatingType === 'global' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: allocatingType === 'global' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <input 
                  type="radio" 
                  checked={allocatingType === 'global'} 
                  readOnly 
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>🌎 Whole Corporate Group</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Allocate cost to global company overhead</div>
                </div>
              </div>

              {/* Option 2: Companies Accordion Section */}
              <div>
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, company: !prev.company }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏢 Companies 
                    {allocatingType === 'company' && allocatingTarget.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                        Active ({allocatingTarget.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.company ? '▼' : '▶'}</span>
                </div>
                {expandedSections.company && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px solid var(--border-color)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {companies
                      .filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(c => {
                        const isChecked = allocatingType === 'company' && allocatingTarget.includes(c.id);
                        return (
                          <label 
                            key={c.id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                              margin: 0
                            }}
                          >
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{c.name}</span>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let current = allocatingType === 'company' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  if (!current.includes(c.id)) current.push(c.id);
                                } else {
                                  current = current.filter(id => id !== c.id);
                                }
                                setAllocatingType('company');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }}
                            />
                          </label>
                        );
                      })}
                    {companies.filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>No matching companies found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Option 3: Departments Accordion Section */}
              <div>
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, department: !prev.department }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📂 Departments 
                    {allocatingType === 'department' && allocatingTarget.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                        Active ({allocatingTarget.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.department ? '▼' : '▶'}</span>
                </div>
                {expandedSections.department && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px solid var(--border-color)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {allAvailableDepts
                      .filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(d => {
                        const isChecked = allocatingType === 'department' && allocatingTarget.includes(d);
                        return (
                          <label 
                            key={d} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                              margin: 0
                            }}
                          >
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{d}</span>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let current = allocatingType === 'department' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  if (!current.includes(d)) current.push(d);
                                } else {
                                  current = current.filter(name => name !== d);
                                }
                                setAllocatingType('department');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }}
                            />
                          </label>
                        );
                      })}
                    {allAvailableDepts.filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>No matching departments found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Option 4: Staff/Recruiters Accordion Section */}
              <div>
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, staff: !prev.staff }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👥 Recruiters (Staff) 
                    {allocatingType === 'staff' && allocatingStaffIds.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                        Active ({allocatingStaffIds.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.staff ? '▼' : '▶'}</span>
                </div>
                {expandedSections.staff && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px solid var(--border-color)',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {staff
                      .filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(s => {
                        const isChecked = allocatingType === 'staff' && allocatingStaffIds.includes(s.id);
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
                              backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                              margin: 0
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{s.fullName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.department || 'No Dept'}</span>
                            </div>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let current = allocatingType === 'staff' ? [...allocatingStaffIds] : [];
                                if (e.target.checked) {
                                  if (!current.includes(s.id)) current.push(s.id);
                                } else {
                                  current = current.filter(id => id !== s.id);
                                }
                                setAllocatingType('staff');
                                setAllocatingStaffIds(current);
                                setAllocatingTarget([]);
                              }}
                            />
                          </label>
                        );
                      })}
                    {staff.filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase())).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>No matching recruiters found.</div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  let finalTarget = allocatingTarget;
                  if (allocatingType === 'staff') {
                    if (allocatingStaffIds.length === 0) {
                      onShowToast("Please select at least one staff member.", "warning");
                      return;
                    }
                    finalTarget = allocatingStaffIds;
                  } else if (allocatingType === 'global') {
                    finalTarget = [];
                  } else {
                    if (!finalTarget || finalTarget.length === 0) {
                      if (allocatingType === 'company') finalTarget = companies[0] ? [companies[0].id] : [];
                      if (allocatingType === 'department') finalTarget = allAvailableDepts[0] ? [allAvailableDepts[0]] : [];
                    }
                  }

                  if (allocatingRowId === 'bulk') {
                    handleBulkUpdateAllocation(allocatingType, finalTarget);
                  } else if (allocatingRowId === 'manual') {
                    setAllocationType(allocatingType);
                    if (allocatingType === 'staff') {
                      setSelectedStaffIds(allocatingStaffIds);
                      setAllocationTarget('');
                    } else {
                      setAllocationTarget(finalTarget);
                      setSelectedStaffIds([]);
                    }
                  } else if (String(allocatingRowId).startsWith('exp-stmt-') || String(allocatingRowId).startsWith('stmt-') || !expenses.some(e => e.id === allocatingRowId)) {
                    handleUpdateCategorizedRow(allocatingRowId, 'allocationType', allocatingType);
                    if (allocatingType === 'staff') {
                      handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', allocatingStaffIds);
                      handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', '');
                    } else {
                      handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', finalTarget);
                      handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', []);
                    }
                  } else {
                    const original = expenses.find(e => e.id === allocatingRowId);
                    if (original) {
                      onSaveExpense({
                        ...original,
                        allocationType: allocatingType,
                        allocationTarget: finalTarget
                      });
                      onShowToast("Cost allocation updated for transaction.", "success");
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
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setAllocatingRowId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Placement Linking Selector Modal */}
      {linkingRowId !== null && (
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
            maxWidth: '750px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔗 Select Sales Placement / Invoice to Link Credit
              </h3>
              <button 
                type="button"
                onClick={() => setLinkingRowId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              className="form-input"
              value={placementSearch}
              onChange={(e) => setPlacementSearch(e.target.value)}
              placeholder="Search by candidate name, client company, or placement ID..."
              style={{ fontSize: '13px', padding: '10px' }}
            />

            {/* Placements Table */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="entity-table dense" style={{ fontSize: '11px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                  <tr>
                    <th>Placement ID</th>
                    <th>Client Company</th>
                    <th>Candidate</th>
                    <th style={{ textAlign: 'right' }}>Gross Fee</th>
                    <th>Start Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {placements
                    .filter(p => {
                      if (p.netScoreValue <= 0) return false;
                      const term = placementSearch.toLowerCase();
                      return (
                        (p.placementId || '').toLowerCase().includes(term) ||
                        (p.clientCompany || '').toLowerCase().includes(term) ||
                        (p.candidateName || '').toLowerCase().includes(term)
                      );
                    })
                    .map(p => {
                      const isSelected = linkingPlacementId === p.id;
                      return (
                        <tr 
                          key={p.id} 
                          onClick={() => setLinkingPlacementId(isSelected ? '' : p.id)}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent'
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{p.placementId}</td>
                          <td>{p.clientCompany}</td>
                          <td style={{ fontWeight: 500 }}>{p.candidateName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            £{p.grossFee?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>{p.startDate}</td>
                          <td>
                            <span style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor: p.clientPaymentStatus === 'paid' ? 'var(--success-light)' : 'var(--warning-light)',
                              color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)'
                            }}>
                              {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={isSelected ? "btn-primary" : "btn-secondary"}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', p.id);
                                setLinkingRowId(null);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {placements.filter(p => {
                    if (p.netScoreValue <= 0) return false;
                    const term = placementSearch.toLowerCase();
                    return (
                      (p.placementId || '').toLowerCase().includes(term) ||
                      (p.clientCompany || '').toLowerCase().includes(term) ||
                      (p.candidateName || '').toLowerCase().includes(term)
                    );
                  }).length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                        No placements found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => {
                  handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', '');
                  setLinkingRowId(null);
                }}
              >
                Clear Link
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => {
                  handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', linkingPlacementId);
                  setLinkingRowId(null);
                }}
              >
                Save Link
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

      {/* ==============================================================
          MODAL: QUICK ADD NOMINAL LEDGER CODE
          ============================================================== */}
      {quickAddNominalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(3px)'
        }}>
          <form 
            onSubmit={async (e) => {
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
                  code: codeStr,
                  type: newNominalType
                });
                onShowToast(`Added Nominal category: ${codeStr}`, "success");
                
                // Pre-select it on the row that triggered it
                if (quickAddRowId) {
                  handleUpdateCategorizedRow(quickAddRowId, 'nominalCode', codeStr);
                }
                
                setQuickAddNominalOpen(false);
                setQuickAddRowId(null);
              } catch (err) {
                onShowToast(`Error: ${err.message}`, "warning");
              }
            }}
            className="detail-section"
            style={{
              width: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlusCircle size={14} style={{ color: 'var(--primary)' }} /> Quick Add Nominal Ledger Code
              </h3>
              <button 
                type="button" 
                onClick={() => {
                  setQuickAddNominalOpen(false);
                  setQuickAddRowId(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}
              >
                &times;
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Nominal Code ID (Key) <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 505"
                value={newNominalCodeId}
                onChange={(e) => setNewNominalCodeId(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nominal Label / Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Health Insurance Overhead"
                value={newNominalCodeName}
                onChange={(e) => setNewNominalCodeName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cost Classification Type <span>*</span></label>
              <select 
                className="select-filter"
                value={newNominalType}
                onChange={(e) => setNewNominalType(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="indirect">Indirect Cost (Overhead / G&A)</option>
                <option value="direct">Direct Cost (Salaries, Commission, Placements Cost)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Save & Select
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  setQuickAddNominalOpen(false);
                  setQuickAddRowId(null);
                }}
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
