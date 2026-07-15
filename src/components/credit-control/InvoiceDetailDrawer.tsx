import React, { useState, useEffect } from 'react';
import { FileText, X, Upload, Send, History } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { firebaseService } from '../../services/firebase';
import { PAYMENT_STATUSES, getCurrencySymbol } from './shared';

interface InvoiceDetailDrawerProps {
  selectedInvoice: any;
  isDetailOpen: boolean;
  setIsDetailOpen: (val: boolean) => void;
  setSelectedInvoice: (invoice: any) => void;
  todayStr: string;
  onShowToast: (msg: string, type?: string) => void;
}

export default function InvoiceDetailDrawer({
  selectedInvoice,
  isDetailOpen,
  setIsDetailOpen,
  setSelectedInvoice,
  todayStr,
  onShowToast
}: InvoiceDetailDrawerProps) {
  const placements = useBoundStore(state => state.placements);
  const companies = useBoundStore(state => state.companies);
  const updatePlacement = useBoundStore(state => state.updatePlacement);
  const currentUser = useBoundStore(state => state.currentUser || {});

  // Edit fields inside Details Modal
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editSimplicityClientNo, setEditSimplicityClientNo] = useState('');
  const [editSimplicityCreditLimit, setEditSimplicityCreditLimit] = useState('');
  const [editGrossAmount, setEditGrossAmount] = useState<number | string>('');
  const [editVatAmount, setEditVatAmount] = useState<number | string>('');
  const [editRaisedDate, setEditRaisedDate] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('30');
  const [editPaymentTermsCustom, setEditPaymentTermsCustom] = useState<number | string>('');
  const [editStatus, setEditStatus] = useState('not-invoiced');
  const [editAmountPaid, setEditAmountPaid] = useState<number | string>('');
  const [editReceivedDate, setEditReceivedDate] = useState('');
  const [editNextChaseDate, setEditNextChaseDate] = useState('');
  const [editDisputeReason, setEditDisputeReason] = useState('');
  const [editDisputeDate, setEditDisputeDate] = useState('');
  const [editDisputeOwner, setEditDisputeOwner] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Synchronize internal state with selected invoice
  useEffect(() => {
    if (selectedInvoice) {
      setEditInvoiceNumber(selectedInvoice.invoiceNumber || '');
      setEditSimplicityClientNo(selectedInvoice.simplicityClientNo || '');
      setEditSimplicityCreditLimit(selectedInvoice.simplicityCreditLimit || '');
      setEditGrossAmount(selectedInvoice.grossBillAmount !== undefined && selectedInvoice.grossBillAmount !== null ? selectedInvoice.grossBillAmount : '');
      setEditVatAmount(selectedInvoice.vatAmount !== undefined && selectedInvoice.vatAmount !== null ? selectedInvoice.vatAmount : '');
      setEditRaisedDate(selectedInvoice.invoiceRaisedDate || '');
      setEditStatus(selectedInvoice.paymentStatus || 'not-invoiced');
      setEditAmountPaid(selectedInvoice.amountPaid !== undefined && selectedInvoice.amountPaid !== null ? selectedInvoice.amountPaid : '');
      setEditReceivedDate(selectedInvoice.paymentReceivedDate || '');
      setEditNextChaseDate(selectedInvoice.nextChaseDate || '');
      setEditDisputeReason(selectedInvoice.disputeReason || '');
      setEditDisputeDate(selectedInvoice.disputeDate || '');
      setEditDisputeOwner(selectedInvoice.disputeOwner || '');
      setUploadedFileUrl(selectedInvoice.invoiceFileUrl || '');
      setUploadedFileName(selectedInvoice.invoiceFileName || '');
      setNewNote('');

      const terms = selectedInvoice.paymentTermsDays || '30';
      if (['7', '10', '30', '31'].includes(String(terms))) {
        setEditPaymentTerms(String(terms));
        setEditPaymentTermsCustom('');
      } else {
        setEditPaymentTerms('custom');
        setEditPaymentTermsCustom(terms);
      }
    }
  }, [selectedInvoice]);

  if (!isDetailOpen || !selectedInvoice) return null;

  const symbol = getCurrencySymbol(selectedInvoice, companies);

  const handleUploadInvoiceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInvoice) return;
    setIsUploading(true);
    try {
      const url = await firebaseService.uploadLetterheadBg(selectedInvoice.id, file); // Uses generic background file uploader
      setUploadedFileUrl(url);
      setUploadedFileName(file.name);
      onShowToast("Invoice document attached successfully!", "success");
    } catch (err: any) {
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

    const calculateDueDate = (rDate: string, days: number | string) => {
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

    const originalPlacement = placements.find(p => p.id === selectedInvoice.id);
    if (!originalPlacement) {
      onShowToast("Associated placement not found in store", "danger");
      return;
    }

    const updatedPlacement = {
      ...originalPlacement,
      invoiceNumber: editInvoiceNumber.trim() || null,
      simplicityClientNo: editSimplicityClientNo.trim() || null,
      simplicityCreditLimit: editSimplicityCreditLimit.trim() || null,
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
      await updatePlacement(updatedPlacement);
      onShowToast(`Invoice settings updated for "${selectedInvoice.candidateName}"`, "success");
      setIsDetailOpen(false);
      setSelectedInvoice(null);
    } catch (e: any) {
      onShowToast("Save failed: " + e.message, "danger");
    }
  };

  const handleAddChaseNote = async (shortcutText?: string) => {
    const noteText = shortcutText || newNote.trim();
    if (!noteText || !selectedInvoice) return;

    const newNoteObj = {
      date: new Date().toISOString(),
      user: currentUser.fullName || 'Admin User',
      content: noteText
    };

    const updatedHistory = [newNoteObj, ...(selectedInvoice.chaseHistory || [])];
    const originalPlacement = placements.find(p => p.id === selectedInvoice.id);
    if (!originalPlacement) return;

    const updatedPlacement = {
      ...originalPlacement,
      chaseHistory: updatedHistory,
      lastChasedDate: new Date().toISOString().split('T')[0]
    };

    try {
      await updatePlacement(updatedPlacement);
      setSelectedInvoice({
        ...selectedInvoice,
        chaseHistory: updatedHistory,
        lastChasedDate: new Date().toISOString().split('T')[0]
      });
      setNewNote('');
      onShowToast("Chase note logged successfully!", "success");
    } catch (e: any) {
      onShowToast("Error logging note: " + e.message, "danger");
    }
  };

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
            <div>🧑‍💼 <strong>Consultant:</strong> {selectedInvoice.recruiterNames} ({selectedInvoice.departmentName || 'Recruitment'})</div>
            <div>📂 <strong>Billing Route:</strong> {selectedInvoice.invoiceType === 'direct' ? 'Direct Invoice' : 'Simplicity Invoice'}</div>
            <div>🔑 <strong>Placement ID:</strong> {selectedInvoice.placementId || selectedInvoice.id}</div>
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
                <div>💰 <strong>Humres Friday Payout:</strong> {selectedInvoice.simplicityPayoutDate || '—'}</div>
                <div>📅 <strong>Client Due Date:</strong> {selectedInvoice.invoiceDueDate || '—'} (30 Days)</div>
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

            {selectedInvoice.invoiceType === 'simplicity' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Simplicity Client Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editSimplicityClientNo} 
                    onChange={(e) => setEditSimplicityClientNo(e.target.value)} 
                    placeholder="e.g. 4035560"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Available Credit Limit</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editSimplicityCreditLimit} 
                    onChange={(e) => setEditSimplicityCreditLimit(e.target.value)} 
                    placeholder="e.g. £35,600.00"
                  />
                </div>
              </div>
            )}

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
              {(selectedInvoice.chaseHistory || []).map((note: any, idx: number) => (
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
}
