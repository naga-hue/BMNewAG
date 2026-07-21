import React, { useState, useMemo } from 'react';
import { UploadCloud, Grid, Trash2, CheckCircle2, Clock, Check } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';

interface BankStatementImportProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

interface CategorizedRow {
  id: string;
  date: string;
  plMonth: string;
  payee: string;
  reference: string;
  amount: number;
  nominalCode: string;
  recipientType: string;
  recipientId: string;
  taxRate: number;
  allocationType: string;
  allocationTarget: string | string[];
  selectedStaffIds: string[];
  linkedPlacementId: string;
  isCredit: boolean;
  committed: boolean;
  linkedPayrollCellId?: string | null;
  allocationMode?: string;
  manualAllocationShares?: Record<string, number>;
}

const EMPTY_ARRAY: any[] = [];

export default function BankStatementImport({ onShowToast }: BankStatementImportProps) {
  const companies = useBoundStore(state => state.companies) || EMPTY_ARRAY;
  const staff = useBoundStore(state => state.staff) || EMPTY_ARRAY;
  const vendors = useBoundStore(state => state.vendors) || EMPTY_ARRAY;
  const placements = useBoundStore(state => state.placements) || EMPTY_ARRAY;
  const nominalCodes = useBoundStore(state => state.nominalCodes) || EMPTY_ARRAY;
  const contracts = useBoundStore(state => state.contracts) || EMPTY_ARRAY;
  const assetAssignments = useBoundStore(state => state.assetAssignments) || EMPTY_ARRAY;

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;
  const saveVendor = useBoundStore(state => state.saveVendor);
  const saveNominalCode = useBoundStore(state => state.saveNominalCode);
  const savePayrollRecord = useBoundStore(state => state.savePayrollRecord);
  const updatePlacement = useBoundStore(state => state.updatePlacement);

  const [importStep, setImportStep] = useState(1); // 1: upload, 2: mapping, 3: categorization desk
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

  const [savedProfiles, setSavedProfiles] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('bm-expenses-import-profiles');
      return saved ? JSON.parse(saved) : {
        'Default Bank Map': { date: 'Transaction Date', payee: 'Description', amount: 'Amount', reference: 'Reference' }
      };
    } catch {
      return {};
    }
  });
  const [newProfileName, setNewProfileName] = useState('');

  const [statementCompanyId, setStatementCompanyId] = useState('');
  const [statementBankAccountId, setStatementBankAccountId] = useState('');
  const [statementAccountRef, setStatementAccountRef] = useState('Main Current Account');
  const [categorizedRows, setCategorizedRows] = useState<CategorizedRow[]>([]);

  // Target allocation selector states
  const [allocatingRowId, setAllocatingRowId] = useState<string | null>(null);
  const [allocatingType, setAllocatingType] = useState('company');
  const [allocatingTarget, setAllocatingTarget] = useState<string[]>([]);
  const [allocatingStaffIds, setAllocatingStaffIds] = useState<string[]>([]);
  const [allocatingMode, setAllocatingMode] = useState('auto');
  const [allocatingManualShares, setAllocatingManualShares] = useState<Record<string, number>>({});
  const [allocationSearch, setAllocationSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({ company: true, department: false, staff: false });

  // Sales Placement linking states
  const [linkingRowId, setLinkingRowId] = useState<string | null>(null);
  const [linkingPlacementId, setLinkingPlacementId] = useState('');
  const [placementSearch, setPlacementSearch] = useState('');

  // Payroll linkage states
  const [linkingPayrollExpId, setLinkingPayrollExpId] = useState<string | null>(null);
  const [linkingStaffId, setLinkingStaffId] = useState('');
  const [linkingMonth, setLinkingMonth] = useState('2026-07');

  // Quick Nominals states
  const [quickAddNominalOpen, setQuickAddNominalOpen] = useState(false);
  const [quickAddRowId, setQuickAddRowId] = useState<string | null>(null);
  const [newNominalCodeId, setNewNominalCodeId] = useState('');
  const [newNominalCodeName, setNewNominalCodeName] = useState('');
  const [newNominalType, setNewNominalType] = useState('indirect');

  // Quick Vendor states
  const [quickVendorRowId, setQuickVendorRowId] = useState<string | null>(null);
  const [quickVendorName, setQuickVendorName] = useState('');
  const [quickVendorCategory, setQuickVendorCategory] = useState('Software License');

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



  const processBankStatementFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        onShowToast("Bank statement file is empty or invalid.", "warning");
        return;
      }

      // Simple CSV line parser
      const parseCSVLine = (txt: string) => {
        const result: string[] = [];
        let startIdx = 0;
        let insideQuotes = false;
        for (let i = 0; i < txt.length; i++) {
          const char = txt[i];
          if (char === '"') insideQuotes = !insideQuotes;
          else if (char === ',' && !insideQuotes) {
            let val = txt.substring(startIdx, i).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
            result.push(val);
            startIdx = i + 1;
          }
        }
        let lastVal = txt.substring(startIdx).trim();
        if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.substring(1, lastVal.length - 1);
        result.push(lastVal);
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows: string[][] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length === headers.length) {
          rows.push(cols);
        }
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvFile(file);

      // Auto-detect columns
      const initialMap: Record<string, string> = {};
      const mappingsList = [
        { key: 'date', labels: ['date', 'transaction date', 'booking date', 'val date'] },
        { key: 'payee', labels: ['description', 'payee', 'beneficiary', 'details', 'name'] },
        { key: 'amount', labels: ['amount', 'value', 'transaction amount', 'net amount', 'price'] },
        { key: 'reference', labels: ['reference', 'memo', 'ref', 'narrative', 'payment reference'] }
      ];

      mappingsList.forEach(m => {
        const idx = headers.findIndex(h => h && m.labels.some(lbl => h.toLowerCase() === lbl.toLowerCase()));
        if (idx > -1) initialMap[m.key] = headers[idx];
      });

      setColumnMappings(initialMap);
      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const handleCSVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processBankStatementFile(e.dataTransfer.files[0]);
    }
  };

  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processBankStatementFile(e.target.files[0]);
    }
  };

  const handleApplyBankMappings = () => {
    const activeCompanyId = statementCompanyId || (companies[0] ? companies[0].id : '');
    const activeCompany = companies.find(c => c.id === activeCompanyId);
    const activeCompanyBanks = activeCompany?.bankAccounts || [];

    if (activeCompanyBanks.length > 0 && !statementBankAccountId) {
      onShowToast("Please select a registered bank account for the statement import.", "warning");
      return;
    }

    if (!columnMappings.date || !columnMappings.payee || !columnMappings.amount) {
      onShowToast("Please map the required Date, Payee, and Amount fields.", "warning");
      return;
    }

    const dateColIdx = csvHeaders.indexOf(columnMappings.date);
    const payeeColIdx = csvHeaders.indexOf(columnMappings.payee);
    const amountColIdx = csvHeaders.indexOf(columnMappings.amount);
    const refColIdx = columnMappings.reference ? csvHeaders.indexOf(columnMappings.reference) : -1;
    const nominalColIdx = columnMappings.nominal ? csvHeaders.indexOf(columnMappings.nominal) : -1;

    const parsedRows = csvRows.map((row, idx) => {
      const dateVal = row[dateColIdx] || '';
      const payeeVal = row[payeeColIdx] || '';
      const amtVal = Number(String(row[amountColIdx]).replace(/[^0-9.-]/g, '')) || 0;
      const refVal = refColIdx > -1 ? row[refColIdx] || '' : '';
      const nominalVal = nominalColIdx > -1 ? row[nominalColIdx] || '' : '';
      
      const parts = dateVal.split(/[-/]/);
      let yyyymm = new Date().toISOString().substring(0, 7);
      if (parts.length >= 3) {
        const year = parts[0].length === 4 ? parts[0] : parts[2];
        const month = parts[1];
        yyyymm = `${year}-${String(month).padStart(2, '0')}`;
      }

      // Auto-detect recipient matching vendor name or staff member name
      let autoRecType = 'other';
      let autoRecId = '';
      let matchedStaffMember = null;
      const cleanPayee = payeeVal.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanPayee) {
        const matchedVendor = vendors.find(v => v.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPayee) || cleanPayee.includes(v.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
        if (matchedVendor) {
          autoRecType = 'vendor';
          autoRecId = matchedVendor.id;
        } else {
          const matchedStaff = staff.find(s => s.fullName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanPayee) || cleanPayee.includes(s.fullName.toLowerCase().replace(/[^a-z0-9]/g, '')));
          if (matchedStaff) {
            autoRecType = 'staff';
            autoRecId = matchedStaff.id;
            matchedStaffMember = matchedStaff;
          }
        }
      }

      // Auto-detect matching nominal category
      let autoNominalCode = '';
      if (nominalVal) {
        const cleanNomVal = String(nominalVal).trim().toLowerCase();
        const matched = activeNominalCodes.find(c => {
          const codeStr = String(c.code || '').toLowerCase();
          const cId = String(c.id).toLowerCase();
          return cId === cleanNomVal || codeStr === cleanNomVal || codeStr.includes(cleanNomVal) || cleanNomVal.includes(codeStr);
        });
        if (matched) {
          autoNominalCode = matched.code;
        }
      }

      // Auto-detect target cost center allocation
      let autoAllocType = 'company';
      let autoAllocTarget: string | string[] = companies[0]?.id || '';
      let autoStaffIds: string[] = [];

      if (matchedStaffMember) {
        autoAllocType = 'staff';
        autoAllocTarget = [matchedStaffMember.id];
        autoStaffIds = [matchedStaffMember.id];
      } else {
        // Match payee to registered Company Name
        const matchedComp = companies.find(c => {
          const cName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanPayee.includes(cName) || cName.includes(cleanPayee);
        });
        if (matchedComp) {
          autoAllocType = 'company';
          autoAllocTarget = matchedComp.id;
        } else {
          // Match payee to active Department Name
          const activeDepts = Array.from(new Set(staff.map(s => s.department).filter(Boolean)));
          const matchedDept = activeDepts.find(d => {
            const dName = d.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanPayee.includes(dName);
          });
          if (matchedDept) {
            autoAllocType = 'department';
            autoAllocTarget = [matchedDept];
          }
        }
      }

      return {
        id: `stmt-row-${idx}-${Date.now()}`,
        date: dateVal,
        plMonth: yyyymm,
        payee: payeeVal,
        reference: refVal,
        amount: amtVal,
        nominalCode: autoNominalCode || '',
        recipientType: autoRecType,
        recipientId: autoRecId,
        taxRate: 0, // default to 0% (Exempt)
        allocationType: autoAllocType,
        allocationTarget: autoAllocTarget,
        selectedStaffIds: autoStaffIds,
        linkedPlacementId: '',
        isCredit: amtVal > 0,
        committed: false
      };
    });

    setCategorizedRows(parsedRows);
    setImportStep(3);
  };

  const handleUpdateCategorizedRow = (rowId: string | null, field: string, value: any) => {
    if (!rowId) return;
    setCategorizedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleCommitBankImports = async () => {
    const mRows = categorizedRows.filter(r => r.nominalCode && !r.committed);
    if (mRows.length === 0) {
      onShowToast("Please map at least one row with a Nominal code before committing.", "warning");
      return;
    }

    try {
      for (const row of mRows) {
        const isStaff = row.allocationType === 'staff';
        const target = isStaff ? row.selectedStaffIds : row.allocationTarget;

        const expenseId = `exp-stmt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const expenseData = {
          id: expenseId,
          date: row.date,
          plMonth: row.plMonth,
          payee: row.payee + (row.reference ? ` [Ref: ${row.reference}]` : ''),
          nominalCode: row.nominalCode,
          amount: Math.abs(row.amount),
          currency: (() => {
            const comp = companies.find(c => c.id === (statementCompanyId || (companies[0] ? companies[0].id : '')));
            const bank = comp?.bankAccounts?.find(b => b.id === statementBankAccountId);
            return bank?.currency || 'GBP';
          })(),
          taxRate: row.taxRate !== undefined ? row.taxRate : 0,
          recipientType: row.recipientType || 'other',
          recipientId: row.recipientId || '',
          invoiceUrl: "#",
          allocationType: row.allocationType,
          allocationTarget: target,
          allocationMode: row.allocationMode || 'auto',
          manualAllocationShares: row.manualAllocationShares || {},
          linkedPlacementId: row.linkedPlacementId || null,
          bankCompanyId: statementCompanyId || (companies[0] ? companies[0].id : ''),
          bankAccountId: statementBankAccountId,
          bankAccountRef: statementAccountRef || 'Main Current Account',
          linkedPayrollCellId: row.linkedPayrollCellId || null
        };

        await saveExpense(expenseData);

        if (row.linkedPayrollCellId) {
          const [sid, m] = row.linkedPayrollCellId.split('_');
          const baseVal = Math.abs(row.amount);
          const record = {
            id: `${sid}_${m}`,
            staffId: sid,
            month: m,
            isReconciled: true,
            basicSalary: baseVal,
            commission: 0,
            employerNi: 0,
            employerPension: 0,
            employeeTaxNic: 0,
            employeePension: 0,
            notes: `Linked to statement payment: ${row.payee} on ${row.date}.`,
            linkedExpenseId: expenseId
          };
          await savePayrollRecord(record);
        }

        // If a placement is linked, mark it as client paid!
        if (row.linkedPlacementId) {
          const matchedPlacement = placements.find(p => p.id === row.linkedPlacementId);
          if (matchedPlacement) {
            await updatePlacement({
              ...matchedPlacement,
              clientPaymentStatus: 'paid',
              clientPaidDate: row.date
            });
          }
        }
      }

      onShowToast(`Successfully imported and logged ${mRows.length} bank transactions.`, "success");
      
      const updatedRows = categorizedRows.map(r => {
        if (r.nominalCode) {
          return { ...r, committed: true };
        }
        return r;
      });
      setCategorizedRows(updatedRows);

      const allDone = updatedRows.every(r => r.committed);
      if (allDone) {
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setCategorizedRows([]);
        setStatementCompanyId('');
        setStatementBankAccountId('');
        setStatementAccountRef('Main Current Account');
        setImportStep(1);
      } else {
        onShowToast(`${updatedRows.filter(r => r.committed).length} rows committed. Map the remaining rows to commit them too.`, "info");
      }
    } catch (err: any) {
      onShowToast(`Error committing statement rows: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Importer Steps */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Bank Statement Import & Categorizer</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Upload your corporate bank statements (CSV/Excel) and map transactions to Nominal codes and allocations row-by-row.</p>
      </div>

      {importStep === 1 && (
        <div 
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCSVDrop}
          onClick={() => {
            const picker = document.getElementById('statement-file-picker');
            if (picker) picker.click();
          }}
          style={{ padding: '40px', borderStyle: 'dashed', borderRadius: '8px', cursor: 'pointer' }}
        >
          <input 
            type="file" 
            id="statement-file-picker" 
            accept=".csv" 
            style={{ display: 'none' }}
            onChange={handleCSVSelect}
          />
          <UploadCloud size={48} className="upload-icon" style={{ marginBottom: '16px' }} />
          <span className="upload-text" style={{ fontSize: '16px', fontWeight: 600 }}>Drag and drop statement CSV here or Browse</span>
          <span className="upload-subtext" style={{ marginTop: '8px' }}>Supported header keys: Date, Description/Payee, Amount (credits & debits)...</span>
        </div>
      )}

      {importStep === 2 && (
        <div className="detail-section" style={{ animation: 'fadeIn 0.2s' }}>
          <div className="section-title">
            <Grid size={16} /> Map CSV Headers
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            We parsed headers of file **{csvFile?.name}**. Map them to target categories below:
          </p>

          <div className="form-group-row">
            {[
              { key: 'date', label: 'Transaction Date *' },
              { key: 'payee', label: 'Payee / Description *' },
              { key: 'amount', label: 'Value Amount *' },
              { key: 'reference', label: 'Reference / Memo (Optional)' },
              { key: 'nominal', label: 'Nominal Code (Optional)' }
            ].map(item => {
              const isUnmapped = !columnMappings[item.key];
              const isRequired = ['date', 'payee', 'amount'].includes(item.key);
              return (
                <div key={item.key} className="form-group" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>{item.label}</label>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isUnmapped 
                        ? (isRequired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)') 
                        : 'rgba(34, 197, 94, 0.1)',
                      color: isUnmapped 
                        ? (isRequired ? 'var(--danger)' : 'var(--warning)') 
                        : 'var(--success)',
                      transition: 'all 0.2s'
                    }}>
                      {isUnmapped ? (isRequired ? 'Required Unmapped' : 'Unmapped') : 'Mapped'}
                    </span>
                  </div>
                  <select
                    className="select-filter"
                    value={columnMappings[item.key] || ''}
                    onChange={(e) => setColumnMappings(prev => ({ ...prev, [item.key]: e.target.value }))}
                    style={{ 
                      width: '100%', 
                      padding: '8px',
                      border: isUnmapped 
                        ? (isRequired 
                            ? '2px solid rgba(239, 68, 68, 0.65)' 
                            : '1px dashed var(--warning)') 
                        : '1.5px solid var(--success)',
                      backgroundColor: isUnmapped 
                        ? (isRequired ? 'rgba(239, 68, 68, 0.02)' : 'transparent')
                        : 'rgba(34, 197, 94, 0.01)',
                      borderRadius: 'var(--radius-sm)',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <option value="">-- Choose Column --</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Saved Preset Profiles */}
          <div style={{ marginTop: '16px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>💾 Save or Load Mapping Preset Profile</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select 
                className="select-filter"
                style={{ flex: 1, padding: '6px' }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && savedProfiles[val]) {
                    setColumnMappings(savedProfiles[val]);
                    onShowToast(`Loaded mapping preset profile: ${val}`, "info");
                  }
                }}
              >
                <option value="">-- Load Saved Preset Profile --</option>
                {Object.keys(savedProfiles).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <input 
                type="text"
                placeholder="New preset profile name"
                className="form-input"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                style={{ width: '160px', padding: '6px' }}
              />
              <button 
                type="button" 
                className="btn-primary" 
                style={{ padding: '6px 12px', fontSize: '11px' }}
                onClick={() => {
                  if (!newProfileName.trim()) {
                    onShowToast("Please enter a name for the preset profile.", "warning");
                    return;
                  }
                  const updated = { ...savedProfiles, [newProfileName.trim()]: columnMappings };
                  setSavedProfiles(updated);
                  localStorage.setItem('bm-expenses-import-profiles', JSON.stringify(updated));
                  onShowToast(`Saved mapping preset profile "${newProfileName.trim()}"!`, "success");
                  setNewProfileName('');
                }}
              >
                Save Preset
              </button>
            </div>
          </div>

          {/* Target Bank Account and Reference Form */}
          <div 
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px', 
              marginTop: '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
              🏦 Bank Account & Statement Reference
            </div>
            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label">Select Company *</label>
                <select
                  className="select-filter"
                  value={statementCompanyId || (companies[0] ? companies[0].id : '')}
                  onChange={(e) => {
                    const compId = e.target.value;
                    setStatementCompanyId(compId);
                    const comp = companies.find(c => c.id === compId);
                    const banks = comp?.bankAccounts || [];
                    if (banks.length > 0) {
                      setStatementBankAccountId(banks[0].id);
                      setStatementAccountRef(`${banks[0].bankName} - ${banks[0].accountName}`);
                    } else {
                      setStatementBankAccountId('');
                      setStatementAccountRef('');
                    }
                  }}
                  style={{ width: '100%', padding: '8px' }}
                  required
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Bank Account *</label>
                {(() => {
                  const activeCompId = statementCompanyId || (companies[0] ? companies[0].id : '');
                  const activeComp = companies.find(c => c.id === activeCompId);
                  const activeCompBanks = activeComp?.bankAccounts || [];

                  return (
                    <>
                      <select
                        className="select-filter"
                        value={statementBankAccountId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setStatementBankAccountId(bId);
                          const acc = activeCompBanks.find(b => b.id === bId);
                          if (acc) {
                            setStatementAccountRef(`${acc.bankName} - ${acc.accountName}`);
                          } else {
                            setStatementAccountRef('');
                          }
                        }}
                        style={{ width: '100%', padding: '8px' }}
                        required
                      >
                        <option value="">-- Select Bank Account --</option>
                        {activeCompBanks.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountName} ({acc.currency})
                          </option>
                        ))}
                      </select>
                      {activeCompBanks.length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
                          ⚠️ No bank accounts configured for this company. Please add one under the Companies tab first!
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn-primary" onClick={handleApplyBankMappings}>
              Validate & Parse Rows
            </button>
            <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>
              Back
            </button>
          </div>
        </div>
      )}

      {importStep === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Row-by-Row Categorization Desk</h3>
            <button className="btn-primary" onClick={handleCommitBankImports}>
              Commit Mapped Rows ({categorizedRows.filter(r => r.nominalCode && !r.committed).length} rows)
            </button>
          </div>

          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px', 
              padding: '8px 12px', 
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <span>🏦 <strong>Target Account:</strong> {companies.find(c => c.id === (statementCompanyId || (companies[0] ? companies[0].id : '')))?.name || 'Company'} — <em>{statementAccountRef}</em></span>
          </div>

          <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table className="entity-table dense" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Description & Ref</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>P&L Month</th>
                  <th>Nominal Category</th>
                  <th>Recipient Linkage</th>
                  <th>Target Allocation</th>
                  <th>VAT Rate</th>
                  <th>Link credit sales</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categorizedRows.map((row) => (
                  <tr key={row.id} style={{ opacity: row.committed ? 0.6 : 1, backgroundColor: row.committed ? 'var(--bg-secondary)' : 'none' }}>
                    <td>
                      {row.committed ? (
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                      ) : row.nominalCode ? (
                        <Check size={14} style={{ color: 'var(--warning)' }} />
                      ) : (
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </td>
                    <td>{row.date}</td>
                    <td style={{ fontWeight: 600 }}>
                      {row.payee}
                      {row.reference && (
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                          Ref: {row.reference}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: row.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      £{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* P&L Month Selector */}
                    <td>
                      <input 
                        type="month"
                        value={row.plMonth}
                        onChange={(e) => handleUpdateCategorizedRow(row.id, 'plMonth', e.target.value)}
                        disabled={row.committed}
                        style={{ padding: '4px', fontSize: '11px', width: '110px' }}
                      />
                    </td>

                    {/* Nominal Category Selector */}
                    <td>
                      <select
                        value={row.nominalCode}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'quick_add_nominal') {
                            setQuickAddRowId(row.id);
                            setNewNominalCodeId('');
                            setNewNominalCodeName('');
                            setNewNominalType('indirect');
                            setQuickAddNominalOpen(true);
                          } else {
                            handleUpdateCategorizedRow(row.id, 'nominalCode', val);
                          }
                        }}
                        disabled={row.committed}
                        style={{ padding: '4px', fontSize: '11px', width: '160px' }}
                      >
                        <option value="">-- Unmapped --</option>
                        <option value="quick_add_nominal" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                          ➕ Add New Nominal Code...
                        </option>
                         {activeNominalCodes.map(c => (
                          <option key={c.id} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                    </td>

                    {/* Recipient Linkage (Vendor/Staff) */}
                    <td>
                      <select
                        value={row.recipientType !== 'other' ? `${row.recipientType}:${row.recipientId}` : 'other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'other') {
                            handleUpdateCategorizedRow(row.id, 'recipientType', 'other');
                            handleUpdateCategorizedRow(row.id, 'recipientId', '');
                          } else if (val === 'register_vendor') {
                            setQuickVendorRowId(row.id);
                            setQuickVendorName(row.payee);
                            setQuickVendorCategory('Software License');
                          } else {
                            const [type, id] = val.split(':');
                            handleUpdateCategorizedRow(row.id, 'recipientType', type);
                            handleUpdateCategorizedRow(row.id, 'recipientId', id);

                            if (type === 'vendor') {
                              const vendorObj = vendors.find(v => v.id === id);
                              const vContracts = contracts.filter(c => c.vendorId === id || (c.vendorName && vendorObj && c.vendorName.toLowerCase().includes(vendorObj.name.toLowerCase())));
                              const vContractIds = vContracts.map(c => c.id);

                              // Auto-populate seat assigned staff users
                              const assignedStaffIds = assetAssignments
                                .filter(a => vContractIds.includes(a.contractId))
                                .map(a => a.staffId)
                                .filter(Boolean);

                              if (assignedStaffIds.length > 0) {
                                handleUpdateCategorizedRow(row.id, 'allocationType', 'staff');
                                handleUpdateCategorizedRow(row.id, 'selectedStaffIds', assignedStaffIds);
                                handleUpdateCategorizedRow(row.id, 'allocationTarget', '');
                                onShowToast(`🔌 Auto-populated ${assignedStaffIds.length} seat users from Vendor Asset (${vendorObj?.name})!`, "success");
                              } else if (vContracts.length > 0 && Array.isArray(vContracts[0].splits)) {
                                const compTargets = vContracts[0].splits.filter((sp: any) => sp.type === 'company').map((sp: any) => sp.targetId);
                                if (compTargets.length > 0) {
                                  handleUpdateCategorizedRow(row.id, 'allocationType', 'company');
                                  handleUpdateCategorizedRow(row.id, 'allocationTarget', compTargets);
                                  handleUpdateCategorizedRow(row.id, 'selectedStaffIds', []);
                                  onShowToast(`🔌 Auto-populated company cost splits from Vendor Asset (${vendorObj?.name})!`, "success");
                                }
                              }
                            } else if (type === 'staff') {
                              const staffMember = staff.find(s => s.id === id);
                              handleUpdateCategorizedRow(row.id, 'allocationType', 'staff');
                              handleUpdateCategorizedRow(row.id, 'selectedStaffIds', [id]);
                              handleUpdateCategorizedRow(row.id, 'allocationTarget', '');
                              onShowToast(`👤 Auto-allocated salary/payroll cost to ${staffMember?.fullName}`, "success");
                            }
                          }
                        }}
                        disabled={row.committed}
                        style={{ padding: '4px', fontSize: '11px', width: '150px' }}
                      >
                        <option value="other">-- General Recipient --</option>
                        <option value="register_vendor" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                          ➕ Register "{row.payee}"...
                        </option>
                        <optgroup label="Registered Vendors">
                          {vendors.map(v => (
                            <option key={v.id} value={`vendor:${v.id}`}>{v.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Staff / Consultants">
                          {staff.map(s => (
                            <option key={s.id} value={`staff:${s.id}`}>{s.fullName}</option>
                          ))}
                        </optgroup>
                      </select>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        {row.linkedPayrollCellId ? (() => {
                          const [sid, m] = row.linkedPayrollCellId.split('_');
                          const staffMember = staff.find(s => s.id === sid);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              <span>✓ Paid: {staffMember?.fullName || 'Staff'} ({m})</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateCategorizedRow(row.id, 'linkedPayrollCellId', null);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: '9px' }}
                                title="Remove payroll linkage"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })() : (
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingPayrollExpId(row.id);
                              setLinkingStaffId(row.recipientType === 'staff' ? row.recipientId : '');
                              setLinkingMonth(row.plMonth || '2026-07');
                            }}
                            disabled={row.committed}
                            style={{
                              background: 'rgba(99, 102, 241, 0.08)',
                              border: '1px dashed rgba(99, 102, 241, 0.3)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 4px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              opacity: row.committed ? 0.5 : 1
                            }}
                          >
                            🔗 Link to Payroll
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Target Selector Button */}
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setAllocatingRowId(row.id);
                          const rawTarget = row.allocationTarget || [];
                          const targetArray = Array.isArray(rawTarget) ? (rawTarget as string[]) : [rawTarget].filter(Boolean) as string[];
                          const type = row.allocationType || 'company';
                          const validTarget = type === 'company'
                            ? targetArray.filter(tid => companies.some(c => c.id === tid))
                            : type === 'department'
                              ? targetArray.filter(d => allAvailableDepts.includes(d))
                              : targetArray;
                          setAllocatingType(type);
                          setAllocatingTarget(validTarget);
                          setAllocatingStaffIds(row.selectedStaffIds || []);
                          setAllocatingMode(row.allocationMode || 'auto');
                          setAllocatingManualShares(row.manualAllocationShares || {});
                          setAllocationSearch('');
                          setExpandedSections({
                            company: type === 'company' || !type,
                            department: type === 'department',
                            staff: type === 'staff'
                          });
                        }}
                        disabled={row.committed}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '11px', 
                          width: '130px', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          textAlign: 'left'
                        }}
                      >
                        {(() => {
                          if (row.allocationType === 'company') {
                            const targets = Array.isArray(row.allocationTarget) ? row.allocationTarget : [row.allocationTarget].filter(Boolean);
                            if (targets.length === 0) return '🏢 Choose Company';
                            const names = targets.map(tid => companies.find(c => c.id === tid)?.name).filter(Boolean);
                            return `🏢 ${names.join(', ')}`;
                          }
                          if (row.allocationType === 'department') {
                            const targets = Array.isArray(row.allocationTarget) ? row.allocationTarget : [row.allocationTarget].filter(Boolean);
                            if (targets.length === 0) return '📂 Choose Dept';
                            return `📂 Dept: ${targets.join(', ')}`;
                          }
                          if (row.allocationType === 'staff') {
                            const count = row.selectedStaffIds?.length || 0;
                            return `👥 ${count} staff split${count !== 1 ? 's' : ''}`;
                          }
                          return '🎯 Click to Allocate';
                        })()}
                      </button>
                    </td>

                    {/* VAT Rate Selector */}
                    <td>
                      <select
                        value={row.taxRate !== undefined ? row.taxRate : 0}
                        onChange={(e) => handleUpdateCategorizedRow(row.id, 'taxRate', Number(e.target.value))}
                        disabled={row.committed}
                        style={{ padding: '4px', fontSize: '11px', width: '85px' }}
                      >
                        <option value="0">0% (Exempt)</option>
                        <option value="20">20% (Std)</option>
                        <option value="5">5% (Red)</option>
                      </select>
                    </td>

                    {/* Link Credit to placement sales invoice */}
                    <td>
                      {row.isCredit ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setLinkingRowId(row.id);
                            setLinkingPlacementId(row.linkedPlacementId || '');
                            setPlacementSearch('');
                          }}
                          disabled={row.committed}
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '11px', 
                            width: '150px', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            textAlign: 'left',
                            border: row.linkedPlacementId ? '1px solid var(--success)' : '1px solid var(--border-color)',
                            color: row.linkedPlacementId ? 'var(--success)' : 'var(--text-primary)'
                          }}
                        >
                          {(() => {
                            if (row.linkedPlacementId) {
                              const p = placements.find(x => x.id === row.linkedPlacementId);
                              return p ? `🔗 ${p.placementId} (${p.clientCompany})` : '🔗 Link Placement';
                            }
                            return '🔗 Link Placement';
                          })()}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Debit</span>
                      )}
                    </td>

                    {/* Delete Row Action */}
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => {
                          setCategorizedRows(prev => prev.filter(r => r.id !== row.id));
                        }}
                        disabled={row.committed}
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        title="Remove this row"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={() => setImportStep(2)}>
              Back to Mappings
            </button>
          </div>

        </div>
      )}

      {/* Target Allocation Popup Modal */}
      {allocatingRowId !== null && (
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Assign where this expense amount should be routed.
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setAllocatingRowId(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search allocation targets by name..."
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
                style={{ fontSize: '12px', padding: '8px', width: '100%' }}
              />
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

            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
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
                  padding: '12px',
                  backgroundColor: allocatingType === 'global' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: allocatingType === 'global' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <input type="radio" checked={allocatingType === 'global'} readOnly style={{ cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>🌎 Whole Corporate Group</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Allocate cost to global company overhead</div>
                </div>
              </div>

              <div>
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, company: !prev.company }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏢 Companies 
                    {allocatingType === 'company' && allocatingTarget.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                        Active ({allocatingTarget.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.company ? '▼' : '▶'}</span>
                </div>
                {expandedSections.company && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', maxHeight: '180px', overflowY: 'auto' }}>
                    {companies
                      .filter(c => c.name.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(c => {
                        const isChecked = allocatingType === 'company' && allocatingTarget.includes(c.id);
                        return (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '4px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent', margin: 0 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{c.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isChecked && allocatingMode === 'manual' && (
                                <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="%"
                                  value={allocatingManualShares[c.id] || ''}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                    setAllocatingManualShares(prev => ({ ...prev, [c.id]: val }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ width: '55px', fontSize: '11px', padding: '2px 4px', textAlign: 'right', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                              )}
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let current = allocatingType === 'company' ? [...allocatingTarget] : [];
                                  if (e.target.checked) {
                                    if (!current.includes(c.id)) current.push(c.id);
                                  } else {
                                    current = current.filter(id => id !== c.id);
                                    const newShares = { ...allocatingManualShares };
                                    delete newShares[c.id];
                                    setAllocatingManualShares(newShares);
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
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, department: !prev.department }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📂 Departments 
                    {allocatingType === 'department' && allocatingTarget.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                        Active ({allocatingTarget.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.department ? '▼' : '▶'}</span>
                </div>
                {expandedSections.department && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', maxHeight: '180px', overflowY: 'auto' }}>
                    {allAvailableDepts
                      .filter(d => d.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(d => {
                        const isChecked = allocatingType === 'department' && allocatingTarget.includes(d);
                        return (
                          <label key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '4px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent', margin: 0 }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{d}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isChecked && allocatingMode === 'manual' && (
                                <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="%"
                                  value={allocatingManualShares[d] || ''}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                    setAllocatingManualShares(prev => ({ ...prev, [d]: val }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ width: '55px', fontSize: '11px', padding: '2px 4px', textAlign: 'right', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                              )}
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let current = allocatingType === 'department' ? [...allocatingTarget] : [];
                                  if (e.target.checked) {
                                    if (!current.includes(d)) current.push(d);
                                  } else {
                                    current = current.filter(name => name !== d);
                                    const newShares = { ...allocatingManualShares };
                                    delete newShares[d];
                                    setAllocatingManualShares(newShares);
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
                <div 
                  onClick={() => setExpandedSections(prev => ({ ...prev, staff: !prev.staff }))}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👥 Recruiters (Staff) 
                    {allocatingType === 'staff' && allocatingStaffIds.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                        Active ({allocatingStaffIds.length} selected)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{expandedSections.staff ? '▼' : '▶'}</span>
                </div>
                {expandedSections.staff && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px', backgroundColor: 'var(--bg-secondary)', maxHeight: '180px', overflowY: 'auto' }}>
                    {staff
                      .filter(s => s.fullName.toLowerCase().includes(allocationSearch.toLowerCase()))
                      .map(s => {
                        const isChecked = allocatingType === 'staff' && allocatingStaffIds.includes(s.id);
                        return (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '4px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.06)' : 'transparent', margin: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: isChecked ? 600 : 'normal' }}>{s.fullName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.department || 'No Dept'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isChecked && allocatingMode === 'manual' && (
                                <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="%"
                                  value={allocatingManualShares[s.id] || ''}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                                    setAllocatingManualShares(prev => ({ ...prev, [s.id]: val }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ width: '55px', fontSize: '11px', padding: '2px 4px', textAlign: 'right', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                              )}
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let current = allocatingType === 'staff' ? [...allocatingStaffIds] : [];
                                  if (e.target.checked) {
                                    if (!current.includes(s.id)) current.push(s.id);
                                  } else {
                                    current = current.filter(id => id !== s.id);
                                    const newShares = { ...allocatingManualShares };
                                    delete newShares[s.id];
                                    setAllocatingManualShares(newShares);
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

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
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
                    finalTarget = allocatingStaffIds.filter(sid => staff.some(s => s.id === sid));
                  } else if (allocatingType === 'global') {
                    finalTarget = [];
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

                  handleUpdateCategorizedRow(allocatingRowId, 'allocationType', allocatingType);
                  if (allocatingType === 'staff') {
                    handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', allocatingStaffIds);
                    handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', '');
                  } else {
                    handleUpdateCategorizedRow(allocatingRowId, 'allocationTarget', finalTarget);
                    handleUpdateCategorizedRow(allocatingRowId, 'selectedStaffIds', []);
                  }
                  handleUpdateCategorizedRow(allocatingRowId, 'allocationMode', allocatingMode);
                  handleUpdateCategorizedRow(allocatingRowId, 'manualAllocationShares', allocatingManualShares);
                  
                  setAllocatingRowId(null);
                }}
              >
                Apply Allocation
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAllocatingRowId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placement Linkage Popup Modal */}
      {linkingRowId !== null && (
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
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '750px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔗 Select Sales Placement / Invoice to Link Credit
              </h3>
              <button type="button" onClick={() => setLinkingRowId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <input
              type="text"
              className="form-input"
              value={placementSearch}
              onChange={(e) => setPlacementSearch(e.target.value)}
              placeholder="Search by candidate name, client company, or placement ID..."
              style={{ fontSize: '13px', padding: '10px' }}
            />

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="entity-table dense" style={{ fontSize: '11px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                  <tr>
                    <th>Placement ID</th>
                    <th>Client Company</th>
                    <th>Candidate</th>
                    <th style={{ textAlign: 'right' }}>Gross Fee</th>
                    <th>Start Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {placements
                    .filter(p => {
                      if (p.netScoreValue <= 0) return false;
                      const term = placementSearch.toLowerCase();
                      return (
                        (p.placementId || '').toLowerCase().includes(term) ||
                        (p.clientCompany || '').toLowerCase().includes(term) ||
                        (p.candidateName || '').toLowerCase().includes(term)
                      );
                    })
                    .map(p => {
                      const isSelected = linkingPlacementId === p.id;
                      return (
                        <tr 
                          key={p.id} 
                          onClick={() => setLinkingPlacementId(isSelected ? '' : p.id)}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent'
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{p.placementId}</td>
                          <td>{p.clientCompany}</td>
                          <td style={{ fontWeight: 500 }}>{p.candidateName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            £{p.netScoreValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>{p.startDate}</td>
                          <td>
                            <span style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor: p.clientPaymentStatus === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                              color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)'
                            }}>
                              {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={isSelected ? "btn-primary" : "btn-secondary"}
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', p.id);
                                setLinkingRowId(null);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => {
                  handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', '');
                  setLinkingRowId(null);
                }}
              >
                Clear Link
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => {
                  handleUpdateCategorizedRow(linkingRowId, 'linkedPlacementId', linkingPlacementId);
                  setLinkingRowId(null);
                }}
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Linkage Popup Modal */}
      {linkingPayrollExpId !== null && (
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
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '450px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                🔗 Reconcile Transaction with Payroll Roster
              </h3>
              <button type="button" onClick={() => setLinkingPayrollExpId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {(() => {
              const matchedRow = categorizedRows.find(e => e.id === linkingPayrollExpId);
              if (!matchedRow) return <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Transaction details not found.</p>;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600 }}>{matchedRow.payee?.split(' [Ref:')[0]}</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Date: {matchedRow.date} &bull; Amount: £{matchedRow.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Staff Member <span>*</span></label>
                    <select
                      className="select-filter"
                      value={linkingStaffId}
                      onChange={(e) => setLinkingStaffId(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      <option value="">-- Select Employee --</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.fullName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Target Payroll Month <span>*</span></label>
                    <select
                      className="select-filter"
                      value={linkingMonth}
                      onChange={(e) => setLinkingMonth(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      {["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button type="button" className="btn-secondary" onClick={() => setLinkingPayrollExpId(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        handleUpdateCategorizedRow(linkingPayrollExpId, 'linkedPayrollCellId', `${linkingStaffId}_${linkingMonth}`);
                        handleUpdateCategorizedRow(linkingPayrollExpId, 'recipientType', 'staff');
                        handleUpdateCategorizedRow(linkingPayrollExpId, 'recipientId', linkingStaffId);
                        const member = staff.find(s => s.id === linkingStaffId);
                        if (member) {
                          handleUpdateCategorizedRow(linkingPayrollExpId, 'payee', member.fullName);
                        }
                        onShowToast("Statement row marked to link to payroll upon commit.", "success");
                        setLinkingPayrollExpId(null);
                      }}
                    >
                      Save Linkage
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Quick Add Vendor Modal */}
      {quickVendorRowId !== null && (
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
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!quickVendorName.trim()) return;
              try {
                const newVendorId = `vendor-${Date.now()}`;
                const newVendor = {
                  id: newVendorId,
                  name: quickVendorName.trim(),
                  category: quickVendorCategory,
                  contactEmail: '',
                  phone: '',
                  notes: 'Auto-registered from bank statement importer categorizer Desk.'
                };
                await saveVendor(newVendor);
                
                handleUpdateCategorizedRow(quickVendorRowId, 'recipientType', 'vendor');
                handleUpdateCategorizedRow(quickVendorRowId, 'recipientId', newVendorId);
                
                onShowToast(`Successfully registered vendor "${quickVendorName}"!`, "success");
                setQuickVendorRowId(null);
              } catch (err: any) {
                onShowToast(`Error registering vendor: ${err.message}`, "warning");
              }
            }}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '450px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Register New Vendor Partner</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Add this supplier to your database.</span>
              </div>
              <button type="button" onClick={() => setQuickVendorRowId(null)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Vendor Company Name <span>*</span></label>
              <input type="text" className="form-input" value={quickVendorName} onChange={(e) => setQuickVendorName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Category <span>*</span></label>
              <select className="select-filter" value={quickVendorCategory} onChange={(e) => setQuickVendorCategory(e.target.value)} style={{ width: '100%', padding: '10px' }}>
                <option value="Software License">Software Licenses (Office, CRM, etc.)</option>
                <option value="Office Rental">Office Rentals & Landlords</option>
                <option value="Telecom">Telecom & Phone Systems</option>
                <option value="AI Service">AI Services (OpenAI, Anthropic)</option>
                <option value="Other">Other Vendors</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Register Vendor Partner</button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setQuickVendorRowId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Nominal Modal */}
      {quickAddNominalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(3px)'
        }}>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newNominalCodeId.trim() || !newNominalCodeName.trim()) {
                onShowToast("Please enter both nominal code and description name.", "warning");
                return;
              }
              const codeStr = `${newNominalCodeId.trim()} - ${newNominalCodeName.trim()}`;
              const exists = activeNominalCodes.some(c => c.id === newNominalCodeId.trim() || String(c.code || '').toLowerCase() === codeStr.toLowerCase());
              if (exists) {
                onShowToast("A nominal code with this key or description name already exists.", "warning");
                return;
              }
              try {
                await saveNominalCode({
                  id: newNominalCodeId.trim(),
                  code: codeStr,
                  type: newNominalType
                });
                onShowToast(`Added Nominal category: ${codeStr}`, "success");
                
                if (quickAddRowId) {
                  handleUpdateCategorizedRow(quickAddRowId, 'nominalCode', codeStr);
                }
                
                setQuickAddNominalOpen(false);
                setQuickAddRowId(null);
              } catch (err: any) {
                onShowToast(`Error: ${err.message}`, "warning");
              }
            }}
            className="detail-section"
            style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', backgroundColor: 'var(--bg-primary)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>
                ➕ Quick Add Nominal Ledger Code
              </h3>
              <button type="button" onClick={() => { setQuickAddNominalOpen(false); setQuickAddRowId(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nominal Code ID (Key) <span>*</span></label>
              <input type="text" className="form-input" placeholder="e.g. 505" value={newNominalCodeId} onChange={(e) => setNewNominalCodeId(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Nominal Label / Name <span>*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Health Insurance Overhead" value={newNominalCodeName} onChange={(e) => setNewNominalCodeName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Cost Classification Type <span>*</span></label>
              <select className="select-filter" value={newNominalType} onChange={(e) => setNewNominalType(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="indirect">Indirect Cost (Overhead / G&A)</option>
                <option value="direct">Direct Cost (Salaries, Commission, Placements Cost)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save & Select</button>
              <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setQuickAddNominalOpen(false); setQuickAddRowId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
