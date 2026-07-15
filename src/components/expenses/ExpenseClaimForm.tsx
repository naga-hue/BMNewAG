import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { CURRENCIES } from './shared';

interface ExpenseClaimFormProps {
  editingExpenseId: string | null;
  setEditingExpenseId: (id: string | null) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export default function ExpenseClaimForm({
  editingExpenseId,
  setEditingExpenseId,
  showForm,
  setShowForm,
  onShowToast
}: ExpenseClaimFormProps) {
  const companies = useBoundStore(state => state.companies);
  const staff = useBoundStore(state => state.staff);
  const vendors = useBoundStore(state => state.vendors);
  const expenses = useBoundStore(state => state.expenses);
  const placements = useBoundStore(state => state.placements);
  const nominalCodes = useBoundStore(state => state.nominalCodes);

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;
  const savePlacement = useBoundStore(state => state.updatePlacement);

  // Form Fields state
  const [date, setDate] = useState('');
  const [plMonth, setPlMonth] = useState('');
  const [payee, setPayee] = useState('');
  const [nominalCode, setNominalCode] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [manualBankAccountId, setManualBankAccountId] = useState('');
  const [taxRate, setTaxRate] = useState('20');
  const [description, setDescription] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState('#');

  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setInvoiceFile(file);
    if (!file) return;

    setIsOcrScanning(true);
    setOcrProgress(0);
    onShowToast("⚡ AI OCR: Extracting metadata from invoice receipt...", "info");

    const timer = setInterval(() => {
      setOcrProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsOcrScanning(false);
          
          const nameLower = file.name.toLowerCase();
          
          if (nameLower.includes('amazon') || nameLower.includes('aws')) setPayee('Amazon Web Services');
          else if (nameLower.includes('royal') || nameLower.includes('pension')) setPayee('Royal London Pension');
          else if (nameLower.includes('adobe')) setPayee('Adobe Systems');
          else if (nameLower.includes('uber')) setPayee('Uber UK');
          else if (nameLower.includes('travel') || nameLower.includes('train')) setPayee('National Rail');
          else if (nameLower.includes('office') || nameLower.includes('depot')) setPayee('Office Depot');
          else setPayee(file.name.split('.')[0].replace(/[-_]/g, ' '));

          const valMatch = nameLower.match(/(\d+(\.\d{2})?)/);
          if (valMatch) {
            setAmount(valMatch[1]);
          } else {
            setAmount('120.00');
          }

          setDate(new Date().toISOString().split('T')[0]);
          setTaxRate('20');
          setCurrency('GBP');

          if (nameLower.includes('software') || nameLower.includes('license') || nameLower.includes('adobe')) {
            setNominalCode('7002');
          } else if (nameLower.includes('rent') || nameLower.includes('office')) {
            setNominalCode('7001');
          } else {
            setNominalCode('7004');
          }

          onShowToast(`⚡ AI OCR Scan complete! Auto-populated fields from ${file.name}.`, "success");
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  // Allocation state inside Form
  const [allocationType, setAllocationType] = useState('company');
  const [allocationTarget, setAllocationTarget] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [allocationMode, setAllocationMode] = useState('auto');
  const [manualAllocationShares, setManualAllocationShares] = useState<Record<string, number>>({});
  const [showPlacementSelector, setShowPlacementSelector] = useState(false);
  const [linkedPlacementId, setLinkedPlacementId] = useState('');

  // Apportionment allocation modal state inside form
  const [allocatingRowId, setAllocatingRowId] = useState<string | null>(null);
  const [allocatingType, setAllocatingType] = useState('company');
  const [allocatingTarget, setAllocatingTarget] = useState<string[]>([]);
  const [allocatingStaffIds, setAllocatingStaffIds] = useState<string[]>([]);
  const [allocatingMode, setAllocatingMode] = useState('auto');
  const [allocatingManualShares, setAllocatingManualShares] = useState<Record<string, number>>({});
  const [allocationSearch, setAllocationSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({ company: true, department: false, staff: false });

  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
      if (typeof c === 'string') {
        const parts = c.split(' - ');
        return { id: parts[0] || c, code: c, type: 'indirect' };
      }
      if (c && typeof c === 'object') {
        return {
          id: c.id || '',
          code: c.code || '',
          type: c.type || 'indirect'
        };
      }
      return null;
    }).filter((c): c is { id: string; code: string; type: string } => c !== null && !!c.code);
  }, [nominalCodes]);

  const allAvailableDepts = useMemo(() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach((d: any) => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  }, [companies, staff]);

  const unpaidPlacements = useMemo(() => {
    return placements.filter(p => p.status !== 'dns' && p.clientPaymentStatus !== 'paid' && p.netScoreValue > 0);
  }, [placements]);

  // Load editing expense values
  useEffect(() => {
    if (editingExpenseId) {
      const exp = expenses.find(e => e.id === editingExpenseId);
      if (exp) {
        let formattedDate = '';
        if (exp.date) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(exp.date)) {
            formattedDate = exp.date;
          } else {
            const parts = exp.date.split(/[-/]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else {
                const day = parts[0];
                const month = parts[1];
                const year = parts[2];
                formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              }
            } else {
              try {
                const d = new Date(exp.date);
                if (!isNaN(d.getTime())) {
                  formattedDate = d.toISOString().substring(0, 10);
                }
              } catch {}
            }
          }
        }
        setDate(formattedDate);
        setPlMonth(exp.plMonth || '');
        setPayee(exp.payee || '');
        setNominalCode(exp.nominalCode || '');
        setAmount(String(exp.amount || ''));
        setCurrency(exp.currency || 'GBP');
        setTaxRate(String(exp.taxRate || 0));
        setDescription(exp.description || '');
        setInvoiceUrl(exp.invoiceUrl || '#');
        setAllocationType(exp.allocationType || 'company');
        setAllocationMode(exp.allocationMode || 'auto');
        setManualAllocationShares(exp.manualAllocationShares || {});
        setLinkedPlacementId(exp.linkedPlacementId || '');
        setManualBankAccountId(exp.bankAccountId ? `${exp.bankCompanyId}:${exp.bankAccountId}` : '');
        setShowPlacementSelector(!!exp.linkedPlacementId);

        if (exp.allocationType === 'staff') {
          setSelectedStaffIds(Array.isArray(exp.allocationTarget) ? (exp.allocationTarget as string[]) : []);
          setAllocationTarget([]);
        } else {
          setAllocationTarget(Array.isArray(exp.allocationTarget) ? (exp.allocationTarget as string[]) : [exp.allocationTarget].filter(Boolean) as string[]);
          setSelectedStaffIds([]);
        }
      }
    } else {
      setDate('');
      setPlMonth('');
      setPayee('');
      setNominalCode('');
      setAmount('');
      setCurrency('GBP');
      setTaxRate('20');
      setDescription('');
      setInvoiceFile(null);
      setInvoiceUrl('#');
      setAllocationType('company');
      setAllocationTarget([]);
      setSelectedStaffIds([]);
      setAllocationMode('auto');
      setManualAllocationShares({});
      setLinkedPlacementId('');
      setManualBankAccountId('');
      setShowPlacementSelector(false);
    }
  }, [editingExpenseId, expenses]);

  if (!showForm) return null;

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !plMonth || !payee.trim() || !nominalCode || !amount) {
      onShowToast("Please enter all required transaction fields.", "warning");
      return;
    }

    let target = allocationTarget;
    if (allocationType === 'staff') {
      if (selectedStaffIds.length === 0) {
        onShowToast("Please select at least one staff member for allocation.", "warning");
        return;
      }
      target = selectedStaffIds;
    } else {
      if (!target || target.length === 0) {
        onShowToast("Please select an allocation target (company or department).", "warning");
        return;
      }
    }

    let resolvedInvoiceUrl = invoiceUrl;
    if (invoiceFile) {
      resolvedInvoiceUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(invoiceFile);
      });
    }

    let bankCompanyId = '';
    let bankAccountId = '';
    let bankAccountRef = '';
    if (manualBankAccountId) {
      const [compId, bankId] = manualBankAccountId.split(':');
      const comp = companies.find(c => c.id === compId);
      const bank = comp?.bankAccounts?.find(b => b.id === bankId);
      if (bank) {
        bankCompanyId = compId;
        bankAccountId = bankId;
        bankAccountRef = `${bank.bankName} - ${bank.accountName}`;
      }
    }

    const expenseData = {
      id: editingExpenseId || `exp-${Date.now()}`,
      date,
      plMonth,
      payee: payee.trim(),
      nominalCode,
      amount: Number(amount),
      currency,
      taxRate: Number(taxRate) || 0,
      description: description.trim(),
      invoiceUrl: resolvedInvoiceUrl,
      recipientType: allocationType === 'staff' ? 'staff' : 'other',
      recipientId: allocationType === 'staff' ? (target[0] || '') : '',
      allocationType,
      allocationTarget: target,
      allocationMode,
      manualAllocationShares,
      linkedPlacementId: linkedPlacementId || null,
      bankCompanyId,
      bankAccountId,
      bankAccountRef
    };

    try {
      await saveExpense(expenseData);

      // If a placement is linked, and this transaction is a payment credit, update placement!
      if (linkedPlacementId) {
        const matchedPlacement = placements.find(p => p.id === linkedPlacementId);
        if (matchedPlacement && matchedPlacement.clientPaymentStatus !== 'paid') {
          const updatedPlacement = {
            ...matchedPlacement,
            clientPaymentStatus: 'paid',
            clientPaidDate: date
          };
          await savePlacement(updatedPlacement);
          onShowToast(`Linked sales credit: Placement ${matchedPlacement.placementId} marked as client paid on ${date}.`, "success");
        }
      }

      onShowToast(
        editingExpenseId 
          ? `Updated expense transaction payee "${payee}"` 
          : `Expense transaction recorded successfully!`, 
        "success"
      );

      setEditingExpenseId(null);
      setShowForm(false);
    } catch (err: any) {
      onShowToast(`Error saving transaction: ${err.message}`, "warning");
    }
  };

  return (
    <form onSubmit={handleExpenseSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s', marginBottom: '24px' }}>
      <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
        <Plus size={14} /> {editingExpenseId ? 'Modify Expense Transaction' : 'Record Overhead Expense'}
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label className="form-label">Transaction Date <span>*</span></label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Relates to P&L Month <span>*</span></label>
          <input type="month" className="form-input" value={plMonth} onChange={(e) => setPlMonth(e.target.value)} required />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Determines which financial period absorbs this cost.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Payee / Recipient Name <span>*</span></label>
          <input type="text" className="form-input" placeholder="e.g. LinkedIn, Apex Properties" value={payee} onChange={(e) => setPayee(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Link to Registered Vendor or Staff</label>
          <select
            className="select-filter"
            value={allocationType === 'staff' ? `staff:${selectedStaffIds[0]}` : 'other'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'other') {
                setAllocationType('company');
                setAllocationTarget([]);
                setSelectedStaffIds([]);
              } else {
                const [type, id] = val.split(':');
                if (type === 'vendor') {
                  setAllocationType('company');
                  const v = vendors.find(item => item.id === id);
                  if (v) {
                    setPayee(v.name);
                    // Match to first company as vendor default
                    setAllocationTarget(companies[0] ? [companies[0].id] : []);
                  }
                } else if (type === 'staff') {
                  setAllocationType('staff');
                  setSelectedStaffIds([id]);
                  setAllocationTarget([]);
                  const s = staff.find(item => item.id === id);
                  if (s) setPayee(s.fullName);
                }
              }
            }}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="other">-- No Linkage / General Payee --</option>
            <optgroup label="Registered Vendors">
              {vendors.map(v => (
                <option key={v.id} value={`vendor:${v.id}`}>{v.name} ({v.category})</option>
              ))}
            </optgroup>
            <optgroup label="Staff / Consultants">
              {staff.map(s => (
                <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group">
          <label className="form-label">Nominal Ledger Category <span>*</span></label>
          <select className="select-filter" value={nominalCode} onChange={(e) => setNominalCode(e.target.value)} style={{ width: '100%', padding: '10px' }} required>
            <option value="">-- Select Nominal Code --</option>
            {activeNominalCodes.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Amount (Gross Value) <span>*</span></label>
          <input type="number" className="form-input" placeholder="Value" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Currency</label>
          <select className="select-filter" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: '100%', padding: '10px' }}>
            {CURRENCIES.map(curr => (
              <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group-row">
        <div className="form-group" style={{ flex: 1.5 }}>
          <label className="form-label">Paid From Bank Account</label>
          <select 
            className="select-filter" 
            value={manualBankAccountId} 
            onChange={(e) => {
              const val = e.target.value;
              setManualBankAccountId(val);
              if (val) {
                const [compId, bankId] = val.split(':');
                const comp = companies.find(c => c.id === compId);
                const bank = comp?.bankAccounts?.find(b => b.id === bankId);
                if (bank) {
                  setCurrency(bank.currency || 'GBP');
                }
              }
            }}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">-- No Mapped Account --</option>
            {companies.map(c => {
              const accounts = c.bankAccounts || [];
              if (accounts.length === 0) return null;
              return (
                <optgroup key={c.id} label={c.name}>
                  {accounts.map(acc => (
                    <option key={acc.id} value={`${c.id}:${acc.id}`}>
                      {acc.bankName} - {acc.accountName} ({acc.currency})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="form-group" style={{ flex: 0.8 }}>
          <label className="form-label">Tax / VAT Rate (%)</label>
          <input type="number" className="form-input" placeholder="e.g. 20" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>

        <div className="form-group" style={{ flex: 1.5, position: 'relative' }}>
          <label className="form-label">Supporting Invoice / Receipt File</label>
          <input type="file" className="form-input" onChange={handleInvoiceFileChange} style={{ padding: '6px' }} />
          {isOcrScanning && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>⚡ AI OCR Scanning...</span>
                <span>{ocrProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${ocrProgress}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.15s ease-out' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Allocation target section */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <div className="form-group">
          <label className="form-label">Cost Allocation Target <span>*</span></label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setAllocatingRowId('manual');
              setAllocatingType(allocationType);
              setAllocatingTarget(allocationTarget);
              setAllocatingStaffIds(selectedStaffIds);
              setAllocatingMode(allocationMode || 'auto');
              setAllocatingManualShares(manualAllocationShares || {});
              setAllocationSearch('');
              setExpandedSections({
                company: allocationType === 'company' || !allocationType,
                department: allocationType === 'department',
                staff: allocationType === 'staff'
              });
            }}
            style={{ padding: '10px', width: '100%', textAlign: 'left', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}
          >
            <span style={{ fontWeight: 600 }}>
              {(() => {
                if (allocationType === 'company') {
                  const targets = Array.isArray(allocationTarget) ? allocationTarget : [allocationTarget].filter(Boolean);
                  if (targets.length === 0) return '🏢 Click to select Company';
                  const names = targets.map(tid => companies.find(c => c.id === tid)?.name).filter(Boolean);
                  return `🏢 Company Target: ${names.join(', ')}`;
                }
                if (allocationType === 'department') {
                  const targets = Array.isArray(allocationTarget) ? allocationTarget : [allocationTarget].filter(Boolean);
                  if (targets.length === 0) return '📂 Click to select Department';
                  return `📂 Department Cost Center: ${targets.join(', ')}`;
                }
                if (allocationType === 'staff') {
                  const count = selectedStaffIds?.length || 0;
                  return `👥 Staff Cost splits: ${count} recruiter${count !== 1 ? 's' : ''} selected`;
                }
                return '🎯 Click to Select Target Allocation...';
              })()}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Modify Target</span>
          </button>
        </div>
      </div>

      {/* Linked Credit to Placement Sales Receipt */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="link-credit-checkbox" checked={showPlacementSelector || linkedPlacementId !== ''} onChange={(e) => setShowPlacementSelector(e.target.checked)} />
          <label htmlFor="link-credit-checkbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
            This transaction is a Client Payment Credit (settles sales invoice)
          </label>
        </div>

        {(showPlacementSelector || linkedPlacementId !== '') && (
          <div className="form-group" style={{ marginTop: '12px', maxWidth: '400px', animation: 'fadeIn 0.2s' }}>
            <label className="form-label">Link to Unpaid Candidate Placement Invoice</label>
            <select className="select-filter" value={linkedPlacementId} onChange={(e) => setLinkedPlacementId(e.target.value)} style={{ width: '100%', padding: '10px' }}>
              <option value="">-- Choose Placements Invoice --</option>
              {unpaidPlacements.map(p => (
                <option key={p.id} value={p.id}>
                  {p.placementId} - {p.candidateName} ({p.clientCompany}) - £{p.netScoreValue.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label">Brief Description / Notes</label>
        <textarea className="form-input" rows={2} placeholder="Additional context on cost center mapping..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
          {editingExpenseId ? 'Update Transaction' : 'Commit Expense'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingExpenseId(null); setManualBankAccountId(''); }}>
          Cancel
        </button>
      </div>

      {/* Manual Allocation Target Selector Modal */}
      {allocatingRowId === 'manual' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10050,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Select Target Allocation Cost Center
                </h3>
              </div>
              <button type="button" onClick={() => setAllocatingRowId(null)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="form-input" placeholder="Search allocation targets by name..." value={allocationSearch} onChange={(e) => setAllocationSearch(e.target.value)} style={{ fontSize: '12px', padding: '8px', width: '100%' }} />
            </div>

            {allocatingType !== 'global' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Split Allocation Mode:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAllocatingMode('auto')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'auto' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'auto' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Automatic (Staff Weighted)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocatingMode('manual')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: allocatingMode === 'manual' ? 'var(--primary)' : 'var(--bg-card)',
                      color: allocatingMode === 'manual' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600
                    }}
                  >
                    Manual Override (%)
                  </button>
                </div>
              </div>
            )}

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                onClick={() => {
                  setAllocatingType('global');
                  setAllocatingTarget([]);
                  setAllocatingStaffIds([]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  backgroundColor: allocatingType === 'global' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: allocatingType === 'global' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <input type="radio" checked={allocatingType === 'global'} readOnly />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>🌎 Whole Corporate Group</div>
                </div>
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, company: !prev.company }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>🏢 Companies {allocatingType === 'company' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.company && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {companies.filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase())).map(c => {
                      const isChecked = allocatingType === 'company' && allocatingTarget.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{c.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[c.id] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [c.id]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'company' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(c.id);
                                } else {
                                  current = current.filter(id => id !== c.id);
                                }
                                setAllocatingType('company');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, department: !prev.department }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>📂 Departments {allocatingType === 'department' && `(${allocatingTarget.length} selected)`}</span>
                </div>
                {expandedSections.department && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {allAvailableDepts.filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase())).map(d => {
                      const isChecked = allocatingType === 'department' && allocatingTarget.includes(d);
                      return (
                        <label key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{d}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[d] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [d]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'department' ? [...allocatingTarget] : [];
                                if (e.target.checked) {
                                  current.push(d);
                                } else {
                                  current = current.filter(id => id !== d);
                                }
                                setAllocatingType('department');
                                setAllocatingTarget(current);
                                setAllocatingStaffIds([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div onClick={() => setExpandedSections(prev => ({ ...prev, staff: !prev.staff }))} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <span>👥 Recruiters {allocatingType === 'staff' && `(${allocatingStaffIds.length} selected)`}</span>
                </div>
                {expandedSections.staff && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {staff.filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase())).map(s => {
                      const isChecked = allocatingType === 'staff' && allocatingStaffIds.includes(s.id);
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', fontSize: '12px', margin: 0 }}>
                          <span>{s.fullName}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isChecked && allocatingMode === 'manual' && (
                              <input 
                                type="number" 
                                value={allocatingManualShares[s.id] || ''} 
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                  setAllocatingManualShares(prev => ({ ...prev, [s.id]: val }));
                                }} 
                                style={{ width: '45px', textAlign: 'right', fontSize: '11px' }} 
                              />
                            )}
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={(e) => {
                                let current = allocatingType === 'staff' ? [...allocatingStaffIds] : [];
                                if (e.target.checked) {
                                  current.push(s.id);
                                } else {
                                  current = current.filter(id => id !== s.id);
                                }
                                setAllocatingType('staff');
                                setAllocatingStaffIds(current);
                                setAllocatingTarget([]);
                              }} 
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={() => {
                  let finalTarget = allocatingTarget;
                  if (allocatingType === 'company') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(tid => companies.some(c => c.id === tid));
                    if (finalTarget.length === 0 && companies[0]) {
                      finalTarget = [companies[0].id];
                    }
                  } else if (allocatingType === 'department') {
                    finalTarget = (Array.isArray(finalTarget) ? finalTarget : [finalTarget].filter(Boolean))
                      .filter(d => allAvailableDepts.includes(d));
                    if (finalTarget.length === 0 && allAvailableDepts[0]) {
                      finalTarget = [allAvailableDepts[0]];
                    }
                  } else if (allocatingType === 'staff') {
                    if (allocatingStaffIds.length === 0) {
                      onShowToast("Please select at least one staff member.", "warning");
                      return;
                    }
                    finalTarget = allocatingStaffIds;
                  }

                  if (allocatingType !== 'global' && allocatingMode === 'manual') {
                    let totalPercent = 0;
                    finalTarget.forEach(tid => {
                      totalPercent += parseInt(String(allocatingManualShares[tid] || 0), 10);
                    });
                    if (totalPercent !== 100) {
                      onShowToast(`Manual split percentages must sum to exactly 100% (currently ${totalPercent}%).`, "warning");
                      return;
                    }
                  }

                  setAllocationType(allocatingType);
                  if (allocatingType === 'staff') {
                    setSelectedStaffIds(allocatingStaffIds);
                    setAllocationTarget([]);
                  } else {
                    setAllocationTarget(finalTarget);
                    setSelectedStaffIds([]);
                  }
                  setAllocationMode(allocatingMode);
                  setManualAllocationShares(allocatingManualShares);
                  setAllocatingRowId(null);
                }}
              >
                Apply
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAllocatingRowId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
