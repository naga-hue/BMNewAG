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
      let vat = (p.vatAmount !== undefined && p.vatAmount !== null && p.vatAmount !== '') 
        ? (Number(p.vatAmount) || 0) 
        : (Math.round(gross * 0.20 * 100) / 100);
      let total = (p.totalInvoiceAmount !== undefined && p.totalInvoiceAmount !== null && p.totalInvoiceAmount !== '') 
        ? (Number(p.totalInvoiceAmount) || 0) 
        : (gross + vat);

      if (p.invoiceType === 'simplicity' && (!p.vatAmount || !p.totalInvoiceAmount)) {
        // Fallback to 2.7% Simplicity factoring fee
        const factoredGross = Math.round(gross * 0.973 * 100) / 100;
        vat = Math.round(factoredGross * 0.20 * 100) / 100;
        total = factoredGross + vat;
      }
      
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

      // 1. Calculate days since start date
      let daysSinceStart = 0;
      if (p.startDate) {
        try {
          const startD = new Date(p.startDate);
          const todayD = new Date(todayStr);
          const diffTime = todayD - startD;
          daysSinceStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch(e) {}
      }

      // 2. Calculate Simplicity Friday Payout Date
      let simplicityPayoutDate = '—';
      if (p.startDate) {
        try {
          const d = new Date(p.startDate);
          if (!isNaN(d.getTime())) {
            const day = d.getDay();
            let daysToAdd = 0;
            if (day === 1 || day === 2 || day === 3) {
              daysToAdd = 5 - day;
            } else {
              if (day === 0) {
                daysToAdd = 5;
              } else {
                daysToAdd = 5 + (7 - day);
              }
            }
            const payoutDate = new Date(d.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            const y = payoutDate.getFullYear();
            const m = String(payoutDate.getMonth() + 1).padStart(2, '0');
            const dayVal = String(payoutDate.getDate()).padStart(2, '0');
            simplicityPayoutDate = `${y}-${m}-${dayVal}`;
          }
        } catch (e) {}
      }

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
        departmentName: deptName,
        daysSinceStart,
        simplicityPayoutDate,
        overridePayoutDate: p.overridePayoutDate || null
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
      nextMonthSimplicity: nextMonthList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      // Simplicity factored recourse calculations
      simplicityClawbackList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 120),
      simplicityClawbackTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 120).reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      simplicityExpiryList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 90 && inv.daysSinceStart < 120),
      simplicityExpiryTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 90 && inv.daysSinceStart < 120).reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      simplicityFollowupList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 31 && inv.daysSinceStart < 90),
      simplicityFollowupTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 31 && inv.daysSinceStart < 90).reduce((sum, inv) => sum + inv.balanceOutstanding, 0)
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

  // Partition filtered invoices into: Disputed/Legal, Live Outstanding, Closed
  const partitionedInvoices = useMemo(() => {
    const disputedLegal = filteredInvoices.filter(inv => 
      ['legal', 'disputed'].includes(inv.paymentStatus)
    );

    const liveOutstanding = filteredInvoices.filter(inv => 
      !['paid', 'legal', 'disputed', 'written-off', 'dns-rebate'].includes(inv.paymentStatus) && 
      inv.balanceOutstanding > 0
    );

    const closed = filteredInvoices.filter(inv => 
      inv.paymentStatus === 'paid' || 
      inv.paymentStatus === 'written-off' || 
      inv.paymentStatus === 'dns-rebate' || 
      inv.balanceOutstanding <= 0
    );

    return {
      disputedLegal,
      liveOutstanding,
      closed
    };
  }, [filteredInvoices]);

  // Helper function to render a single invoice row
  const renderInvoiceRow = (inv) => {
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
        <td style={{ padding: '14px 10px' }}>
          <strong>{inv.clientCompany}</strong>
          {inv.invoiceType === 'simplicity' && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: 1.2 }}>
              <span>Client No: <strong style={{ color: 'var(--text-secondary)' }}>{inv.simplicityClientNo || '—'}</strong></span>
              <span>Limit: <strong style={{ color: 'var(--primary)' }}>{inv.simplicityCreditLimit || '—'}</strong></span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                {inv.noaRequired && <span style={{ color: '#38bdf8', fontSize: '9px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.08)', padding: '1px 4px', borderRadius: '3px' }}>NOA</span>}
                {inv.consultantInvoiceReceived && <span style={{ color: 'var(--success)', fontSize: '9px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '1px 4px', borderRadius: '3px' }}>Consultant Inv</span>}
              </div>
            </div>
          )}
        </td>
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
        {activeSubTab === 'simplicity' && (
          <td style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>
            {inv.balanceOutstanding > 0 ? (() => {
              const days = inv.daysSinceStart;
              if (days >= 120) {
                return (
                  <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🟥 Recourse Clawback (Day {days})
                  </span>
                );
              } else if (days >= 90) {
                return (
                  <span style={{ color: 'var(--warning)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🟧 Credit Loss (Day {days})
                  </span>
                );
              } else if (days >= 31) {
                return (
                  <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: '600' }}>
                    🟨 Follow-up Active (Day {days})
                  </span>
                );
              } else {
                return (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                    Standard Grace (Day {days})
                  </span>
                );
              }
            })() : (
              <span style={{ color: 'var(--success)', fontSize: '11px' }}>Paid / Settled</span>
            )}
          </td>
        )}
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
  };

  // 1. Calculate next 6 Fridays dynamically for drop zones
  const upcomingFridays = useMemo(() => {
    const fridays = [];
    try {
      const today = new Date(todayStr);
      let day = today.getDay();
      let daysToFriday = 5 - day;
      if (daysToFriday < 0) {
        daysToFriday += 7;
      }
      const nextFriday = new Date(today.getTime() + daysToFriday * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < 6; i++) {
        const fri = new Date(nextFriday.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const y = fri.getFullYear();
        const m = String(fri.getMonth() + 1).padStart(2, '0');
        const d = String(fri.getDate()).padStart(2, '0');
        fridays.push(`${y}-${m}-${d}`);
      }
    } catch(e) {}
    return fridays;
  }, [todayStr]);

  // 2. Group simplicity invoices by Friday payout date
  const simplicityWeeks = useMemo(() => {
    const groups = {};
    
    invoices.filter(inv => inv.invoiceType === 'simplicity').forEach(inv => {
      const payoutFriday = inv.overridePayoutDate || inv.simplicityPayoutDate || '—';
      if (!groups[payoutFriday]) {
        groups[payoutFriday] = [];
      }
      groups[payoutFriday].push(inv);
    });

    return Object.keys(groups).sort().map(dateStr => {
      const list = groups[dateStr];
      const netTotalSum = list.reduce((sum, inv) => sum + (Number(inv.grossBillAmount) || 0), 0);
      const totalToHumresSum = list.reduce((sum, inv) => sum + ((Number(inv.grossBillAmount) || 0) * 0.973), 0);
      const vatSum = totalToHumresSum * 0.20;
      const totalInclVatSum = totalToHumresSum * 1.20;

      return {
        weekDate: dateStr,
        invoices: list,
        netTotalSum,
        totalToHumresSum,
        vatSum,
        totalInclVatSum
      };
    });
  }, [invoices]);

  // 3. Move invoice to target payout week Friday
  const handleMoveInvoiceToWeek = async (invoiceId, targetWeekDate) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    
    const originalPlacement = placements.find(p => p.id === invoiceId);
    if (!originalPlacement) return;

    const updatedPlacement = {
      ...originalPlacement,
      overridePayoutDate: targetWeekDate
    };

    try {
      await onUpdatePlacement(updatedPlacement);
      onShowToast(`Moved ${inv.candidateName} to week ending ${targetWeekDate}`, "success");
    } catch (e) {
      onShowToast(`Failed to move invoice: ${e.message}`, "warning");
    }
  };



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

        {/* Simplicity Recourse Alert Banner */}
        {activeSubTab === 'simplicity' && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.03)', 
            border: '1px solid rgba(239, 68, 68, 0.15)', 
            borderRadius: '12px', 
            padding: '16px 20px', 
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
              <AlertTriangle size={18} />
              <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Simplicity Factoring & Recourse Risk Summary</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                  🟥 Recourse Clawbacks (Day 120+)
                </span>
                <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: 'var(--danger)', fontFamily: 'monospace' }}>
                  £{dashboardStats.simplicityClawbackTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Deducted off next payment. ({dashboardStats.simplicityClawbackList.length} cases)
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                  🟧 Credit Limit Expiry (Day 90-119)
                </span>
                <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'monospace' }}>
                  £{dashboardStats.simplicityExpiryTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Client loses limit on Simplicity. ({dashboardStats.simplicityExpiryList.length} cases)
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                  🟨 Standard Chase Active (Day 31-89)
                </span>
                <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                  £{dashboardStats.simplicityFollowupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Followed up from Day 31. ({dashboardStats.simplicityFollowupList.length} cases)
                </span>
              </div>
            </div>
          </div>
        )}

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
          SPREADSHEET VIEW WITH CONDITIONAL TAB LOGIC
          ------------------------------------------------------------- */}
      {activeSubTab === 'direct' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* 1. DISPUTED & LEGAL INVOICES (Top Table) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(239, 68, 68, 0.04)', 
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚠️ Disputed & Legal Proceedings Invoices ({partitionedInvoices.disputedLegal.length})
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Action Required</span>
            </div>
            <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('placementId')}>Placement ID {renderSortIndicator('placementId')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('client')}>Client Company {renderSortIndicator('client')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('candidateName')}>Candidate Name {renderSortIndicator('candidateName')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('recruiter')}>Recruiter {renderSortIndicator('recruiter')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('dueDate')}>Due Date {renderSortIndicator('dueDate')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }} onClick={() => handleSort('amount')}>Total Invoice {renderSortIndicator('amount')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }} onClick={() => handleSort('status')}>Status {renderSortIndicator('status')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {partitionedInvoices.disputedLegal.map(inv => {
                    const symbol = getCurrencySymbol(inv);
                    const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
                    return (
                      <tr key={inv.id} onClick={() => handleOpenDetail(inv)} style={{ cursor: 'pointer' }} className="table-row-hover">
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}><strong>{inv.clientCompany}</strong></td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}>{inv.candidateName}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.recruiterNames}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{inv.invoiceDueDate}</span>
                            {inv.paymentStatus === 'overdue' && <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>({inv.overdueDays}d overdue)</span>}
                          </div>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{symbol}{(inv.totalInvoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: `${statusObj.color}15`, color: statusObj.color, border: `1px solid ${statusObj.color}30`, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{statusObj.label}</span>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: inv.balanceOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>{symbol}{(inv.balanceOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{inv.invoiceFileUrl ? <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}><FileDown size={12} /></a> : '-'}</td>
                      </tr>
                    );
                  })}
                  {partitionedInvoices.disputedLegal.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No disputed or legal action invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. LIVE OUTSTANDING INVOICES (Middle Table) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(99, 102, 241, 0.04)', 
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⏳ Live Outstanding & Overdue Invoices ({partitionedInvoices.liveOutstanding.length})
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Ledger</span>
            </div>
            <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('placementId')}>Placement ID {renderSortIndicator('placementId')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('client')}>Client Company {renderSortIndicator('client')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('candidateName')}>Candidate Name {renderSortIndicator('candidateName')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('recruiter')}>Recruiter {renderSortIndicator('recruiter')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('dueDate')}>Due Date {renderSortIndicator('dueDate')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }} onClick={() => handleSort('amount')}>Total Invoice {renderSortIndicator('amount')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }} onClick={() => handleSort('status')}>Status {renderSortIndicator('status')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {partitionedInvoices.liveOutstanding.map(inv => {
                    const symbol = getCurrencySymbol(inv);
                    const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
                    return (
                      <tr key={inv.id} onClick={() => handleOpenDetail(inv)} style={{ cursor: 'pointer' }} className="table-row-hover">
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}><strong>{inv.clientCompany}</strong></td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}>{inv.candidateName}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.recruiterNames}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{inv.invoiceDueDate}</span>
                            {inv.paymentStatus === 'overdue' && <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>({inv.overdueDays}d overdue)</span>}
                          </div>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{symbol}{(inv.totalInvoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: `${statusObj.color}15`, color: statusObj.color, border: `1px solid ${statusObj.color}30`, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{statusObj.label}</span>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: inv.balanceOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>{symbol}{(inv.balanceOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{inv.invoiceFileUrl ? <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}><FileDown size={12} /></a> : '-'}</td>
                      </tr>
                    );
                  })}
                  {partitionedInvoices.liveOutstanding.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No live outstanding invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. CLOSED & HISTORICAL INVOICES (Bottom Table) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '10px 14px', 
              backgroundColor: 'rgba(16, 185, 129, 0.04)', 
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ✅ Closed & Historical Settled Invoices ({partitionedInvoices.closed.length})
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Archived / Paid</span>
            </div>
            <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('placementId')}>Placement ID {renderSortIndicator('placementId')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('client')}>Client Company {renderSortIndicator('client')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('candidateName')}>Candidate Name {renderSortIndicator('candidateName')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('recruiter')}>Recruiter {renderSortIndicator('recruiter')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }} onClick={() => handleSort('dueDate')}>Due Date {renderSortIndicator('dueDate')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }} onClick={() => handleSort('amount')}>Total Invoice {renderSortIndicator('amount')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }} onClick={() => handleSort('status')}>Status {renderSortIndicator('status')}</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }}>Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {partitionedInvoices.closed.map(inv => {
                    const symbol = getCurrencySymbol(inv);
                    const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
                    return (
                      <tr key={inv.id} onClick={() => handleOpenDetail(inv)} style={{ cursor: 'pointer' }} className="table-row-hover">
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}><strong>{inv.clientCompany}</strong></td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}>{inv.candidateName}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.recruiterNames}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{inv.invoiceDueDate}</span>
                            {inv.paymentStatus === 'overdue' && <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 'bold' }}>({inv.overdueDays}d overdue)</span>}
                          </div>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{symbol}{(inv.totalInvoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: `${statusObj.color}15`, color: statusObj.color, border: `1px solid ${statusObj.color}30`, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{statusObj.label}</span>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: inv.balanceOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>{symbol}{(inv.balanceOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{inv.invoiceFileUrl ? <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}><FileDown size={12} /></a> : '-'}</td>
                      </tr>
                    );
                  })}
                  {partitionedInvoices.closed.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No closed or historical invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Simplicity Upcoming Payout Friday Drop Zones */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              📬 Reschedule Expected Payout Week (Drag Invoice Row & Drop Here):
            </span>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
              {upcomingFridays.map(fri => (
                <div 
                  key={fri}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const invoiceId = e.dataTransfer.getData("text/plain");
                    handleMoveInvoiceToWeek(invoiceId, fri);
                  }}
                  style={{ 
                    flex: '0 0 130px', 
                    padding: '8px 10px', 
                    backgroundColor: 'rgba(99, 102, 241, 0.03)', 
                    border: '1px dashed var(--primary)', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    textAlign: 'center',
                    cursor: 'default',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  onDragEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.03)';
                  }}
                >
                  📅 Drop to {fri}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Grouped Tables */}
          {simplicityWeeks.map(week => {
            return (
              <div 
                key={week.weekDate}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const invoiceId = e.dataTransfer.getData("text/plain");
                  handleMoveInvoiceToWeek(invoiceId, week.weekDate);
                }}
                style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                {/* Week Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 14px', 
                  backgroundColor: 'rgba(99, 102, 241, 0.04)', 
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📅 Week Ending Friday: {week.weekDate} ({week.invoices.length} Starters)
                  </h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Drag invoice here to reschedule</span>
                </div>

                <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Placement ID</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Client Company</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Candidate Name</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Recruiter</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Start Date</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>Simplicity Risk Timeline</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Net Total</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Total to Humres (97.3%)</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>VAT (20%)</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'right' }}>Total including VAT</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }}>Status</th>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', textAlign: 'center' }}>Doc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {week.invoices.map((inv, idx) => {
                        const symbol = getCurrencySymbol(inv);
                        const statusObj = PAYMENT_STATUSES.find(s => s.value === inv.paymentStatus) || { label: inv.paymentStatus, color: '#fff' };
                        
                        return (
                          <tr 
                            key={inv.id} 
                            onClick={() => handleOpenDetail(inv)}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", inv.id);
                            }}
                            style={{ cursor: 'grab', transition: 'background-color 0.2s' }}
                            className="table-row-hover"
                          >
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id)}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}>
                              <strong>{inv.clientCompany}</strong>
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', flexDirection: 'column' }}>
                                <span>Client No: {inv.simplicityClientNo || '—'} &bull; Limit: {inv.simplicityCreditLimit || '—'}</span>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                  {inv.noaRequired && <span style={{ color: '#38bdf8', fontSize: '8px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.08)', padding: '1px 3px', borderRadius: '2px' }}>NOA</span>}
                                  {inv.consultantInvoiceReceived && <span style={{ color: 'var(--success)', fontSize: '8px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '1px 3px', borderRadius: '2px' }}>Consultant Inv</span>}
                                </div>
                              </div>
                            </td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }}>{inv.candidateName}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{inv.recruiterNames}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>{inv.startDate}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {inv.balanceOutstanding > 0 ? (() => {
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
                              )}
                            </td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{symbol}{(Number(inv.grossBillAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)' }}>{symbol}{((Number(inv.grossBillAmount) || 0) * 0.973).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>{symbol}{((Number(inv.grossBillAmount) || 0) * 0.973 * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{symbol}{((Number(inv.grossBillAmount) || 0) * 0.973 * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>
                              <span style={{ backgroundColor: `${statusObj.color}15`, color: statusObj.color, border: `1px solid ${statusObj.color}30`, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>{statusObj.label}</span>
                            </td>
                            <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{inv.invoiceFileUrl ? <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}><FileDown size={12} /></a> : '-'}</td>
                          </tr>
                        );
                      })}
                      
                      {/* Weekly Aggregated Sum Row */}
                      <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                        <td colSpan="6" style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right' }}>📊 WEEK ending {week.weekDate} TOTALS:</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>£{week.netTotalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)' }}>£{week.totalToHumresSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace' }}>£{week.vatSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--primary)' }}>£{week.totalInclVatSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td colSpan="2" style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontSize: '12px' }} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {simplicityWeeks.length === 0 && (
            <div style={{ padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No simplicity invoice records found matching the active search or filters.
            </div>
          )}
        </div>
      )}

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

                {/* Simplicity Factoring & Recourse Risk Meter */}
                {selectedInvoice.invoiceType === 'simplicity' && (
                  <div style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.02)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '10.5px' }}>
                        🛡️ Simplicity Factoring Audit & Deadlines
                      </span>
                      {selectedInvoice.balanceOutstanding > 0 && (
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: selectedInvoice.daysSinceStart >= 120 ? 'var(--danger)' : selectedInvoice.daysSinceStart >= 90 ? 'var(--warning)' : 'var(--success)'
                        }}>
                          Day {selectedInvoice.daysSinceStart} of 120 limit
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                      <div>💰 <strong>Humres Friday Payout:</strong> {selectedInvoice.simplicityPayoutDate}</div>
                      <div>📅 <strong>Client Due Date:</strong> {selectedInvoice.invoiceDueDate} (30 Days)</div>
                    </div>

                    {selectedInvoice.balanceOutstanding > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        {/* Risk Timeline visual track */}
                        <div style={{ display: 'flex', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '25%', backgroundColor: '#10b981' }} title="Day 1-30: Paid Grace" />
                          <div style={{ width: '50%', backgroundColor: '#0ea5e9' }} title="Day 31-90: Active Follow-up" />
                          <div style={{ width: '25%', backgroundColor: 'var(--warning)' }} title="Day 91-120: Expiry Alert" />
                          <div style={{ width: '100%', backgroundColor: 'var(--danger)' }} title="Day 120+: Recourse active" />
                        </div>
                        
                        {/* Status Message */}
                        <div>
                          {selectedInvoice.daysSinceStart >= 120 ? (
                            <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                              ⚠️ RECOURSE CLAWBACK ACTIVE: Simplicity will deduct this invoice amount off Humres' next payment. Legal action initiated by Simplicity.
                            </div>
                          ) : selectedInvoice.daysSinceStart >= 90 ? (
                            <div style={{ color: 'var(--warning)', fontWeight: 'bold' }}>
                              ⚠️ CREDIT LIMIT EXPIRED: Client credit limit has been lost on Simplicity! Prompt collection action required.
                            </div>
                          ) : selectedInvoice.daysSinceStart >= 31 ? (
                            <div style={{ color: '#38bdf8' }}>
                              &bull; Simplicity follow-ups active. Client is {selectedInvoice.overdueDays} days past due date.
                            </div>
                          ) : (
                            <div style={{ color: 'var(--success)' }}>
                              &bull; Within standard grace period. Expected payout from Simplicity is scheduled for Friday.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
