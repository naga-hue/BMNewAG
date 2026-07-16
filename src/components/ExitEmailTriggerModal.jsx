import React, { useState, useEffect } from 'react';
import { X, Send, Mail, ShieldAlert, Users, Laptop, FileText, ClipboardList } from 'lucide-react';

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
  onSend 
}) {
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    if (staffMember && isOpen) {
      const company = companies.find(c => c.id === staffMember.companyId) || { name: 'Humres Group' };
      
      // 1. Resolve Office Location
      const officeLocations = company.addressOverride || company.address || 'Humres HQ Office';

      // 2. Resolve Reporting Manager
      const reportingManager = staff.find(s => s.id === staffMember.reportingManagerId);
      const managerName = reportingManager ? reportingManager.fullName : 'None';
      const managerEmail = reportingManager?.businessEmail || reportingManager?.personalEmail || '';

      // 3. Resolve Assigned Assets (Hardware & Software Seats)
      const myAssignments = assetAssignments.filter(a => a.staffId === staffMember.id);
      const assetLines = myAssignments.map(a => {
        const detail = a.serialNumber ? `, S/N: ${a.serialNumber}` : '';
        const typeLabel = a.type ? ` (${a.type})` : ' (Asset)';
        return `• ${a.name || a.assetName || a.contractName || 'Unlabeled Asset'}${typeLabel}${detail}`;
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
        return `• Candidate: ${p.candidateName} @ Client: ${p.clientCompany} (Starts: ${p.startDate}, Split Fee: £${splitFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
      }).join('\n') || '• No upcoming placements scheduled to start.';

      // 7. Resolve Commission Plan & Estimate
      const commPolicy = commissionPolicies.find(p => p.id === staffMember.commissionPolicyId);
      const commSchemeName = commPolicy ? commPolicy.name : 'None';
      let commissionEstimate = 0;
      if (commPolicy) {
        const threshold = Number(commPolicy.threshold) || 0;
        const commissionable = Math.max(0, yearRevenue - threshold);
        if (commissionable > 0) {
          const slabs = commPolicy.slabs || [];
          let remaining = commissionable;
          slabs.forEach(slab => {
            const min = Number(slab.minAmount) || 0;
            const max = Number(slab.maxAmount) || Infinity;
            const rate = Number(slab.rate) || 0;
            const slabRange = max - min;
            if (remaining > 0) {
              const applicableAmount = Math.min(remaining, slabRange);
              commissionEstimate += (applicableAmount * rate) / 100;
              remaining -= applicableAmount;
            }
          });
        }
      }

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
- Monthly Base Salary: ${staffMember.salary ? `£${Number(staffMember.salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not specified'}
- Commission Scheme Mapped: ${commSchemeName}
- Cumulative Billings (Current Year - 2026 Split): £${yearRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Projected Commission Due (Current Year Slabs): £${commissionEstimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

RECRUITMENT SALES & CLIENT LEDGER STATUS
--------------------------------------------------
- Outstanding Payments from Clients (Employee Split): £${outstandingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  }, [staffMember, exitSettings, companies, staff, assetAssignments, commissionPolicies, placements, isOpen]);

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
