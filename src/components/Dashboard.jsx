import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  FileWarning, 
  AlertTriangle, 
  Globe, 
  CheckCircle2, 
  Clock, 
  Info,
  CalendarDays,
  CalendarCheck,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  Sliders
} from 'lucide-react';

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

export default function Dashboard({ 
  companies = [], 
  onSelectCompany,
  staff = [],
  leaveRequests = [],
  holidays = [],
  contracts = [],
  vendors = [],
  placements = []
}) {
  // Current date anchor: June 29, 2026
  const CURRENT_DATE = new Date(); CURRENT_DATE.setHours(0, 0, 0, 0);
  const [calDate, setCalDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [chartCompanyFilters, setChartCompanyFilters] = useState({ consolidated: true });
  
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const companyColors = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
  
  const monthlyRevenue = useMemo(() => {
    const monthlySum = Array(12).fill(0);
    placements.forEach(p => {
      if (p.status !== 'dns' && p.startDate) {
        const dateObj = new Date(p.startDate);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() === 2026) {
          const monthIndex = dateObj.getMonth();
          monthlySum[monthIndex] += Number(p.grossBillAmount || 0);
        }
      }
    });
    return monthlySum;
  }, [placements]);

  const maxMonthlyRevenue = useMemo(() => {
    return Math.max(...monthlyRevenue, 10000);
  }, [monthlyRevenue]);

  const activeChartCompanyIds = useMemo(() => {
    return companies.map(c => c.id).filter(id => chartCompanyFilters[id] === true);
  }, [companies, chartCompanyFilters]);

  const companyMonthlyRevenues = useMemo(() => {
    const res = {};
    companies.forEach(c => {
      res[c.id] = Array(12).fill(0);
    });

    placements.forEach(p => {
      if (p.status !== 'dns' && p.startDate && p.companyId) {
        const dateObj = new Date(p.startDate);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() === 2026) {
          const monthIndex = dateObj.getMonth();
          if (res[p.companyId]) {
            res[p.companyId][monthIndex] += Number(p.grossBillAmount || 0);
          }
        }
      }
    });
    return res;
  }, [placements, companies]);

  const chartData = useMemo(() => {
    const width = 800;
    const height = 240;
    const paddingLeft = 70;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const lines = [];

    // Consolidated Total
    const consSum = Array(12).fill(0);
    companies.forEach(c => {
      const revs = companyMonthlyRevenues[c.id] || [];
      revs.forEach((r, i) => { consSum[i] += r; });
    });

    const consPoints = consSum.map((val, idx) => {
      const x = paddingLeft + (idx / 11) * chartWidth;
      const ratio = val / maxMonthlyRevenue;
      const y = height - paddingBottom - ratio * chartHeight;
      return { x, y, value: val, month: MONTH_LABELS[idx] };
    });

    const consLinePath = consPoints.length > 0 
      ? `M ${consPoints[0].x} ${consPoints[0].y} ` + consPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
      : '';

    const consAreaPath = consPoints.length > 0
      ? `${consLinePath} L ${consPoints[consPoints.length - 1].x} ${height - paddingBottom} L ${consPoints[0].x} ${height - paddingBottom} Z`
      : '';

    lines.push({
      id: 'consolidated',
      name: 'Consolidated Total',
      color: 'var(--primary)',
      points: consPoints,
      linePath: consLinePath,
      areaPath: consAreaPath,
      isArea: true
    });

    // Individual lines
    companies.forEach((c, idx) => {
      if (chartCompanyFilters[c.id] === true) {
        const revs = companyMonthlyRevenues[c.id] || Array(12).fill(0);
        const pts = revs.map((val, mIdx) => {
          const x = paddingLeft + (mIdx / 11) * chartWidth;
          const ratio = val / maxMonthlyRevenue;
          const y = height - paddingBottom - ratio * chartHeight;
          return { x, y, value: val, month: MONTH_LABELS[mIdx] };
        });

        const lp = pts.length > 0 
          ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
          : '';

        lines.push({
          id: c.id,
          name: c.name,
          color: companyColors[idx % companyColors.length],
          points: pts,
          linePath: lp,
          areaPath: '',
          isArea: false
        });
      }
    });

    return { lines, width, height, paddingLeft, paddingRight, paddingTop, paddingBottom, chartWidth, chartHeight };
  }, [monthlyRevenue, maxMonthlyRevenue, chartCompanyFilters, companies, companyMonthlyRevenues]);

  // Helper to compile core document/insurance alerts
  const getComplianceAlerts = (company) => {
    const alerts = [];
    
    // Check registration document
    const hasRegDoc = company.documents.some(d => d.type === 'registration');
    if (!hasRegDoc) {
      alerts.push({
        id: `${company.id}-no-reg`,
        company,
        type: 'critical',
        title: 'Registration Document Missing',
        desc: `No Certificate of Incorporation found for ${company.name}.`
      });
    }

    // Check tax document
    const hasTaxDoc = company.documents.some(d => d.type === 'vat');
    if (company.vatNumber && !hasTaxDoc) {
      const taxLabel = company.country === 'India' ? 'GSTIN' : company.country === 'United States' ? 'EIN' : company.country === 'United Arab Emirates' ? 'TRN' : 'VAT';
      alerts.push({
        id: `${company.id}-no-tax`,
        company,
        type: 'warning',
        title: `${taxLabel} Certificate Missing`,
        desc: `Tax code is recorded (${company.vatNumber}) but certificate upload is missing.`
      });
    }

    // Check insurance status
    if (!company.hasInsurance || !company.insurance) {
      alerts.push({
        id: `${company.id}-no-ins`,
        company,
        type: 'critical',
        title: 'No Insurance Details Recorded',
        desc: `${company.name} has no commercial liability coverage on file.`
      });
    } else {
      // Check insurance document
      const hasInsDoc = company.documents.some(d => d.type === 'insurance');
      if (!hasInsDoc) {
        alerts.push({
          id: `${company.id}-no-ins-doc`,
          company,
          type: 'warning',
          title: 'Insurance Policy Certificate Missing',
          desc: `Insurance details are filled but policy document upload is missing.`
        });
      }

      // Check insurance expiry
      const expiry = new Date(company.insurance.expiryDate);
      const diffTime = expiry - CURRENT_DATE;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        alerts.push({
          id: `${company.id}-ins-expired`,
          company,
          type: 'critical',
          title: 'Insurance Expired',
          desc: `Policy ${company.insurance.policyNumber} expired on ${company.insurance.expiryDate}.`
        });
      } else if (diffDays <= 90) {
        alerts.push({
          id: `${company.id}-ins-expiring`,
          company,
          type: 'expiring',
          title: 'Insurance Expiring Soon',
          desc: `Policy expires in ${diffDays} days (${company.insurance.expiryDate}).`
        });
      }
    }

    return alerts;
  };

  // Compile all doc/insurance alerts
  const docAlerts = companies.flatMap(getComplianceAlerts);

  // Calculate birthdays and work anniversaries in the current calendar month
  const currentMonthIndex = CURRENT_DATE.getMonth();
  const currentMonthName = CURRENT_DATE.toLocaleDateString(undefined, { month: 'long' });
  const celebrationsList = [];

  staff.forEach(s => {
    if (s.status === 'exited') return;
    if (s.dateOfBirth) {
      const dob = new Date(s.dateOfBirth);
      if (dob.getMonth() === currentMonthIndex) {
        celebrationsList.push({
          id: `bday-card-${s.id}`,
          type: 'birthday',
          fullName: s.fullName,
          dateStr: dob.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          day: dob.getDate(),
          detail: `🎂 Birthday (Turns ${CURRENT_DATE.getFullYear() - dob.getFullYear()})`
        });
      }
    }

    if (s.startDate) {
      const start = new Date(s.startDate);
      if (start.getMonth() === currentMonthIndex) {
        const years = CURRENT_DATE.getFullYear() - start.getFullYear();
        if (years > 0) {
          const ordinal = years === 1 ? '1st' : years === 2 ? '2nd' : years === 3 ? '3rd' : `${years}th`;
          celebrationsList.push({
            id: `anniv-card-${s.id}`,
            type: 'anniversary',
            fullName: s.fullName,
            dateStr: start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            day: start.getDate(),
            detail: `👔 ${ordinal} Work Anniversary`
          });
        }
      }
    }
  });

  const currentMonthCelebrations = celebrationsList.sort((a, b) => a.day - b.day);

  // Compile all statutory compliance tasks
  const allStatutoryTasks = companies.flatMap(c => {
    if (!c.complianceTasks) return [];
    return c.complianceTasks.map(t => ({
      ...t,
      company: c
    }));
  });

  // Filter for pending statutory tasks
  const pendingStatutoryTasks = allStatutoryTasks
    .filter(t => t.status === 'pending')
    .map(t => {
      const dueDate = new Date(t.dueDate);
      const diffTime = dueDate - CURRENT_DATE;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        ...t,
        daysLeft: diffDays,
        isOverdue: diffDays < 0
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const overdueStatutoryCount = pendingStatutoryTasks.filter(t => t.isOverdue).length;

  // Group metrics
  const totalCompanies = companies.length;
  const insuredCompanies = companies.filter(c => c.hasInsurance && c.insurance).length;
  
  // Calculate aggregate critical compliance risks (overdue filings + missing core records)
  const criticalComplianceCount = companies.filter(c => {
    const hasRegDoc = c.documents.some(d => d.type === 'registration');
    let hasExpiredInsurance = false;
    if (c.hasInsurance && c.insurance) {
      const expiry = new Date(c.insurance.expiryDate);
      hasExpiredInsurance = (expiry - CURRENT_DATE) < 0;
    }
    
    // Check if company has any overdue compliance tasks
    const hasOverdueTasks = c.complianceTasks && c.complianceTasks.some(t => {
      if (t.status !== 'pending') return false;
      const due = new Date(t.dueDate);
      return (due - CURRENT_DATE) < 0;
    });

    return !hasRegDoc || hasExpiredInsurance || hasOverdueTasks;
  }).length;

  // Upcoming due dates count (filings & insurances expiring in 30 days)
  const immediateActionsCount = pendingStatutoryTasks.filter(t => t.daysLeft >= 0 && t.daysLeft <= 30).length + 
    companies.filter(c => {
      if (!c.hasInsurance || !c.insurance) return false;
      const expiry = new Date(c.insurance.expiryDate);
      const diffDays = Math.ceil((expiry - CURRENT_DATE) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;

  // Country breakdown
  const countryCounts = companies.reduce((acc, c) => {
    acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {});

  const countryListData = Object.entries(countryCounts).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / totalCompanies) * 100)
  })).sort((a, b) => b.count - a.count);

  // Compile Operational events (Next 30 days)
  const getUpcomingEvents = () => {
    const events = [];
    
    const getDaysDiff = (targetDateStr) => {
      if (!targetDateStr) return 999;
      const target = new Date(targetDateStr);
      target.setHours(0, 0, 0, 0);
      const todayVal = new Date(CURRENT_DATE);
      todayVal.setHours(0, 0, 0, 0);
      
      const diff = target - todayVal;
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // 1. Birthdays & Anniversaries
    staff.forEach(s => {
      // Birthdays
      if (s.dateOfBirth) {
        const dob = new Date(s.dateOfBirth);
        if (!isNaN(dob.getTime())) {
          let bday = new Date(CURRENT_DATE.getFullYear(), dob.getMonth(), dob.getDate());
          if (!isNaN(bday.getTime())) {
            if (bday < CURRENT_DATE) {
              bday = new Date(CURRENT_DATE.getFullYear() + 1, dob.getMonth(), dob.getDate());
            }
            if (!isNaN(bday.getTime())) {
              const diff = getDaysDiff(bday.toISOString().split('T')[0]);
              if (diff >= 0 && diff <= 30) {
                events.push({
                  id: `bday-${s.id}`,
                  type: 'birthday',
                  title: `🎂 Birthday: ${s.fullName}`,
                  dateStr: bday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  diffDays: diff,
                  dept: s.department,
                  company: companies.find(c => c.id === s.companyId)?.name || ''
                });
              }
            }
          }
        }
      }

      // Anniversaries
      if (s.startDate) {
        const start = new Date(s.startDate);
        if (!isNaN(start.getTime())) {
          let anniv = new Date(CURRENT_DATE.getFullYear(), start.getMonth(), start.getDate());
          if (!isNaN(anniv.getTime())) {
            let annivYear = CURRENT_DATE.getFullYear();
            if (anniv < CURRENT_DATE) {
              anniv = new Date(CURRENT_DATE.getFullYear() + 1, start.getMonth(), start.getDate());
              annivYear = CURRENT_DATE.getFullYear() + 1;
            }
            if (!isNaN(anniv.getTime())) {
              const years = annivYear - start.getFullYear();
              const diff = getDaysDiff(anniv.toISOString().split('T')[0]);
              if (diff >= 0 && diff <= 30 && years > 0) {
                const ordinal = years === 1 ? '1st' : years === 2 ? '2nd' : years === 3 ? '3rd' : `${years}th`;
                events.push({
                  id: `anniv-${s.id}`,
                  type: 'anniversary',
                  title: `👔 Work Anniversary: ${s.fullName} (${ordinal})`,
                  dateStr: anniv.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  diffDays: diff,
                  dept: s.department,
                  company: companies.find(c => c.id === s.companyId)?.name || ''
                });
              }
            }
          }
        }
      }
    });

    // 2. Approved Leaves
    leaveRequests
      .filter(r => r.status === 'approved')
      .forEach(r => {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        const diff = getDaysDiff(r.startDate);
        
        const staffObj = staff.find(s => s.id === r.staffId);
        if (!staffObj) return;

        const isActive = CURRENT_DATE >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
                         CURRENT_DATE <= new Date(end.getFullYear(), end.getMonth(), end.getDate());

        if (isActive) {
          events.push({
            id: `leave-active-${r.id}`,
            type: 'leave',
            title: `🌴 On Leave Now: ${staffObj.fullName}`,
            dateStr: `Active (ends ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`,
            diffDays: 0,
            dept: staffObj.department,
            company: companies.find(c => c.id === staffObj.companyId)?.name || ''
          });
        } else if (diff >= 0 && diff <= 30) {
          events.push({
            id: `leave-upcoming-${r.id}`,
            type: 'leave',
            title: `🌴 Upcoming Leave: ${staffObj.fullName}`,
            dateStr: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            diffDays: diff,
            dept: staffObj.department,
            company: companies.find(c => c.id === staffObj.companyId)?.name || ''
          });
        }
      });

    // 3. Holidays
    holidays.forEach(h => {
      if (h.date) {
        const diff = getDaysDiff(h.date);
        if (diff >= 0 && diff <= 30) {
          events.push({
            id: `holiday-${h.id}`,
            type: 'holiday',
            title: `🏖️ Public Holiday: ${h.name} (${h.country || 'Global'})`,
            dateStr: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            diffDays: diff,
            dept: '',
            company: ''
          });
        }
      }
    });

    // 4. Payment dues to vendors
    contracts.forEach(c => {
      if (c.paymentDueDate) {
        const diff = getDaysDiff(c.paymentDueDate);
        // Include payments due within 30 days or overdue
        if (diff <= 30) {
          const matchedVendor = vendors.find(v => v.id === c.vendorId);
          const rawCost = c.unitCost * c.quantityPurchased;
          const taxFactor = 1 + ((c.taxRate || 0) / 100);
          const cost = rawCost * taxFactor;
          const symbol = symbolMap[c.currency] || '£';

          events.push({
            id: `pay-${c.id}`,
            type: 'payment',
            title: `💰 Payment Due: ${c.name} (${matchedVendor ? matchedVendor.name : 'Vendor'})`,
            dateStr: new Date(c.paymentDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            costStr: `${symbol}${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            diffDays: diff,
            isOverdue: diff < 0,
            dept: '',
            company: companies.find(comp => comp.id === c.companyId)?.name || ''
          });
        }
      }
    });

    // 5. Contract renewals
    contracts.forEach(c => {
      const renewalTarget = c.renewalDate || c.endDate;
      if (renewalTarget) {
        const diff = getDaysDiff(renewalTarget);
        if (diff <= 30) {
          const matchedVendor = vendors.find(v => v.id === c.vendorId);
          events.push({
            id: `renew-${c.id}`,
            type: 'renewal',
            title: `🔄 Contract Renewal: ${c.name} (${matchedVendor ? matchedVendor.name : 'Vendor'})`,
            dateStr: new Date(renewalTarget).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            diffDays: diff,
            isOverdue: diff < 0,
            dept: '',
            company: companies.find(comp => comp.id === c.companyId)?.name || ''
          });
        }
      }
    });

    return events.sort((a, b) => a.diffDays - b.diffDays);
  };

  const allEvents = getUpcomingEvents();
  const next7DaysEvents = allEvents.filter(evt => evt.diffDays <= 7 || evt.isOverdue);
  const next30DaysEvents = allEvents.filter(evt => evt.diffDays > 7 && evt.diffDays <= 30);

  const renderEventRow = (evt) => {
    const bgColors = {
      birthday: { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)', text: '#ec4899' },
      anniversary: { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.2)', text: '#818cf8' },
      leave: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
      holiday: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', text: '#10b981' },
      payment: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.2)', text: '#f43f5e' },
      renewal: { bg: 'rgba(147, 51, 234, 0.08)', border: 'rgba(147, 51, 234, 0.2)', text: '#a855f7' }
    };
    const c = bgColors[evt.type] || { bg: 'rgba(255,255,255,0.03)', border: 'var(--border-color)', text: 'var(--text-primary)' };

    return (
      <div 
        key={evt.id} 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '10px 14px', 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderLeft: `4px solid ${c.text}`,
          borderRadius: '6px',
          fontSize: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {evt.title}
            {evt.isOverdue && (
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                OVERDUE
              </span>
            )}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {evt.company && `${evt.company} `}{evt.dept && `• ${evt.dept}`}
          </span>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontWeight: 700, color: c.text }}>{evt.dateStr}</span>
          {evt.costStr ? (
            <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-primary)' }}>{evt.costStr}</span>
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {evt.diffDays === 0 ? 'today' : evt.diffDays === 1 ? 'tomorrow' : `in ${evt.diffDays} days`}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Behavioral UX: Goal Gradient & Contrast Effect Banner */}
      <div 
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          alignItems: 'center'
        }}
      >
        {/* Goal Gradient Effect: Progress toward Placement Revenue Target */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} style={{ color: 'var(--primary)' }} /> Annual Revenue Goal Progress
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
              £{monthlyRevenue.reduce((a, b) => a + b, 0).toLocaleString()} / £1,200,000 ({Math.min(100, Math.round((monthlyRevenue.reduce((a, b) => a + b, 0) / 1200000) * 100))}%)
            </span>
          </div>

          {/* Goal Gradient Progress Bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${Math.min(100, (monthlyRevenue.reduce((a, b) => a + b, 0) / 1200000) * 100)}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--success) 100%)',
                borderRadius: '4px',
                transition: 'width 0.5s ease-out'
              }} 
            />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            🎯 Annual Target: You are {Math.min(100, Math.round((monthlyRevenue.reduce((a, b) => a + b, 0) / 1200000) * 100))}% toward achieving your annual target!
          </span>
        </div>

        {/* Contrast Effect & Reciprocity: Current vs Optimized framing */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '10px 14px', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Contrast Framing & Optimization
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              Current Overhead Risk: <span style={{ color: '#ef4444' }}>High</span> ➔ Optimized: <span style={{ color: 'var(--success)' }}>Peak Zero-Waste</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              1-Click Optimization Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        
        <div className="metric-card" style={{ '--card-accent': 'var(--primary)', '--card-accent-light': 'var(--primary-light)' }}>
          <div className="metric-info">
            <h3>Total Entities</h3>
            <div className="metric-value">{totalCompanies}</div>
            <div className="metric-trend trend-neutral">
              <Globe size={14} /> Active globally
            </div>
          </div>
          <div className="metric-icon-wrapper">
            <Building2 size={24} />
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--success)', '--card-accent-light': 'var(--success-light)' }}>
          <div className="metric-info">
            <h3>Insured Companies</h3>
            <div className="metric-value">{insuredCompanies} <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>/ {totalCompanies}</span></div>
            <div className="metric-trend trend-up">
              <ShieldCheck size={14} /> Active policies
            </div>
          </div>
          <div className="metric-icon-wrapper">
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--danger)', '--card-accent-light': 'var(--danger-light)' }}>
          <div className="metric-info">
            <h3>Critical Risks</h3>
            <div className="metric-value">{criticalComplianceCount}</div>
            <div className="metric-trend" style={{ color: criticalComplianceCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
              <FileWarning size={14} /> Overdue filings/docs
            </div>
          </div>
          <div className="metric-icon-wrapper">
            <FileWarning size={24} />
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--warning)', '--card-accent-light': 'var(--warning-light)' }}>
          <div className="metric-info">
            <h3>Due &lt; 30 Days</h3>
            <div className="metric-value">{immediateActionsCount}</div>
            <div className="metric-trend" style={{ color: immediateActionsCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              <Clock size={14} /> Action items
            </div>
          </div>
          <div className="metric-icon-wrapper">
            <Clock size={24} />
          </div>
        </div>

      </div>

      {/* YTD Group Revenue SVG Trend Chart */}
      <div className="chart-card" style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '13px', margin: 0, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📈 2026 Group Monthly Placement Billings (YTD Trend)
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Calculated in real-time based on active scored placements
          </span>
        </div>

        {/* Company Legend Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>Filter View:</span>
          
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '11.5px', 
            cursor: 'pointer', 
            color: 'var(--text-primary)',
            backgroundColor: chartCompanyFilters['consolidated'] !== false ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${chartCompanyFilters['consolidated'] !== false ? 'var(--primary)' : 'var(--border-color)'}`,
            padding: '5px 12px',
            borderRadius: '20px',
            transition: 'all 0.2s ease-in-out'
          }}>
            <input 
              type="checkbox" 
              checked={chartCompanyFilters['consolidated'] !== false}
              onChange={(e) => setChartCompanyFilters(prev => ({ ...prev, consolidated: e.target.checked }))}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Consolidated Total</span>
          </label>

          {companies.map((c, idx) => {
            const color = companyColors[idx % companyColors.length];
            const isChecked = !!chartCompanyFilters[c.id];
            return (
              <label key={c.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '11px', 
                cursor: 'pointer', 
                color: 'var(--text-primary)',
                backgroundColor: isChecked ? `${color}20` : 'var(--bg-card)',
                border: `1px solid ${isChecked ? color : 'var(--border-color)'}`,
                padding: '4px 10px',
                borderRadius: '20px',
                transition: 'all 0.2s ease-in-out'
              }}>
                <input 
                  type="checkbox" 
                  checked={isChecked}
                  onChange={(e) => setChartCompanyFilters(prev => ({ ...prev, [c.id]: e.target.checked }))}
                  style={{ cursor: 'pointer', accentColor: color }}
                />
                <span style={{ fontWeight: 600, color }}>{c.name}</span>
              </label>
            );
          })}
        </div>

        {/* SVG Trend Chart Canvas */}
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '12px' }}>
          <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} style={{ width: '100%', height: 'auto', minWidth: '700px' }}>
            <defs>
              <linearGradient id="dashboardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = chartData.height - chartData.paddingBottom - ratio * chartData.chartHeight;
              const labelVal = Math.round(ratio * maxMonthlyRevenue);
              return (
                <g key={idx}>
                  <line 
                    x1={chartData.paddingLeft} 
                    y1={y} 
                    x2={chartData.width - chartData.paddingRight} 
                    y2={y} 
                    stroke="var(--border-color)" 
                    strokeDasharray="4 4" 
                    strokeWidth={0.5}
                  />
                  <text 
                    x={chartData.paddingLeft - 10} 
                    y={y + 4} 
                    fill="var(--text-muted)" 
                    fontSize={10} 
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    £{labelVal.toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* Area Path (Consolidated Only) */}
            {chartCompanyFilters['consolidated'] !== false && chartData.lines[0] && (
              <path d={chartData.lines[0].areaPath} fill="url(#dashboardAreaGrad)" />
            )}

            {/* Line Paths */}
            {chartData.lines.map(line => {
              if (line.id === 'consolidated' && chartCompanyFilters['consolidated'] === false) return null;
              return (
                <path 
                  key={line.id}
                  d={line.linePath} 
                  fill="none" 
                  stroke={line.color} 
                  strokeWidth={3} 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              );
            })}

            {/* X Axis Labels */}
            {chartData.lines[0]?.points.map((p, idx) => (
              <text 
                key={idx} 
                x={p.x} 
                y={chartData.height - 15} 
                fill="var(--text-muted)" 
                fontSize={10} 
                textAnchor="middle"
              >
                {p.month}
              </text>
            ))}

            {/* Interactive Data Nodes */}
            {chartData.lines.map(line => {
              if (line.id === 'consolidated' && chartCompanyFilters['consolidated'] === false) return null;
              return line.points.map((p, idx) => (
                <g 
                  key={`${line.id}-${idx}`}
                  onMouseEnter={() => setHoveredPoint({ ...p, lineName: line.name, lineColor: line.color })}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={hoveredPoint?.month === p.month && hoveredPoint?.lineName === line.name ? 7 : 4} 
                    fill={line.color} 
                    stroke="#fff" 
                    strokeWidth={2}
                    style={{ transition: 'all 0.15s' }}
                  />
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={15} 
                    fill="transparent" 
                  />
                </g>
              ));
            })}
          </svg>

          {/* Interactive Tooltip Overlay */}
          {hoveredPoint && (
            <div style={{
              position: 'absolute',
              top: `${hoveredPoint.y - 50}px`,
              left: `${hoveredPoint.x - 60}px`,
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${hoveredPoint.lineColor || 'var(--primary)'}`,
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--text-primary)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 100
            }}>
              <strong>{hoveredPoint.month} 2026</strong><br/>
              <span style={{ color: hoveredPoint.lineColor }}>{hoveredPoint.lineName}</span>: <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>£{Math.round(hoveredPoint.value).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Cockpit Layout */}
      <div className="analytics-section" style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr' }}>
        
        {/* Compliance & Document Alerts Panel */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} style={{ color: 'var(--danger)' }} /> Document & Coverage Alerts
            </h2>
            <span style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
              {docAlerts.length} Alerts
            </span>
          </div>

          {docAlerts.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={48} className="empty-state-icon" style={{ color: 'var(--success)' }} />
              <div>All insurance certificates and registration certificates are up to date.</div>
            </div>
          ) : (
            <div className="alerts-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {docAlerts.map(alert => (
                <div 
                  key={alert.id} 
                  className={`alert-item ${alert.type}`}
                  onClick={() => onSelectCompany(alert.company)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ marginTop: '2px' }}>
                    {alert.type === 'critical' ? (
                      <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                    ) : (
                      <Info size={18} style={{ color: alert.type === 'expiring' ? 'var(--warning)' : 'var(--info)' }} />
                    )}
                  </div>
                  <div className="alert-content">
                    <div className="alert-title">{alert.title}</div>
                    <div className="alert-desc">{alert.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className={`country-badge country-${alert.company.country.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {alert.company.name}
                      </span>
                      <span className="alert-time">View Profile</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statutory Compliance Calendar Timeline */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={20} style={{ color: 'var(--accent)' }} /> Statutory Filing Timeline
            </h2>
            {overdueStatutoryCount > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                {overdueStatutoryCount} Overdue
              </span>
            )}
          </div>

          {pendingStatutoryTasks.length === 0 ? (
            <div className="empty-state">
              <CalendarCheck size={48} className="empty-state-icon" style={{ color: 'var(--success)' }} />
              <div>No pending statutory filings!</div>
            </div>
          ) : (
            <div className="alerts-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {pendingStatutoryTasks.map(task => (
                <div 
                  key={task.id} 
                  className={`alert-item ${task.isOverdue ? 'critical' : task.daysLeft <= 30 ? 'expiring' : ''}`}
                  onClick={() => onSelectCompany(task.company)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ marginTop: '2px' }}>
                    {task.isOverdue ? (
                      <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                    ) : (
                      <CalendarDays size={18} style={{ color: task.daysLeft <= 30 ? 'var(--warning)' : 'var(--primary)' }} />
                    )}
                  </div>
                  <div className="alert-content">
                    <div className="alert-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{task.name}</span>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        color: task.isOverdue ? 'var(--danger)' : task.daysLeft <= 30 ? 'var(--warning)' : 'var(--text-secondary)'
                      }}>
                        {task.isOverdue ? 'OVERDUE' : `In ${task.daysLeft} days`}
                      </span>
                    </div>
                    <div className="alert-desc" style={{ fontSize: '12px', margin: '4px 0' }}>
                      Due Date: <strong>{task.dueDate}</strong> &bull; {task.notes}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className={`country-badge country-${task.company.country.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {task.company.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Filings Calendar</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Celebrations & Anniversaries Card */}
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span role="img" aria-label="celebration-icon" style={{ fontSize: '18px' }}>🎉</span> Celebrations & Anniversaries
            </h2>
            <span style={{ fontSize: '11px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
              {currentMonthName}
            </span>
          </div>

          {currentMonthCelebrations.length === 0 ? (
            <div className="empty-state">
              <span role="img" aria-label="empty-icon" style={{ fontSize: '36px', marginBottom: '10px' }}>📅</span>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No events for {currentMonthName}</div>
            </div>
          ) : (
            <div className="alerts-list" style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentMonthCelebrations.map(c => {
                const isBirthday = c.type === 'birthday';
                return (
                  <div 
                    key={c.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)', 
                      borderLeft: `4px solid ${isBirthday ? '#ec4899' : '#818cf8'}`,
                      borderRadius: '6px',
                      padding: '8px 12px'
                    }}
                  >
                    <div style={{ 
                      fontSize: '18px', 
                      width: '32px', 
                      height: '32px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: isBirthday ? 'rgba(236, 72, 153, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                      borderRadius: '50%'
                    }}>
                      {isBirthday ? '🎂' : '👔'}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>
                        {c.fullName}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {c.detail}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isBirthday ? '#ec4899' : '#818cf8' }}>
                        {c.dateStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Leaves & Holidays Monthly Calendar Widget */}
      <div className="chart-card" style={{ width: '100%' }}>
        <div className="chart-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={20} style={{ color: 'var(--accent)' }} /> Group Leaves & Bank Holidays Calendar
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              ◀
            </button>
            <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '120px', textAlign: 'center', color: 'var(--text-primary)' }}>
              {calDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              ▶
            </button>
            <button 
              type="button"
              className="btn-secondary" 
              onClick={() => setCalDate(new Date('2026-06-01'))}
              style={{ padding: '4px 10px', fontSize: '12px', marginLeft: '6px' }}
            >
              Today
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* Calendar Grid */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>{d}</div>
              ))}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {(() => {
                const year = calDate.getFullYear();
                const month = calDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                let firstDayIndex = new Date(year, month, 1).getDay();
                firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

                const cells = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<div key={`empty-${i}`} style={{ minHeight: '80px', backgroundColor: 'transparent' }} />);
                }

                for (let d = 1; d <= daysInMonth; d++) {
                  const dayEvents = (() => {
                    const events = [];

                    // Holidays
                    holidays.forEach(h => {
                      if (!h.date) return;
                      const hDate = new Date(h.date);
                      if (hDate.getFullYear() === year && hDate.getMonth() === month && hDate.getDate() === d) {
                        events.push({ type: 'holiday', name: h.name });
                      }
                    });

                    // Leaves
                    leaveRequests.forEach(r => {
                      if (r.status !== 'approved' || !r.startDate || !r.endDate) return;
                      const start = new Date(r.startDate);
                      const end = new Date(r.endDate);
                      const checkDate = new Date(year, month, d);
                      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

                      if (checkDate >= startDateOnly && checkDate <= endDateOnly) {
                        const staffMember = staff.find(s => s.id === r.staffId);
                        events.push({
                          type: 'leave',
                          staffName: staffMember ? staffMember.fullName.split(' ')[0] + ' ' + (staffMember.fullName.split(' ')[1] ? staffMember.fullName.split(' ')[1][0] + '.' : '') : 'Staff',
                          leaveType: r.leaveType
                        });
                      }
                    });

                    return events;
                  })();

                  const isToday = year === 2026 && month === 5 && d === 29;

                  cells.push(
                    <div 
                      key={`day-${d}`} 
                      style={{
                        minHeight: '80px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '6px',
                        position: 'relative',
                        boxShadow: isToday ? '0 0 10px rgba(99,102,241,0.25)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                        alignSelf: 'flex-end'
                      }}>
                        {d}
                      </span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1 }}>
                        {dayEvents.map((evt, idx) => (
                          <div 
                            key={idx}
                            style={{
                              fontSize: '9px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              fontWeight: 500,
                              lineHeight: '1.1',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              backgroundColor: evt.type === 'holiday' ? 'rgba(16, 185, 129, 0.15)' : 
                                             evt.leaveType === 'Annual' ? 'rgba(99, 102, 241, 0.15)' : 
                                             evt.leaveType === 'Sick' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: evt.type === 'holiday' ? 'var(--success)' : 
                                     evt.leaveType === 'Annual' ? 'var(--accent)' : 
                                     evt.leaveType === 'Sick' ? 'var(--danger)' : 'var(--warning)',
                              border: evt.type === 'holiday' ? '1px solid rgba(16, 185, 129, 0.2)' : 
                                      evt.leaveType === 'Annual' ? '1px solid rgba(99, 102, 241, 0.2)' : 
                                      evt.leaveType === 'Sick' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                            }}
                            title={evt.type === 'holiday' ? `Holiday: ${evt.name}` : `Leave: ${evt.staffName} (${evt.leaveType})`}
                          >
                            {evt.type === 'holiday' ? `🌴 ${evt.name}` : `👤 ${evt.staffName}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return cells;
              })()}
            </div>
          </div>

          {/* Agenda Sidebar */}
          <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              📅 Monthly Planner Agenda
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
              {(() => {
                const year = calDate.getFullYear();
                const month = calDate.getMonth();
                const list = [];

                // Compile Holidays
                holidays.forEach(h => {
                  if (!h.date) return;
                  const hDate = new Date(h.date);
                  if (hDate.getFullYear() === year && hDate.getMonth() === month) {
                    list.push({
                      day: hDate.getDate(),
                      type: 'holiday',
                      title: h.name,
                      desc: `Public Holiday (${h.country})`
                    });
                  }
                });

                // Compile Leaves
                leaveRequests.forEach(r => {
                  if (r.status !== 'approved' || !r.startDate || !r.endDate) return;
                  const start = new Date(r.startDate);
                  const end = new Date(r.endDate);
                  const monthStart = new Date(year, month, 1);
                  const monthEnd = new Date(year, month + 1, 0);

                  if (start <= monthEnd && end >= monthStart) {
                    const staffMember = staff.find(s => s.id === r.staffId);
                    list.push({
                      day: start.getFullYear() === year && start.getMonth() === month ? start.getDate() : 1,
                      type: 'leave',
                      title: staffMember ? staffMember.fullName : 'Staff Member',
                      desc: `${r.leaveType} Leave (${r.startDate} to ${r.endDate})`
                    });
                  }
                });

                list.sort((a, b) => a.day - b.day);

                return list.map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderLeft: `3px solid ${item.type === 'holiday' ? 'var(--success)' : 'var(--accent)'}`,
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                        Day {item.day}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                ));
              })()}

              {(() => {
                const year = calDate.getFullYear();
                const month = calDate.getMonth();
                const totalEvents = holidays.filter(h => h.date && new Date(h.date).getFullYear() === year && new Date(h.date).getMonth() === month).length +
                                    leaveRequests.filter(r => r.status === 'approved' && r.startDate && r.endDate && new Date(r.startDate) <= new Date(year, month + 1, 0) && new Date(r.endDate) >= new Date(year, month, 1)).length;
                
                if (totalEvents === 0) {
                  return (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                      No leaves or holidays logged this month.
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Operational Planner Agenda */}
      <div className="chart-card" style={{ width: '100%' }}>
        <div className="chart-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={20} style={{ color: 'var(--primary)' }} /> Upcoming Operational Timeline & Agenda
          </h2>
          <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
            Next 30 Days Planner
          </span>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          
          {/* Next 7 Days Column */}
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger)', borderBottom: '2px solid rgba(239, 68, 68, 0.2)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Immediate Agenda (Next 7 Days)</span>
              <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '10px', color: 'var(--danger)' }}>
                {next7DaysEvents.length} items
              </span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {next7DaysEvents.map(evt => renderEventRow(evt))}
              {next7DaysEvents.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No operational actions in the next 7 days.
                </div>
              )}
            </div>
          </div>

          {/* Next 30 Days Column */}
          <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', borderBottom: '2px solid rgba(245, 158, 11, 0.2)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Upcoming Agenda (8 to 30 Days)</span>
              <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '10px', color: 'var(--warning)' }}>
                {next30DaysEvents.length} items
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {next30DaysEvents.map(evt => renderEventRow(evt))}
              {next30DaysEvents.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No upcoming actions scheduled.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
