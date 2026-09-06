import React, { useState, useMemo, useRef } from 'react';
import { UploadCloud, Grid, Trash2, CheckCircle2, Clock, Check, ArrowLeft, Search, RefreshCw, AlertCircle, FileText, Building2, Calendar, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBoundStore } from '../../store/useBoundStore';
import { parseAndStandardizeDate, symbolMap } from './shared';
import { FX_RATES, toGBP, getHistoricalFxRate } from '../../utils/currency';

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
  fxRate?: number;
  amountGBP?: number;
}

interface HeldBankStatement {
  id: string;
  bankAccountId: string;
  companyId: string;
  currency: string;
  fileName: string;
  uploadedAt: string;
  headers: string[];
  rawRows: string[][];
  columnMappings: Record<string, string>;
  dateFormat: 'UK' | 'US';
  latestStatementDate?: string;
  earliestStatementDate?: string;
  categorizedRows?: CategorizedRow[];
}

function formatDisplayDate(dStr?: string | null): string {
  if (!dStr) return '—';
  try {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    return dStr;
  } catch {
    return dStr || '—';
  }
}

function isRowCapturedInLedger(
  rowDate: string,
  rowAmount: number,
  rowPayee: string,
  rowRef: string,
  bankAccountId: string,
  ledgerExpenses: any[]
): boolean {
  if (!ledgerExpenses || ledgerExpenses.length === 0) return false;
  const absRowAmt = Math.abs(rowAmount);
  const cleanPayee = (rowPayee || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanRef = (rowRef || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return ledgerExpenses.some((exp: any) => {
    if (exp.bankAccountId && exp.bankAccountId !== bankAccountId) return false;
    if (exp.date !== rowDate) return false;
    const expAmt = Math.abs(exp.amount);
    if (Math.abs(expAmt - absRowAmt) > 0.05) return false;
    const expPayee = (exp.payee || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const expRef = (exp.reference || exp.description || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanPayee && (expPayee.includes(cleanPayee) || cleanPayee.includes(expPayee))) return true;
    if (cleanRef && (expRef.includes(cleanRef) || cleanRef.includes(expRef))) return true;
    return true;
  });
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
  const expenses = useBoundStore(state => state.expenses) || EMPTY_ARRAY;

  const updateExpense = useBoundStore(state => state.updateExpense);
  const saveExpense = updateExpense;
  const saveVendor = useBoundStore(state => state.saveVendor);
  const saveNominalCode = useBoundStore(state => state.saveNominalCode);
  const savePayrollRecord = useBoundStore(state => state.savePayrollRecord);
  const updatePlacement = useBoundStore(state => state.updatePlacement);

  const [importStep, setImportStep] = useState(1); // 1: upload, 2: mapping, 3: categorization desk
  const [activeViewMode, setActiveViewMode] = useState<'hub' | 'mapping' | 'desk'>('hub');
  const [hubCompanyFilter, setHubCompanyFilter] = useState('ALL');
  const [hubSearch, setHubSearch] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [heldStatements, setHeldStatements] = useState<Record<string, HeldBankStatement>>(() => {
    try {
      const saved = localStorage.getItem('bm-held-bank-statements');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateHeldStatements = (newMap: Record<string, HeldBankStatement>) => {
    setHeldStatements(newMap);
    try {
      localStorage.setItem('bm-held-bank-statements', JSON.stringify(newMap));
    } catch (err) {
      console.error('Failed to persist held bank statements:', err);
    }
  };

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dateFormat, setDateFormat] = useState<'UK' | 'US'>('UK');
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
  const [statementCurrency, setStatementCurrency] = useState('GBP');
  const [statementFxRate, setStatementFxRate] = useState<number>(1.0);
  const [fxCalculationMode, setFxCalculationMode] = useState<'date' | 'fixed'>('date');
  const [isResolvingFx, setIsResolvingFx] = useState(false);
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

  // Comprehensive Bank Statements Queue & Books Reconciliation Status List
  const allEnrichedBankAccounts = useMemo(() => {
    const list: any[] = [];

    companies.forEach((c: any) => {
      const banks = c.bankAccounts || [];
      banks.forEach((b: any) => {
        const held = heldStatements[b.id];
        
        // Ledger expenses for this bank account
        const ledgerExpenses = expenses.filter((e: any) => 
          e.bankAccountId === b.id || (e.bankCompanyId === c.id && e.currency === b.currency)
        );

        const ledgerDates = ledgerExpenses.map((e: any) => e.date).filter(Boolean).sort();
        const latestLedgerDate = ledgerDates.length > 0 ? ledgerDates[ledgerDates.length - 1] : null;

        let latestStatementDate: string | null = null;
        let earliestStatementDate: string | null = null;
        let totalTransactions = 0;
        let capturedTransactions = 0;

        if (held) {
          totalTransactions = held.categorizedRows?.length || held.rawRows?.length || 0;
          latestStatementDate = held.latestStatementDate || null;
          earliestStatementDate = held.earliestStatementDate || null;

          // If date bounds weren't pre-computed, compute them from rawRows
          if (!latestStatementDate && held.rawRows && held.headers) {
            const dateCol = held.columnMappings?.date || held.headers.find((h: string) => h.toLowerCase().includes('date'));
            if (dateCol) {
              const colIdx = held.headers.indexOf(dateCol);
              if (colIdx > -1) {
                const dates = held.rawRows.map((r: any[]) => parseAndStandardizeDate(r[colIdx], held.dateFormat || 'UK')).filter(Boolean).sort();
                if (dates.length > 0) {
                  earliestStatementDate = dates[0];
                  latestStatementDate = dates[dates.length - 1];
                }
              }
            }
          }

          // Check captured count
          if (held.categorizedRows && held.categorizedRows.length > 0) {
            capturedTransactions = held.categorizedRows.filter((r: any) => 
              r.committed || isRowCapturedInLedger(r.date, r.amount, r.payee, r.reference, b.id, ledgerExpenses)
            ).length;
          } else if (held.rawRows && held.headers) {
            const dateCol = held.columnMappings?.date || held.headers.find((h: string) => h.toLowerCase().includes('date'));
            const amtCol = held.columnMappings?.amount || held.headers.find((h: string) => h.toLowerCase().includes('amount') || h.toLowerCase().includes('value'));
            const payeeCol = held.columnMappings?.payee || held.headers.find((h: string) => h.toLowerCase().includes('desc') || h.toLowerCase().includes('payee'));
            const refCol = held.columnMappings?.reference || held.headers.find((h: string) => h.toLowerCase().includes('ref'));

            const dIdx = dateCol ? held.headers.indexOf(dateCol) : -1;
            const aIdx = amtCol ? held.headers.indexOf(amtCol) : -1;
            const pIdx = payeeCol ? held.headers.indexOf(payeeCol) : -1;
            const rIdx = refCol ? held.headers.indexOf(refCol) : -1;

            if (dIdx > -1 && aIdx > -1) {
              capturedTransactions = held.rawRows.filter((r: any[]) => {
                const stdDate = parseAndStandardizeDate(r[dIdx], held.dateFormat || 'UK');
                const amt = Number(String(r[aIdx]).replace(/[^0-9.-]/g, '')) || 0;
                const payee = pIdx > -1 ? r[pIdx] : '';
                const ref = rIdx > -1 ? r[rIdx] : '';
                return isRowCapturedInLedger(stdDate, amt, payee, ref, b.id, ledgerExpenses);
              }).length;
            }
          }
        }

        const pendingTransactions = Math.max(0, totalTransactions - capturedTransactions);
        const capturePct = totalTransactions > 0 ? Math.round((capturedTransactions / totalTransactions) * 100) : 0;

        let status: 'fully_captured' | 'partially_captured' | 'unprocessed' | 'no_statement' = 'no_statement';
        if (held) {
          if (totalTransactions > 0 && capturedTransactions >= totalTransactions) {
            status = 'fully_captured';
          } else if (capturedTransactions > 0) {
            status = 'partially_captured';
          } else {
            status = 'unprocessed';
          }
        }

        list.push({
          bankId: b.id,
          companyId: c.id,
          companyName: c.name,
          bankName: b.bankName,
          accountName: b.accountName,
          accountNumber: b.accountNumber,
          sortCode: b.sortCode,
          currency: b.currency || 'GBP',
          heldStatement: held,
          latestLedgerDate,
          latestStatementDate,
          earliestStatementDate,
          totalTransactions,
          capturedTransactions,
          pendingTransactions,
          capturePct,
          status
        });
      });
    });

    return list;
  }, [companies, expenses, heldStatements]);

  const handleTriggerUploadForBank = (bankId: string) => {
    if (fileInputRefs.current[bankId]) {
      fileInputRefs.current[bankId]?.click();
    }
  };

  const handleBankFileChange = (e: React.ChangeEvent<HTMLInputElement>, bank: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processBankStatementFile(file, bank.bankId, bank.companyId, bank.currency);
      e.target.value = '';
    }
  };

  const handleOpenDeskForBank = (bankItem: any) => {
    const held = heldStatements[bankItem.bankId];
    if (!held) {
      onShowToast("No statement uploaded for this bank account yet. Please click 'Choose Statement' first.", "warning");
      return;
    }

    setStatementCompanyId(bankItem.companyId);
    setStatementBankAccountId(bankItem.bankId);
    setStatementAccountRef(`${bankItem.bankName} - ${bankItem.accountName}`);
    setStatementCurrency(bankItem.currency || 'GBP');
    setStatementFxRate(FX_RATES[bankItem.currency] || (bankItem.currency === 'AED' ? 0.21 : 1.0));
    setCsvHeaders(held.headers || []);
    setCsvRows(held.rawRows || []);
    setCsvFile({ name: held.fileName } as any);
    setDateFormat(held.dateFormat || 'UK');
    setColumnMappings(held.columnMappings || {});

    if (held.categorizedRows && held.categorizedRows.length > 0) {
      setCategorizedRows(held.categorizedRows);
      setActiveViewMode('desk');
      setImportStep(3);
    } else {
      setActiveViewMode('mapping');
      setImportStep(2);
    }
  };

  const handleClearStatementForBank = (bankId: string) => {
    const target = allEnrichedBankAccounts.find(b => b.bankId === bankId);
    const bankLabel = target ? `${target.bankName} - ${target.accountName}` : 'this bank account';
    if (window.confirm(`Are you sure you want to remove the held statement for ${bankLabel} from the queue?`)) {
      const updated = { ...heldStatements };
      delete updated[bankId];
      updateHeldStatements(updated);
      onShowToast("Held statement removed from queue.", "info");
    }
  };

  const handleBackToHub = () => {
    // Save working state back to held statement if active
    if (statementBankAccountId && heldStatements[statementBankAccountId]) {
      const updatedHeld = {
        ...heldStatements[statementBankAccountId],
        categorizedRows,
        columnMappings,
        dateFormat
      };
      const updated = { ...heldStatements, [statementBankAccountId]: updatedHeld };
      updateHeldStatements(updated);
    }
    setActiveViewMode('hub');
    setImportStep(1);
  };

  const filteredBankAccounts = useMemo(() => {
    return allEnrichedBankAccounts.filter((b: any) => {
      if (hubCompanyFilter !== 'ALL' && b.companyId !== hubCompanyFilter) return false;
      if (hubSearch.trim()) {
        const q = hubSearch.toLowerCase().trim();
        const str = `${b.companyName} ${b.bankName} ${b.accountName} ${b.currency} ${b.accountNumber || ''} ${b.heldStatement?.fileName || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [allEnrichedBankAccounts, hubCompanyFilter, hubSearch]);

  const hubTotals = useMemo(() => {
    const totalAccounts = allEnrichedBankAccounts.length;
    const statementsHeld = allEnrichedBankAccounts.filter((b: any) => b.heldStatement).length;
    const totalTransactions = allEnrichedBankAccounts.reduce((sum: number, b: any) => sum + b.totalTransactions, 0);
    const capturedTransactions = allEnrichedBankAccounts.reduce((sum: number, b: any) => sum + b.capturedTransactions, 0);
    const pendingTransactions = allEnrichedBankAccounts.reduce((sum: number, b: any) => sum + b.pendingTransactions, 0);
    const overallPct = totalTransactions > 0 ? Math.round((capturedTransactions / totalTransactions) * 100) : 0;
    return { totalAccounts, statementsHeld, totalTransactions, capturedTransactions, pendingTransactions, overallPct };
  }, [allEnrichedBankAccounts]);



  const processBankStatementFile = (
    file: File, 
    targetBankAccountId?: string, 
    targetCompanyId?: string, 
    targetCurrency?: string
  ) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let headers: string[] = [];
        let rows: string[][] = [];

        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            onShowToast("Excel statement file contains no worksheets.", "warning");
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

          if (!sheetData || sheetData.length < 2) {
            onShowToast("Excel statement file is empty or invalid.", "warning");
            return;
          }

          // Find the header row (first row with at least 2 non-empty cells)
          let headerRowIdx = 0;
          while (headerRowIdx < sheetData.length) {
            const row = sheetData[headerRowIdx];
            if (row && Array.isArray(row) && row.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length >= 2) {
              break;
            }
            headerRowIdx++;
          }

          if (headerRowIdx >= sheetData.length) {
            onShowToast("Could not find table headers in the Excel file.", "warning");
            return;
          }

          headers = (sheetData[headerRowIdx] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
          const rawRows = sheetData.slice(headerRowIdx + 1);

          rows = rawRows
            .filter((r: any[]) => r && Array.isArray(r) && r.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
            .map((r: any[]) => {
              return headers.map((_, colIdx) => String(r[colIdx] !== undefined && r[colIdx] !== null ? r[colIdx] : '').trim());
            });
        } else {
          // Plain Text / CSV Parsing
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

          headers = parseCSVLine(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length === headers.length) {
              rows.push(cols);
            }
          }
        }

        if (rows.length === 0 || headers.length === 0) {
          onShowToast("No valid transaction rows found in file.", "warning");
          return;
        }

        // Auto-detect columns
        const initialMap: Record<string, string> = {};
        const mappingsList = [
          { key: 'date', labels: ['date', 'transaction date', 'booking date', 'val date', 'posted date', 'trans date'] },
          { key: 'payee', labels: ['description', 'payee', 'beneficiary', 'details', 'name', 'narrative', 'party', 'counterparty'] },
          { key: 'amount', labels: ['amount', 'value', 'transaction amount', 'net amount', 'price', 'paid out', 'debit', 'debit amount'] },
          { key: 'reference', labels: ['reference', 'memo', 'ref', 'narrative', 'payment reference', 'type', 'id'] },
          { key: 'nominal', labels: ['nominal', 'category', 'nominal code', 'account code', 'code'] }
        ];

        mappingsList.forEach(m => {
          const idx = headers.findIndex(h => h && m.labels.some(lbl => h.toLowerCase() === lbl.toLowerCase() || h.toLowerCase().includes(lbl.toLowerCase())));
          if (idx > -1) initialMap[m.key] = headers[idx];
        });

        // Compute statement date range
        let earliestDate = '';
        let latestDate = '';
        const dateCol = initialMap.date || headers.find(h => h.toLowerCase().includes('date'));
        if (dateCol) {
          const dIdx = headers.indexOf(dateCol);
          if (dIdx > -1) {
            const dates = rows.map(r => parseAndStandardizeDate(r[dIdx], dateFormat)).filter(Boolean).sort();
            if (dates.length > 0) {
              earliestDate = dates[0];
              latestDate = dates[dates.length - 1];
            }
          }
        }

        if (targetBankAccountId) {
          // Store directly into multi-bank held queue!
          const newHeld: HeldBankStatement = {
            id: `stmt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            bankAccountId: targetBankAccountId,
            companyId: targetCompanyId || '',
            currency: targetCurrency || 'GBP',
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            headers,
            rawRows: rows,
            columnMappings: initialMap,
            dateFormat,
            latestStatementDate: latestDate,
            earliestStatementDate: earliestDate,
            categorizedRows: []
          };
          const updated = { ...heldStatements, [targetBankAccountId]: newHeld };
          updateHeldStatements(updated);
          onShowToast(`Uploaded & held statement "${file.name}" (${rows.length} rows, up to ${formatDisplayDate(latestDate)})! You can choose the next statement or open the desk.`, "success");
        } else {
          // General upload -> load into current import session
          setCsvHeaders(headers);
          setCsvRows(rows);
          setCsvFile(file);
          setColumnMappings(initialMap);
          setActiveViewMode('mapping');
          setImportStep(2);
        }
      } catch (err: any) {
        console.error("Error processing statement file:", err);
        onShowToast(`Failed to parse file: ${err.message || 'Unknown error'}`, "danger");
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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

  const handleApplyBankMappings = async () => {
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

    setIsResolvingFx(true);

    // Resolve date-specific conversion rates for foreign currency
    const dateRateCache: Record<string, number> = {};
    if (statementCurrency !== 'GBP') {
      if (fxCalculationMode === 'date') {
        const uniqueDates = Array.from(new Set(csvRows.map(r => parseAndStandardizeDate(r[dateColIdx], dateFormat)).filter(Boolean)));
        await Promise.all(uniqueDates.map(async (dStr) => {
          try {
            const rate = await getHistoricalFxRate(statementCurrency, dStr);
            dateRateCache[dStr] = rate;
          } catch {
            dateRateCache[dStr] = statementFxRate || (statementCurrency === 'AED' ? 0.21 : 1.0);
          }
        }));
      } else {
        csvRows.forEach(r => {
          const dStr = parseAndStandardizeDate(r[dateColIdx], dateFormat);
          if (dStr) dateRateCache[dStr] = statementFxRate;
        });
      }
    }

    setIsResolvingFx(false);

    const parsedRows = csvRows.map((row, idx) => {
      const dateVal = row[dateColIdx] || '';
      const payeeVal = row[payeeColIdx] || '';
      const amtVal = Number(String(row[amountColIdx]).replace(/[^0-9.-]/g, '')) || 0;
      const refVal = refColIdx > -1 ? row[refColIdx] || '' : '';
      const nominalVal = nominalColIdx > -1 ? row[nominalColIdx] || '' : '';
      
      const standardizedDate = parseAndStandardizeDate(dateVal, dateFormat);
      const yyyymm = standardizedDate ? standardizedDate.substring(0, 7) : new Date().toISOString().substring(0, 7);

      // Resolve effective FX rate and GBP equivalent for this specific date
      const rowFxRate = statementCurrency === 'GBP' ? 1.0 : (dateRateCache[standardizedDate] || statementFxRate || FX_RATES[statementCurrency] || 1.0);
      const rowAmountGBP = Math.abs(amtVal) * rowFxRate;

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
        date: standardizedDate,
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
        committed: false,
        fxRate: rowFxRate,
        amountGBP: rowAmountGBP
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
        const amt = Math.abs(row.amount);
        const cur = statementCurrency || 'GBP';
        const rate = cur === 'GBP' ? 1.0 : (row.fxRate || statementFxRate || FX_RATES[cur] || 1.0);
        const gbpAmt = cur === 'GBP' ? amt : (row.amountGBP || (amt * rate));

        const expenseData = {
          id: expenseId,
          date: row.date,
          plMonth: row.plMonth,
          payee: row.payee + (row.reference ? ` [Ref: ${row.reference}]` : ''),
          nominalCode: row.nominalCode,
          amount: amt,
          currency: cur,
          fxRate: rate,
          amountGBP: gbpAmt,
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
          linkedPayrollCellId: row.linkedPayrollCellId || null,
          reference: row.reference || '',
          description: row.reference || ''
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

      // Save updated categorizedRows to heldStatements in localStorage
      if (statementBankAccountId && heldStatements[statementBankAccountId]) {
        const updatedHeld = {
          ...heldStatements[statementBankAccountId],
          categorizedRows: updatedRows,
          columnMappings: columnMappings
        };
        const updated = { ...heldStatements, [statementBankAccountId]: updatedHeld };
        updateHeldStatements(updated);
      }

      const allDone = updatedRows.every(r => r.committed);
      if (allDone) {
        onShowToast("All transactions for this statement are now committed to the ledger!", "success");
      } else {
        onShowToast(`${updatedRows.filter(r => r.committed).length} rows committed. Map the remaining rows to commit them too.`, "info");
      }
    } catch (err: any) {
      onShowToast(`Error committing statement rows: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {activeViewMode === 'hub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🏦</span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Bank Statements Hub & Multi-Bank Reconciliation Queue</h2>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                Upload statements for your corporate bank accounts. The system holds your files and monitors whether each transaction is captured in the ledger or awaiting processing.
              </p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Configured Bank Accounts
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px', color: 'var(--text-primary)' }}>
                {hubTotals.totalAccounts}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Across {companies.length} registered companies
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Statements Held in Queue
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px', color: 'var(--primary)' }}>
                {hubTotals.statementsHeld} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-muted)' }}>/ {hubTotals.totalAccounts} active</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {hubTotals.totalTransactions} total transactions staged
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Captured in Books
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px', color: 'var(--success)' }}>
                {hubTotals.capturedTransactions} <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({hubTotals.overallPct}%)</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Reconciled into expenses ledger
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pending Processing
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px', color: hubTotals.pendingTransactions > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {hubTotals.pendingTransactions}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {hubTotals.pendingTransactions > 0 ? 'Awaiting categorization & commit' : 'All held transactions captured!'}
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              <select
                className="select-filter"
                value={hubCompanyFilter}
                onChange={(e) => setHubCompanyFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '12px', minWidth: '180px' }}
              >
                <option value="ALL">🏢 All Companies ({companies.length})</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '360px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by bank, account, or currency..."
                  className="form-input"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                  style={{ paddingLeft: '30px', paddingRight: '10px', paddingY: '6px', fontSize: '12px', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Showing {filteredBankAccounts.length} of {allEnrichedBankAccounts.length} bank accounts
            </div>
          </div>

          {/* Primary Bank Accounts Table */}
          <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="entity-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Bank Account & Entity</th>
                  <th style={{ padding: '12px 14px' }}>Attached Statement File</th>
                  <th style={{ padding: '12px 14px' }}>📅 Statement & Books Dates</th>
                  <th style={{ padding: '12px 14px', width: '220px' }}>Capture Status & Progress</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBankAccounts.map((b: any) => {
                  const hasHeld = !!b.heldStatement;
                  return (
                    <tr key={b.bankId} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: hasHeld ? 'rgba(99, 102, 241, 0.02)' : 'transparent' }}>
                      
                      {/* Bank Account & Entity */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🏦</span> {b.bankName} - {b.accountName}
                            <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: '10px', fontWeight: 800, color: 'var(--primary)' }}>
                              {b.currency}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🏢 {b.companyName}</span>
                            {b.accountNumber && (
                              <span style={{ color: 'var(--text-muted)' }}>&bull; Acc: {b.accountNumber}</span>
                            )}
                            {b.sortCode && (
                              <span style={{ color: 'var(--text-muted)' }}>&bull; Sort: {b.sortCode}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Attached Statement File */}
                      <td style={{ padding: '12px 14px' }}>
                        {hasHeld ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={13} /> {b.heldStatement.fileName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              <strong>{b.totalTransactions}</strong> total transactions staged
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Uploaded {new Date(b.heldStatement.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontStyle: 'italic' }}>
                            ⚪ No statement uploaded
                          </span>
                        )}
                      </td>

                      {/* Dates & Books Coverage Tracker (User Priority!) */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Latest Statement Txn:</span>
                            <strong style={{ color: b.latestStatementDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {formatDisplayDate(b.latestStatementDate)}
                            </strong>
                          </div>
                          <div style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Books Captured Up To:</span>
                            <strong style={{ color: b.latestLedgerDate ? 'var(--success)' : 'var(--text-muted)' }}>
                              {formatDisplayDate(b.latestLedgerDate)}
                            </strong>
                          </div>

                          {/* Gap Guidance */}
                          {hasHeld && (
                            <div style={{ marginTop: '2px' }}>
                              {b.status === 'fully_captured' ? (
                                <span style={{ fontSize: '10.5px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ✅ All transactions captured in ledger!
                                </span>
                              ) : b.pendingTransactions > 0 ? (
                                <span style={{ fontSize: '10.5px', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ⚠️ {b.pendingTransactions} pending to process
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Capture Status & Progress */}
                      <td style={{ padding: '12px 14px' }}>
                        {hasHeld ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                              <span style={{ fontWeight: 600 }}>
                                {b.capturedTransactions} / {b.totalTransactions} Captured
                              </span>
                              <span style={{ fontWeight: 700, color: b.status === 'fully_captured' ? 'var(--success)' : b.status === 'partially_captured' ? 'var(--warning)' : 'var(--text-muted)' }}>
                                {b.capturePct}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${b.capturePct}%`, 
                                  height: '100%', 
                                  backgroundColor: b.status === 'fully_captured' ? 'var(--success)' : b.status === 'partially_captured' ? 'var(--warning)' : 'var(--text-muted)',
                                  transition: 'width 0.3s ease'
                                }} 
                              />
                            </div>
                            <div>
                              {b.status === 'fully_captured' && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--success)', fontWeight: 700 }}>
                                  🟢 Reconciled & Captured
                                </span>
                              )}
                              {b.status === 'partially_captured' && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.12)', color: 'var(--warning)', fontWeight: 700 }}>
                                  🟡 In Progress ({b.pendingTransactions} pending)
                                </span>
                              )}
                              {b.status === 'unprocessed' && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(249, 115, 22, 0.12)', color: 'var(--warning)', fontWeight: 700 }}>
                                  🟠 Unprocessed ({b.totalTransactions} waiting)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                            ⚪ Awaiting Statement
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <input
                            type="file"
                            ref={(el) => (fileInputRefs.current[b.bankId] = el)}
                            style={{ display: 'none' }}
                            accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            onChange={(e) => handleBankFileChange(e, b)}
                          />

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '11.5px', padding: '6px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleTriggerUploadForBank(b.bankId)}
                            title={hasHeld ? 'Upload a new statement file to replace the current one' : 'Choose and upload statement for this bank account'}
                          >
                            <UploadCloud size={13} /> {hasHeld ? 'Replace File' : 'Choose Statement'}
                          </button>

                          {hasHeld && (
                            <>
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ fontSize: '11.5px', padding: '6px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleOpenDeskForBank(b)}
                                title="Open the categorization desk for this bank statement"
                              >
                                ⚡ Open Desk
                              </button>

                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '6px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                onClick={() => handleClearStatementForBank(b.bankId)}
                                title="Remove this held statement from queue"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredBankAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No bank accounts found matching your filter. Please configure bank accounts in Company Settings!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* General Standalone Dropzone */}
          <div style={{ marginTop: '10px' }}>
            <div 
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCSVDrop}
              onClick={() => {
                const picker = document.getElementById('general-statement-file-picker');
                if (picker) picker.click();
              }}
              style={{ padding: '24px', borderStyle: 'dashed', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}
            >
              <input 
                type="file" 
                id="general-statement-file-picker" 
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                style={{ display: 'none' }}
                onChange={handleCSVSelect}
              />
              <UploadCloud size={24} style={{ color: 'var(--primary)', marginBottom: '6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag & Drop or Browse Standalone Statement (CSV or Excel)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                You can also drop any statement here to manually map and assign it to any company bank account.
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeViewMode === 'mapping' || (importStep === 2 && activeViewMode !== 'hub')) && (
        <div className="detail-section" style={{ animation: 'fadeIn 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleBackToHub} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
            >
              <ArrowLeft size={14} /> Back to Bank Statements Hub
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Bank: <strong>{statementAccountRef}</strong> ({statementCurrency})
            </span>
          </div>

          <div className="section-title">
            <Grid size={16} /> Target Bank Account, Currency & Header Mapping
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            File: <strong>{csvFile?.name}</strong>. Configure your target account, currency, and map the statement columns below:
          </p>

          {/* 1. Target Bank Account & Statement Currency Setup Card */}
          <div 
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '2px solid var(--primary)', 
              borderRadius: 'var(--radius-md)', 
              padding: '18px', 
              marginBottom: '22px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '14px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏦</span> 1. Target Bank Account & Statement Currency
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                File: <strong>{csvFile?.name}</strong>
              </span>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Select Company *</label>
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
                      const cur = banks[0].currency || 'GBP';
                      setStatementCurrency(cur);
                      setStatementFxRate(FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0));
                    } else {
                      setStatementBankAccountId('');
                      setStatementAccountRef('');
                      setStatementCurrency('GBP');
                      setStatementFxRate(1.0);
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
                <label className="form-label" style={{ fontWeight: 600 }}>Select Bank Account *</label>
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
                            const cur = acc.currency || 'GBP';
                            setStatementCurrency(cur);
                            setStatementFxRate(FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0));
                          } else {
                            setStatementAccountRef('');
                            setStatementCurrency('GBP');
                            setStatementFxRate(1.0);
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

            {/* Statement Currency and Historical Conversion Rate Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Statement Currency *
                </label>
                <select
                  className="select-filter"
                  value={statementCurrency}
                  onChange={(e) => {
                    const cur = e.target.value;
                    setStatementCurrency(cur);
                    setStatementFxRate(FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0));
                  }}
                  style={{ width: '100%', padding: '8px', fontWeight: 700, borderColor: statementCurrency !== 'GBP' ? 'var(--primary)' : undefined }}
                >
                  <option value="GBP">GBP (£) - British Pound</option>
                  <option value="AED">AED (AED) - UAE Dirham</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="ZAR">ZAR (R) - South African Rand</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Transactions will be categorized & stored natively in <strong>{statementCurrency}</strong>.
                </span>
              </div>

              {statementCurrency !== 'GBP' && (
                <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    Conversion Rate Calculation Method *
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: fxCalculationMode === 'date' ? 'var(--primary)' : 'var(--text-primary)', margin: 0 }}>
                      <input
                        type="radio"
                        name="fx-calc-mode"
                        checked={fxCalculationMode === 'date'}
                        onChange={() => setFxCalculationMode('date')}
                        style={{ accentColor: 'var(--primary)', marginTop: '2px' }}
                      />
                      <div>
                        <span>📅 Daily Rate by Transaction Date (Automatic Historical Rate)</span>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '1px' }}>
                          Each transaction automatically retrieves the exact market/ECB exchange rate for its specific booking date.
                        </div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: fxCalculationMode === 'fixed' ? 'var(--primary)' : 'var(--text-primary)', margin: 0 }}>
                      <input
                        type="radio"
                        name="fx-calc-mode"
                        checked={fxCalculationMode === 'fixed'}
                        onChange={() => setFxCalculationMode('fixed')}
                        style={{ accentColor: 'var(--primary)', marginTop: '2px' }}
                      />
                      <div>
                        <span>🔒 Fixed Rate Across Entire Statement</span>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '1px' }}>
                          Applies one single constant exchange rate to all rows in this file.
                        </div>
                      </div>
                    </label>
                  </div>

                  {fxCalculationMode === 'fixed' ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <input
                        type="number"
                        step="0.0001"
                        className="form-input"
                        value={statementFxRate}
                        onChange={(e) => setStatementFxRate(parseFloat(e.target.value) || 0)}
                        style={{ flex: 1, padding: '8px', fontWeight: 700 }}
                        placeholder="e.g. 0.2120"
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        title="Reset to current market live rate"
                        onClick={() => setStatementFxRate(FX_RATES[statementCurrency] || (statementCurrency === 'AED' ? 0.21 : 1.0))}
                      >
                        ↺ Default
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '6px', fontSize: '11px', color: 'var(--primary)', marginTop: '2px' }}>
                      ⚡ <strong>Date-Specific Conversion Enabled:</strong> Each transaction date will look up and lock in the historical exchange rate on that day (Baseline reference today: 1 {statementCurrency} ≈ £{(FX_RATES[statementCurrency] || (statementCurrency === 'AED' ? 0.21 : 1.0)).toFixed(4)} GBP).
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> 2. Map Statement Column Headers
          </div>

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

          {/* Date Format Parser Selection */}
          <div style={{ 
            marginTop: '16px', 
            backgroundColor: 'rgba(99, 102, 241, 0.03)', 
            padding: '12px', 
            borderRadius: '6px', 
            border: '1px solid rgba(99, 102, 241, 0.15)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📅</span> Date Parsing Format Configuration
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              If your bank statement represents dates with months first (e.g. US style <code>MM/DD/YYYY</code>), change this to US. UK is standard <code>DD/MM/YYYY</code>.
            </p>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                <input 
                  type="radio" 
                  name="import-date-format" 
                  value="UK"
                  checked={dateFormat === 'UK'} 
                  onChange={() => setDateFormat('UK')} 
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                UK Format (DD/MM/YYYY)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                <input 
                  type="radio" 
                  name="import-date-format" 
                  value="US"
                  checked={dateFormat === 'US'} 
                  onChange={() => setDateFormat('US')} 
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                US Format (MM/DD/YYYY)
              </label>
            </div>
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleApplyBankMappings}
              disabled={isResolvingFx}
              style={{ minWidth: '200px' }}
            >
              {isResolvingFx ? '⏳ Calculating Date Rates...' : 'Validate & Parse Rows'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleBackToHub}>
              ← Back to Hub
            </button>
          </div>
        </div>
      )}

      {(activeViewMode === 'desk' || (importStep === 3 && activeViewMode !== 'hub')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleBackToHub} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
            >
              <ArrowLeft size={14} /> Back to Bank Statements Hub
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Target Account: <strong style={{ color: 'var(--text-primary)' }}>{statementAccountRef}</strong>
              </span>
              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', fontWeight: 700, fontSize: '11.5px' }}>
                {statementCurrency}
              </span>
            </div>
          </div>

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
              <span>🏦 <strong>Target Account:</strong> {companies.find(c => c.id === (statementCompanyId || (companies[0] ? companies[0].id : '')))?.name || 'Company'} — <em>{statementAccountRef}</em></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-card)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>💱 Currency:</span>
                <select
                  value={statementCurrency}
                  onChange={(e) => {
                    const cur = e.target.value;
                    setStatementCurrency(cur);
                    setStatementFxRate(FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0));
                  }}
                  style={{ padding: '3px 8px', fontSize: '11.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (AED)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>

                {statementCurrency !== 'GBP' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {fxCalculationMode === 'date' ? (
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                        📅 Converted per transaction date
                      </span>
                    ) : (
                      <>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>FX:</span>
                        <input
                          type="number"
                          step="0.0001"
                          value={statementFxRate}
                          onChange={(e) => setStatementFxRate(parseFloat(e.target.value) || 0)}
                          style={{ width: '75px', padding: '3px 6px', fontSize: '11.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--border-color)', textAlign: 'right' }}
                          title={`Exchange Rate: 1 ${statementCurrency} = £${statementFxRate}`}
                        />
                        <button
                          type="button"
                          style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: 0 }}
                          title="Reset to default rate"
                          onClick={() => setStatementFxRate(FX_RATES[statementCurrency] || (statementCurrency === 'AED' ? 0.21 : 1.0))}
                        >
                          ↺
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table className="entity-table dense" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Description & Ref</th>
                  <th style={{ textAlign: 'right' }}>Amount ({statementCurrency})</th>
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
                      {(symbolMap[statementCurrency] || `${statementCurrency} `)}{Math.abs(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {statementCurrency !== 'GBP' && (
                        <div 
                          style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }} 
                          title={`Historical FX Rate on ${row.date || 'transaction date'}: 1 ${statementCurrency} = £${(row.fxRate || statementFxRate)?.toFixed(6)}`}
                        >
                          ≈ £{(row.amountGBP || (Math.abs(row.amount) * (row.fxRate || statementFxRate || 1.0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span style={{ fontSize: '9px', opacity: 0.85, marginLeft: '4px', backgroundColor: 'var(--bg-card)', padding: '1px 4px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
                            @{(row.fxRate || statementFxRate || 1.0).toFixed(4)}
                          </span>
                        </div>
                      )}
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
                          {staff.filter(s => s.status !== 'exited').map(s => (
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
                      {staff.filter(s => s.status !== 'exited').map(s => (
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
