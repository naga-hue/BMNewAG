import React, { useState } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  Cake, 
  FileText, 
  Clock, 
  Briefcase, 
  Search, 
  Info, 
  CheckCircle2, 
  User, 
  Building2, 
  TrendingUp, 
  ShieldCheck,
  Receipt
} from 'lucide-react';

export default function WhatsImportantDashboard({
  companies = [],
  staff = [],
  leaveRequests = [],
  holidays = [],
  contracts = [],
  vendors = [],
  placements = [],
  setActiveTab,
  setSelectedCompany,
  setSelectedStaff
}) {
  const [activeHorizon, setActiveHorizon] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-dismissed-alerts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const handleDismissAlert = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem('bm-dismissed-alerts', JSON.stringify(updated));
  };

  const [showDismissedDrawer, setShowDismissedDrawer] = useState(false);

  const handleRestoreAlert = (id) => {
    const updated = dismissedIds.filter(x => x !== id);
    setDismissedIds(updated);
    localStorage.setItem('bm-dismissed-alerts', JSON.stringify(updated));
  };

  const [dispatchLogs, setDispatchLogs] = useState([]);

  // Fixed Anchor Date representing "Today"
  const ANCHOR_DATE = new Date('2026-07-13');

  const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };
  const getContractCostText = (c) => {
    const symbol = symbolMap[c.currency] || '£';
    const totalVal = c.unitCost * c.quantityPurchased;
    const intervalSuffix = c.costInterval === 'monthly' ? '/mo' : (c.costInterval === 'annual' ? '/yr' : ' (one-off)');
    return `${symbol}${totalVal.toLocaleString()}${intervalSuffix}`;
  };

  // Calculate the start and end dates for the selected time horizon
  const getHorizonRange = (horizon) => {
    const start = new Date(ANCHOR_DATE.getTime());
    const end = new Date(ANCHOR_DATE.getTime());

    if (horizon === 'today') {
      // July 13
    } else if (horizon === 'tomorrow') {
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
    } else if (horizon === 'this_week') {
      // Today (Monday, July 13) to Sunday of this week (July 19)
      const dayOfWeek = ANCHOR_DATE.getDay();
      const diffToSunday = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek);
      end.setDate(end.getDate() + diffToSunday);
    } else if (horizon === 'next_week') {
      // Monday of next week (July 20) to Sunday of next week (July 26)
      const dayOfWeek = ANCHOR_DATE.getDay();
      const diffToNextMonday = 8 - (dayOfWeek === 0 ? 7 : dayOfWeek);
      start.setDate(start.getDate() + diffToNextMonday);
      end.setDate(start.getDate() + 6);
    } else if (horizon === 'this_month') {
      // First day of current month to last day of current month
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (horizon === 'next_month') {
      // August 1 to August 31
      start.setMonth(start.getMonth() + 1);
      start.setDate(1);
      end.setMonth(end.getMonth() + 2);
      end.setDate(0);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const { start: rangeStart, end: rangeEnd } = getHorizonRange(activeHorizon);

  // Helper date matchers
  const isDateInRange = (dateStr, rStart, rEnd) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0); // avoid timezone shifts
    return d >= rStart && d <= rEnd;
  };

  const isLeaveOverlapping = (leave, rStart, rEnd) => {
    if (!leave.startDate || !leave.endDate) return false;
    const leaveStart = new Date(leave.startDate);
    const leaveEnd = new Date(leave.endDate);
    leaveStart.setHours(0, 0, 0, 0);
    leaveEnd.setHours(23, 59, 59, 999);
    return leaveStart <= rEnd && leaveEnd >= rStart;
  };

  const checkBirthdayAnniversary = (dobStr, startStr, rStart, rEnd) => {
    let birthday = false;
    let bdayAge = 0;
    let anniversary = false;
    let annivYears = 0;

    const parseBday = dobStr ? new Date(dobStr) : null;
    const parseStart = startStr ? new Date(startStr) : null;

    let cur = new Date(rStart.getTime());
    while (cur <= rEnd) {
      const month = cur.getMonth();
      const date = cur.getDate();

      if (parseBday && parseBday.getMonth() === month && parseBday.getDate() === date) {
        birthday = true;
        bdayAge = cur.getFullYear() - parseBday.getFullYear();
      }

      if (parseStart && parseStart.getMonth() === month && parseStart.getDate() === date) {
        const diffYears = cur.getFullYear() - parseStart.getFullYear();
        if (diffYears > 0) {
          anniversary = true;
          annivYears = diffYears;
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    return { birthday, bdayAge, anniversary, annivYears };
  };

  // Compile datasets
  const activeStaff = staff.filter(s => s.status !== 'exited');

  // 1. Staff Leaves & Absences
  const horizonLeaves = leaveRequests
    .filter(req => req.status === 'approved' && isLeaveOverlapping(req, rangeStart, rangeEnd))
    .map(req => {
      const sMember = staff.find(st => st.id === req.staffId);
      return {
        id: `leave-${req.id}`,
        category: 'absences',
        title: sMember ? sMember.fullName : 'Unknown Employee',
        desc: `On Leave: ${req.startDate} to ${req.endDate} (${req.totalDays} Days) - Reason: ${req.leaveType || 'General'}`,
        badge: 'Leave Active',
        type: 'info',
        staffMember: sMember,
        startDate: req.startDate
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const horizonHolidays = holidays
    .filter(h => isDateInRange(h.date, rangeStart, rangeEnd))
    .map(h => {
      const comp = companies.find(c => c.id === h.companyId);
      return {
        id: `holiday-${h.id || h.date}`,
        category: 'absences',
        title: h.name,
        desc: `Public Holiday for ${comp ? comp.name : 'all offices'} on ${h.date}`,
        badge: 'Public Holiday',
        type: 'success',
        date: h.date
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Statutory Filing Deadlines
  const horizonFilingTasks = companies.flatMap(c => {
    if (!c.complianceTasks) return [];
    return c.complianceTasks
      .filter(t => t.status === 'pending' && isDateInRange(t.dueDate, rangeStart, rangeEnd))
      .map(t => ({
        id: `filing-${c.id}-${t.id}`,
        category: 'filings',
        title: t.name,
        desc: `Filing due for ${c.name} (Deadline: ${t.dueDate}). ${t.notes ? 'Notes: ' + t.notes : ''}`,
        badge: 'Filing Due',
        type: 'warning',
        company: c,
        dueDate: t.dueDate
      }));
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // 3. Company Document Alerts
  const missingContractAlerts = (activeHorizon === 'today' || activeHorizon === 'this_month') 
    ? activeStaff
        .filter(s => !s.documents || !s.documents.some(d => d.type === 'appointment'))
        .map(s => ({
          id: `missing-doc-${s.id}`,
          category: 'docAlerts',
          title: `Contract Missing: ${s.fullName}`,
          desc: `Active Staff Member has no Appointment/Contract document uploaded on file.`,
          badge: 'Contract Missing',
          type: 'critical',
          staffMember: s
        }))
    : [];

  const insuranceExpiryAlerts = companies.flatMap(c => {
    if (!c.insurance || !c.insurance.expiryDate) return [];
    const expDate = new Date(c.insurance.expiryDate);
    const expired = expDate < ANCHOR_DATE;
    
    const matchesPeriod = expired 
      ? (activeHorizon === 'today')
      : isDateInRange(c.insurance.expiryDate, rangeStart, rangeEnd);

    if (!matchesPeriod) return [];

    return [{
      id: `ins-expiry-${c.id}`,
      category: 'docAlerts',
      title: `${c.name} Insurance Expiry`,
      desc: expired 
        ? `Liability coverage EXPIRED on ${c.insurance.expiryDate} (Policy: ${c.insurance.policyNumber})`
        : `Liability coverage expires on ${c.insurance.expiryDate} (Policy: ${c.insurance.policyNumber})`,
      badge: expired ? 'Critical Expiry' : 'Insurance Expiring',
      type: 'critical',
      company: c,
      expiryDate: c.insurance.expiryDate
    }];
  }).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  // 4. Birthdays & Anniversaries
  const horizonCelebrations = staff
    .filter(s => s.status !== 'exited')
    .flatMap(s => {
      const { birthday, bdayAge, anniversary, annivYears } = checkBirthdayAnniversary(s.dateOfBirth, s.startDate, rangeStart, rangeEnd);
      const items = [];

      if (birthday) {
        items.push({
          id: `bday-${s.id}`,
          category: 'celebrations',
          title: `🎂 Birthday: ${s.fullName}`,
          desc: `Turns ${bdayAge} years old! Show some appreciation.`,
          badge: 'Birthday',
          type: 'pink',
          staffMember: s
        });
      }

      if (anniversary) {
        const ord = annivYears === 1 ? '1st' : annivYears === 2 ? '2nd' : annivYears === 3 ? '3rd' : `${annivYears}th`;
        items.push({
          id: `anniv-${s.id}`,
          category: 'celebrations',
          title: `👔 Anniversary: ${s.fullName}`,
          desc: `Celebrating ${ord} year anniversary at Humres!`,
          badge: 'Work Anniversary',
          type: 'indigo',
          staffMember: s
        });
      }

      return items;
    });

  // 5. Candidate Starts
  const horizonPlacementStarts = placements
    .filter(p => p.status !== 'dns' && isDateInRange(p.startDate, rangeStart, rangeEnd))
    .map(p => ({
      id: `p-start-${p.id}`,
      category: 'candidateStarts',
      title: `Candidate Start: ${p.candidateName}`,
      desc: `Starts placement at ${p.clientCompany} as ${p.jobTitle || 'Recruit'}. Split: ${p.splits?.map(s => s.staffName).join(', ') || 'No splits'}.`,
      badge: 'Placement Start',
      type: 'indigo',
      placement: p,
      startDate: p.startDate
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Vendor Contracts Expiring
  const horizonContractExpiries = contracts
    .filter(c => isDateInRange(c.endDate, rangeStart, rangeEnd))
    .map(c => {
      const vend = vendors.find(v => v.id === c.vendorId);
      return {
        id: `contract-exp-${c.id}`,
        category: 'expiringContracts',
        title: `Vendor Contract Expiring: ${c.name}`,
        desc: `Contract with ${vend ? vend.name : 'Unknown Vendor'} expires on ${c.endDate}. Value: ${getContractCostText(c)}.`,
        badge: 'Contract Expiring',
        type: 'warning',
        contract: c,
        endDate: c.endDate
      };
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  // 6. Other Upcoming Events
  const upcomingEvents = (activeHorizon === 'today') 
    ? [
        {
          id: 'event-daily-standup',
          category: 'events',
          title: 'Daily Humres Group Standup',
          desc: '10:00 AM daily operational sync across all global offices.',
          badge: 'Daily Event',
          type: 'success'
        }
      ]
    : [];

  // 7. Accounts Receivable (AR)
  const horizonARInvoices = placements
    .filter(p => p.status !== 'dns' && p.clientPaymentStatus !== 'paid' && p.invoiceNumber)
    .filter(p => {
      if (!p.invoiceDueDate) return false;
      const dueDate = new Date(p.invoiceDueDate);
      const isExpired = dueDate < ANCHOR_DATE;
      
      return isExpired 
        ? (activeHorizon === 'today' || activeHorizon === 'this_week')
        : isDateInRange(p.invoiceDueDate, rangeStart, rangeEnd);
    })
    .map(p => {
      const dueDate = new Date(p.invoiceDueDate);
      const isExpired = dueDate < ANCHOR_DATE;
      return {
        id: `ar-${p.id}`,
        category: 'arAlerts',
        title: `AR Invoice Unpaid: ${p.clientCompany}`,
        desc: `Invoice #${p.invoiceNumber} for Candidate ${p.candidateName} (Amount: £${(p.balanceOutstanding || p.totalInvoiceAmount || 0).toLocaleString()}). Due: ${p.invoiceDueDate}`,
        badge: isExpired ? 'Invoice Overdue' : 'Payment Due',
        type: isExpired ? 'critical' : 'warning',
        placement: p,
        dueDate: p.invoiceDueDate
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // 8. Accounts Payable (AP)
  const horizonAPBills = contracts
    .filter(c => {
      if (!c.paymentDueDate) return false;
      const dueDate = new Date(c.paymentDueDate);
      const isExpired = dueDate < ANCHOR_DATE;
      
      return isExpired 
        ? (activeHorizon === 'today' || activeHorizon === 'this_week')
        : isDateInRange(c.paymentDueDate, rangeStart, rangeEnd);
    })
    .map(c => {
      const vend = vendors.find(v => v.id === c.vendorId);
      const dueDate = new Date(c.paymentDueDate);
      const isExpired = dueDate < ANCHOR_DATE;
      return {
        id: `ap-${c.id}`,
        category: 'apAlerts',
        title: `AP Vendor Payment: ${vend ? vend.name : 'Unknown Vendor'} (${c.name})`,
        desc: `Vendor contract payout for ${c.name} (Amount: ${getContractCostText(c)}). Due: ${c.paymentDueDate}`,
        badge: isExpired ? 'Payment Overdue' : 'Payment Imminent',
        type: isExpired ? 'critical' : 'warning',
        contract: c,
        dueDate: c.paymentDueDate
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Invoices to be Raised (unpaid and has no invoice number yet)
  const horizonInvoicesToRaise = placements
    .filter(p => p.status !== 'dns' && !p.invoiceNumber)
    .filter(p => {
      const triggerDateStr = p.invoiceTriggerCustomDate || p.startDate;
      if (!triggerDateStr) return false;
      const triggerDate = new Date(triggerDateStr);
      const isExpired = triggerDate < ANCHOR_DATE;
      
      return isExpired 
        ? (activeHorizon === 'today' || activeHorizon === 'this_week')
        : isDateInRange(triggerDateStr, rangeStart, rangeEnd);
    })
    .map(p => {
      const triggerDateStr = p.invoiceTriggerCustomDate || p.startDate;
      const triggerDate = new Date(triggerDateStr);
      const isExpired = triggerDate < ANCHOR_DATE;
      return {
        id: `raise-${p.id}`,
        category: 'invoicesToRaise',
        title: `Raise Invoice: ${p.clientCompany}`,
        desc: `Candidate: ${p.candidateName}. Gross billing: £${(p.grossBillAmount || 0).toLocaleString()}. Trigger event: ${p.invoiceTriggerType || 'start-date'} (${triggerDateStr})`,
        badge: isExpired ? 'Raise Overdue' : 'Action Required',
        type: isExpired ? 'critical' : 'warning',
        placement: p,
        triggerDate: triggerDateStr
      };
    })
    .sort((a, b) => a.triggerDate.localeCompare(b.triggerDate));

  // 7b. Debtors Over 60 Days
  const debtorOver60Alerts = placements
    .filter(p => p.status !== 'dns' && p.clientPaymentStatus !== 'paid' && p.invoiceDueDate)
    .filter(p => {
      const due = new Date(p.invoiceDueDate);
      const diff = ANCHOR_DATE.getTime() - due.getTime();
      const overdueDays = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
      return overdueDays > 60;
    })
    .map(p => {
      const due = new Date(p.invoiceDueDate);
      const diff = ANCHOR_DATE.getTime() - due.getTime();
      const overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const amount = Number(p.balanceOutstanding || p.totalInvoiceAmount || p.grossBillAmount || 0);
      return {
        id: `debtor-60-${p.id}`,
        category: 'debtorAlerts',
        title: `Overdue Debtor (>60 Days): ${p.clientCompany}`,
        desc: `Invoice #${p.invoiceNumber || 'N/A'} for Candidate ${p.candidateName} is overdue by ${overdueDays} days. Outstanding: £${amount.toLocaleString()}`,
        badge: '60+ Days Overdue',
        type: 'critical',
        placement: p,
        dueDate: p.invoiceDueDate
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const staffExpiryAlerts = [];
  activeStaff.forEach(s => {
    if (s.visaExpiryDate) {
      const expDate = new Date(s.visaExpiryDate);
      const diffTime = expDate.getTime() - ANCHOR_DATE.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 60) {
        const isExpired = diffDays < 0;
        staffExpiryAlerts.push({
          id: `staff-visa-${s.id}`,
          category: 'docAlerts',
          title: `Visa Expiry: ${s.fullName}`,
          desc: `${s.fullName}'s work visa ${isExpired ? 'expired on' : 'expires on'} ${s.visaExpiryDate} (${isExpired ? 'Expired' : `${diffDays} days remaining`}).`,
          badge: isExpired ? 'Visa Expired' : 'Visa Expiring',
          type: isExpired ? 'critical' : 'warning',
          staffId: s.id
        });
      }
    }

    if (s.contractRenewalDate) {
      const renDate = new Date(s.contractRenewalDate);
      const diffTime = renDate.getTime() - ANCHOR_DATE.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 60) {
        const isExpired = diffDays < 0;
        staffExpiryAlerts.push({
          id: `staff-contract-${s.id}`,
          category: 'docAlerts',
          title: `Contract Renewal: ${s.fullName}`,
          desc: `${s.fullName}'s employment contract is due for renewal on ${s.contractRenewalDate}.`,
          badge: isExpired ? 'Renewal Overdue' : 'Renewal Impending',
          type: isExpired ? 'critical' : 'warning',
          staffId: s.id
        });
      }
    }
  });

  // Combine everything
  const rawAllAlerts = [
    ...horizonLeaves,
    ...horizonHolidays,
    ...horizonFilingTasks,
    ...missingContractAlerts,
    ...insuranceExpiryAlerts,
    ...horizonCelebrations,
    ...horizonPlacementStarts,
    ...horizonContractExpiries,
    ...horizonARInvoices,
    ...horizonAPBills,
    ...horizonInvoicesToRaise,
    ...debtorOver60Alerts,
    ...upcomingEvents,
    ...staffExpiryAlerts
  ];

  const dismissedAlerts = rawAllAlerts.filter(a => dismissedIds.includes(a.id));
  const allAlerts = rawAllAlerts.filter(a => !dismissedIds.includes(a.id));

  // Apply search query
  const filteredAlerts = allAlerts.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.desc.toLowerCase().includes(q) ||
      a.badge.toLowerCase().includes(q)
    );
  });

  const criticalAlertIds = filteredAlerts
    .filter(a => a.type === 'critical')
    .map(a => a.id)
    .sort()
    .join(',');

  console.log("[WhatsImportantDashboard] render. criticalAlertIds:", criticalAlertIds || "none");

  React.useEffect(() => {
    console.log("[WhatsImportantDashboard] useEffect triggered. criticalAlertIds:", criticalAlertIds || "none");
    const criticalAlerts = filteredAlerts.filter(a => a.type === 'critical');
    if (criticalAlerts.length === 0) return;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setDispatchLogs(prev => {
      const newLogs = [];
      criticalAlerts.forEach(a => {
        const alreadyLogged = prev.some(log => log.alertId === a.id);
        if (!alreadyLogged) {
          console.log("[WhatsImportantDashboard] logging new critical alert:", a.id);
          newLogs.push({
            id: `log-${Date.now()}-${a.id}`,
            alertId: a.id,
            timestamp: new Date().toLocaleTimeString(),
            title: a.title,
            status: 'Dispatched',
            method: 'Web Push & Email Dispatch to AP/Finance desk'
          });

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`⚠️ Humres Risk Alert: ${a.title}`, {
              body: a.desc
            });
          }
        }
      });
      if (newLogs.length === 0) return prev;
      return [...newLogs, ...prev].slice(0, 15);
    });
  }, [criticalAlertIds]);

  // Categorize for rendering
  const categories = {
    absences: { title: 'Leave & Absences', icon: <Calendar size={16} />, color: '#0ea5e9', items: [] },
    filings: { title: 'Statutory Filings', icon: <Clock size={16} />, color: '#f59e0b', items: [] },
    debtorAlerts: { title: 'Debtors Over 60 Days', icon: <AlertTriangle size={16} />, color: '#ef4444', items: [] },
    docAlerts: { title: 'Document Alerts', icon: <AlertTriangle size={16} />, color: '#ef4444', items: [] },
    arAlerts: { title: 'Accounts Receivable (AR)', icon: <TrendingUp size={16} />, color: '#10b981', items: [] },
    apAlerts: { title: 'Accounts Payable (AP)', icon: <Receipt size={16} />, color: '#f43f5e', items: [] },
    invoicesToRaise: { title: 'Invoices to be Raised', icon: <FileText size={16} />, color: '#8b5cf6', items: [] },
    candidateStarts: { title: 'Candidate Starts', icon: <User size={16} />, color: '#6366f1', items: [] },
    expiringContracts: { title: 'Vendor Contracts Expiring', icon: <Briefcase size={16} />, color: '#f59e0b', items: [] },
    celebrations: { title: 'Birthdays & Anniversaries', icon: <Cake size={16} />, color: '#ec4899', items: [] },
    events: { title: 'Other Events', icon: <Info size={16} />, color: '#10b981', items: [] }
  };

  filteredAlerts.forEach(item => {
    if (categories[item.category]) {
      categories[item.category].items.push(item);
    }
  });

  const getDaysCountLabel = () => {
    if (activeHorizon === 'today') return 'today';
    if (activeHorizon === 'tomorrow') return 'tomorrow';
    if (activeHorizon === 'this_week') return 'this week';
    if (activeHorizon === 'next_week') return 'next week';
    if (activeHorizon === 'this_month') return 'this month';
    return 'next month';
  };

  const getHorizonBadgeColor = (type) => {
    switch (type) {
      case 'critical': return { bg: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444' };
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b' };
      case 'success': return { bg: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981' };
      case 'pink': return { bg: 'rgba(236, 72, 153, 0.12)', border: '1px solid rgba(236, 72, 153, 0.25)', color: '#ec4899' };
      case 'indigo': return { bg: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#6366f1' };
      default: return { bg: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.25)', color: '#0ea5e9' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Top Banner introducing the view with Loss Aversion Urgency Framing */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(99, 102, 241, 0.08) 100%)',
        border: '1px solid var(--border-color)',
        borderLeft: '5px solid var(--primary)',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Welcome back, Naga
            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px' }}>
              Super Admin Overview
            </span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Centralized operational dashboard overview for <strong>{getDaysCountLabel()}</strong>.
          </p>
        </div>

        {/* Contrast Effect: High-Priority Risk Counter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#ef4444' }}>
              {criticalAlertIds.length}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
              Loss Risks / Overdue
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
              {filteredAlerts.length - criticalAlertIds.length}
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              Optimized Actions
            </div>
          </div>
        </div>
      </div>

      {/* Control bar: Tabs & Search Filter */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        
        {/* Horizon Tabs Selector */}
        <div style={{ 
          display: 'flex', 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)',
          padding: '4px', 
          borderRadius: '8px' 
        }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'this_week', label: 'This Week' },
            { id: 'next_week', label: 'Next Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'next_month', label: 'Next Month' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveHorizon(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: activeHorizon === tab.id ? 600 : 500,
                color: activeHorizon === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: activeHorizon === tab.id ? 'var(--border-color)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search important items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>
          {dismissedIds.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowDismissedDrawer(true)}
              style={{ fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              🔄 History ({dismissedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Grid of Categories */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        {Object.entries(categories).map(([key, category]) => {
          const hasItems = category.items.length > 0;
          return (
            <div 
              key={key}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 10px -2px rgba(0,0,0,0.1)',
                gridColumn: key === 'arAlerts' ? '1 / -1' : 'auto'
              }}
            >
              
              {/* Category Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: `rgba(${parseInt(category.color.slice(1,3), 16)}, ${parseInt(category.color.slice(3,5), 16)}, ${parseInt(category.color.slice(5,7), 16)}, 0.08)`,
                  color: category.color
                }}>
                  {category.icon}
                </div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', flex: 1 }}>
                  {category.title}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '10px' }}>
                  {category.items.length}
                </span>
              </div>

              {/* Category Items List */}
              {key === 'arAlerts' ? (() => {
                const simplicityAR = category.items.filter(item => item.placement?.invoiceType === 'simplicity');
                const directAR = category.items.filter(item => item.placement?.invoiceType !== 'simplicity');
                
                return (
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
                    
                    {/* Simplicity Table */}
                    <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 4px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                        <span>Simplicity Accounts Receivable</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({simplicityAR.length} due)</span>
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)' }}>
                              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Client / Candidate</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Due Date</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simplicityAR.length > 0 ? simplicityAR.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px 4px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.placement.clientCompany}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.placement.candidateName}</div>
                                </td>
                                <td style={{ padding: '8px 4px' }}>
                                  <span style={{ 
                                    color: item.type === 'critical' ? 'var(--danger)' : 'inherit',
                                    fontWeight: item.type === 'critical' ? 700 : 'normal'
                                  }}>
                                    {item.placement.invoiceDueDate}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>
                                  £{(item.placement.balanceOutstanding || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setActiveTab('credit_control')}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '10px' }}
                                  >
                                    Ledger
                                  </button>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan="4" style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>No simplicity invoices due</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Direct Table */}
                    <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 4px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                        <span>Direct Accounts Receivable</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({directAR.length} due)</span>
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)' }}>
                              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Client / Candidate</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600 }}>Due Date</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                              <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {directAR.length > 0 ? directAR.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px 4px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.placement.clientCompany}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.placement.candidateName}</div>
                                </td>
                                <td style={{ padding: '8px 4px' }}>
                                  <span style={{ 
                                    color: item.type === 'critical' ? 'var(--danger)' : 'inherit',
                                    fontWeight: item.type === 'critical' ? 700 : 'normal'
                                  }}>
                                    {item.placement.invoiceDueDate}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>
                                  £{(item.placement.balanceOutstanding || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setActiveTab('credit_control')}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '10px' }}
                                  >
                                    Ledger
                                  </button>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan="4" style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>No direct invoices due</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                );
              })() : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {hasItems ? (
                    category.items.map(item => {
                      const badgeStyle = getHorizonBadgeColor(item.type);
                      return (
                        <div 
                          key={item.id}
                          className="important-alert-card"
                          style={{
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            borderRadius: '8px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            borderLeft: `4px solid ${category.color}`,
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            cursor: 'default'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.title}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                fontSize: '9px', 
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                                ...badgeStyle
                              }}>
                                {item.badge}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismissAlert(item.id);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  lineHeight: 1
                                }}
                                title="Dismiss Alert"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                            {item.desc}
                          </p>

                          {/* Navigation Quick Links */}
                          {(item.staffMember || item.company || item.placement || item.contract) && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              {item.staffMember && (
                                <button
                                  onClick={() => {
                                    setSelectedStaff(item.staffMember);
                                    setActiveTab('staff');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  View Staff Profile
                                </button>
                              )}
                              {item.company && (
                                <button
                                  onClick={() => {
                                    setSelectedCompany(item.company);
                                    setActiveTab('directory');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  Go to Compliance Tasks
                                </button>
                              )}
                              {item.placement && (
                                <button
                                  onClick={() => {
                                    setActiveTab('credit_control');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  Go to Credit Control Ledger
                                </button>
                              )}
                              {item.contract && (
                                <button
                                  onClick={() => {
                                    setActiveTab('vendors');
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  Go to Vendor Contracts
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '24px 0',
                      color: 'var(--text-muted)',
                      gap: '4px',
                      flex: 1
                    }}>
                      <span style={{ fontSize: '11px' }}>No items pending</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dispatch logs simulator console */}
      <div className="detail-section" style={{ marginTop: '24px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ fontSize: '13px', margin: '0 0 8px 0', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🛡️ Automatic Web Push & Email Dispatch Logs</span>
          <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text-muted)' }}>(Realtime alerts monitoring)</span>
        </h3>
        {dispatchLogs.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No critical risk alerts dispatched yet. Automatic push-notifications will log here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {dispatchLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderBottom: '1px dashed rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>[{log.status}]</span>
                  <span style={{ color: 'var(--text-primary)' }}>{log.title}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({log.method})</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.timestamp}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dismissed Alerts History Drawer */}
      {showDismissedDrawer && (
        <div className="form-wizard-overlay" onClick={() => setShowDismissedDrawer(false)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="wizard-header">
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>🔄 Dismissed Alerts History Log</h2>
              <button type="button" className="btn-close" onClick={() => setShowDismissedDrawer(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                The following alerts were hidden from the primary dashboard feed. Click "Restore Alert" to reactivate them.
              </p>
              {dismissedAlerts.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                  No dismissed alerts found in history.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dismissedAlerts.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, marginRight: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.desc}</span>
                      </div>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => handleRestoreAlert(item.id)}
                        style={{ fontSize: '10px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      >
                        Restore Alert
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDismissedDrawer(false)}>Close History</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
