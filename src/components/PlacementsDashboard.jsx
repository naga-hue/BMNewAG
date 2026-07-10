import React, { useState, useEffect } from 'react';
import MultiSelectFilter from './MultiSelectFilter';
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
  Clock,
  ThumbsUp,
  X
} from 'lucide-react';

const SOURCES = [
  "LinkedIn",
  "Job Board",
  "Internal Database",
  "Client Direct",
  "Headhunted",
  "Referral",
  "Other"
];

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

export default function PlacementsDashboard({
  companies = [],
  staff = [],
  placements = [],
  onSavePlacement,
  onDeletePlacement,
  onSavePlacementsBatch,
  onClearAllPlacements,
  onShowToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // matrix, registry, import, leaderboard

  // Registry states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, dns, rebate
  const [consultantFilter, setConsultantFilter] = useState('all');
  const [startMonthFilter, setStartMonthFilter] = useState('all');
  const [internalCompanyFilter, setInternalCompanyFilter] = useState(['all']);
  const [departmentFilter, setDepartmentFilter] = useState(['all']);

  // Compile list of unique departments from both company profiles and active staff records
  const allAvailableDepts = (() => {
    const depts = [];
    // Add from company profiles
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    // Add from staff profiles
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  })();

  // Manual placement logger states
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingPlacementId, setEditingPlacementId] = useState(null);
  const [viewingPlacement, setViewingPlacement] = useState(null);

  const [pIdInput, setPIdInput] = useState('');
  const [invoiceInput, setInvoiceInput] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [candidateInput, setCandidateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [scoredDateInput, setScoredDateInput] = useState('');
  const [dnsDateInput, setDnsDateInput] = useState('');
  const [sourceInput, setSourceInput] = useState('LinkedIn');
  const [statusInput, setStatusInput] = useState('active');
  const [grossInput, setGrossInput] = useState('');
  const [deductionsInput, setDeductionsInput] = useState('0');
  const [splitsInput, setSplitsInput] = useState([{ staffId: '', percentage: 100 }]);

  // Client payment inputs
  const [clientPaymentStatusInput, setClientPaymentStatusInput] = useState('unpaid'); // paid, unpaid
  const [clientPaidDateInput, setClientPaidDateInput] = useState('');

  // Credit Control Invoice States
  const [invoiceTypeInput, setInvoiceTypeInput] = useState('direct');
  const [simplicityClientNoInput, setSimplicityClientNoInput] = useState('');
  const [simplicityCreditLimitInput, setSimplicityCreditLimitInput] = useState('');
  const [noaRequiredInput, setNoaRequiredInput] = useState(false);
  const [consultantInvoiceReceivedInput, setConsultantInvoiceReceivedInput] = useState(false);
  const [invoiceTriggerTypeInput, setInvoiceTriggerTypeInput] = useState('start-date');
  const [invoiceTriggerCustomDateInput, setInvoiceTriggerCustomDateInput] = useState('');
  const [paymentTermsInput, setPaymentTermsInput] = useState('30');
  const [paymentTermsCustomDaysInput, setPaymentTermsCustomDaysInput] = useState('');

  // CSV Import Wizard states
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [validatedPlacements, setValidatedPlacements] = useState([]);
  const [importStep, setImportStep] = useState(1); // 1: upload, 2: mapping, 3: validation & preview
  const [unmatchedRecruiterMappings, setUnmatchedRecruiterMappings] = useState({}); // name -> staffId

  // Leaderboard filters
  const [leaderboardMonth, setLeaderboardMonth] = useState('2026-06');

  // Matrix & Drill-down states
  const [matrixYear, setMatrixYear] = useState('2026');
  const [matrixViewType, setMatrixViewType] = useState('count'); // count or value
  const [selectedCellPlacements, setSelectedCellPlacements] = useState(null);
  const [showDrilldownModal, setShowDrilldownModal] = useState(false);
  const [drilldownClient, setDrilldownClient] = useState('');
  const [drilldownMonthName, setDrilldownMonthName] = useState('');
  const [expandedKeys, setExpandedKeys] = useState({});

  // Sorting state for Placements registry table
  const [sortBy, setSortBy] = useState('startDate');
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc

  const handleHeaderClick = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const sortPlacements = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';

      if (sortBy === 'netScoreValue' || sortBy === 'grossBillAmount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortBy === 'startDate' || sortBy === 'scoredDate') {
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

  // Trigger Edit Placement
  const handleEditPlacement = (placement) => {
    setEditingPlacementId(placement.id);
    setPIdInput(placement.placementId);
    setInvoiceInput(placement.invoiceNumber || '');
    setClientInput(placement.clientCompany);
    setCandidateInput(placement.candidateName);
    setStartDateInput(placement.startDate);
    setScoredDateInput(placement.scoredDate);
    setDnsDateInput(placement.dnsDate || '');
    setSourceInput(placement.source || 'LinkedIn');
    setStatusInput(placement.status);
    setGrossInput(String(placement.grossBillAmount));
    setDeductionsInput(String(placement.dnsRebateAmount || 0));
    setSplitsInput(placement.splits && placement.splits.length > 0 
      ? placement.splits 
      : [{ staffId: '', percentage: 100 }]);
    setClientPaymentStatusInput(placement.clientPaymentStatus || 'unpaid');
    setClientPaidDateInput(placement.clientPaidDate || '');
    setInvoiceTypeInput(placement.invoiceType || 'direct');
    setSimplicityClientNoInput(placement.simplicityClientNo || '');
    setSimplicityCreditLimitInput(placement.simplicityCreditLimit || '');
    setNoaRequiredInput(!!placement.noaRequired);
    setConsultantInvoiceReceivedInput(!!placement.consultantInvoiceReceived);
    setInvoiceTriggerTypeInput(placement.invoiceTriggerType || 'start-date');
    setInvoiceTriggerCustomDateInput(placement.invoiceTriggerCustomDate || '');
    const terms = String(placement.paymentTermsDays || '30');
    if (['7', '10', '30', '31'].includes(terms)) {
      setPaymentTermsInput(terms);
      setPaymentTermsCustomDaysInput('');
    } else {
      setPaymentTermsInput('custom');
      setPaymentTermsCustomDaysInput(terms);
    }
    
    setShowLogForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit manual placement
  const handlePlacementSubmit = async (e) => {
    e.preventDefault();

    if (!pIdInput.trim() || !clientInput.trim() || !candidateInput.trim() || !startDateInput || !scoredDateInput || !grossInput) {
      onShowToast("Please fill in all required fields.", "warning");
      return;
    }

    // Validate splits
    let totalSplit = 0;
    const cleanSplits = [];
    
    for (const s of splitsInput) {
      if (!s.staffId) {
        onShowToast("Please select a recruiter for all split allocations.", "warning");
        return;
      }
      const percentageVal = Number(s.percentage) || 0;
      if (percentageVal <= 0) {
        onShowToast("Split percentage must be greater than 0%.", "warning");
        return;
      }
      totalSplit += percentageVal;
      cleanSplits.push({ staffId: s.staffId, percentage: percentageVal });
    }

    if (totalSplit !== 100) {
      onShowToast(`Recruiter splits must equal exactly 100% (currently ${totalSplit}%).`, "warning");
      return;
    }

    const gross = Number(grossInput) || 0;
    const deductions = Number(deductionsInput) || 0;
    const netScore = Math.max(0, gross - deductions);

    const pType = invoiceTypeInput;
    const pTrigger = invoiceTriggerTypeInput;
    let raisedDate = '';
    if (pTrigger === 'start-date') {
      raisedDate = startDateInput;
    } else if (pTrigger === 'offer-accepted') {
      raisedDate = scoredDateInput;
    } else {
      raisedDate = invoiceTriggerCustomDateInput || new Date().toISOString().split('T')[0];
    }

    const termDays = paymentTermsInput === 'custom' 
      ? (Number(paymentTermsCustomDaysInput) || 30) 
      : Number(paymentTermsInput);

    const calculateDueDate = (rDate, days) => {
      if (!rDate) return '';
      try {
        const parts = rDate.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + Number(days));
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayVal = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dayVal}`;
        }
      } catch (e) {}
      return rDate;
    };

    const dueDate = calculateDueDate(raisedDate, termDays);

    let vatVal = Math.round(gross * 0.20 * 100) / 100;
    let totalVal = gross + vatVal;

    if (pType === 'simplicity') {
      const factoredGross = Math.round(gross * 0.9704 * 100) / 100;
      vatVal = Math.round(factoredGross * 0.20 * 100) / 100;
      totalVal = factoredGross + vatVal;
    }

    const existingPlacement = editingPlacementId ? placements.find(p => p.id === editingPlacementId) : null;
    const currentAmountPaid = existingPlacement ? (existingPlacement.amountPaid || 0) : (clientPaymentStatusInput === 'paid' ? totalVal : 0);
    const currentBalance = Math.max(0, totalVal - currentAmountPaid);

    let initialPaymentStatus = 'not-invoiced';
    if (clientPaymentStatusInput === 'paid' || currentBalance === 0) {
      initialPaymentStatus = 'paid';
    } else if (existingPlacement && existingPlacement.paymentStatus) {
      initialPaymentStatus = existingPlacement.paymentStatus;
    } else if (invoiceInput.trim()) {
      initialPaymentStatus = 'sent-to-client';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (initialPaymentStatus !== 'paid' && 
        initialPaymentStatus !== 'written-off' && 
        initialPaymentStatus !== 'dns-rebate' && 
        initialPaymentStatus !== 'legal' && 
        initialPaymentStatus !== 'disputed' && 
        dueDate < todayStr) {
      initialPaymentStatus = 'overdue';
    }

    const placementData = {
      id: editingPlacementId || `place-${Date.now()}`,
      placementId: pIdInput.trim(),
      invoiceNumber: invoiceInput.trim() || null,
      clientCompany: clientInput.trim(),
      candidateName: candidateInput.trim(),
      startDate: startDateInput,
      scoredDate: scoredDateInput,
      dnsDate: statusInput === 'dns' ? (dnsDateInput || scoredDateInput) : null,
      status: statusInput,
      source: sourceInput,
      grossBillAmount: gross,
      dnsRebateAmount: deductions,
      dnsAmount: statusInput === 'dns' ? gross : 0,
      rebateAmount: statusInput === 'rebate' || (statusInput !== 'dns' && deductions > 0) ? deductions : 0,
      netScoreValue: netScore,
      splits: cleanSplits,
      clientPaymentStatus: clientPaymentStatusInput,
      clientPaidDate: clientPaymentStatusInput === 'paid' ? (clientPaidDateInput || new Date().toISOString().split('T')[0]) : null,
      importKey: editingPlacementId ? (placements.find(p => p.id === editingPlacementId)?.importKey || null) : "manual",
      
      // Credit Control parameters
      invoiceType: pType,
      simplicityClientNo: pType === 'simplicity' ? simplicityClientNoInput.trim() : null,
      simplicityCreditLimit: pType === 'simplicity' ? simplicityCreditLimitInput.trim() : null,
      noaRequired: pType === 'simplicity' ? noaRequiredInput : false,
      consultantInvoiceReceived: pType === 'simplicity' ? consultantInvoiceReceivedInput : false,
      invoiceTriggerType: pTrigger,
      invoiceTriggerCustomDate: pTrigger === 'custom-date' ? invoiceTriggerCustomDateInput : '',
      invoiceRaisedDate: raisedDate,
      paymentTermsDays: termDays,
      invoiceDueDate: dueDate,
      vatAmount: vatVal,
      totalInvoiceAmount: totalVal,
      paymentStatus: initialPaymentStatus,
      amountPaid: currentAmountPaid,
      balanceOutstanding: currentBalance,
      paymentReceivedDate: clientPaymentStatusInput === 'paid' ? (clientPaidDateInput || todayStr) : (existingPlacement?.paymentReceivedDate || null),
      invoiceFileUrl: existingPlacement?.invoiceFileUrl || '',
      invoiceFileName: existingPlacement?.invoiceFileName || '',
      chaseHistory: existingPlacement?.chaseHistory || [],
      lastChasedDate: existingPlacement?.lastChasedDate || '',
      nextChaseDate: existingPlacement?.nextChaseDate || '',
      disputeReason: existingPlacement?.disputeReason || '',
      disputeDate: existingPlacement?.disputeDate || '',
      disputeOwner: existingPlacement?.disputeOwner || ''
    };

    try {
      await onSavePlacement(placementData);
      onShowToast(
        editingPlacementId 
          ? `Updated placement details for "${candidateInput}"` 
          : `Placement for "${candidateInput}" logged successfully!`, 
        "success"
      );
      
      // Reset Form
      setPIdInput('');
      setInvoiceInput('');
      setClientInput('');
      setCandidateInput('');
      setStartDateInput('');
      setScoredDateInput('');
      setDnsDateInput('');
      setStatusInput('active');
      setGrossInput('');
      setDeductionsInput('0');
      setClientPaymentStatusInput('unpaid');
      setClientPaidDateInput('');
      setSplitsInput([{ staffId: '', percentage: 100 }]);
      setInvoiceTypeInput('direct');
      setSimplicityClientNoInput('');
      setSimplicityCreditLimitInput('');
      setNoaRequiredInput(false);
      setConsultantInvoiceReceivedInput(false);
      setInvoiceTriggerTypeInput('start-date');
      setInvoiceTriggerCustomDateInput('');
      setPaymentTermsInput('30');
      setPaymentTermsCustomDaysInput('');
      setEditingPlacementId(null);
      setShowLogForm(false);
    } catch (err) {
      onShowToast(`Error saving placement: ${err.message}`, "warning");
    }
  };

  // Manage splits form rows
  const handleAddSplitRow = () => {
    setSplitsInput(prev => [...prev, { staffId: '', percentage: 0 }]);
  };

  const handleRemoveSplitRow = (idx) => {
    setSplitsInput(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSplitChange = (idx, field, value) => {
    setSplitsInput(prev => prev.map((s, i) => {
      if (i === idx) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // Quick action: Mark DNS
  const handleQuickDNS = async (placement) => {
    const dnsDate = window.prompt("Enter Date Candidate Did Not Start (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (dnsDate === null) return; // cancel

    const updated = {
      ...placement,
      status: 'dns',
      dnsDate: dnsDate || placement.startDate,
      dnsRebateAmount: placement.grossBillAmount,
      netScoreValue: 0,
      clientPaymentStatus: 'unpaid',
      clientPaidDate: null
    };

    try {
      await onSavePlacement(updated);
      onShowToast(`Placement ${placement.placementId} marked as Did Not Start (DNS).`, 'info');
    } catch (err) {
      onShowToast(`Error updating placement: ${err.message}`, 'warning');
    }
  };

  // Quick action: Apply Rebate
  const handleQuickRebate = async (placement) => {
    const amtStr = window.prompt("Enter Rebate Deduction Amount:", "2000");
    if (amtStr === null) return; // cancel
    const amt = Number(amtStr) || 0;

    const updated = {
      ...placement,
      status: 'rebate',
      dnsRebateAmount: amt,
      netScoreValue: Math.max(0, placement.grossBillAmount - amt)
    };

    try {
      await onSavePlacement(updated);
      onShowToast(`Applied ${amt.toLocaleString()} rebate to placement ${placement.placementId}.`, 'info');
    } catch (err) {
      onShowToast(`Error updating placement: ${err.message}`, 'warning');
    }
  };

  // Quick action: Toggle Client Payment
  const handleToggleClientPayment = async (placement, status) => {
    let paidDate = null;
    if (status === 'paid') {
      const inputDate = window.prompt("Enter Date Client Paid Invoice (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
      if (inputDate === null) return; // cancel
      paidDate = inputDate || new Date().toISOString().split('T')[0];
    }

    const updated = {
      ...placement,
      clientPaymentStatus: status,
      clientPaidDate: paidDate
    };

    try {
      await onSavePlacement(updated);
      onShowToast(
        status === 'paid'
          ? `Marked client invoice for ${placement.placementId} as Paid.`
          : `Reset client invoice for ${placement.placementId} to Unpaid.`,
        'success'
      );
    } catch (err) {
      onShowToast(`Error updating client payment: ${err.message}`, 'warning');
    }
  };

  // CSV Parsing Engine
  const handleCSVDragOver = (e) => {
    e.preventDefault();
  };

  const handleCSVDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleCSVSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const parseCSVLine = (text) => {
    const result = [];
    let startValueIdx = 0;
    let insideQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        let value = text.substring(startValueIdx, i).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        result.push(value.replace(/""/g, '"'));
        startValueIdx = i + 1;
      }
    }
    let lastValue = text.substring(startValueIdx).trim();
    if (lastValue.startsWith('"') && lastValue.endsWith('"')) {
      lastValue = lastValue.substring(1, lastValue.length - 1);
    }
    result.push(lastValue.replace(/""/g, '"'));
    return result;
  };

  const processCSVFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        onShowToast("The uploaded CSV has no rows or is invalid.", "warning");
        return;
      }

      const headers = parseCSVLine(lines[0]);
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = parseCSVLine(lines[i]);
        if (columns.length === headers.length) {
          rows.push(columns);
        }
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvFile(file);
      
      const initialMap = {};
      const requiredMappings = [
        { key: 'placementId', labels: ['Placement ID', 'Import Key', 'id'] },
        { key: 'invoiceNumber', labels: ['Invoice Number', 'Invoice #', 'InvoiceNo'] },
        { key: 'internalCompany', labels: ['Internal Company', 'InternalCompany', 'Entity'] },
        { key: 'clientCompany', labels: ['Client Company', 'Client', 'Company'] },
        { key: 'candidateName', labels: ['Candidate', 'Candidate Name', 'CandidateName'] },
        { key: 'startDate', labels: ['Start Date', 'Start', 'StartDate', 'Joining Date'] },
        { key: 'scoredDate', labels: ['Scored Month', 'Scored Date', 'Confirm Date', 'ScoredMonth', 'ScoredDate'] },
        { key: 'scoredWeek', labels: ['Scored Week', 'ScoredWeek'] },
        { key: 'dnsWeek', labels: ['DNS Week', 'DNSWeek'] },
        { key: 'grossBillAmount', labels: ['Gross Bill Amount', 'Gross', 'Bill Amount', 'GrossBillAmount'] },
        { key: 'dnsRebateAmount', labels: ['DNS/Rebate Amount', 'Deduction', 'Rebate', 'DNSRebateAmount', 'DNS/Rebate'] },
        { key: 'netScoreValue', labels: ['Net Score Value', 'Net Score', 'NetScoreValue'] },
        { key: 'status', labels: ['Status', 'State'] },
        { key: 'source', labels: ['Source', 'Candidate Source'] },
        { key: 'consultants', labels: ['Consultants', 'Recruiter', 'Owner'] },
        { key: 'splitsJson', labels: ['Split Details JSON', 'Splits JSON', 'SplitDetailsJSON'] },
        { key: 'clientPaymentStatus', labels: ['Client Payment Status', 'Payment Status', 'Paid Status'] },
        { key: 'clientPaidDate', labels: ['Client Paid Date', 'Payment Date', 'Date Paid'] }
      ];

      requiredMappings.forEach(mapObj => {
        const foundIdx = headers.findIndex(h => 
          mapObj.labels.some(label => h.toLowerCase() === label.toLowerCase())
        );
        if (foundIdx > -1) {
          initialMap[mapObj.key] = headers[foundIdx];
        }
      });

      setColumnMappings(initialMap);
      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const handleApplyMappings = () => {
    const required = ['placementId', 'clientCompany', 'candidateName', 'startDate', 'grossBillAmount'];
    const missing = required.filter(field => !columnMappings[field]);
    
    if (missing.length > 0) {
      onShowToast(`Please map the required columns: ${missing.join(', ')}`, "warning");
      return;
    }

    validateMappedRows();
    setImportStep(3);
  };

  const parseFlexibleDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return '';
    const clean = dateStr.trim();
    
    // Try splitting by slash or dash
    const parts = clean.split(/[\/\-]/);
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      // Check if the first part is a 4-digit year (e.g. YYYY-MM-DD or YYYY-DD-MM)
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (p1 > 12) {
          // It's YYYY-DD-MM (e.g. 2026-13-07)
          month = p2;
          day = p1;
        } else {
          // Standard YYYY-MM-DD
          month = p1;
          day = p2;
        }
      } else {
        // Standard D/M/YY or M/D/YY (default UK D/M/YY)
        if (year < 100) {
          year = 2000 + year; // Convert 26 to 2026
        }
        // Swap if month is > 12 (e.g. 13/07/26)
        if (month > 12) {
          const tmp = month;
          month = day;
          day = tmp;
        }
      }
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        return `${year}-${formattedMonth}-${formattedDay}`;
      }
    }
    
    // Fallback to native parsing
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        let yr = d.getFullYear();
        if (yr < 1970 && yr > 1900) {
          yr = yr + 100;
        }
        return `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    } catch (e) {}
    
    return '';
  };

  const validateMappedRows = () => {
    const parsed = [];
    const unmatchedNames = new Set();

    csvRows.forEach((row, idx) => {
      const getVal = (field) => {
        const header = columnMappings[field];
        if (!header) return '';
        const colIdx = csvHeaders.indexOf(header);
        return colIdx > -1 ? String(row[colIdx] || '') : '';
      };

      const pId = getVal('placementId') || `PL-IMP-${idx}-${Date.now()}`;
      const candidate = getVal('candidateName');
      const client = getVal('clientCompany');
      const internalCompany = getVal('internalCompany');
      const scoredWeek = getVal('scoredWeek');
      const dnsWeek = getVal('dnsWeek');
      
      const start = parseFlexibleDate(getVal('startDate'));
      
      let scoredRaw = getVal('scoredDate') || getVal('startDate') || '';
      let scored = parseFlexibleDate(scoredRaw);
      if (!scored && scoredRaw.includes(' ')) {
        const parts = scoredRaw.split(' ');
        if (parts.length >= 2) {
          const monthsMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
          const month = monthsMap[parts[0].toLowerCase().substring(0, 3)] || 0;
          const year = Number(parts[1]) || 2026;
          scored = new Date(year, month, 15).toISOString().split('T')[0];
        }
      }
      if (!scored) {
        scored = start;
      }

      const grossVal = getVal('grossBillAmount') || '0';
      const gross = Number(grossVal.replace(/[^0-9.]/g, '')) || 0;
      
      const deductionsVal = getVal('dnsRebateAmount') || '0';
      const deductions = Number(deductionsVal.replace(/[^0-9.]/g, '')) || 0;
      
      const netVal = getVal('netScoreValue') || '';
      const net = netVal !== '' ? (Number(netVal.replace(/[^0-9.]/g, '')) || 0) : Math.max(0, gross - deductions);

      // Parse status
      let status = (getVal('status') || 'active').toLowerCase().trim();
      if (!['active', 'dns', 'rebate'].includes(status)) {
        status = deductions >= gross ? 'dns' : deductions > 0 ? 'rebate' : 'active';
      }

      // Parse Client Payment details
      let clientPaidStatus = (getVal('clientPaymentStatus') || 'unpaid').toLowerCase().trim();
      if (clientPaidStatus.includes('paid') || clientPaidStatus.includes('yes') || clientPaidStatus.includes('true') || clientPaidStatus.includes('received')) {
        clientPaidStatus = 'paid';
      } else {
        clientPaidStatus = 'unpaid';
      }
      
      const clientPaidDateRaw = getVal('clientPaidDate') || new Date().toISOString().split('T')[0];
      const clientPaidDate = clientPaidStatus === 'paid' 
        ? (parseFlexibleDate(clientPaidDateRaw) || new Date().toISOString().split('T')[0]) 
        : null;

      // Parse splits
      const consultantsStr = getVal('consultants');
      const splitsJsonStr = getVal('splitsJson');
      let finalSplits = [];
      const rowIssues = [];

      if (splitsJsonStr && splitsJsonStr.trim() !== '') {
        try {
          let cleanJsonStr = splitsJsonStr.replace(/""/g, '"').trim();
          // Safe conversion of single quotes to double quotes for standard JSON compatibility
          if (cleanJsonStr.includes("'")) {
            cleanJsonStr = cleanJsonStr.replace(/'/g, '"');
          }
          
          const parsedJson = JSON.parse(cleanJsonStr);
          if (Array.isArray(parsedJson)) {
            let specifiedCount = 0;
            const itemsParsed = parsedJson.map(item => {
              const name = item.consultant || item.Consultant || item.name || item.fullName || item.recruiter || item.recruiterName || '';
              let percentageVal = item.share || item.percent || item.percentage || item.value || item.split;
              let pct = null;
              if (percentageVal !== undefined && percentageVal !== null) {
                const cleanedPct = String(percentageVal).replace('%', '').trim();
                const num = Number(cleanedPct);
                if (!isNaN(num) && num > 0) {
                  pct = num;
                  specifiedCount++;
                }
              }
              return { name: name.trim(), pct };
            });

            if (specifiedCount === 0 && itemsParsed.length > 0) {
              const share = Math.round(100 / itemsParsed.length);
              finalSplits = itemsParsed.map((item, idx) => ({
                name: item.name,
                percentage: idx === itemsParsed.length - 1 ? (100 - (share * (itemsParsed.length - 1))) : share
              }));
            } else {
              finalSplits = itemsParsed.map(item => ({
                name: item.name,
                percentage: item.pct !== null ? item.pct : 100
              }));
            }
          } else {
            const entries = Object.entries(parsedJson);
            let specifiedCount = 0;
            const itemsParsed = entries.map(([name, percent]) => {
              let pct = null;
              if (percent !== undefined && percent !== null) {
                const cleanedPct = String(percent).replace('%', '').trim();
                const num = Number(cleanedPct);
                if (!isNaN(num) && num > 0) {
                  pct = num;
                  specifiedCount++;
                }
              }
              return { name: name.trim(), pct };
            });

            if (specifiedCount === 0 && itemsParsed.length > 0) {
              const share = Math.round(100 / itemsParsed.length);
              finalSplits = itemsParsed.map((item, idx) => ({
                name: item.name,
                percentage: idx === itemsParsed.length - 1 ? (100 - (share * (itemsParsed.length - 1))) : share
              }));
            } else {
              finalSplits = itemsParsed.map(item => ({
                name: item.name,
                percentage: item.pct !== null ? item.pct : 100
              }));
            }
          }
        } catch (err) {
          rowIssues.push("Could not parse split JSON field. Falling back to consultant list.");
        }
      }

      if (finalSplits.length === 0 && consultantsStr) {
        const names = consultantsStr.split(/[,&;]/).map(n => n.trim()).filter(n => n !== '');
        if (names.length > 0) {
          const share = Math.round(100 / names.length);
          finalSplits = names.map((name, i) => ({
            name,
            percentage: i === names.length - 1 ? (100 - (share * (names.length - 1))) : share
          }));
        }
      }

      if (finalSplits.length === 0) {
        rowIssues.push("No recruiters assigned. Auto-mapping 100% to first user in list.");
        if (staff.length > 0) {
          finalSplits = [{ name: staff[0].fullName, percentage: 100 }];
        }
      }

      // Validation checks
      const isValidDate = (dStr) => {
        if (!dStr) return false;
        const d = new Date(dStr);
        return !isNaN(d.getTime());
      };

      if (!client || client.trim() === '') {
        rowIssues.push("Client Company is missing.");
      }
      if (!candidate || candidate.trim() === '') {
        rowIssues.push("Candidate Name is missing.");
      }
      if (!start || !isValidDate(start)) {
        rowIssues.push("Official Start Date is missing or invalid (must be DD/MM/YYYY or YYYY-MM-DD).");
      }
      if (scored && !isValidDate(scored)) {
        rowIssues.push("Scored Date is invalid.");
      }
      if (isNaN(gross) || gross <= 0) {
        rowIssues.push("Gross Bill Amount must be greater than 0.");
      }

      // Attempt to resolve staff ids
      const mappedSplits = finalSplits.map(s => {
        const sName = String(s.name || '').trim().toLowerCase();
        
        let matchedStaff = staff.find(member => {
          const mName = String(member.fullName || '').trim().toLowerCase();
          return mName === sName;
        });
        
        if (!matchedStaff && sName !== '') {
          matchedStaff = staff.find(member => {
            const mName = String(member.fullName || '').trim().toLowerCase();
            return mName.includes(sName) || sName.includes(mName);
          });
        }

        if (matchedStaff) {
          return {
            staffId: matchedStaff.id,
            name: matchedStaff.fullName,
            percentage: s.percentage,
            resolved: true
          };
        } else {
          unmatchedNames.add(s.name || 'Unassigned');
          return {
            staffId: '',
            name: s.name || 'Unassigned',
            percentage: s.percentage,
            resolved: false
          };
        }
      });

      const sum = mappedSplits.reduce((acc, item) => acc + item.percentage, 0);
      if (sum !== 100 && mappedSplits.length > 0) {
        rowIssues.push(`Recruiter splits sum is ${sum}% instead of 100%`);
      }

      const hasUnresolved = mappedSplits.some(s => !s.resolved);

      parsed.push({
        id: `place-imp-${idx}-${Date.now()}`,
        placementId: pId,
        invoiceNumber: getVal('invoiceNumber') || `INV-IMP-${idx}`,
        internalCompany,
        clientCompany: client,
        candidateName: candidate,
        startDate: start,
        scoredDate: scored,
        scoredWeek,
        dnsWeek,
        dnsDate: status === 'dns' ? start : null,
        status,
        source: getVal('source') || 'LinkedIn',
        grossBillAmount: gross,
        dnsRebateAmount: deductions,
        dnsAmount: status === 'dns' ? gross : 0,
        rebateAmount: status === 'rebate' || (status !== 'dns' && deductions > 0) ? deductions : 0,
        netScoreValue: net,
        splits: mappedSplits,
        clientPaymentStatus: clientPaidStatus,
        clientPaidDate,
        issues: rowIssues,
        isValid: !hasUnresolved && sum === 100 && rowIssues.length === 0,
        importKey: `batch-${csvFile?.name || 'csv'}`
      });
    });

    setValidatedPlacements(parsed);
    
    const mapper = {};
    unmatchedNames.forEach(name => {
      mapper[name] = '';
    });
    setUnmatchedRecruiterMappings(mapper);
  };

  const handleUnmatchedMapChange = (name, staffId) => {
    setUnmatchedRecruiterMappings(prev => ({
      ...prev,
      [name]: staffId
    }));
  };

  const handleResolveUnmatched = () => {
    const updatedPlacements = validatedPlacements.map(p => {
      let allResolved = true;
      const updatedSplits = p.splits.map(s => {
        if (s.resolved) return s;

        const manualStaffId = unmatchedRecruiterMappings[s.name];
        if (manualStaffId) {
          const matchedStaff = staff.find(member => member.id === manualStaffId);
          return {
            ...s,
            staffId: manualStaffId,
            name: matchedStaff ? matchedStaff.fullName : s.name,
            resolved: true
          };
        }
        allResolved = false;
        return s;
      });

      const sum = updatedSplits.reduce((acc, item) => acc + item.percentage, 0);
      const hasIssues = p.issues.length > 0 || sum !== 100;

      return {
        ...p,
        splits: updatedSplits,
        isValid: allResolved && !hasIssues
      };
    });

    setValidatedPlacements(updatedPlacements);
    onShowToast("Applied custom recruiter maps.", "success");
  };

  const handleSaveImportBatch = async () => {
    const invalidRowsCount = validatedPlacements.filter(p => !p.isValid).length;
    if (invalidRowsCount > 0) {
      if (!window.confirm(`There are ${invalidRowsCount} rows with errors or unmapped staff. These rows will NOT be imported. Continue?`)) {
        return;
      }
    }

    const cleanImports = validatedPlacements
      .filter(p => p.isValid)
      .map(p => {
        const finalSplits = p.splits.map(s => ({
          staffId: s.staffId,
          percentage: s.percentage
        }));
        return {
          id: p.id,
          placementId: p.placementId,
          invoiceNumber: p.invoiceNumber,
          internalCompany: p.internalCompany || '',
          clientCompany: p.clientCompany,
          candidateName: p.candidateName,
          startDate: p.startDate,
          scoredDate: p.scoredDate,
          scoredWeek: p.scoredWeek || '',
          dnsWeek: p.dnsWeek || '',
          dnsDate: p.dnsDate,
          status: p.status,
          source: p.source,
          grossBillAmount: p.grossBillAmount,
          dnsRebateAmount: p.dnsRebateAmount,
          dnsAmount: p.dnsAmount || (p.status === 'dns' ? p.grossBillAmount : 0),
          rebateAmount: p.rebateAmount || (p.status === 'rebate' || (p.status !== 'dns' && p.dnsRebateAmount > 0) ? p.dnsRebateAmount : 0),
          netScoreValue: p.netScoreValue,
          splits: finalSplits,
          clientPaymentStatus: p.clientPaymentStatus,
          clientPaidDate: p.clientPaidDate,
          importKey: p.importKey
        };
      });

    if (cleanImports.length === 0) {
      onShowToast("No valid rows to import.", "warning");
      return;
    }

    try {
      await onSavePlacementsBatch(cleanImports);
      onShowToast(`Successfully imported ${cleanImports.length} placements!`, "success");
      
      setCsvFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setValidatedPlacements([]);
      setImportStep(1);
      setActiveSubTab('registry');
    } catch (err) {
      onShowToast(`Error committing import: ${err.message}`, "warning");
    }
  };

  // Billings Leaderboard calculations based on splits
  const getLeaderboardData = () => {
    const [year, month] = leaderboardMonth.split('-').map(Number);
    
    const summaries = staff.map(member => {
      let totalBilling = 0;
      let placementCount = 0;

      placements.forEach(p => {
        if (p.status === 'dns') return;
        const dateStr = p.startDate || p.scoredDate || '';
        if (!dateStr) return;
        const pDate = new Date(dateStr);
        if (pDate.getFullYear() === year && (pDate.getMonth() + 1) === month) {
          const splitObj = p.splits?.find(s => s.staffId === member.id);
          if (splitObj) {
            const allocation = (p.netScoreValue * splitObj.percentage) / 100;
            totalBilling += allocation;
            placementCount += (Number(splitObj.percentage) || 0) / 100;
          }
        }
      });

      return {
        member,
        totalBilling,
        placementCount
      };
    });

    return summaries.sort((a, b) => b.totalBilling - a.totalBilling);
  };

  const leaderboardList = getLeaderboardData();
  const maxBilling = Math.max(...leaderboardList.map(l => l.totalBilling), 1);

  // Filter placements
  const filteredPlacements = placements.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;

    if (consultantFilter !== 'all') {
      const hasConsultant = p.splits?.some(s => s.staffId === consultantFilter);
      if (!hasConsultant) return false;
    }

    if (startMonthFilter !== 'all') {
      if (!p.startDate) return false;
      const pStart = new Date(p.startDate);
      if (pStart.getMonth() !== Number(startMonthFilter)) return false;
    }

    if (!internalCompanyFilter.includes('all')) {
      if (!p.internalCompany || !internalCompanyFilter.includes(p.internalCompany)) return false;
    }

    if (!departmentFilter.includes('all')) {
      const matchDept = p.splits?.some(s => {
        const staffObj = staff.find(member => member.id === s.staffId);
        return staffObj && departmentFilter.includes(staffObj.department);
      });
      if (!matchDept) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPId = p.placementId.toLowerCase().includes(q);
      const matchClient = p.clientCompany.toLowerCase().includes(q);
      const matchCandidate = p.candidateName.toLowerCase().includes(q);
      const matchRecruiters = p.splits?.some(s => {
        const staffObj = staff.find(member => member.id === s.staffId);
        return staffObj?.fullName.toLowerCase().includes(q);
      });
      return matchPId || matchClient || matchCandidate || matchRecruiters;
    }

    return true;
  });

  const sortedPlacements = sortPlacements(filteredPlacements);

  const handleExportPlacements = () => {
    const headers = [
      "Placement ID",
      "Client",
      "Candidate",
      "Position Title",
      "Type",
      "Start Date",
      "Gross Billing",
      "Currency",
      "Net Score Value",
      "Payment Status",
      "Recruiter Splits"
    ];
    const rows = sortedPlacements.map(p => [
      p.placementId || '',
      p.clientName || '',
      p.candidateName || '',
      p.positionTitle || '',
      p.placementType || 'permanent',
      p.startDate || '',
      p.grossBillAmount || 0,
      p.currency || 'GBP',
      p.netScoreValue || 0,
      p.clientPaymentStatus || 'pending',
      (p.splits || []).map(s => {
        const member = staff.find(item => item.id === s.staffId);
        return `${member ? member.fullName : s.staffId} (${s.percentage}%)`;
      }).join('; ')
    ]);
    
    const escapeCsv = (val) => {
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
    link.setAttribute('download', "Placements_Registry.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Placements registry exported to CSV successfully.", "success");
  };

  // Compute matching split ratio weight helper
  const getPlacementSplitWeight = (p) => {
    // If no filters are active, return full 100% weight (1.0)
    if (consultantFilter === 'all' && departmentFilter.includes('all') && internalCompanyFilter.includes('all')) {
      return 1.0;
    }

    if (!p.splits || p.splits.length === 0) {
      return 1.0;
    }

    let matchingPercentage = 0;
    p.splits.forEach(s => {
      let match = true;
      const rec = staff.find(st => st.id === s.staffId);

      if (consultantFilter !== 'all' && s.staffId !== consultantFilter) match = false;
      if (!departmentFilter.includes('all') && (!rec || !departmentFilter.includes(rec.department))) match = false;
      if (!internalCompanyFilter.includes('all') && (!rec || !internalCompanyFilter.includes(rec.companyId))) match = false;

      if (match) {
        matchingPercentage += Number(s.percentage) || 0;
      }
    });

    return matchingPercentage / 100;
  };

  const totalGross = filteredPlacements.reduce((acc, p) => acc + ((p.grossBillAmount || 0) * getPlacementSplitWeight(p)), 0);
  const totalDns = filteredPlacements.reduce((acc, p) => {
    const w = getPlacementSplitWeight(p);
    if (p.status === 'dns') {
      return acc + ((p.grossBillAmount || 0) * w);
    }
    return acc + ((p.dnsAmount || 0) * w);
  }, 0);
  const totalRebate = filteredPlacements.reduce((acc, p) => {
    const w = getPlacementSplitWeight(p);
    if (p.status === 'rebate' || (p.status !== 'dns' && p.dnsRebateAmount > 0)) {
      return acc + ((p.dnsRebateAmount || 0) * w);
    }
    return acc + ((p.rebateAmount || 0) * w);
  }, 0);
  const totalNet = filteredPlacements.reduce((acc, p) => acc + ((p.netScoreValue || 0) * getPlacementSplitWeight(p)), 0);

  const companyOptions = [
    { value: 'all', label: 'All Internal Companies' },
    ...companies.map(c => ({ value: c.name, label: c.name }))
  ];

  const departmentOptionsList = [
    { value: 'all', label: 'All Departments' },
    ...allAvailableDepts.map(d => ({ value: d, label: d }))
  ];

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
          { key: 'matrix', label: 'YTD Client Placements Matrix' },
          { key: 'registry', label: 'Placements Log Desk' },
          { key: 'import', label: 'CSV Spreadsheet Importer' },
          { key: 'leaderboard', label: 'Monthly Billing Rankings' }
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
          SUB-TAB 1: PLACEMENTS REGISTRY
          ============================================================== */}
      {activeSubTab === 'registry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Sales Placements & Billing Logs</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Log candidates placements, splits allocation ratios, and adjust DNS/Rebates items.</p>
            </div>
            
            <button className="btn-primary" onClick={() => {
              setEditingPlacementId(null);
              setPIdInput('');
              setInvoiceInput('');
              setClientInput('');
              setCandidateInput('');
              setStartDateInput('');
              setScoredDateInput('');
              setDnsDateInput('');
              setStatusInput('active');
              setGrossInput('');
              setDeductionsInput('0');
              setClientPaymentStatusInput('unpaid');
              setClientPaidDateInput('');
              setSplitsInput([{ staffId: '', percentage: 100 }]);
              setShowLogForm(prev => !prev);
            }}>
              <Plus size={16} /> {showLogForm ? 'Close Log Form' : 'Log Placement'}
            </button>
          </div>

          {/* Placements billing calculations metrics summary grid */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div className="metric-card" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Gross Placed Volume</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>£{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="metric-card" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>DNS Lost Volume</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--danger)' }}>-£{totalDns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="metric-card" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Rebate Deductions</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warning)' }}>-£{totalRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="metric-card" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Net Fee Volume</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>£{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Log Placement Form (Popup modal card) */}
          {showLogForm && (
            <div className="form-wizard-overlay" onClick={() => { setShowLogForm(false); setEditingPlacementId(null); }}>
              <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                      <Plus size={20} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                        {editingPlacementId ? 'Modify Placement Records' : 'Log Placed Candidate Sales'}
                      </h2>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill in placement details below</span>
                    </div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => { setShowLogForm(false); setEditingPlacementId(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>
                
                <form onSubmit={handlePlacementSubmit} className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> {editingPlacementId ? 'Modify Placement Records' : 'Log Placed Candidate Sales'}
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">CRM Placement ID <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. PL-59283"
                    value={pIdInput}
                    onChange={(e) => setPIdInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Invoice Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. INV-2026-10"
                    value={invoiceInput}
                    onChange={(e) => setInvoiceInput(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Candidate Source</label>
                  <select 
                    className="select-filter"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {SOURCES.map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Client Company <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Company candidate is placed at"
                    value={clientInput}
                    onChange={(e) => setClientInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Candidate Full Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Placed candidate name"
                    value={candidateInput}
                    onChange={(e) => setCandidateInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Work Start Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={startDateInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDateInput(val);
                      if (!scoredDateInput || scoredDateInput === startDateInput) {
                        setScoredDateInput(val);
                      }
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scored Confirmation Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={scoredDateInput}
                    onChange={(e) => setScoredDateInput(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Defines the commission calendar month this deal lands in.
                  </span>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Gross Fee Amount <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 15000"
                    value={grossInput}
                    onChange={(e) => setGrossInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Placement status <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={statusInput}
                    onChange={(e) => {
                      setStatusInput(e.target.value);
                      if (e.target.value === 'dns') {
                        setDeductionsInput(grossInput);
                      } else if (e.target.value === 'active') {
                        setDeductionsInput('0');
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="active">Active Placement</option>
                    <option value="dns">Did Not Start (DNS)</option>
                    <option value="rebate">Rebated Placement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Deductions (DNS / Rebate Amount)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={deductionsInput}
                    onChange={(e) => setDeductionsInput(e.target.value)}
                    disabled={statusInput === 'dns'}
                  />
                </div>
              </div>

              {statusInput === 'dns' && (
                <div className="form-group" style={{ animation: 'fadeIn 0.2s' }}>
                  <label className="form-label">DNS Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={dnsDateInput}
                    onChange={(e) => setDnsDateInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Credit Control Settings */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', margin: '0 0 4px 0' }}>Credit Control & Billing Setup</h4>
                
                <div className="form-group-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice Type <span>*</span></label>
                    <select
                      className="select-filter"
                      value={invoiceTypeInput}
                      onChange={(e) => setInvoiceTypeInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="direct">Direct Invoice</option>
                      <option value="simplicity">Simplicity Invoice</option>
                    </select>
                  </div>

                  {/* Simplicity Fields Injection */}
                  {invoiceTypeInput === 'simplicity' && (
                    <div style={{ 
                      gridColumn: '1 / -1',
                      backgroundColor: 'rgba(99, 102, 241, 0.03)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      padding: '16px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      animation: 'fadeIn 0.2s',
                      marginTop: '8px'
                    }}>
                      <h5 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🛡️ Simplicity Factoring Details
                      </h5>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Simplicity Client Number</label>
                          <input
                            type="text"
                            className="form-input"
                            value={simplicityClientNoInput}
                            onChange={(e) => setSimplicityClientNoInput(e.target.value)}
                            placeholder="e.g. 4037676"
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Available Credit Limit</label>
                          <input
                            type="text"
                            className="form-input"
                            value={simplicityCreditLimitInput}
                            onChange={(e) => setSimplicityCreditLimitInput(e.target.value)}
                            placeholder="e.g. £30,000.00 or Cr. Req sent"
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={noaRequiredInput}
                            onChange={(e) => setNoaRequiredInput(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          NOA Required?
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={consultantInvoiceReceivedInput}
                            onChange={(e) => setConsultantInvoiceReceivedInput(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Consultant Invoice Received?
                        </label>
                      </div>

                      {/* Factoring Math Breakdown Preview */}
                      {grossInput && !isNaN(Number(grossInput)) && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '12px', 
                          backgroundColor: 'var(--bg-secondary)', 
                          borderRadius: '6px', 
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>Estimated Factoring Breakdown (2.96% Fee):</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '4px', fontFamily: 'monospace' }}>
                            <div>Net Fee Value:</div>
                            <div style={{ textAlign: 'right' }}>£{Number(grossInput).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div>Total to Humres (97.04%):</div>
                            <div style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>£{(Number(grossInput) * 0.9704).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div>VAT on factored total (20%):</div>
                            <div style={{ textAlign: 'right' }}>£{(Number(grossInput) * 0.9704 * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 'bold' }}>Expected Friday Payout:</div>
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                              £{(Number(grossInput) * 0.9704 * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice to be Raised On <span>*</span></label>
                    <select
                      className="select-filter"
                      value={invoiceTriggerTypeInput}
                      onChange={(e) => setInvoiceTriggerTypeInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="start-date">Candidate Start Date</option>
                      <option value="offer-accepted">Date Offer Accepted</option>
                      <option value="custom-date">Custom Date...</option>
                    </select>
                  </div>

                  {invoiceTriggerTypeInput === 'custom-date' && (
                    <div className="form-group" style={{ marginBottom: 0, animation: 'fadeIn 0.2s' }}>
                      <label className="form-label">Custom Invoice Date <span>*</span></label>
                      <input
                        type="date"
                        className="form-input"
                        value={invoiceTriggerCustomDateInput}
                        onChange={(e) => setInvoiceTriggerCustomDateInput(e.target.value)}
                        required={invoiceTriggerTypeInput === 'custom-date'}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice Due In <span>*</span></label>
                    <select
                      className="select-filter"
                      value={paymentTermsInput}
                      onChange={(e) => setPaymentTermsInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="7">7 Days</option>
                      <option value="10">10 Days</option>
                      <option value="30">30 Days</option>
                      <option value="31">31 Days</option>
                      <option value="custom">Custom Days...</option>
                    </select>
                  </div>

                  {paymentTermsInput === 'custom' && (
                    <div className="form-group" style={{ marginBottom: 0, animation: 'fadeIn 0.2s' }}>
                      <label className="form-label">Custom Terms (Days) <span>*</span></label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 45"
                        value={paymentTermsCustomDaysInput}
                        onChange={(e) => setPaymentTermsCustomDaysInput(e.target.value)}
                        required={paymentTermsInput === 'custom'}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Client Invoice Payment settings */}
              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Client Invoice Payment Status</label>
                  <select 
                    className="select-filter"
                    value={clientPaymentStatusInput}
                    onChange={(e) => {
                      setClientPaymentStatusInput(e.target.value);
                      if (e.target.value === 'unpaid') {
                        setClientPaidDateInput('');
                      } else {
                        setClientPaidDateInput(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="unpaid">Unpaid / Pending Client Settlement</option>
                    <option value="paid">Paid by Client</option>
                  </select>
                </div>

                {clientPaymentStatusInput === 'paid' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s' }}>
                    <label className="form-label">Date Client Settled Invoice <span>*</span></label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={clientPaidDateInput}
                      onChange={(e) => setClientPaidDateInput(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Splits setup */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Recruiter Splits Allocation</label>
                  <button type="button" className="btn-secondary" onClick={handleAddSplitRow} style={{ padding: '4px 10px', fontSize: '11px' }}>
                    + Add Recruiter Split
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {splitsInput.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select
                        className="select-filter"
                        value={row.staffId}
                        onChange={(e) => handleSplitChange(idx, 'staffId', e.target.value)}
                        style={{ flex: 2, padding: '8px' }}
                        required
                      >
                        <option value="">-- Choose Recruiter --</option>
                        {staff.map(member => (
                          <option key={member.id} value={member.id}>{member.fullName} ({member.jobTitle})</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="%"
                          value={row.percentage}
                          onChange={(e) => handleSplitChange(idx, 'percentage', e.target.value)}
                          style={{ padding: '6px' }}
                          required
                        />
                        <span style={{ fontSize: '13px' }}>%</span>
                      </div>

                      {splitsInput.length > 1 && (
                        <button type="button" className="btn-icon delete" onClick={() => handleRemoveSplitRow(idx)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

                  <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button type="button" className="btn-secondary" onClick={() => {
                      setShowLogForm(false);
                      setEditingPlacementId(null);
                    }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      {editingPlacementId ? 'Update Placement' : 'Save Placement Log'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Filters controls */}
          <div className="controls-row">
            <div className="search-filter-group">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search placement id, client, candidate, or recruiter..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select 
                className="select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Placement Statuses</option>
                <option value="active">Active Placements Only</option>
                <option value="dns">Did Not Start (DNS)</option>
                <option value="rebate">Rebated Placements</option>
              </select>

              {/* Consultant/Recruiter Filter */}
              <select 
                className="select-filter"
                value={consultantFilter}
                onChange={(e) => setConsultantFilter(e.target.value)}
              >
                <option value="all">All Consultants</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>

              {/* Start Month Filter */}
              <select 
                className="select-filter"
                value={startMonthFilter}
                onChange={(e) => setStartMonthFilter(e.target.value)}
              >
                <option value="all">All Start Months</option>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <MultiSelectFilter
                options={companyOptions}
                selectedValues={internalCompanyFilter}
                onChange={(vals) => setInternalCompanyFilter(vals)}
                placeholder="Select Companies"
              />

              <MultiSelectFilter
                options={departmentOptionsList}
                selectedValues={departmentFilter}
                onChange={(vals) => setDepartmentFilter(vals)}
                placeholder="Select Departments"
              />
            </div>

            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleExportPlacements}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
            >
              📥 Export CSV
            </button>
          </div>

          {/* Placements registry listing table */}
          <div className="table-container">
            <table className="entity-table dense">
              <thead>
                <tr>
                  <th onClick={() => handleHeaderClick('placementId')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Placement ID {renderSortIndicator('placementId')}
                  </th>
                  <th onClick={() => handleHeaderClick('clientCompany')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Client Company {renderSortIndicator('clientCompany')}
                  </th>
                  <th onClick={() => handleHeaderClick('candidateName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Candidate {renderSortIndicator('candidateName')}
                  </th>
                  <th onClick={() => handleHeaderClick('startDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Dates (Start / Scored) {renderSortIndicator('startDate')}
                  </th>
                  <th onClick={() => handleHeaderClick('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Status {renderSortIndicator('status')}
                  </th>
                  <th onClick={() => handleHeaderClick('clientPaymentStatus')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Client Payment Status {renderSortIndicator('clientPaymentStatus')}
                  </th>
                  <th onClick={() => handleHeaderClick('grossBillAmount')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Gross fee {renderSortIndicator('grossBillAmount')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th onClick={() => handleHeaderClick('netScoreValue')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    Net Fee Score {renderSortIndicator('netScoreValue')}
                  </th>
                  <th>Recruiters Splits Allocation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlacements.map(p => {
                  const statusColors = {
                    active: { label: 'Active', color: 'var(--success)' },
                    dns: { label: 'DNS', color: 'var(--danger)' },
                    rebate: { label: 'Rebated', color: 'var(--warning)' }
                  };
                  const config = statusColors[p.status] || { label: p.status, color: 'var(--text-secondary)' };

                  return (
                    <tr 
                      key={p.id}
                      onClick={() => setViewingPlacement(p)}
                      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                      className="placement-row-hover"
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        <div>{p.placementId}</div>
                        {p.invoiceNumber && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Invoice: {p.invoiceNumber}</div>}
                      </td>
                      <td>{p.clientCompany}</td>
                      <td>{p.candidateName}</td>
                      <td style={{ fontSize: '11px' }}>
                        <div>Start: <strong>{p.startDate}</strong></div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Scored: {p.scoredDate}</div>
                        {p.dnsDate && <div style={{ color: 'var(--danger)', marginTop: '2px' }}>DNS: {p.dnsDate}</div>}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: config.color,
                          backgroundColor: `${config.color}15`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${config.color}35`,
                          display: 'inline-block'
                        }}>
                          {config.label}
                        </span>
                      </td>
                      
                      {/* Client payment status display */}
                      <td>
                        {p.clientPaymentStatus === 'paid' ? (
                          <div>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: 'var(--success)', 
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid rgba(16, 185, 129, 0.15)'
                            }}>
                              Client Paid
                            </span>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Paid: {p.clientPaidDate}</div>
                          </div>
                        ) : (
                          <div>
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: 'var(--danger)', 
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid rgba(239, 68, 68, 0.15)'
                            }}>
                              Invoice Unpaid
                            </span>
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600 }}>£{p.grossBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: p.status === 'dns' || p.dnsRebateAmount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {p.status === 'dns' ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>-£{p.grossBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: '9px', color: 'var(--danger)' }}>DNS Full Loss</div>
                          </div>
                        ) : p.dnsRebateAmount > 0 ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>-£{p.dnsRebateAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: '9px', color: 'var(--warning)' }}>Rebate Adjustment</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        <div>£{p.netScoreValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        {getPlacementSplitWeight(p) < 1.0 && (
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Share: £{(p.netScoreValue * getPlacementSplitWeight(p)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {p.splits?.map((s, i) => {
                          const matchedStaff = staff.find(member => member.id === s.staffId);
                          return (
                            <div key={i} style={{ marginBottom: '2px' }}>
                              &bull; {matchedStaff ? matchedStaff.fullName : 'Unknown'} (<strong>{s.percentage}%</strong>)
                            </div>
                          );
                        })}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {p.status === 'active' && (
                            <>
                              <button 
                                className="btn-secondary" 
                                title="Mark Did Not Start"
                                onClick={() => handleQuickDNS(p)}
                                style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                              >
                                DNS
                              </button>
                              <button 
                                className="btn-secondary" 
                                title="Apply Rebate"
                                onClick={() => handleQuickRebate(p)}
                                style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                              >
                                Rebate
                              </button>
                            </>
                          )}
                          
                          {/* Client Payment Quick Toggles */}
                          {p.clientPaymentStatus === 'paid' ? (
                            <button
                              className="btn-secondary"
                              onClick={() => handleToggleClientPayment(p, 'unpaid')}
                              style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                            >
                              Reset Unpaid
                            </button>
                          ) : (
                            <button
                              className="btn-secondary"
                              onClick={() => handleToggleClientPayment(p, 'paid')}
                              style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--success)', color: 'var(--success)' }}
                            >
                              Client Paid
                            </button>
                          )}

                          <button className="btn-icon" onClick={() => handleEditPlacement(p)} title="Edit details">
                            <Edit3 size={11} />
                          </button>
                          <button 
                            className="btn-icon delete" 
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete placement record "${p.placementId}"?`)) {
                                onDeletePlacement(p.id);
                                onShowToast(`Deleted placement "${p.placementId}"`, "info");
                              }
                            }} 
                            title="Delete record"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPlacements.length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No placement logs found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 2: CSV IMPORTER WIZARD
          ============================================================== */}
      {activeSubTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>CRM Placement Spreadsheet Importer</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Upload your placement CSV records directly from your CRM, map headers, resolve recruiter roster names, and batch upload.</p>
            </div>
            {onClearAllPlacements && (
              <button 
                type="button" 
                className="btn-danger" 
                onClick={onClearAllPlacements}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
              >
                <Trash2 size={14} />
                Clear Database
              </button>
            )}
          </div>

          {importStep === 1 && (
            <div 
              className="upload-zone"
              onDragOver={handleCSVDragOver}
              onDrop={handleCSVDrop}
              onClick={() => document.getElementById('csv-uploader-file-picker').click()}
              style={{ padding: '40px', borderStyle: 'dashed', borderRadius: '8px', cursor: 'pointer' }}
            >
              <input 
                type="file" 
                id="csv-uploader-file-picker" 
                accept=".csv" 
                style={{ display: 'none' }}
                onChange={handleCSVSelect}
              />
              <UploadCloud size={48} className="upload-icon" style={{ marginBottom: '16px' }} />
              <span className="upload-text" style={{ fontSize: '16px', fontWeight: 600 }}>Drag and drop placement CSV here or Browse</span>
              <span className="upload-subtext" style={{ marginTop: '8px' }}>Supported header keys: Placement ID, Client, Candidate, Start Date, Gross Bill Amount, Split details...</span>
            </div>
          )}

          {importStep === 2 && (
            <div className="detail-section" style={{ animation: 'fadeIn 0.2s' }}>
              <div className="section-title">
                <Grid size={16} /> Map CSV Headers to Database Fields
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                We parsed the column headers of your file **{csvFile?.name}**. Map them to target placements values below.
              </p>

              <div className="form-group-row" style={{ flexWrap: 'wrap' }}>
                {[
                  { key: 'placementId', label: 'Placement ID (CRM ID) *' },
                  { key: 'invoiceNumber', label: 'Invoice Number' },
                  { key: 'clientCompany', label: 'Client Company *' },
                  { key: 'candidateName', label: 'Candidate Full Name *' },
                  { key: 'startDate', label: 'Start Date (Start)*' },
                  { key: 'scoredDate', label: 'Scored Confirmation Date' },
                  { key: 'grossBillAmount', label: 'Gross Fee Amount *' },
                  { key: 'dnsRebateAmount', label: 'DNS/Rebate Deduction' },
                  { key: 'status', label: 'Status field' },
                  { key: 'source', label: 'Sourcing channel' },
                  { key: 'consultants', label: 'Consultants Name List' },
                  { key: 'splitsJson', label: 'Splits Details JSON' },
                  { key: 'clientPaymentStatus', label: 'Client Payment Status' },
                  { key: 'clientPaidDate', label: 'Client Payment Date' }
                ].map(item => (
                  <div key={item.key} className="form-group" style={{ flex: '1 1 250px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>{item.label}</label>
                    <select
                      className="select-filter"
                      value={columnMappings[item.key] || ''}
                      onChange={(e) => setColumnMappings(prev => ({ ...prev, [item.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px' }}
                    >
                      <option value="">-- Ignore / Not in CSV --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" className="btn-primary" onClick={handleApplyMappings}>
                  Validate Mapped Rows
                </button>
                <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>
                  Back
                </button>
              </div>
            </div>
          )}

          {importStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.2s' }}>
              
              {Object.keys(unmatchedRecruiterMappings).length > 0 && (
                <div className="detail-section" style={{ border: '1px solid var(--warning)', backgroundColor: 'rgba(245,158,11,0.02)' }}>
                  <div className="section-title" style={{ color: 'var(--warning)' }}>
                    <AlertTriangle size={16} /> Unresolved Recruiter Names Found
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    The following recruiter names in the CSV splits could not be resolved automatically. Map them manually to employees:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(unmatchedRecruiterMappings).map(name => (
                      <div key={name} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, width: '200px' }}>"{name}" maps to:</span>
                        <select
                          className="select-filter"
                          value={unmatchedRecruiterMappings[name]}
                          onChange={(e) => handleUnmatchedMapChange(name, e.target.value)}
                          style={{ padding: '6px', minWidth: '220px' }}
                        >
                          <option value="">-- Choose Active Employee --</option>
                          {staff.map(member => (
                            <option key={member.id} value={member.id}>{member.fullName}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="btn-secondary" onClick={handleResolveUnmatched} style={{ marginTop: '16px', padding: '6px 16px' }}>
                    Apply Mappings & Validate
                  </button>
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>CSV Import Rows Preview ({validatedPlacements.length} rows parsed)</h3>
                
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="entity-table dense">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Placement ID</th>
                        <th>Client</th>
                        <th>Candidate</th>
                        <th>Start Date</th>
                        <th>Client Payment</th>
                        <th style={{ textAlign: 'right' }}>Net Billing</th>
                        <th>Recruiters Splits Mapped</th>
                        <th>Errors / Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validatedPlacements.map((p, i) => (
                        <tr key={i} style={{ opacity: p.isValid ? 1 : 0.75 }}>
                          <td>
                            {p.isValid ? (
                              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                            ) : (
                              <XCircle size={16} style={{ color: 'var(--danger)' }} />
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{p.placementId}</td>
                          <td>{p.clientCompany}</td>
                          <td>{p.candidateName}</td>
                          <td>{p.startDate}</td>
                          <td>
                            <span style={{ color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--danger)', fontSize: '11px', fontWeight: 600 }}>
                              {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>£{p.netScoreValue.toLocaleString()}</td>
                          <td>
                            {p.splits.map((s, idx) => (
                              <div key={idx} style={{ fontSize: '11px', color: s.resolved ? 'var(--text-primary)' : 'var(--danger)' }}>
                                &bull; {s.name} ({s.percentage}%) {s.resolved ? '✔️' : '❌ Unmapped'}
                              </div>
                            ))}
                          </td>
                          <td style={{ color: 'var(--danger)', fontSize: '11px' }}>
                            {p.issues.map((issue, idx) => (
                              <div key={idx}>&bull; {issue}</div>
                            ))}
                            {p.splits.some(s => !s.resolved) && <div>&bull; Contains unmapped staff name.</div>}
                            {p.isValid && <span style={{ color: 'var(--success)' }}>Ready</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-primary" onClick={handleSaveImportBatch}>
                  Commit Valid Imports ({validatedPlacements.filter(p => p.isValid).length} rows)
                </button>
                <button type="button" className="btn-secondary" onClick={() => setImportStep(2)}>
                  Back to Mappings
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: GROUP LEADERBOARDS
          ============================================================== */}
      {activeSubTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Consultant Billing Rankings</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Rankings based on split placement net fees generated during the selected calendar month.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Select Month:</span>
              <input
                type="month"
                className="select-filter"
                value={leaderboardMonth}
                onChange={(e) => setLeaderboardMonth(e.target.value)}
                style={{ padding: '6px' }}
              />
            </div>
          </div>

          <div className="chart-card" style={{ width: '100%', padding: '24px' }}>
            <div className="distribution-list" style={{ gap: '20px' }}>
              {leaderboardList.map((row, idx) => (
                <div key={row.member.id} className="distribution-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: 700, 
                        color: idx === 0 ? 'var(--warning)' : 'var(--text-muted)',
                        width: '24px', 
                        textAlign: 'center' 
                      }}>
                        #{idx + 1}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{row.member.fullName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {row.member.jobTitle} &bull; {row.member.department}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>
                        £{row.totalBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {Number(row.placementCount.toFixed(2))} {Number(row.placementCount.toFixed(2)) === 1 ? 'placement' : 'placements'} (split allocations)
                      </div>
                    </div>
                  </div>

                  <div className="dist-bar-bg" style={{ height: '8px' }}>
                    <div 
                      className="dist-bar-fill" 
                      style={{ 
                        width: `${(row.totalBilling / maxBilling) * 100}%`,
                        background: idx === 0 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #6366f1, #4f46e5)'
                      }}
                    />
                  </div>
                </div>
              ))}
              {leaderboardList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No active placements scored for this month.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 4: YTD CLIENT PLACEMENTS MATRIX
          ============================================================= */}
      {activeSubTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                {matrixViewType === 'value' ? 'YTD Placements & Fee Billing Value Matrix' : 'YTD Placements & Split Count Matrix'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {matrixViewType === 'value' 
                  ? 'Track placement split net fee values hierarchically by internal company, department, and recruiters.' 
                  : 'Track placement split counts hierarchically by internal company, department, and recruiters.'}
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Toggle switch between Split Count and Fee Billing Value */}
              <div style={{ 
                display: 'flex', 
                backgroundColor: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setMatrixViewType('count')}
                  style={{
                    background: matrixViewType === 'count' ? 'var(--bg-sidebar)' : 'none',
                    border: 'none',
                    color: matrixViewType === 'count' ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 600,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Split Counts
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewType('value')}
                  style={{
                    background: matrixViewType === 'value' ? 'var(--bg-sidebar)' : 'none',
                    border: 'none',
                    color: matrixViewType === 'value' ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 600,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Fee Values (£)
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Calendar Year:</span>
                <select 
                  className="select-filter"
                  value={matrixYear}
                  onChange={(e) => setMatrixYear(e.target.value)}
                  style={{ padding: '6px 12px' }}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="entity-table dense" style={{ minWidth: '1300px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Internal Company / Department / Recruiter</th>
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                    <th key={m} style={{ textAlign: 'right', width: '80px' }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'right', width: '100px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)' }}>YTD Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const year = Number(matrixYear);
                  const matrixData = [];
                  let colTotals = Array(12).fill(0);
                  let grandTotal = 0;

                  companies.forEach(company => {
                    const companyStaff = staff.filter(s => s.companyId === company.id);
                    const configuredDepts = (company.departments || []).map(d => d.name || d);
                    const companyDepts = Array.from(new Set([...configuredDepts, ...companyStaff.map(s => s.department).filter(Boolean)])).sort();
                    
                    const companyMonths = Array(12).fill(0);
                    const companyPlacementsByMonth = Array.from({ length: 12 }, () => []);
                    const deptRows = [];
                    
                    companyDepts.forEach(dept => {
                      const deptStaff = companyStaff.filter(s => s.department === dept);
                      const deptMonths = Array(12).fill(0);
                      const deptPlacementsByMonth = Array.from({ length: 12 }, () => []);
                      const staffRows = [];
                      
                      deptStaff.forEach(member => {
                        const memberMonths = Array(12).fill(0);
                        const memberPlacementsByMonth = Array.from({ length: 12 }, () => []);
                        
                        placements.forEach(p => {
                          if (!p.startDate || p.status === 'dns') return;
                          const pStart = new Date(p.startDate);
                          if (pStart.getFullYear() !== year) return;
                          
                          const monthIdx = pStart.getMonth();
                          const splitObj = p.splits?.find(sp => sp.staffId === member.id);
                          if (splitObj) {
                            const weight = matrixViewType === 'value'
                              ? (Number(p.netScoreValue) || 0) * (Number(splitObj.percentage) || 100) / 100
                              : (Number(splitObj.percentage) || 100) / 100;
                            memberMonths[monthIdx] += weight;
                            memberPlacementsByMonth[monthIdx].push({
                              ...p,
                              recruiterSplit: splitObj.percentage || 100,
                              splitFee: (Number(p.netScoreValue) || 0) * (Number(splitObj.percentage) || 100) / 100
                            });
                          }
                        });
                        
                        const memberTotal = memberMonths.reduce((a, b) => a + b, 0);
                        
                        staffRows.push({
                          id: `member-${company.id}-${dept}-${member.id}`,
                          name: member.fullName,
                          subtitle: member.jobTitle,
                          type: 'member',
                          months: memberMonths,
                          placementsByMonth: memberPlacementsByMonth,
                          total: memberTotal
                        });
                        
                        for (let m = 0; m < 12; m++) {
                          deptMonths[m] += memberMonths[m];
                          deptPlacementsByMonth[m].push(...memberPlacementsByMonth[m]);
                        }
                      });
                      
                      const deptTotal = deptMonths.reduce((a, b) => a + b, 0);
                      
                      deptRows.push({
                        id: `dept-${company.id}-${dept}`,
                        name: dept,
                        type: 'department',
                        months: deptMonths,
                        placementsByMonth: deptPlacementsByMonth,
                        total: deptTotal,
                        children: staffRows
                      });
                      
                      for (let m = 0; m < 12; m++) {
                        companyMonths[m] += deptMonths[m];
                        companyPlacementsByMonth[m].push(...deptPlacementsByMonth[m]);
                      }
                    });
                    
                    const companyTotal = companyMonths.reduce((a, b) => a + b, 0);
                    
                    matrixData.push({
                      id: `company-${company.id}`,
                      name: company.name,
                      type: 'company',
                      months: companyMonths,
                      placementsByMonth: companyPlacementsByMonth,
                      total: companyTotal,
                      children: deptRows
                    });
                  });

                  // Calculate column totals from all unique placements to avoid double-counting splits in footer
                  placements.forEach(p => {
                    if (!p.startDate || p.status === 'dns') return;
                    const pStart = new Date(p.startDate);
                    if (pStart.getFullYear() !== year) return;
                    const monthIdx = pStart.getMonth();
                    
                    const value = matrixViewType === 'value'
                      ? (Number(p.netScoreValue) || 0)
                      : (() => {
                          const totalWeight = p.splits?.reduce((sum, s) => sum + ((Number(s.percentage) || 100) / 100), 0) || 0;
                          return totalWeight > 0 ? totalWeight : 1.0;
                        })();
                    colTotals[monthIdx] += value;
                    grandTotal += value;
                  });

                  // Flatten rows based on expanded states
                  const visibleRows = [];
                  matrixData.forEach(compRow => {
                    visibleRows.push(compRow);
                    if (expandedKeys[compRow.id]) {
                      compRow.children.forEach(deptRow => {
                        visibleRows.push(deptRow);
                        if (expandedKeys[deptRow.id]) {
                          deptRow.children.forEach(memberRow => {
                            visibleRows.push(memberRow);
                          });
                        }
                      });
                    }
                  });

                  if (matrixData.length === 0) {
                    return (
                      <tr>
                        <td colSpan="14" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          No parent entities configured.
                        </td>
                      </tr>
                    );
                  }

                  const toggleKey = (key) => {
                    setExpandedKeys(prev => ({
                      ...prev,
                      [key]: !prev[key]
                    }));
                  };

                  return (
                    <>
                      {visibleRows.map(row => {
                        const isCompany = row.type === 'company';
                        const isDept = row.type === 'department';
                        const isMember = row.type === 'member';

                        const paddingLeft = isCompany ? '12px' : isDept ? '32px' : '52px';
                        const hasChildren = isCompany || isDept;
                        const isExpanded = expandedKeys[row.id];

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

                            {row.months.map((val, monthIdx) => {
                              const cellPlacements = row.placementsByMonth[monthIdx] || [];
                              const displayVal = parseFloat(val.toFixed(2));

                              return (
                                <td key={monthIdx} style={{ textAlign: 'right' }}>
                                  {displayVal > 0 ? (
                                    <button
                                      onClick={() => {
                                        // De-duplicate placements to avoid showing same placement twice in modal list due to splits
                                        const uniq = Array.from(new Map(cellPlacements.map(p => [p.id, p])).values());
                                        setDrilldownClient(row.name);
                                        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                        setDrilldownMonthName(monthNames[monthIdx]);
                                        setSelectedCellPlacements(uniq);
                                        setShowDrilldownModal(true);
                                      }}
                                      style={{
                                        background: isCompany ? 'rgba(99, 102, 241, 0.08)' : isDept ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                        border: isCompany ? '1px solid rgba(99, 102, 241, 0.2)' : isDept ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                                        borderRadius: '4px',
                                        color: isCompany ? 'var(--accent)' : isDept ? 'var(--warning)' : 'var(--success)',
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
                                      {matrixViewType === 'value' 
                                        ? `£${Math.round(displayVal).toLocaleString()}` 
                                        : displayVal}
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
                              color: isCompany ? 'var(--accent)' : isDept ? 'var(--warning)' : 'var(--success)'
                            }}>
                              {matrixViewType === 'value' 
                                ? `£${Math.round(row.total).toLocaleString()}` 
                                : parseFloat(row.total.toFixed(2))}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Column totals footer */}
                      <tr style={{ fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.03)', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ paddingLeft: '12px' }}>Monthly Totals ({matrixViewType === 'value' ? 'Fee Values' : 'Placements'})</td>
                        {colTotals.map((tot, idx) => (
                          <td key={idx} style={{ textAlign: 'right', color: 'var(--success)' }}>
                            {matrixViewType === 'value' 
                              ? `£${Math.round(tot).toLocaleString()}` 
                              : parseFloat(tot.toFixed(2))}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', color: 'var(--accent)', fontSize: '13px' }}>
                          {matrixViewType === 'value' 
                            ? `£${Math.round(grandTotal).toLocaleString()}` 
                            : parseFloat(grandTotal.toFixed(2))}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Drill-down modal */}
          {showDrilldownModal && selectedCellPlacements && (
            <div className="slide-over-overlay active" onClick={() => setShowDrilldownModal(false)} style={{ zIndex: 1000 }}>
              <div 
                className="slide-over-panel" 
                onClick={(e) => e.stopPropagation()} 
                style={{ 
                  width: '60%', 
                  maxWidth: '800px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderLeft: '1px solid var(--border-color)',
                  boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
                  padding: '24px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                      Placements Drill-down: {drilldownClient}
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Period: {drilldownMonthName} {matrixYear} &bull; {selectedCellPlacements.length} {selectedCellPlacements.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowDrilldownModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '20px',
                      cursor: 'pointer'
                    }}
                  >
                    &times;
                  </button>
                </div>

                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="entity-table dense" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Placement ID</th>
                        <th>Candidate Name</th>
                        <th>Client Company</th>
                        <th>Start Date</th>
                        <th style={{ textAlign: 'right' }}>Total Fee</th>
                        <th style={{ textAlign: 'center' }}>Split %</th>
                        <th style={{ textAlign: 'right' }}>Split Fee Share</th>
                        <th>Recruiter Splits</th>
                        <th>Client Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCellPlacements.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700 }}>{p.placementId}</td>
                          <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
                          <td>{p.clientCompany || '—'}</td>
                          <td>{p.startDate}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            £{(Number(p.netScoreValue) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {p.splits?.map(s => (
                              <div key={s.staffId} style={{ fontSize: '10px' }}>
                                {s.percentage}%
                              </div>
                            ))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                            {p.splits?.map(s => {
                              const share = (Number(p.netScoreValue) || 0) * (Number(s.percentage) || 100) / 100;
                              return (
                                <div key={s.staffId} style={{ fontSize: '10px' }}>
                                  £{share.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              );
                            })}
                          </td>
                          <td>
                            {p.splits?.map(s => {
                              const r = staff.find(st => st.id === s.staffId);
                              return (
                                <div key={s.staffId} style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {r ? r.fullName : 'Recruiter'}
                                </div>
                              );
                            })}
                          </td>
                          <td>
                            <span style={{ 
                              fontSize: '9px',
                              fontWeight: 700,
                              color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)',
                              backgroundColor: p.clientPaymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: p.clientPaymentStatus === 'paid' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                              {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setShowDrilldownModal(false)}>
                    Close Panel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* View Placement Detail Card Modal */}
      {viewingPlacement && (
        <div className="form-wizard-overlay" onClick={() => setViewingPlacement(null)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                  <Eye size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                    Placement Record Details
                  </h2>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>CRM Registry Profile: {viewingPlacement.placementId}</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setViewingPlacement(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Profile Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Candidate Name</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{viewingPlacement.candidateName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Client Company</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{viewingPlacement.clientCompany}</div>
                </div>
              </div>

              {/* Placement Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Start Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.startDate}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Scored Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.scoredDate}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>DNS Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--danger)' }}>{viewingPlacement.dnsDate || '—'}</div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                  Financial Metrics
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Gross Placement Fee</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>
                      £{Number(viewingPlacement.grossBillAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>DNS / Rebate Loss</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--danger)', fontFamily: 'monospace' }}>
                      -£{Number(viewingPlacement.dnsRebateAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Net Placement Value</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--success)', fontFamily: 'monospace' }}>
                      £{Number(viewingPlacement.netScoreValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Invoice Number</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.invoiceNumber || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Invoice Type</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', textTransform: 'capitalize' }}>
                    {viewingPlacement.invoiceType || 'direct'} Invoice
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Client Payment Status</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', textTransform: 'capitalize', color: viewingPlacement.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
                    {viewingPlacement.clientPaymentStatus || 'unpaid'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Payment Terms</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
                    {viewingPlacement.paymentTermsDays || 30} Days
                  </div>
                </div>
              </div>

              {/* Simplicity Specific Parameters Details */}
              {viewingPlacement.invoiceType === 'simplicity' && (
                <div style={{ 
                  backgroundColor: 'rgba(99, 102, 241, 0.03)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderTop: '1px dashed var(--border-color)',
                  paddingTop: '14px',
                  marginTop: '6px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block' }}>
                    🛡️ Simplicity Factoring Audit
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                    <div>Client Number: <strong>{viewingPlacement.simplicityClientNo || '—'}</strong></div>
                    <div>Credit Limit: <strong>{viewingPlacement.simplicityCreditLimit || '—'}</strong></div>
                    <div>NOA Required: <strong>{viewingPlacement.noaRequired ? 'Yes' : 'No'}</strong></div>
                    <div>Invoice Received: <strong>{viewingPlacement.consultantInvoiceReceived ? 'Yes' : 'No'}</strong></div>
                  </div>

                  {/* Factoring details breakdown */}
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '8px 12px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Net Fee Total:</span>
                      <span>£{Number(viewingPlacement.grossBillAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                      <span>Total to Humres (97.04%):</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * 0.9704).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>VAT (20% of factored):</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * 0.9704 * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 'bold', color: 'var(--primary)' }}>
                      <span>Expected Payout:</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * 0.9704 * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recruiter Splits */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                  Recruiter Commission Splits
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {viewingPlacement.splits?.map((split, index) => {
                    const matchedStaff = staff.find(s => s.id === split.staffId);
                    return (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                        <span>{matchedStaff ? matchedStaff.fullName : 'Unknown Recruiter'}</span>
                        <strong style={{ color: 'var(--primary)' }}>{split.percentage}% Split</strong>
                      </div>
                    );
                  })}
                  {(!viewingPlacement.splits || viewingPlacement.splits.length === 0) && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No splits configured. (100% house placement)</span>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setViewingPlacement(null)}>
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => {
                    handleEditPlacement(viewingPlacement);
                    setViewingPlacement(null);
                  }}
                >
                  Edit Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
