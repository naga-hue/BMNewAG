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
  currentUser: any;
  onShowToast: (msg: string, type?: string) => void;
}

export default function InvoiceDetailDrawer({
  selectedInvoice,
  isDetailOpen,
  setIsDetailOpen,
  setSelectedInvoice,
  todayStr,
  currentUser,
  onShowToast
}: InvoiceDetailDrawerProps) {
  const placements = useBoundStore(state => state.placements);
  const companies = useBoundStore(state => state.companies);
  const updatePlacement = useBoundStore(state => state.updatePlacement);

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

  const handlePrintInvoice = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      onShowToast("Popup blocker blocked the print window.", "warning");
      return;
    }

    const companyName = employerCompany?.name || "Humres Technical Recruitment Ltd";
    const companyAddress = employerCompany?.address || "30 Stamford Street, London, SE1 9LQ";
    const invoiceNum = editInvoiceNumber || `INV-2026-${selectedInvoice.id.slice(-4).toUpperCase()}`;

    const htmlContent = `
      <html>
        <head>
          <title>Invoice ${invoiceNum}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #1e3a8a; }
            .title { font-size: 28px; font-weight: bold; text-align: right; }
            .details-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .half { width: 48%; }
            .label { font-weight: bold; color: #666; margin-bottom: 4px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .table th { background-color: #f3f4f6; text-align: left; padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; }
            .table td { padding: 10px; border: 1px solid #e5e7eb; }
            .table-totals { margin-left: auto; width: 40%; }
            .table-totals td { padding: 8px; border: none; }
            .table-totals td.val { text-align: right; font-family: monospace; }
            .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 11px; color: #666; text-align: center; margin-top: 60px; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">${companyName}</div>
              <div style="font-size: 12px; margin-top: 4px;">${companyAddress}</div>
            </div>
            <div>
              <div class="title">INVOICE</div>
              <div style="text-align: right; font-size: 14px; margin-top: 6px;">Invoice No: <strong>${invoiceNum}</strong></div>
            </div>
          </div>

          <div class="details-row">
            <div class="half">
              <div class="label">INVOICE TO:</div>
              <div style="font-weight: bold; font-size: 15px;">${selectedInvoice.clientCompany}</div>
              <div style="color: #4b5563; font-size: 13px; margin-top: 4px;">Accounts Payable Desk</div>
            </div>
            <div class="half" style="text-align: right;">
              <div class="label">INVOICE DETAILS:</div>
              <div style="font-size: 13px;">Date Raised: ${editRaisedDate}</div>
              <div style="font-size: 13px;">Payment Terms: ${paymentTermsDays} Days</div>
              <div style="font-size: 13px;"><strong>Due Date: ${editDueDate}</strong></div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th style="width: 70%;">Description</th>
                <th style="text-align: right; width: 30%;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Placement Fee &bull; ${selectedInvoice.candidateName}</strong><br/>
                  <span style="font-size: 12px; color: #4b5563;">Role: ${selectedInvoice.jobTitle || 'Consultant'} | Start Date: ${selectedInvoice.startDate || 'Immediate'}</span>
                </td>
                <td style="text-align: right; font-family: monospace;">£${(Number(editGrossBillAmount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between;">
            <div style="width: 50%; font-size: 12px;">
              <div style="font-weight: bold; margin-bottom: 4px;">BACS Payment Instructions:</div>
              <div>Bank: HSBC UK Bank plc</div>
              <div>Account Name: ${companyName}</div>
              <div>Sort Code: 40-02-50</div>
              <div>Account No: 81927364</div>
              <div style="margin-top: 8px; color: #6b7280;">Please quote invoice reference <strong>${invoiceNum}</strong> when making payments.</div>
            </div>
            <div style="width: 40%;">
              <table class="table-totals">
                <tr>
                  <td style="font-weight: bold;">Subtotal:</td>
                  <td class="val">£${(Number(editGrossBillAmount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">VAT (20%):</td>
                  <td class="val">£${(Number(editVatAmount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-top: 1.5px solid #333;">
                  <td style="font-weight: bold; font-size: 15px;">Total Due:</td>
                  <td class="val" style="font-weight: bold; font-size: 15px; color: #1e3a8a;">£${(Number(editTotalInvoiceAmount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="footer">
            <div>Thank you for your business.</div>
            <div style="margin-top: 4px; font-size: 9px; color: #9ca3af;">Registered office: ${companyAddress} | Company Registration No: 08927163 &bull; VAT Reg: GB 892 1029 38</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
          <button type="button" className="btn-secondary" onClick={handlePrintInvoice} style={{ marginRight: 'auto', backgroundColor: 'var(--accent)', color: '#fff' }}>
            🖨️ Print Clean Invoice
          </button>
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
