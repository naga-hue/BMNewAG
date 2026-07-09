import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Calendar, 
  Plus, 
  Upload, 
  ChevronRight, 
  FileDown, 
  TrendingUp, 
  DollarSign, 
  MessageSquare,
  History,
  X,
  Send,
  HelpCircle,
  Briefcase
} from 'lucide-react';
import { firebaseService } from '../services/firebase';

const CURRENCY_SYMBOLS = {
  GBP: '£',
  USD: '$',
  AED: 'AED ',
  ZAR: 'R',
  INR: '₹'
};

const PAYMENT_STATUSES = [
  { value: 'not-invoiced', label: 'Not Invoiced', color: '#94a3b8' },
  { value: 'invoice-uploaded', label: 'Invoice Uploaded', color: '#6366f1' },
  { value: 'sent-to-client', label: 'Sent to Client', color: '#0ea5e9' },
  { value: 'payment-expected', label: 'Payment Expected', color: '#d97706' },
  { value: 'part-paid', label: 'Part Paid', color: '#a855f7' },
  { value: 'paid', label: 'Paid', color: '#10b981' },
  { value: 'overdue', label: 'Overdue', color: '#ef4444' },
  { value: 'disputed', label: 'Disputed', color: '#f97316' },
  { value: 'legal', label: 'Legal', color: '#7f1d1d' },
  { value: 'written-off', label: 'Written Off', color: '#475569' },
  { value: 'dns-rebate', label: 'DNS / Rebate', color: '#b91c1c' }
];

export default function CreditControlDashboard({
  placements = [],
  companies = [],
  staff = [],
  currentUser = {},
  onUpdatePlacement,
  onShowToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('direct'); // direct or simplicity
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, next-7, next-30, this-month, next-month, overdue
  
  // Sorting states
  const [sortBy, setSortBy] = useState('dueDate'); // dueDate, amount, overdueDays, client, recruiter, status
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  // Details Modal States
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit fields inside Details Modal
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editGrossAmount, setEditGrossAmount] = useState('');
  const [editVatAmount, setEditVatAmount] = useState('');
  const [editRaisedDate, setEditRaisedDate] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('30');
  const [editPaymentTermsCustom, setEditPaymentTermsCustom] = useState('');
  const [editStatus, setEditStatus] = useState('not-invoiced');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editNextChaseDate, setEditNextChaseDate] = useState('');
  const [editDisputeReason, setEditDisputeReason] = useState('');
  const [editDisputeDate, setEditDisputeDate] = useState('');
  const [editDisputeOwner, setEditDisputeOwner] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Helper date conversions
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const calculateDaysOverdue = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const today = new Date(todayStr);
    const due = new Date(dueDateStr);
    const diff = today.getTime() - due.getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  const getCurrencySymbol = (placement) => {
    const matched = companies.find(c => c.id === placement.companyId);
    return CURRENCY_SYMBOLS[matched?.currency || 'GBP'] || '£';
  };

  const invoices = useMemo(() => {
    return placements.map(p => {
      const gross = Number(p.grossBillAmount) || 0;
      const vat = (p.vatAmount !== undefined && p.vatAmount !== null && p.vatAmount !== '') 
        ? (Number(p.vatAmount) || 0) 
        : (Math.round(gross * 0.20 * 100) / 100);
      const total = (p.totalInvoiceAmount !== undefined && p.totalInvoiceAmount !== null && p.totalInvoiceAmount !== '') 
        ? (Number(p.totalInvoiceAmount) || 0) 
        : (gross + vat);
      
      const raisedDate = p.invoiceRaisedDate || p.startDate || p.scoredDate || todayStr;
      const termsDays = (p.paymentTermsDays !== undefined && p.paymentTermsDays !== null && p.paymentTermsDays !== '') ? Number(p.paymentTermsDays) : 30;
      
      // Calculate due date
      let dueDate = p.invoiceDueDate;
      if (!dueDate && raisedDate) {
        try {
          const parts = raisedDate.split('-');
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + termsDays);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayVal = String(d.getDate()).padStart(2, '0');
            dueDate = `${y}-${m}-${dayVal}`;
          }
        } catch (e) {
          dueDate = raisedDate;
        }
      }

      const overdueDays = calculateDaysOverdue(dueDate);
      const paid = Number(p.amountPaid) || 0;
      const outstanding = Math.max(0, total - paid);

      // Resolve final calculated status
      let finalStatus = p.paymentStatus || 'not-invoiced';
      if (p.clientPaymentStatus === 'paid' || outstanding === 0) {
        finalStatus = 'paid';
      } else if (
        finalStatus !== 'paid' && 
        finalStatus !== 'written-off' && 
        finalStatus !== 'dns-rebate' && 
        finalStatus !== 'legal' && 
        finalStatus !== 'disputed' && 
        dueDate < todayStr
      ) {
        finalStatus = 'overdue';
      }

      // Resolve recruiter splits names
      const recruiterNames = (p.splits || []).map(sp => {
        const staffMember = staff.find(s => s.id === sp.staffId);
        return staffMember ? staffMember.fullName : 'Recruiter';
      }).join(', ');

      const mainRecruiterId = p.splits && p.splits.length > 0 ? p.splits[0].staffId : '';
      const mainRecruiter = staff.find(s => s.id === mainRecruiterId);
      const deptName = mainRecruiter ? mainRecruiter.department : 'Recruitment';

      return {
        ...p,
        invoiceType: p.invoiceType || 'direct',
        invoiceRaisedDate: raisedDate,
        paymentTermsDays: termsDays,
        invoiceDueDate: dueDate || raisedDate,
        vatAmount: vat,
        totalInvoiceAmount: total,
        paymentStatus: finalStatus,
        amountPaid: paid,
        balanceOutstanding: outstanding,
        overdueDays,
        recruiterNames,
        mainRecruiterId,
        departmentName: deptName
      };
    });
  }, [placements, companies, staff, todayStr]);

  // -------------------------------------------------------------
  // DASHBOARD CALCULATIONS
  // -------------------------------------------------------------
  const dashboardStats = useMemo(() => {
    const overdueList = invoices.filter(inv => inv.paymentStatus === 'overdue' && inv.balanceOutstanding > 0);
    const legalList = invoices.filter(inv => inv.paymentStatus === 'legal' && inv.balanceOutstanding > 0);
    const disputedList = invoices.filter(inv => inv.paymentStatus === 'disputed' && inv.balanceOutstanding > 0);

    const totalOverdue = overdueList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    const overdueDirect = overdueList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    const overdueSimplicity = overdueList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    
    let oldestOverdueDays = 0;
    overdueList.forEach(inv => {
      if (inv.overdueDays > oldestOverdueDays) oldestOverdueDays = inv.overdueDays;
    });

    const getExpectedInDays = (days) => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + days);
      const limitStr = limitDate.toISOString().split('T')[0];

      return invoices.filter(inv => 
        inv.invoiceDueDate >= todayStr && 
        inv.invoiceDueDate <= limitStr && 
        inv.balanceOutstanding > 0 &&
        !['paid', 'legal', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
      );
    };

    const next7Days = getExpectedInDays(7);
    const next30Days = getExpectedInDays(30);

    const getExpectedInMonth = (yearVal, monthVal) => {
      const prefix = `${yearVal}-${String(monthVal).padStart(2, '0')}`;
      return invoices.filter(inv => 
        inv.invoiceDueDate.startsWith(prefix) && 
        inv.balanceOutstanding > 0 && 
        !['paid', 'legal', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
      );
    };

    const tDate = new Date();
    const thisMonthList = getExpectedInMonth(tDate.getFullYear(), tDate.getMonth() + 1);
    
    tDate.setMonth(tDate.getMonth() + 1);
    const nextMonthList = getExpectedInMonth(tDate.getFullYear(), tDate.getMonth() + 1);

    return {
      overdueCount: overdueList.length,
      overdueTotal: totalOverdue,
      overdueOldestDays: oldestOverdueDays,
      overdueDirect,
      overdueSimplicity,
      
      legalList,
      legalTotal: legalList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      disputedList,
      disputedTotal: disputedList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      next7Days,
      next7DaysTotal: next7Days.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      next30Days,
      next30DaysTotal: next30Days.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      thisMonthList,
      thisMonthTotal: thisMonthList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      thisMonthDirect: thisMonthList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      thisMonthSimplicity: thisMonthList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      nextMonthList,
      nextMonthTotal: nextMonthList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      nextMonthDirect: nextMonthList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      nextMonthSimplicity: nextMonthList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0)
    };
  }, [invoices, todayStr]);

  // -------------------------------------------------------------
  // LIST FILTERING & SORTING
  // -------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // 1. Tab check
      if (inv.invoiceType !== activeSubTab) return false;

      // 2. Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const candidateMatch = (inv.candidateName || '').toLowerCase().includes(query);
        const clientMatch = (inv.clientCompany || '').toLowerCase().includes(query);
        const invNumMatch = (inv.invoiceNumber || '').toLowerCase().includes(query);
        const pidMatch = (inv.placementId || '').toLowerCase().includes(query);
        const recruiterMatch = (inv.recruiterNames || '').toLowerCase().includes(query);
        if (!candidateMatch && !clientMatch && !invNumMatch && !pidMatch && !recruiterMatch) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'unpaid' && (inv.paymentStatus === 'paid' || inv.balanceOutstanding <= 0)) return false;
        if (statusFilter !== 'unpaid' && inv.paymentStatus !== statusFilter) return false;
      }

      // 4. Recruiter filter
      if (recruiterFilter !== 'all' && inv.mainRecruiterId !== recruiterFilter) return false;

      // 5. Date filter
      if (dateFilter !== 'all') {
        if (dateFilter === 'overdue') {
          if (inv.paymentStatus !== 'overdue') return false;
        } else if (dateFilter === 'next-7') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 7);
          const limitStr = limit.toISOString().split('T')[0];
          if (inv.invoiceDueDate < todayStr || inv.invoiceDueDate > limitStr) return false;
        } else if (dateFilter === 'next-30') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 30);
          const limitStr = limit.toISOString().split('T')[0];
          if (inv.invoiceDueDate < todayStr || inv.invoiceDueDate > limitStr) return false;
        } else if (dateFilter === 'this-month') {
          const now = new Date();
          const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (!inv.invoiceDueDate.startsWith(prefix)) return false;
        } else if (dateFilter === 'next-month') {
          const now = new Date();
          now.setMonth(now.getMonth() + 1);
          const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (!inv.invoiceDueDate.startsWith(prefix)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'amount') {
        valA = a.totalInvoiceAmount;
        valB = b.totalInvoiceAmount;
      } else if (sortBy === 'recruiter') {
        valA = a.recruiterNames;
        valB = b.recruiterNames;
      } else if (sortBy === 'client') {
        valA = a.clientCompany;
        valB = b.clientCompany;
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, activeSubTab, searchQuery, statusFilter, recruiterFilter, dateFilter, sortBy, sortOrder, todayStr]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>⇅</span>;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // -------------------------------------------------------------
  // OPEN INVOICE EDITOR DETAIL MODAL
  // -------------------------------------------------------------
  const handleOpenDetail = (invoice) => {
    setSelectedInvoice(invoice);
    setEditInvoiceNumber(invoice.invoiceNumber || '');
    setEditGrossAmount(String(invoice.grossBillAmount || ''));
    setEditVatAmount(String(invoice.vatAmount || ''));
    setEditRaisedDate(invoice.invoiceRaisedDate || '');
    setEditStatus(invoice.paymentStatus || 'not-invoiced');
    setEditAmountPaid(String(invoice.amountPaid || '0'));
    setEditReceivedDate(invoice.paymentReceivedDate || '');
    setEditNextChaseDate(invoice.nextChaseDate || '');
    setEditDisputeReason(invoice.disputeReason || '');
    setEditDisputeDate(invoice.disputeDate || '');
    setEditDisputeOwner(invoice.disputeOwner || '');
    setUploadedFileUrl(invoice.invoiceFileUrl || '');
    setUploadedFileName(invoice.invoiceFileName || '');
    setNewNote('');

    const terms = String(invoice.paymentTermsDays || '30');
    if (['7', '10', '30', '31'].includes(terms)) {
      setEditPaymentTerms(terms);
      setEditPaymentTermsCustom('');
    } else {
      setEditPaymentTerms('custom');
      setEditPaymentTermsCustom(terms);
    }

    setIsDetailOpen(true);
  };

  const handleUploadInvoiceFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedInvoice) return;
    setIsUploading(true);
    try {
      const url = await firebaseService.uploadLetterheadBg(selectedInvoice.id, file); // Uses generic background file uploader
      setUploadedFileUrl(url);
      setUploadedFileName(file.name);
      onShowToast("Invoice document attached successfully!", "success");
    } catch (err) {
      console.error(err);
      onShowToast("Upload failed: " + err.message, "danger");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveInvoiceEdits = async () => {
    if (!selectedInvoice) return;
    const gross = Number(editGrossAmount) || 0;
    const vat = editVatAmount !== '' ? (Number(editVatAmount) || 0) : Math.round(gross * 0.20 * 100) / 100;
    const total = gross + vat;

    const termsDays = editPaymentTerms === 'custom' 
      ? (Number(editPaymentTermsCustom) || 30) 
      : Number(editPaymentTerms);

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

    const dueDate = calculateDueDate(editRaisedDate, termsDays);
    const paid = Number(editAmountPaid) || 0;
    const outstanding = Math.max(0, total - paid);

    let finalStatus = editStatus;
    if (paid >= total && total > 0) {
      finalStatus = 'paid';
    } else if (
      finalStatus !== 'paid' && 
      finalStatus !== 'written-off' && 
      finalStatus !== 'dns-rebate' && 
      finalStatus !== 'legal' && 
      finalStatus !== 'disputed' && 
      dueDate < todayStr
    ) {
      finalStatus = 'overdue';
    }

    const updatedPlacement = {
      ...selectedInvoice,
      invoiceNumber: editInvoiceNumber.trim() || null,
      grossBillAmount: gross,
      vatAmount: vat,
      totalInvoiceAmount: total,
      invoiceRaisedDate: editRaisedDate,
      paymentTermsDays: termsDays,
      invoiceDueDate: dueDate,
      paymentStatus: finalStatus,
      amountPaid: paid,
      balanceOutstanding: outstanding,
      clientPaymentStatus: finalStatus === 'paid' ? 'paid' : 'unpaid',
      clientPaidDate: finalStatus === 'paid' ? (editReceivedDate || todayStr) : null,
      paymentReceivedDate: finalStatus === 'paid' ? (editReceivedDate || todayStr) : null,
      nextChaseDate: editNextChaseDate,
      disputeReason: finalStatus === 'disputed' ? editDisputeReason : '',
      disputeDate: finalStatus === 'disputed' ? editDisputeDate : '',
      disputeOwner: finalStatus === 'disputed' ? editDisputeOwner : '',
      invoiceFileUrl: uploadedFileUrl,
      invoiceFileName: uploadedFileName
    };

    try {
      await onUpdatePlacement(updatedPlacement);
      onShowToast(`Invoice settings updated for "${selectedInvoice.candidateName}"`, "success");
      setIsDetailOpen(false);
      setSelectedInvoice(null);
    } catch (e) {
      onShowToast("Save failed: " + e.message, "danger");
    }
  };

  const handleAddChaseNote = async (shortcutText) => {
    const noteText = shortcutText || newNote.trim();
    if (!noteText || !selectedInvoice) return;

    const newNoteObj = {
      date: new Date().toISOString(),
      user: currentUser.fullName || 'Admin User',
      content: noteText
    };

    const updatedHistory = [newNoteObj, ...(selectedInvoice.chaseHistory || [])];
    const updatedPlacement = {
      ...selectedInvoice,
      chaseHistory: updatedHistory,
      lastChasedDate: new Date().toISOString().split('T')[0]
    };

    try {
      await onUpdatePlacement(updatedPlacement);
      setSelectedInvoice(prev => ({
        ...prev,
        chaseHistory: updatedHistory,
        lastChasedDate: new Date().toISOString().split('T')[0]
      }));
      setNewNote('');
      onShowToast("Chase note logged successfully!", "success");
    } catch (e) {
      onShowToast("Error logging note: " + e.message, "danger");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* -------------------------------------------------------------
          DASHBOARD HEADERS & RISK BLOCKS
          ------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
        
        {/* KPI OVERDUE CARD */}
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🔴 Cash Overdue (Outstanding)
              </span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 2px 0', color: 'var(--danger)', fontFamily: 'monospace' }}>
                £{dashboardStats.overdueTotal.toLocaleString()}
              </h2>
            </div>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px', borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>
              📁 <strong>Direct:</strong> £{dashboardStats.overdueDirect.toLocaleString()}
            </div>
            <div>
              💼 <strong>Simplicity:</strong> £{dashboardStats.overdueSimplicity.toLocaleString()}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              ⚠️ <strong>Oldest Overdue Item:</strong> {dashboardStats.overdueOldestDays} Days Overdue
            </div>
          </div>
        </div>

        {/* HIGH RISK / LEGAL INVOICES CARD */}
        <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.05)', border: '1px solid rgba(127, 29, 29, 0.15)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚖️ Legal Actions Cases
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 0 0', color: '#fca5a5', fontFamily: 'monospace' }}>
                £{dashboardStats.legalTotal.toLocaleString()}
              </h2>
            </div>
            <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.2)', color: '#ef4444', padding: '8px', borderRadius: '8px' }}>
              <ShieldAlert size={20} />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, fontSize: '10px', color: 'var(--text-secondary)' }}>
            {dashboardStats.legalList.map(inv => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed rgba(127, 29, 29, 0.1)' }}>
                <span>{inv.clientCompany} ({inv.invoiceNumber || 'No Inv'})</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>£{inv.balanceOutstanding.toLocaleString()}</span>
              </div>
            ))}
            {dashboardStats.legalList.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>No active legal cases.</span>
            )}
          </div>
        </div>

        {/* CASH FORECAST METRIC TILES */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected (Next 7 Days)</span>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>£{dashboardStats.next7DaysTotal.toLocaleString()}</div>
            </div>
            <div style={{ color: 'var(--primary)' }}><Clock size={16} /></div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected (Next 30 Days)</span>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>£{dashboardStats.next30DaysTotal.toLocaleString()}</div>
            </div>
            <div style={{ color: 'var(--accent)' }}><TrendingUp size={16} /></div>
          </div>
        </div>

      </div>

      {/* MONTH FORECAST BREAKDOWNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expected This Month</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0', fontFamily: 'monospace', color: 'var(--accent)' }}>£{dashboardStats.thisMonthTotal.toLocaleString()}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Direct: £{dashboardStats.thisMonthDirect.toLocaleString()} | Simplicity: £{dashboardStats.thisMonthSimplicity.toLocaleString()}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
            📬 <strong>{dashboardStats.thisMonthList.length} Invoices</strong> due
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expected Next Month</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0', fontFamily: 'monospace' }}>£{dashboardStats.nextMonthTotal.toLocaleString()}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Direct: £{dashboardStats.nextMonthDirect.toLocaleString()} | Simplicity: £{dashboardStats.nextMonthSimplicity.toLocaleString()}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
            📬 <strong>{dashboardStats.nextMonthList.length} Invoices</strong> due
          </div>
        </div>
      </div>

      {/* DISPUTED INVOICES BANNER PANEL */}
      {dashboardStats.disputedList.length > 0 && (
        <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f97316' }}>
            <AlertTriangle size={18} />
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>⚠️ Client Disputed Billing Cases (Outstanding: £{dashboardStats.disputedTotal.toLocaleString()})</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {dashboardStats.disputedList.map(inv => (
              <div key={inv.id} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '11.5px', cursor: 'pointer' }} onClick={() => handleOpenDetail(inv)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                  <span>{inv.clientCompany}</span>
                  <span style={{ color: '#f97316' }}>£{inv.balanceOutstanding.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text-secondary)' }}>
                  <div>👨‍💼 <strong>Candidate:</strong> {inv.candidateName}</div>
                  <div>🚨 <strong>Dispute Reason:</strong> <span style={{ color: 'var(--text-primary)' }}>{inv.disputeReason || 'Unresolved dispute'}</span></div>
                  <div>📅 <strong>Dispute Raised:</strong> {inv.disputeDate || 'N/A'} | 🧑‍💼 <strong>Owner:</strong> {inv.disputeOwner || 'HR'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TABS & FILTERS SECTION
          ------------------------------------------------------------- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        
        {/* Navigation Sub-Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveSubTab('direct')}
              style={{ 
                padding: '12px 20px', 
                border: 'none', 
                background: 'none', 
                fontSize: '14px', 
                fontWeight: 700, 
                cursor: 'pointer',
                borderBottom: activeSubTab === 'direct' ? '3px solid var(--primary)' : '3px solid transparent',
                color: activeSubTab === 'direct' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              📁 Direct Invoices
            </button>
            <button 
              onClick={() => setActiveSubTab('simplicity')}
              style={{ 
                padding: '12px 20px', 
                border: 'none', 
                background: 'none', 
                fontSize: '14px', 
                fontWeight: 700, 
                cursor: 'pointer',
                borderBottom: activeSubTab === 'simplicity' ? '3px solid var(--primary)' : '3px solid transparent',
                color: activeSubTab === 'simplicity' ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              💼 Simplicity Invoices
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
          
          <div className="search-box-container" style={{ width: '100%' }}>
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search invoices by client, candidate, inv number, recruiter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <select 
            className="select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="all">All Payment Statuses</option>
            <option value="unpaid">Outstanding Invoices</option>
            {PAYMENT_STATUSES.map(st => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={recruiterFilter}
            onChange={(e) => setRecruiterFilter(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="all">All Recruiters</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="all">All Date Ranges</option>
            <option value="overdue">Overdue Invoices</option>
            <option value="next-7">Expected Next 7 Days</option>
            <option value="next-30">Expected Next 30 Days</option>
            <option value="this-month">Expected This Month</option>
            <option value="next-month">Expected Next Month</option>
          </select>

        </div>

      </div>

      {/* -------------------------------------------------------------
          INVOICES GRID/LIST TABLE
          ------------------------------------------------------------- */}
      <div className="table-container" style={{ margin: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('placementId')}>Placement ID {renderSortIndicator('placementId')}</th>
              <th style={{ cursor: 'pointer', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('client')}>Client Company {renderSortIndicator('client')}</th>
              <th style={{ cursor: 'pointer', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('candidateName')}>Candidate Name {renderSortIndicator('candidateName')}</th>
              <th style={{ cursor: 'pointer', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('recruiter')}>Recruiter {renderSortIndicator('recruiter')}</th>
              <th style={{ cursor: 'pointer', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('dueDate')}>Due Date {renderSortIndicator('dueDate')}</th>
              <th style={{ cursor: 'pointer', textAlign: 'right', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('amount')}>Total Invoice {renderSortIndicator('amount')}</th>
              <th style={{ cursor: 'pointer', textAlign: 'center', padding: '14px 10px', whiteSpace: 'nowrap' }} onClick={() => handleSort('status')}>Status {renderSortIndicator('status')}</th>
              <th style={{ textAlign: 'right', padding: '14px 10px', whiteSpace: 'nowrap' }}>Outstanding</th>
              <th style={{ textAlign: 'center', padding: '14px 10px', whiteSpace: 'nowrap' }}>Doc</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => {
              const symbol = getCurrencySymbol(inv);
              const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };

              return (
                <tr 
                  key={inv.id} 
                  onClick={() => handleOpenDetail(inv)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                  className="table-row-hover"
                >
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '14px 10px', whiteSpace: 'nowrap' }}>
                    {inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id)}
                  </td>
                  <td style={{ padding: '14px 10px' }}><strong>{inv.clientCompany}</strong></td>
                  <td style={{ padding: '14px 10px' }}>{inv.candidateName}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '14px 10px' }}>{inv.recruiterNames}</td>
                  <td style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{inv.invoiceDueDate}</span>
                      {inv.paymentStatus === 'overdue' && (
                        <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 'bold' }}>
                          ({inv.overdueDays}d overdue)
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', padding: '14px 10px', whiteSpace: 'nowrap' }}>
                    {symbol}{(inv.totalInvoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      backgroundColor: `${statusObj.color}15`, 
                      color: statusObj.color, 
                      border: `1px solid ${statusObj.color}30`, 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: '10.5px',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {statusObj.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: inv.balanceOutstanding > 0 ? 'var(--warning)' : 'var(--success)', padding: '14px 10px', whiteSpace: 'nowrap' }}>
                    {symbol}{(inv.balanceOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center', padding: '14px 10px' }}>
                    {inv.invoiceFileUrl ? (
                      <a 
                        href={inv.invoiceFileUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                        title={inv.invoiceFileName || "Download invoice"}
                        style={{ color: 'var(--primary)' }}
                      >
                        <FileDown size={14} />
                      </a>
                    ) : (
                      <span style={{ opacity: 0.2 }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No matching invoice records found in database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------------------
          INVOICE DETAIL & EDITOR MODAL
          ------------------------------------------------------------- */}
      {isDetailOpen && selectedInvoice && (() => {
        const symbol = getCurrencySymbol(selectedInvoice);
        return (
          <div className="form-wizard-overlay" onClick={() => setIsDetailOpen(false)}>
            <div 
              className="form-wizard-card" 
              onClick={(e) => e.stopPropagation()} 
              style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              
              {/* Header */}
              <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>
                      Invoice Record Details
                    </h2>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Placement: <strong>{selectedInvoice.candidateName}</strong> @ {selectedInvoice.clientCompany}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setIsDetailOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Body split into details + chasers */}
              <div className="wizard-content" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. Placement Reference Info Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', fontSize: '12px' }}>
                  <div>👨‍💼 <strong>Candidate:</strong> {selectedInvoice.candidateName}</div>
                  <div>🏢 <strong>Client:</strong> {selectedInvoice.clientCompany}</div>
                  <div>📅 <strong>Start Date:</strong> {selectedInvoice.startDate}</div>
                  <div>🧑‍💼 <strong>Consultant:</strong> {selectedInvoice.recruiterNames} ({selectedInvoice.departmentName})</div>
                  <div>📂 <strong>Billing Route:</strong> {selectedInvoice.invoiceType === 'direct' ? 'Direct Invoice' : 'Simplicity Invoice'}</div>
                  <div>🔑 <strong>Placement ID:</strong> {selectedInvoice.placementId}</div>
                </div>

                {/* 2. Editable Invoice coordinates */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', margin: 0, textTransform: 'uppercase' }}>Invoice Configuration</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Invoice Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editInvoiceNumber} 
                        onChange={(e) => setEditInvoiceNumber(e.target.value)} 
                        placeholder="e.g. INV-1004"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Invoice Raised Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editRaisedDate} 
                        onChange={(e) => setEditRaisedDate(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Payment Terms</label>
                      <select 
                        className="select-filter" 
                        value={editPaymentTerms}
                        onChange={(e) => setEditPaymentTerms(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        <option value="7">7 Days</option>
                        <option value="10">10 Days</option>
                        <option value="30">30 Days</option>
                        <option value="31">31 Days</option>
                        <option value="custom">Custom Days...</option>
                      </select>
                    </div>

                    {editPaymentTerms === 'custom' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Custom Days</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={editPaymentTermsCustom} 
                          onChange={(e) => setEditPaymentTermsCustom(e.target.value)} 
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Gross Fee ({symbol})</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={editGrossAmount} 
                        onChange={(e) => setEditGrossAmount(e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">VAT Amount ({symbol})</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={editVatAmount} 
                        onChange={(e) => setEditVatAmount(e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Total Amount ({symbol})</label>
                      <div className="form-input" style={{ backgroundColor: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold' }}>
                        {symbol}{(Number(editGrossAmount || 0) + (editVatAmount !== '' ? Number(editVatAmount || 0) : Math.round(Number(editGrossAmount || 0) * 0.20 * 100) / 100)).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Attachment document picker */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice Attachment File</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" 
                        onChange={handleUploadInvoiceFile} 
                        style={{ display: 'none' }}
                        id="invoice-attachment-uploader"
                      />
                      <label htmlFor="invoice-attachment-uploader" className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <Upload size={13} /> {isUploading ? 'Uploading...' : 'Upload Invoice Doc'}
                      </label>
                      {uploadedFileUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--success)' }}>✓ {uploadedFileName || 'Attached'}</span>
                          <button type="button" className="btn-secondary" onClick={() => { setUploadedFileUrl(''); setUploadedFileName(''); }} style={{ padding: '2px 6px', fontSize: '9px', color: 'var(--danger)', border: 'none', background: 'none' }}>Remove</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No invoice file linked.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Payment Status & Received coordinates */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', margin: 0, textTransform: 'uppercase' }}>Payment Details & Chasing Status</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Payment Status</label>
                      <select 
                        className="select-filter" 
                        value={editStatus} 
                        onChange={(e) => setEditStatus(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        {PAYMENT_STATUSES.map(st => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount Paid ({symbol})</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={editAmountPaid} 
                        onChange={(e) => setEditAmountPaid(e.target.value)} 
                      />
                    </div>
                  </div>

                  {editStatus === 'paid' ? (
                    <div className="form-group" style={{ marginBottom: 0, animation: 'fadeIn 0.2s' }}>
                      <label className="form-label">Payment Received Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editReceivedDate} 
                        onChange={(e) => setEditReceivedDate(e.target.value)} 
                      />
                    </div>
                  ) : (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Next Chasing Date</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={editNextChaseDate} 
                        onChange={(e) => setEditNextChaseDate(e.target.value)} 
                      />
                    </div>
                  )}

                  {/* Disputed Sub-form */}
                  {editStatus === 'disputed' && (
                    <div style={{ border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '8px', padding: '12px', backgroundColor: 'rgba(249, 115, 22, 0.02)', display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Reason for Dispute</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Candidate left early / client requested rebate"
                          value={editDisputeReason} 
                          onChange={(e) => setEditDisputeReason(e.target.value)} 
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Dispute Date</label>
                          <input 
                            type="date" 
                            className="form-input" 
                            value={editDisputeDate} 
                            onChange={(e) => setEditDisputeDate(e.target.value)} 
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Dispute Owner</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={editDisputeOwner} 
                            onChange={(e) => setEditDisputeOwner(e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Chase Logs & History timeline */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={13} /> Chasing Timeline & Notes
                  </h4>
                  
                  {/* Logging Box */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Add new chaser note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddChaseNote()}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-primary" onClick={() => handleAddChaseNote()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}>
                      <Send size={12} /> Log Note
                    </button>
                  </div>

                  {/* Shortcut Quick log buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" onClick={() => handleAddChaseNote("Client contacted via phone 📞")} style={{ fontSize: '10px', padding: '4px 8px' }}>📞 Phone Call</button>
                    <button type="button" className="btn-secondary" onClick={() => handleAddChaseNote("Payment promised by client 💳")} style={{ fontSize: '10px', padding: '4px 8px' }}>💳 Payment Promised</button>
                    <button type="button" className="btn-secondary" onClick={() => handleAddChaseNote("Email reminder sent ✉️")} style={{ fontSize: '10px', padding: '4px 8px' }}>✉️ Sent Reminder</button>
                    <button type="button" className="btn-secondary" onClick={() => handleAddChaseNote("Awaiting client PO / Approval ⏳")} style={{ fontSize: '10px', padding: '4px 8px' }}>⏳ Awaiting PO</button>
                  </div>

                  {/* Notes List Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px', marginTop: '4px' }}>
                    {(selectedInvoice.chaseHistory || []).map((note, idx) => (
                      <div key={idx} style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                          <span>🧑‍💼 {note.user}</span>
                          <span>📅 {new Date(note.date).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#fff', lineHeight: 1.4 }}>{note.content}</div>
                      </div>
                    ))}
                    {(selectedInvoice.chaseHistory || []).length === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        No chase logs recorded yet for this invoice.
                      </span>
                    )}
                  </div>

                </div>

              </div>

              {/* Footer Actions */}
              <div className="wizard-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsDetailOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveInvoiceEdits}>
                  Save Invoice Updates
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
