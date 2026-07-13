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
        staffMember: sMember
      };
    });

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
        type: 'success'
      };
    });

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
        company: c
      }));
  });

  // 3. Company Document Alerts
  // Outstanding missing contract alerts (rendered under "Today" or "This Month" as reminders)
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

  // Expiry alerts for company insurances
  const insuranceExpiryAlerts = companies.flatMap(c => {
    if (!c.insurance || !c.insurance.expiryDate) return [];
    const expDate = new Date(c.insurance.expiryDate);
    const expired = expDate < ANCHOR_DATE;
    
    const matchesPeriod = expired 
      ? (activeHorizon === 'today') // expired show up immediately as critical items today
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
      company: c
    }];
  });

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
      placement: p
    }));

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
        contract: c
      };
    });

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
        placement: p
      };
    });

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
        contract: c
      };
    });

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
        placement: p
      };
    });

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
        placement: p
      };
    });

  // Combine everything
  const allAlerts = [
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
    ...upcomingEvents
  ];

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
      
      {/* Top Banner introducing the view */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(99, 102, 241, 0.05) 100%)',
        border: '1px solid var(--border-color)',
        padding: '20px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
          Welcome back, Paul
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Here is your centralized company dashboard overview for {getDaysCountLabel()}.
        </p>
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

    </div>
  );
}
