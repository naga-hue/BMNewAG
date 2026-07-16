import React, { useState, useEffect } from 'react';
import { X, Send, Mail, ShieldAlert, Users, Laptop, FileText, ClipboardList } from 'lucide-react';
import { toGBP, FX_RATES } from '../utils/currency';

export default function ExitEmailTriggerModal({ 
  isOpen, 
  onClose, 
  staffMember, 
  exitSettings = {}, 
  companies = [], 
  staff = [],
  assetAssignments = [],
  commissionPolicies = [],
  placements = [],
  contracts = [],
  onSend 
}) {
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Currency formatting map
  const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

  // Convert GBP to target currency
  const fromGBP = (gbpAmt, targetCur) => {
    const targetRate = FX_RATES[targetCur] || 1.0;
    return targetRate > 0 ? gbpAmt / targetRate : gbpAmt;
  };

  // Monthly payout calculation helper (cash-received commission)
  const calculateCashReceivedCommission = (member, policy, monthStr) => {
    if (!policy) {
      return { 
        billing: 0, 
        baseEarned: 0, 
        withheld: 0, 
        paidNow: 0, 
        released: 0, 
        totalPayout: 0 
      };
    }

    const [payYear, payMonth] = monthStr.split('-').map(Number);
    let cycleYear = payYear;
    let cycleMonth = payMonth - 1;
    if (cycleMonth === 0) {
      cycleMonth = 12;
      cycleYear = payYear - 1;
    }

    const getMonthsOfService = (startStr, dateStr) => {
      if (!startStr) return 999;
      try {
        const [startYear, startMonth] = startStr.substring(0, 7).split('-').map(Number);
        const [pYear, pMonth] = dateStr.split('-').map(Number);
        return (pYear - startYear) * 12 + (pMonth - startMonth);
      } catch (e) {
        return 999;
      }
    };

    const monthsOfService = getMonthsOfService(member.startDate, monthStr);
    const isStarterWaiverActive = policy.starterWaiveThreshold && monthsOfService < 12;
    const isLocked = policy.effectiveFrom === 'one_year_service' && monthsOfService < 12 && !isStarterWaiverActive;

    if (isLocked) {
      return { 
        billing: 0, 
        baseEarned: 0, 
        withheld: 0, 
        paidNow: 0, 
        released: 0, 
        totalPayout: 0 
      };
    }

    let targetStaffIds = [member.id];
    if (policy.type === 'manager') {
      const teamMembers = staff.filter(s => s.reportingManagerId === member.id);
      targetStaffIds = [member.id, ...teamMembers.map(s => s.id)];
    }

    const getRecruiterBillingForStartMonth = (yearVal, monthVal) => {
      let sum = 0;
      placements.forEach(p => {
        if (!p.startDate || p.status === 'dns') return;
        const pStart = new Date(p.startDate);
        if (pStart.getFullYear() === yearVal && (pStart.getMonth() + 1) === monthVal) {
          p.splits?.forEach(s => {
            if (targetStaffIds.includes(s.staffId)) {
              sum += (p.netScoreValue * s.percentage) / 100;
            }
          });
        }
      });
      return sum;
    };

    const getPolicyCommission = (billingAmt) => {
      const policyCompany = companies.find(c => c.id === policy.companyId);
      const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
      
      const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold || 0, policyCurrency);
      const commissionable = Math.max(0, billingAmt - thresh);
      const slabs = policy.slabs || [];

      if (commissionable <= 0) return { earned: 0, commissionable: 0 };

      let highestRate = 0;
      let isFlatRate = false;
      slabs.forEach(s => {
        if (s.rate > highestRate) highestRate = s.rate;
        if (s.minAmount === 0 && s.maxAmount >= 999999) isFlatRate = true;
      });

      if (isFlatRate) {
        return { earned: (commissionable * highestRate) / 100, commissionable };
      }

      let remaining = commissionable;
      let earned = 0;
      slabs.forEach(slab => {
        const min = toGBP(slab.minAmount || 0, policyCurrency);
        const max = toGBP(slab.maxAmount || 0, policyCurrency);
        const rate = Number(slab.rate) || 0;
        const slabRange = max - min;
        if (remaining > 0) {
          const applicable = Math.min(remaining, slabRange);
          earned += (applicable * rate) / 100;
          remaining -= applicable;
        }
      });

      return { earned, commissionable };
    };

    const getQuarterlyCommissionForMonth = (yearVal, monthVal) => {
      const currentQuarterMonth = monthVal;
      let qStartMonth = 1;
      if (currentQuarterMonth >= 4 && currentQuarterMonth <= 6) qStartMonth = 4;
      else if (currentQuarterMonth >= 7 && currentQuarterMonth <= 9) qStartMonth = 7;
      else if (currentQuarterMonth >= 10 && currentQuarterMonth <= 12) qStartMonth = 10;

      let cumulativeBilling = 0;
      for (let m = qStartMonth; m <= currentQuarterMonth; m++) {
        cumulativeBilling += getRecruiterBillingForStartMonth(yearVal, m);
      }

      const cumulativeRes = getPolicyCommission(cumulativeBilling);
      
      let previousBilling = 0;
      for (let m = qStartMonth; m < currentQuarterMonth; m++) {
        previousBilling += getRecruiterBillingForStartMonth(yearVal, m);
      }
      const previousRes = getPolicyCommission(previousBilling);

      const netEarned = Math.max(0, cumulativeRes.earned - previousRes.earned);
      return {
        earned: netEarned,
        commissionable: cumulativeRes.commissionable
      };
    };

    const currentCycleBilling = getRecruiterBillingForStartMonth(cycleYear, cycleMonth);
    const policyRes = policy.calcInterval === 'quarterly'
      ? getQuarterlyCommissionForMonth(cycleYear, cycleMonth)
      : getPolicyCommission(currentCycleBilling);
    const baseEarned = policyRes.earned;

    let totalPaidNow = 0;
    let totalWithheld = 0;

    placements.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pStart = new Date(p.startDate);
      if (pStart.getFullYear() === cycleYear && (pStart.getMonth() + 1) === cycleMonth) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
          const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;
          
          const myCommShare = currentCycleBilling > 0 
            ? (myBillingShare / currentCycleBilling) * baseEarned 
            : 0;

          const isPaid = p.clientPaymentStatus === 'paid';
          if (isPaid) {
            totalPaidNow += myCommShare;
          } else {
            totalWithheld += myCommShare;
          }
        }
      }
    });

    let totalReleased = 0;
    placements.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pStart = new Date(p.startDate);
      const pStartYear = pStart.getFullYear();
      const pStartMonth = pStart.getMonth() + 1;

      const isBeforeCycle = pStartYear < cycleYear || (pStartYear === cycleYear && pStartMonth < cycleMonth);
      if (isBeforeCycle) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          if (p.clientPaidDate && p.clientPaidDate.substring(0, 7) === monthStr) {
            const histTotalBilling = getRecruiterBillingForStartMonth(pStartYear, pStartMonth);
            const histPolicyRes = policy.calcInterval === 'quarterly'
              ? getQuarterlyCommissionForMonth(pStartYear, pStartMonth)
              : getPolicyCommission(histTotalBilling);
            
            const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
            const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;
            const myCommShare = histTotalBilling > 0 
              ? (myBillingShare / histTotalBilling) * histPolicyRes.earned 
              : 0;
            
            totalReleased += myCommShare;
          }
        }
      }
    });

    const totalPayout = totalPaidNow + totalReleased;
    const policyCompany = companies.find(c => c.id === policy.companyId);
    const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';

    return {
      billing: fromGBP(currentCycleBilling, policyCurrency),
      baseEarned: fromGBP(baseEarned, policyCurrency),
      withheld: fromGBP(totalWithheld, policyCurrency),
      paidNow: fromGBP(totalPaidNow, policyCurrency),
      released: fromGBP(totalReleased, policyCurrency),
      totalPayout: fromGBP(totalPayout, policyCurrency)
    };
  };

  useEffect(() => {
    if (staffMember && isOpen) {
      const company = companies.find(c => c.id === staffMember.companyId) || { name: 'Humres Group' };
      const staffCurrency = staffMember.currency || 'GBP';
      const currencySymbol = symbolMap[staffCurrency] || '£';

      // 1. Resolve Office Location
      const officeLocations = company.addressOverride || company.address || 'Humres HQ Office';

      // 2. Resolve Reporting Manager
      const reportingManager = staff.find(s => s.id === staffMember.reportingManagerId);
      const managerName = reportingManager ? reportingManager.fullName : 'None';
      const managerEmail = reportingManager?.businessEmail || reportingManager?.personalEmail || '';

      // 3. Resolve Assigned Assets (Hardware & Software Seats resolved via matched contracts)
      const myAssignments = assetAssignments.filter(a => a.staffId === staffMember.id);
      const assetLines = myAssignments.map(a => {
        const matchedContract = contracts.find(c => c.id === a.contractId);
        const assetName = a.name || a.assetName || matchedContract?.name || a.contractName || 'Unknown Asset/License';
        const detail = a.serialNumber ? `, S/N: ${a.serialNumber}` : '';
        const typeLabel = a.type || (matchedContract ? 'License' : 'Asset');
        return `• ${assetName} (${typeLabel})${detail}`;
      });
      const assetListText = assetLines.length > 0 ? assetLines.join('\n') : '• No company hardware or software seats currently assigned.';

      // 4. Calculate Sales Revenue this year (2026 Split)
      const currentYearPlacements = placements.filter(p => 
        p.status !== 'dns' && 
        p.startDate && 
        p.startDate.startsWith('2026') &&
        (p.splits || []).some(sp => sp.staffId === staffMember.id)
      );
      const yearRevenue = currentYearPlacements.reduce((sum, p) => {
        const sp = (p.splits || []).find(s => s.staffId === staffMember.id);
        const rate = sp ? Number(sp.percentage) / 100 : 0;
        return sum + (Number(p.grossBillAmount) || 0) * rate;
      }, 0);
      const yearRevenueNative = fromGBP(yearRevenue, staffCurrency);

      // 5. Calculate Client Outstanding Payments (Employee Split)
      const unpaidPlacements = placements.filter(p => 
        p.status !== 'dns' && 
        p.clientPaymentStatus !== 'paid' && 
        (p.splits || []).some(sp => sp.staffId === staffMember.id)
      );
      const outstandingPayments = unpaidPlacements.reduce((sum, p) => {
        const sp = (p.splits || []).find(s => s.staffId === staffMember.id);
        const rate = sp ? Number(sp.percentage) / 100 : 0;
        const outstanding = p.balanceOutstanding !== undefined ? Number(p.balanceOutstanding) : (Number(p.grossBillAmount) || 0) * 1.20;
        return sum + outstanding * rate;
      }, 0);
      const outstandingPaymentsNative = fromGBP(outstandingPayments, staffCurrency);

      // 6. Calculate Upcoming Placements to Start
      const today = new Date('2026-07-16');
      const upcomingPlacements = placements.filter(p => 
        p.status !== 'dns' && 
        p.startDate && 
        new Date(p.startDate) > today &&
        (p.splits || []).some(sp => sp.staffId === staffMember.id)
      );
      const upcomingListText = upcomingPlacements.map(p => {
        const sp = (p.splits || []).find(s => s.staffId === staffMember.id);
        const rate = sp ? Number(sp.percentage) / 100 : 0;
        const splitFee = (Number(p.grossBillAmount) || 0) * rate;
        const splitFeeNative = fromGBP(splitFee, staffCurrency);
        return `• Candidate: ${p.candidateName} @ Client: ${p.clientCompany} (Starts: ${p.startDate}, Split Fee: ${currencySymbol}${splitFeeNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / GBP £${splitFee.toLocaleString(undefined, { minimumFractionDigits: 2 })})`;
      }).join('\n') || '• No upcoming placements scheduled to start.';

      // 7. Resolve Commission Plan & Estimate for "This Month" (July 2026)
      const commPolicy = commissionPolicies.find(p => p.id === staffMember.commissionPolicyId);
      const commSchemeName = commPolicy ? commPolicy.name : 'None';
      
      // Calculate monthly commission due this month (July 2026) in policy currency
      const monthStr = '2026-07';
      const monthlyCommission = calculateCashReceivedCommission(staffMember, commPolicy, monthStr);

      // Resolve the policy currency
      const policyCompany = companies.find(c => c.id === commPolicy?.companyId);
      const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';

      // Convert monthly commission to GBP, then to staff currency
      const totalPayoutGBP = toGBP(monthlyCommission.totalPayout, policyCurrency);
      const totalPayoutNative = fromGBP(totalPayoutGBP, staffCurrency);

      const withheldGBP = toGBP(monthlyCommission.withheld, policyCurrency);
      const withheldNative = fromGBP(withheldGBP, staffCurrency);

      // 8. Resolve Role Contacts for CC list / Recipients
      const hrContact = staff.find(s => s.id === company.hrContactId);
      const hrEmail = hrContact?.businessEmail || hrContact?.personalEmail || exitSettings.hrEmail || 'hr@humres.co.uk';

      const itContact = staff.find(s => s.id === company.itContactId);
      const itEmail = itContact?.businessEmail || itContact?.personalEmail || exitSettings.itEmail || 'it@humres.co.uk';

      const opsContact = staff.find(s => s.id === company.opsContactId);
      const opsEmail = opsContact?.businessEmail || opsContact?.personalEmail || exitSettings.adminEmail || 'admin@humres.co.uk';

      const mdContact = staff.find(s => s.id === company.mdContactId);
      const mdEmail = mdContact?.businessEmail || mdContact?.personalEmail || exitSettings.directorEmail || 'director@humres.co.uk';

      // Deduplicate emails
      const recipientList = Array.from(new Set(
        [hrEmail, itEmail, opsEmail, mdEmail, managerEmail].filter(Boolean)
      )).join(', ');
      setEmailRecipient(recipientList);

      // Subject
      setEmailSubject(`[CONSOLIDATED OFFBOARDING SUMMARY] Case File & Clearances - ${staffMember.fullName}`);

      // Combined Email Body Text
      const emailBodyText = `CONSOLIDATED EMPLOYEE EXIT PORTFOLIO & SUMMARY
==================================================
This email serves as the official consolidated offboarding record for the departing employee. Please find action points and operational/financial statuses below.

EMPLOYEE GENERAL INFORMATION
--------------------------------------------------
- Full Name: ${staffMember.fullName || 'N/A'}
- Job Title: ${staffMember.jobTitle || 'N/A'}
- Entity / Company: ${company.name || 'N/A'}
- Department: ${staffMember.department || 'N/A'}
- Reporting Manager: ${managerName}
- Start Date: ${staffMember.startDate || 'N/A'}
- Last Working Date: ${staffMember.lastWorkingDate || 'N/A'}

FINANCIAL & COMPENSATION PROFILE
--------------------------------------------------
- Monthly Base Salary: ${staffMember.salary ? `${currencySymbol}${Math.round(Number(staffMember.salary) / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month (${currencySymbol}${Number(staffMember.salary).toLocaleString()} / year ${staffCurrency})` : 'Not specified'}
- Commission Scheme Mapped: ${commSchemeName}
- Cumulative Billings (Current Year - 2026 Split): ${currencySymbol}${yearRevenueNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GBP £${yearRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Commission Due for Payment This Month (July 2026): ${currencySymbol}${totalPayoutNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GBP £${totalPayoutGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Commission Withheld (Pending Client Payment): ${currencySymbol}${withheldNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GBP £${withheldGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})

RECRUITMENT SALES & CLIENT LEDGER STATUS
--------------------------------------------------
- Outstanding Payments from Clients (Employee Split): ${currencySymbol}${outstandingPaymentsNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GBP £${outstandingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Future / Upcoming Placements Scheduled to Start:
${upcomingListText}

HARDWARE & LICENSE ASSET HOLDINGS
--------------------------------------------------
${assetListText}

WORK LOCATION & LOCAL ENTITY INFO
--------------------------------------------------
- Office Location: ${officeLocations}

ACTION ITEMS REQUIRED BY DEPARTMENTS
--------------------------------------------------
1. HR DEPARTMENT: Close HR files, calculate final pay including accrued leaves, and log exit interview details.
2. IT DEPARTMENT: De-provision all app accounts, license seats, and recover the hardware assets listed above.
3. OPERATIONS / MANAGEMENT: Review upcoming placements to start and transition client management coverage.

Sincerely,
Operations Portal`;

      setEmailBody(emailBodyText);
    }
  }, [staffMember, exitSettings, companies, staff, assetAssignments, commissionPolicies, placements, contracts, isOpen]);

  if (!isOpen || !staffMember) return null;

  const handleDispatch = () => {
    // Send single consolidated notification payload
    const notification = {
      id: `email-consolidated-${Date.now()}`,
      role: 'consolidated',
      roleName: 'Consolidated Exit Summary',
      recipient: emailRecipient,
      subject: emailSubject,
      body: emailBody,
      sentAt: new Date().toISOString(),
      staffId: staffMember.id,
      staffName: staffMember.fullName
    };

    onSend(notification);
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>Confirm Consolidated Exit Portfolio</h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Verify financial, operational, and asset metrics before broad dispatch.</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="wizard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
          
          {/* Recipients List Input */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Recipient Dispatch List (Comma Separated)
            </label>
            <input 
              type="text" 
              className="form-input" 
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="e.g. hr@company.com, it@company.com, md@company.com"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px' }}>Subject Line</label>
            <input 
              type="text" 
              className="form-input" 
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <label className="form-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClipboardList size={14} /> Email Portfolio Content (Editable Preview)
            </label>
            <textarea 
              className="form-input" 
              rows="12" 
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '11px', flex: 1, minHeight: '300px' }}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="wizard-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-danger" 
            onClick={handleDispatch}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={14} /> Send Exit Portfolio
          </button>
        </div>

      </div>
    </div>
  );
}
