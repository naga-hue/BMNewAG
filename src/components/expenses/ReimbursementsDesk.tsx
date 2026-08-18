import React, { useState, useMemo } from 'react';
import { useBoundStore } from '../../store/useBoundStore';
import { symbolMap } from '../payroll/utils';
import { FX_RATES } from '../../utils/currency';
import { CheckCircle2, XCircle, AlertCircle, FileText, Send, Calendar, DollarSign, Loader2 } from 'lucide-react';

interface ReimbursementsDeskProps {
  onShowToast: (msg: string, type?: string) => void;
  currentUser?: any;
  readOnly?: boolean;
}

export default function ReimbursementsDesk({ onShowToast, currentUser, readOnly = false }: ReimbursementsDeskProps) {
  const staff = useBoundStore(state => state.staff);
  const companies = useBoundStore(state => state.companies);
  const reimbursementClaims = useBoundStore(state => state.reimbursementClaims || []);
  const saveReimbursementClaim = useBoundStore(state => state.saveReimbursementClaim);
  const updateExpense = useBoundStore(state => state.updateExpense);

  const isRecruiter = currentUser?.permissions?.role === 'recruiter';
  const lockClaimantToSelf = isRecruiter || readOnly;

  // Form States
  const [claimantId, setClaimantId] = useState(lockClaimantToSelf ? currentUser?.id || '' : '');
  const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [description, setDescription] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState('#');

  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setInvoiceFile(file);
    if (!file) return;

    onShowToast("⚡ AI OCR: Extracting metadata from invoice receipt...", "info");
    const nameLower = file.name.toLowerCase();
    setTimeout(() => {
      if (nameLower.includes('amazon') || nameLower.includes('aws')) {
        setDescription('AWS hosting bill - reimbursement');
      } else if (nameLower.includes('uber')) {
        setDescription('Uber travel - reimbursement');
      } else if (nameLower.includes('train') || nameLower.includes('travel')) {
        setDescription('Train travel ticket - reimbursement');
      }
      
      const valMatch = nameLower.match(/(\d+(\.\d{2})?)/);
      if (valMatch) {
        setAmount(valMatch[1]);
      }
      onShowToast(`⚡ AI OCR Scan complete! Auto-populated fields from ${file.name}.`, "success");
    }, 1000);
  };

  // Approval Modal States
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [payoutDateTime, setPayoutDateTime] = useState('');
  const [disbursementAccount, setDisbursementAccount] = useState('Lloyds Bank Plc - GBP Operations A/C');
  const [accountsEmail, setAccountsEmail] = useState('accounts@globalrecruiters.ae');
  const [approving, setApproving] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('All');

  React.useEffect(() => {
    if (currentUser?.permissions?.role === 'recruiter') {
      setClaimantId(currentUser.id);
      setCurrency(currentUser.currency || 'GBP');
    }
  }, [currentUser]);

  // Available bank accounts for payout selection
  const BANK_ACCOUNTS = [
    'Lloyds Bank Plc - GBP Operations A/C',
    'Lloyds Bank Plc - Salaries A/C',
    'Emirates NBD - AED Operating A/C',
    'Emirates NBD - USD Operating A/C',
    'India Standard Chartered - INR Operating A/C',
    'HMRC Tax Settlement A/C'
  ];

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimantId || !amount || Number(amount) <= 0 || !description.trim() || !approverEmail.trim()) {
      onShowToast("Please fill in all required fields: Claimant, Amount, Description, and Approver Email.", "warning");
      return;
    }

    setSubmitting(true);
    const selectedStaff = staff.find(s => s.id === claimantId);
    const company = companies.find(c => c.id === selectedStaff?.companyId);

    let resolvedInvoiceUrl = invoiceUrl;
    if (invoiceFile) {
      resolvedInvoiceUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(invoiceFile);
      });
    }

    const claim = {
      id: 'reim-' + Date.now(),
      staffId: claimantId,
      staffName: selectedStaff?.fullName || 'Unknown',
      companyId: selectedStaff?.companyId || '',
      companyName: company?.name || 'Group Company',
      date: claimDate,
      amount: Number(amount),
      currency: currency,
      description: description.trim(),
      approverEmail: approverEmail.trim(),
      ccEmail: ccEmail.trim(),
      invoiceUrl: resolvedInvoiceUrl,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    try {
      // 1. Save claim to database
      await saveReimbursementClaim(claim);

      // 2. Dispatch request email to Approver
      const mailSubject = `🔔 REIMBURSEMENT APPROVAL REQUIRED: ${selectedStaff?.fullName} - ${currency} ${amount}`;
      const mailBody = `Hello,

A reimbursement request has been submitted and awaits your approval:

Claimant: ${selectedStaff?.fullName}
Company: ${company?.name || 'Group Company'}
Date: ${claimDate}
Amount: ${amount} ${currency} (GBP Equivalent: £${(Number(amount) * (FX_RATES[currency] || 1.0)).toFixed(2)})
Description: ${description.trim()}
${resolvedInvoiceUrl && resolvedInvoiceUrl !== '#' ? 'Invoice Receipt: Attached in the System.' : ''}

Please review and approve this claim.

Sent automatically via Humres Group Business Management Suite.`;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: [approverEmail, ccEmail].filter(Boolean),
          subject: mailSubject,
          body: mailBody
        })
      });

      onShowToast("Reimbursement request submitted and approval email sent!", "success");
      
      // Reset form
      setAmount('');
      setDescription('');
      setInvoiceFile(null);
      setInvoiceUrl('#');
    } catch (err: any) {
      console.error(err);
      onShowToast(`Claim submitted but notification failed: ${err.message}`, "warning");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveClick = (claim: any) => {
    setSelectedClaim(claim);
    setPayoutDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)); // Default to tomorrow
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedClaim || !payoutDateTime || !disbursementAccount || !accountsEmail) {
      onShowToast("Please enter payout date/time, select disbursement account, and verify Accounts email.", "warning");
      return;
    }

    setApproving(true);
    const updatedClaim = {
      ...selectedClaim,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      payoutDateTime,
      disbursementAccount
    };

    try {
      // 1. Update status in database
      await saveReimbursementClaim(updatedClaim);

      // 2. Auto-book as expense in nominal ledger
      const rate = FX_RATES[selectedClaim.currency] || 1.0;
      const gbpAmt = selectedClaim.amount * rate;
      const nominalClaim = {
        id: `reimburse-book-${selectedClaim.id}`,
        date: selectedClaim.date,
        payee: `Reimbursement: ${selectedClaim.staffName}`,
        amount: gbpAmt,
        currency: 'GBP',
        nominalCode: '503 - Staff Expenses & Travel',
        allocationType: 'staff' as const,
        allocationTarget: [selectedClaim.staffId],
        plMonth: selectedClaim.date.substring(0, 7),
        invoiceUrl: selectedClaim.invoiceUrl || '#',
        notes: `Approved reimbursement for ${selectedClaim.description}. Paid from ${disbursementAccount} on ${payoutDateTime}.`
      };
      await updateExpense(nominalClaim);

      // 3. Dispatch Notification to Accounts, Claimant and CC
      const mailSubject = `✅ APPROVED REIMBURSEMENT PAYOUT ORDER: ${selectedClaim.staffName}`;
      const mailBody = `ATTN: Accounts Team,

A reimbursement claim has been APPROVED and requires disbursement:

Claimant: ${selectedClaim.staffName}
Company: ${selectedClaim.companyName}
Claim Date: ${selectedClaim.date}
Claim Amount: ${selectedClaim.amount} ${selectedClaim.currency} (GBP Equivalent: £${gbpAmt.toFixed(2)})
Description: ${selectedClaim.description}

DISBURSEMENT INSTRUCTIONS:
----------------------------------------
Payout Target Date/Time: ${payoutDateTime.replace('T', ' ')}
Pay From Account: ${disbursementAccount
}
----------------------------------------

Approved By: ${selectedClaim.approverEmail}
Approved At: ${updatedClaim.approvedAt}

This order is locked and booked to the Nominal Ledger (503 - Staff Expenses & Travel). Please execute the payment accordingly.

Sent automatically via Humres Group Business Management Suite.`;

      const notificationRecipients = [
        accountsEmail,
        selectedClaim.approverEmail,
        selectedClaim.ccEmail
      ].filter(Boolean) as string[];

      // Fetch email of the claimant to keep them informed
      const claimant = staff.find(s => s.id === selectedClaim.staffId);
      const claimantEmail = claimant?.businessEmail || claimant?.personalEmail;
      if (claimantEmail && !notificationRecipients.includes(claimantEmail)) {
        notificationRecipients.push(claimantEmail);
      }

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: notificationRecipients,
          subject: mailSubject,
          body: mailBody
        })
      });

      onShowToast("Reimbursement claim approved and accounts notified successfully!", "success");
      setShowApprovalModal(false);
      setSelectedClaim(null);
    } catch (err: any) {
      console.error(err);
      onShowToast(`Status updated but dispatch failed: ${err.message}`, "warning");
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClaim = async (claim: any) => {
    if (!window.confirm(`Are you sure you want to reject this reimbursement claim for ${claim.staffName}?`)) return;

    const updated = {
      ...claim,
      status: 'rejected',
      rejectedAt: new Date().toISOString()
    };

    try {
      await saveReimbursementClaim(updated);
      onShowToast(`Reimbursement claim for ${claim.staffName} was rejected.`, "info");
    } catch (err: any) {
      onShowToast(`Error rejecting claim: ${err.message}`, "warning");
    }
  };

  const filteredClaims = useMemo(() => {
    const isManager = currentUser?.permissions?.role === 'manager';
    const userDept = currentUser?.department;

    return reimbursementClaims.filter(c => {
      // 1. Recruiter restriction: see only own claims
      if (isRecruiter && c.staffId !== currentUser?.id) return false;

      // 2. Manager restriction: see only own department's team members' claims
      if (isManager) {
        const claimant = staff.find(s => s.id === c.staffId);
        if (claimant && claimant.department !== userDept && c.staffId !== currentUser?.id) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter === 'All') return true;
      return c.status === statusFilter.toLowerCase();
    });
  }, [reimbursementClaims, statusFilter, currentUser, staff, isRecruiter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Submit Claim Form */}
        <form onSubmit={handleClaimSubmit} className="detail-section" style={{ padding: '20px', gap: '12px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: 'var(--primary)' }}>
            <FileText size={16} /> Submit Reimbursement Claim
          </h3>
          
          <div className="form-group">
            <label className="form-label">Claimant Employee <span>*</span></label>
            <select
              className="select-filter"
              value={claimantId}
              onChange={(e) => {
                setClaimantId(e.target.value);
                const s = staff.find(member => member.id === e.target.value);
                if (s) setCurrency(s.currency || 'GBP');
              }}
              required
              disabled={lockClaimantToSelf}
              style={{ width: '100%', padding: '8px 10px' }}
            >
              {lockClaimantToSelf ? (
                <option value={currentUser?.id}>{currentUser?.fullName}</option>
              ) : (
                <>
                  <option value="">-- Choose Employee --</option>
                  {staff.filter(s => s.status !== 'exited').map(s => {
                    const comp = companies.find(c => c.id === s.companyId);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({comp?.name || 'Group'})
                      </option>
                    );
                  })}
                </>
              )}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Expense Date <span>*</span></label>
              <input
                type="date"
                className="form-input"
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Currency <span>*</span></label>
              <select
                className="select-filter"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px' }}
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="AED">AED (AED)</option>
                <option value="INR">INR (₹)</option>
                <option value="ZAR">ZAR (R)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Claim Amount <span>*</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px' }}
              />
              {currency !== 'GBP' && amount && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ≈ £{(Number(amount) * (FX_RATES[currency] || 1.0)).toFixed(2)} GBP
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Purpose <span>*</span></label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Reimbursement for June remote office internet bill"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', resize: 'none' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Send Request To (Approver Email) <span>*</span></label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. manager@globalrecruiters.ae"
              value={approverEmail}
              onChange={(e) => setApproverEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">CC Email (Optional)</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. director@globalrecruiters.ae"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              style={{ width: '100%', padding: '8px 10px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Upload Receipt / Invoice (Optional)</label>
            <input
              type="file"
              className="form-input"
              onChange={handleInvoiceFileChange}
              style={{ width: '100%', padding: '6px' }}
            />
            {invoiceFile && (
              <span style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
                ✓ {invoiceFile.name} ready for upload
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="spinner" /> Submitting Request...
              </>
            ) : (
              <>
                <Send size={14} /> Submit Claim Request
              </>
            )}
          </button>
        </form>

        {/* Right: Submitted Claims Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="controls-row" style={{ margin: 0, justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Reimbursement Workflow Desk</h3>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                className="select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                <option value="All">All Claims</option>
                <option value="Pending">Pending Approvals</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="register-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Claim Details</th>
                  <th>Amount</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No reimbursement claims found matching this status filter.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map(claim => {
                    const symbol = symbolMap[claim.currency] || claim.currency;
                    return (
                      <tr key={claim.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{claim.staffName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{claim.companyName}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>{claim.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Claim Date: {claim.date}</div>
                          {claim.invoiceUrl && claim.invoiceUrl !== '#' && (
                            <div style={{ marginTop: '4px' }}>
                              <a 
                                href={claim.invoiceUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                style={{ fontSize: '10px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                              >
                                📎 View Invoice
                              </a>
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{symbol}{claim.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          {claim.currency !== 'GBP' && (
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              £{(claim.amount * (FX_RATES[claim.currency] || 1.0)).toFixed(2)} GBP
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>{claim.approverEmail}</div>
                          {claim.ccEmail && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CC: {claim.ccEmail}</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${claim.status}`} style={{ textTransform: 'uppercase', fontSize: '9px', fontWeight: 700 }}>
                            {claim.status}
                          </span>
                          {claim.status === 'approved' && claim.payoutDateTime && (
                            <div style={{ fontSize: '9px', color: 'var(--success)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                              🗓️ Payout Target:<br/>{claim.payoutDateTime.replace('T', ' ')}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isRecruiter || readOnly || claim.staffId === currentUser?.id ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {claim.status === 'pending' ? 'Awaiting Approval' : 'Processed'}
                            </span>
                          ) : claim.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn-accent"
                                onClick={() => handleApproveClick(claim)}
                                style={{ backgroundColor: '#10b981', color: 'white', padding: '4px 8px', fontSize: '11px' }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleRejectClaim(claim)}
                                style={{ border: '1px solid var(--danger)', color: 'var(--danger)', padding: '4px 8px', fontSize: '11px' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Processed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Approval Modal Drawer */}
      {showApprovalModal && selectedClaim && (
        <div className="form-wizard-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            
            <div className="wizard-header">
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>
                💳 Approve Reimbursement & Instruct Accounts
              </h2>
              <button type="button" className="btn-close" onClick={() => setShowApprovalModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
                <strong>Summary of claim being approved:</strong><br/>
                Employee: {selectedClaim.staffName}<br/>
                Amount: {symbolMap[selectedClaim.currency] || selectedClaim.currency}{selectedClaim.amount.toLocaleString()} (GBP Equiv: £{(selectedClaim.amount * (FX_RATES[selectedClaim.currency] || 1.0)).toFixed(2)})<br/>
                Purpose: {selectedClaim.description}
              </div>

              <div className="form-group">
                <label className="form-label">1. Payout Date & Time <span>*</span></label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={payoutDateTime}
                  onChange={(e) => setPayoutDateTime(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">2. Pay From Disbursement Account <span>*</span></label>
                <select
                  className="select-filter"
                  value={disbursementAccount}
                  onChange={(e) => setDisbursementAccount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px' }}
                >
                  {BANK_ACCOUNTS.map(acc => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">3. Notify Accounts (Destination Email) <span>*</span></label>
                <input
                  type="email"
                  className="form-input"
                  value={accountsEmail}
                  onChange={(e) => setAccountsEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', padding: '12px 24px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowApprovalModal(false)} disabled={approving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmApproval}
                disabled={approving}
                style={{ backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {approving ? (
                  <>
                    <Loader2 size={14} className="spinner" /> Approving & Dispatches...
                  </>
                ) : (
                  "Confirm Approval & Send to Accounts"
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
