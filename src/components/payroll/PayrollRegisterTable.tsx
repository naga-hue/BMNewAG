import React, { useState, useMemo } from 'react';
import { CheckCircle2, Search, Building2, Layers, Plus, Trash2 } from 'lucide-react';
// @ts-ignore
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff, Placement, Expense, NominalCode, ReimbursementItem } from '../../types';
import { symbolMap, MONTHS, getBusinessDaysInMonth, getCellData, calculateCommissionForRecruiter } from './utils';
import { getUkStaffOverhead, formatOverheadTitle, WithOverheadTooltip } from './ukStaffOverheadData';
import { FX_RATES } from '../../utils/currency';
import { jsPDF } from 'jspdf';

interface PayrollRegisterTableProps {
  companies: Company[];
  staff: Staff[];
  commissionPolicies: any[];
  placements: Placement[];
  payrollRecords: any[];
  payrollPolicies: any[];
  leaveRequests: any[];
  holidays: any[];
  expenses: Expense[];
  nominalCodes: NominalCode[];
  onSavePayrollRecord: (record: any) => Promise<any>;
  onSaveExpense: (expense: Expense) => Promise<any>;
  onDeleteExpense: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  currentUser?: any;
  scopingViewMode?: string;
  reminderSettings?: any;
}

export default function PayrollRegisterTable({
  companies,
  staff,
  commissionPolicies,
  placements,
  payrollRecords,
  payrollPolicies,
  leaveRequests,
  holidays,
  expenses,
  nominalCodes,
  onSavePayrollRecord,
  onSaveExpense,
  onDeleteExpense,
  onShowToast,
  currentUser,
  scopingViewMode,
  reminderSettings
}: PayrollRegisterTableProps) {
  const isRecruiter = currentUser?.permissions?.role === 'recruiter' || scopingViewMode === 'self';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string[]>(['all']);
  const [selectedDept, setSelectedDept] = useState<string[]>(['all']);
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, reconciled, projected
  const [selectedInvoiceStatusFilter, setSelectedInvoiceStatusFilter] = useState('all'); // all, submitted, pending
  const [recruiterSelectedMonth, setRecruiterSelectedMonth] = useState('2026-08');
  const [submittingInvoices, setSubmittingInvoices] = useState(false);
  const [showExitedRoster, setShowExitedRoster] = useState(false);
  const [detailBreakdownType, setDetailBreakdownType] = useState<string | null>(null); // null, 'salary', 'commission', 'expenses'

  // Selected cell for override modal
  const [selectedCell, setSelectedCell] = useState<any>(null); // { staffMember, month }

  // Modal editor states
  const [isReconciled, setIsReconciled] = useState(false);
  const [basicSalaryOverride, setBasicSalaryOverride] = useState('');
  const [commissionOverride, setCommissionOverride] = useState('');
  const [linkedExpenseId, setLinkedExpenseId] = useState('');
  const [initialLinkedExpenseId, setInitialLinkedExpenseId] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [bookExpense, setBookExpense] = useState(true);
  const [employerNi, setEmployerNi] = useState('0.00');
  const [employerPension, setEmployerPension] = useState('0.00');
  const [employeeTaxNic, setEmployeeTaxNic] = useState('0.00');
  const [employeePension, setEmployeePension] = useState('0.00');
  const [reimbursementsInput, setReimbursementsInput] = useState('0.00');
  const [bonusOverride, setBonusOverride] = useState('0.00');
  const [bonusCurrency, setBonusCurrency] = useState('GBP');
  const [bonusAmountInput, setBonusAmountInput] = useState('0.00');
  const [reimbursementsCurrency, setReimbursementsCurrency] = useState('GBP');
  const [reimbursementsAmountInput, setReimbursementsAmountInput] = useState('0.00');
  const [reimbursementNominalCode, setReimbursementNominalCode] = useState('');
  const [reimbursementAllocation, setReimbursementAllocation] = useState<'company' | 'department' | 'staff'>('company');
  const [reimbursementDepartment, setReimbursementDepartment] = useState('');
  const [reimbursementItems, setReimbursementItems] = useState<ReimbursementItem[]>([]);
  const [splitFromTotalPaid, setSplitFromTotalPaid] = useState(true);

  const totalReimbursementsGBP = useMemo(() => {
    return reimbursementItems.reduce((sum, item) => {
      const amt = Number(item.amount) || 0;
      const rate = FX_RATES[item.currency] || 1.0;
      return sum + (amt * rate);
    }, 0);
  }, [reimbursementItems]);

  const derivedPureBasicSalary = useMemo(() => {
    if (!splitFromTotalPaid) {
      return Number(basicSalaryOverride) || 0;
    }
    const totalPaid = Number(basicSalaryOverride) || 0;
    const comm = Number(commissionOverride) || 0;
    const bonus = Number(bonusOverride) || 0;
    const reimbursements = totalReimbursementsGBP;
    const eeTax = Number(employeeTaxNic) || 0;
    const eePension = Number(employeePension) || 0;

    return Math.max(0, totalPaid - comm - bonus - reimbursements + eeTax + eePension);
  }, [splitFromTotalPaid, basicSalaryOverride, commissionOverride, bonusOverride, totalReimbursementsGBP, employeeTaxNic, employeePension]);

  const handleAddReimbursementItem = () => {
    const defaultReimburseNominal = nominalCodes.find(c => c.code?.toLowerCase().includes('travel') || c.code?.toLowerCase().includes('expense') || c.code?.toLowerCase().includes('reimburse'))?.code || (nominalCodes[0]?.code || '7400 - Travel & Entertaining');
    const defaultDept = selectedCell?.staffMember?.department || (allAvailableDepts[0] || 'Operations');
    setReimbursementItems(prev => [
      ...prev,
      {
        id: `reimb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: '',
        amount: '',
        currency: 'GBP',
        nominalCode: defaultReimburseNominal,
        allocation: 'company',
        department: defaultDept
      }
    ]);
  };

  const handleUpdateReimbursementItem = (id: string, updates: Partial<ReimbursementItem>) => {
    setReimbursementItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleRemoveReimbursementItem = (id: string) => {
    setReimbursementItems(prev => prev.filter(item => item.id !== id));
  };

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

  const companyOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Group Companies' },
      ...companies.map(c => ({ value: c.id, label: c.name }))
    ];
  }, [companies]);

  const departmentOptionsList = useMemo(() => {
    return [
      { value: 'all', label: 'All Departments' },
      ...allAvailableDepts.map(d => ({ value: d, label: d }))
    ];
  }, [allAvailableDepts]);

  const [showBulkReconcile, setShowBulkReconcile] = useState(false);
  const [bulkReconcileText, setBulkReconcileText] = useState('');
  const [bulkMatches, setBulkMatches] = useState<any[]>([]);
  const [selectedBulkMonth, setSelectedBulkMonth] = useState('2026-07');

  const handleAnalyzeBulkStatement = () => {
    if (!bulkReconcileText.trim()) {
      onShowToast("Please paste bank statement rows first.", "warning");
      return;
    }

    const lines = bulkReconcileText.split('\n');
    const matches: any[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[,\t]/);
      if (parts.length < 2) return;

      const rawName = parts[0].trim();
      const rawAmount = parts[1].replace(/[^0-9.]/g, '').trim();
      const parsedAmount = parseFloat(rawAmount);
      if (isNaN(parsedAmount)) return;

      const matchedStaff = filteredStaff.find(s => 
        s.fullName.toLowerCase().includes(rawName.toLowerCase()) ||
        rawName.toLowerCase().includes(s.fullName.toLowerCase())
      );

      if (matchedStaff) {
        const cell = getCellData(
          matchedStaff,
          selectedBulkMonth,
          payrollRecords,
          payrollPolicies,
          leaveRequests,
          holidays,
          staff,
          companies,
          placements,
          commissionPolicies
        );

        const projectedTotal = cell.total;
        const diff = Math.abs(projectedTotal - parsedAmount);
        const matchConfidence = diff <= 10 ? 'high' : diff <= 200 ? 'medium' : 'low';

        matches.push({
          index: idx,
          staffMember: matchedStaff,
          pastedName: rawName,
          pastedAmount: parsedAmount,
          projectedAmount: projectedTotal,
          diff: diff,
          confidence: matchConfidence,
          checked: matchConfidence === 'high',
          cellData: cell
        });
      }
    });

    setBulkMatches(matches);
    onShowToast(`Analyzed statement: identified ${matches.length} matching staff rows!`, "info");
  };

  const handleExecuteBulkReconcile = async () => {
    const selectedMatches = bulkMatches.filter(m => m.checked);
    if (selectedMatches.length === 0) {
      onShowToast("No matched rows selected for reconciliation.", "warning");
      return;
    }

    let successCount = 0;
    try {
      for (const match of selectedMatches) {
        const { staffMember, cellData, pastedAmount } = match;

        const recId = `payroll-${staffMember.id}-${selectedBulkMonth}`;
        const record = {
          id: recId,
          staffId: staffMember.id,
          month: selectedBulkMonth,
          isReconciled: true,
          basicSalaryOverride: cellData.basic,
          commissionOverride: cellData.commission,
          employerNi: cellData.employerNi,
          employerPension: cellData.employerPension,
          employeeTaxNic: cellData.employeeTaxNic,
          employeePension: cellData.employeePension,
          reimbursements: cellData.reimbursements,
          notes: `Reconciled via bulk bank statement matching. Statement amount: £${pastedAmount.toFixed(2)}.`
        };

        await onSavePayrollRecord(record);
        successCount++;
      }

      onShowToast(`Successfully reconciled ${successCount} staff payroll records!`, "success");
      setShowBulkReconcile(false);
      setBulkReconcileText('');
      setBulkMatches([]);
    } catch (err: any) {
      onShowToast(`Error saving bulk updates: ${err.message}`, "warning");
    }
  };

  const handleExportSage = () => {
    const headers = [
      'Month',
      'Employee Reference',
      'Employee Name',
      'Basic Pay (£)',
      'Commission (£)',
      'Gross Pay (£)',
      'Employer NI (£)',
      'Employer Pension (£)',
      'Employee Tax & NI Deduction (£)',
      'Employee Pension Deduction (£)',
      'Net Pay (£)'
    ];

    const rows: string[][] = [];

    filteredStaff.forEach(s => {
      MONTHS.forEach(m => {
        const cell = getCellData(
          s,
          m,
          payrollRecords,
          payrollPolicies,
          leaveRequests,
          holidays,
          staff,
          companies,
          placements,
          commissionPolicies
        );

        rows.push([
          m,
          s.id,
          s.fullName,
          cell.basic.toFixed(2),
          cell.commission.toFixed(2),
          cell.total.toFixed(2),
          cell.employerNi.toFixed(2),
          cell.employerPension.toFixed(2),
          cell.employeeTaxNic.toFixed(2),
          cell.employeePension.toFixed(2),
          (cell.total - cell.employeeTaxNic - cell.employeePension).toFixed(2)
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sage_Payroll_Ledger_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Sage payroll upload CSV file exported successfully.", "success");
  };

  const handleCellClick = (staffMember: Staff, month: string) => {
    const cell = getCellData(
      staffMember,
      month,
      payrollRecords,
      payrollPolicies,
      leaveRequests,
      holidays,
      staff,
      companies,
      placements,
      commissionPolicies
    );
    setSelectedCell({ staffMember, month });

    let autoReconciled = cell.isReconciled;
    let autoBasic = cell.basic;
    let autoExpenseId = '';
    let autoNotes = cell.notes;

    const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);

    if (cell.isReconciled) {
      autoExpenseId = record?.linkedExpenseId || '';
    } else {
      const matchedExpense = expenses.find(e => {
        const payeeLower = (e.payee || '').toLowerCase();
        const staffLower = (staffMember.fullName || '').toLowerCase();
        const isNameMatch = payeeLower.includes(staffLower) || staffLower.includes(payeeLower);
        const nom = (e.nominalCode || '').toLowerCase();
        const isSalaryNominal = nom.includes('salary') || nom.includes('wage') || nom.includes('500') || nom.includes('1001') || nom.includes('freelance');
        return isNameMatch && isSalaryNominal && e.plMonth === month && !e.linkedPayrollCellId;
      });
      if (matchedExpense) {
        autoReconciled = true;
        autoBasic = matchedExpense.amount;
        autoExpenseId = matchedExpense.id;
        autoNotes = `Auto-detected match: Linked to expense payment of £${matchedExpense.amount.toLocaleString()} on ${matchedExpense.date}. ${cell.notes}`.trim();
      }
    }

    const ukOverhead = getUkStaffOverhead(staffMember.id, month);
    if (ukOverhead && (!record || record.bonus === undefined)) {
      autoReconciled = true;
      autoBasic = ukOverhead.regularHours;
      if (!autoNotes) {
        autoNotes = `Humres UK Overhead: Bonus £${ukOverhead.bonus.toLocaleString()}, NI £${ukOverhead.employerNi.toLocaleString()}, Pension £${ukOverhead.royalLondon.toLocaleString()}`;
      }
    }

    const initialBonus = record?.bonus !== undefined ? Number(record.bonus) : (ukOverhead ? ukOverhead.bonus : (cell.bonus || 0));
    const initialNi = record?.employerNi !== undefined ? Number(record.employerNi) : (ukOverhead ? ukOverhead.employerNi : (cell.employerNi || 0));
    const initialPension = record?.employerPension !== undefined ? Number(record.employerPension) : (ukOverhead ? ukOverhead.royalLondon : (cell.employerPension || 0));

    setIsReconciled(autoReconciled);
    const isSplit = record?.splitFromTotalPaid !== undefined ? record.splitFromTotalPaid : true;
    setSplitFromTotalPaid(isSplit);

    let initialBasicVal = autoBasic;
    if (isSplit && record?.totalPaidAmount !== undefined) {
      initialBasicVal = record.totalPaidAmount;
    } else if (isSplit && record?.isReconciled && record?.basicSalary !== undefined) {
      initialBasicVal = (record.basicSalary || 0) + (record.commission || 0) + (record.bonus || 0) + (record.reimbursements || 0) - (record.employeeTaxNic || 0) - (record.employeePension || 0);
    }
    setBasicSalaryOverride(initialBasicVal.toFixed(2));
    setCommissionOverride(cell.commission.toFixed(2));
    setEmployerNi(initialNi.toFixed(2));
    setEmployerPension(initialPension.toFixed(2));
    setEmployeeTaxNic((cell.employeeTaxNic || 0).toFixed(2));
    setEmployeePension((cell.employeePension || 0).toFixed(2));
    setReimbursementsInput((cell.reimbursements || 0).toFixed(2));
    setBonusOverride(initialBonus.toFixed(2));
    
    setBonusCurrency(record?.bonusCurrency || 'GBP');
    setBonusAmountInput((record?.bonusAmountEntered !== undefined ? record.bonusAmountEntered : initialBonus).toFixed(2));
    setReimbursementsCurrency(record?.reimbursementsCurrency || 'GBP');
    setReimbursementsAmountInput((record?.reimbursementsAmountEntered !== undefined ? record.reimbursementsAmountEntered : (cell.reimbursements || 0)).toFixed(2));
    
    const defaultReimburseNominal = record?.reimbursementNominalCode || nominalCodes.find(c => c.code?.toLowerCase().includes('travel') || c.code?.toLowerCase().includes('expense') || c.code?.toLowerCase().includes('reimburse'))?.code || (nominalCodes[0]?.code || '7400 - Travel & Entertaining');
    const defaultReimburseDept = (record as any)?.reimbursementDepartment || staffMember.department || (allAvailableDepts[0] || 'Operations');
    setReimbursementNominalCode(defaultReimburseNominal);
    setReimbursementAllocation((record?.reimbursementAllocation as 'company' | 'department' | 'staff') || 'company');
    setReimbursementDepartment(defaultReimburseDept);

    let initialReimbItems: ReimbursementItem[] = [];
    if (record?.reimbursementItems && Array.isArray(record.reimbursementItems) && record.reimbursementItems.length > 0) {
      initialReimbItems = record.reimbursementItems.map((item: any, idx: number) => ({
        id: item.id || `reimb_${Date.now()}_${idx}`,
        description: item.description || '',
        amount: item.amount !== undefined ? item.amount : '',
        currency: item.currency || 'GBP',
        nominalCode: item.nominalCode || defaultReimburseNominal,
        allocation: item.allocation || 'company',
        department: item.department || defaultReimburseDept
      }));
    } else if (record?.reimbursementsAmountEntered !== undefined && Number(record.reimbursementsAmountEntered) > 0) {
      initialReimbItems = [{
        id: `reimb_${Date.now()}`,
        description: 'Staff expense reimbursement',
        amount: record.reimbursementsAmountEntered.toString(),
        currency: record.reimbursementsCurrency || 'GBP',
        nominalCode: record.reimbursementNominalCode || defaultReimburseNominal,
        allocation: (record.reimbursementAllocation as 'company' | 'department' | 'staff') || 'company',
        department: defaultReimburseDept
      }];
    } else if (cell.reimbursements && cell.reimbursements > 0) {
      initialReimbItems = [{
        id: `reimb_${Date.now()}`,
        description: 'Staff expense reimbursement',
        amount: cell.reimbursements.toString(),
        currency: 'GBP',
        nominalCode: defaultReimburseNominal,
        allocation: 'company',
        department: defaultReimburseDept
      }];
    }
    setReimbursementItems(initialReimbItems);

    setLinkedExpenseId(autoExpenseId);
    setInitialLinkedExpenseId(record?.linkedExpenseId || '');
    
    setReconcileNotes(autoNotes);
    setBookExpense(true);
  };

  const handleDownloadInvoice = (
    staffMember: Staff,
    monthKey: string,
    basic: number,
    commission: number,
    invoiceSubtype: 'base' | 'commission' = 'base'
  ) => {
    const isCommission = invoiceSubtype === 'commission';
    const amount = isCommission ? commission : basic;
    
    const invoiceNumber = `INV-${monthKey.replace('-', '')}-${staffMember.id.substring(0, 4).toUpperCase()}-${isCommission ? 'COMM' : 'BASE'}`;
    const invoiceDate = new Date().toISOString().split('T')[0];
    const companyName = companies.find(c => c.id === staffMember.companyId)?.name || 'Humres Technical Recruitment Ltd';
    
    const approvedLeaves = leaveRequests?.filter(req => 
      req.staffId === staffMember.id && 
      req.status === 'approved' && 
      req.startDate && 
      req.startDate.substring(0, 7) === monthKey
    ) || [];
    const leaveDays = approvedLeaves.reduce((sum, req) => sum + (Number(req.totalDays) || 0), 0);
    const totalBusinessDays = getBusinessDaysInMonth(monthKey, staffMember.companyId, holidays);
    const attendanceDays = Math.max(0, totalBusinessDays - leaveDays);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the invoice.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
          .invoice-box { max-width: 800px; margin: auto; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); padding: 30px; border-radius: 8px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; color: #1e3a8a; }
          .meta-info { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 13px; line-height: 1.6; }
          .meta-block { flex: 1; }
          .meta-block h3 { margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px; text-transform: uppercase; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .table th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: bold; text-align: left; padding: 12px; font-size: 13px; }
          .table td { border-bottom: 1px solid #e2e8f0; padding: 12px; font-size: 13px; color: #334155; }
          .totals-table { width: 300px; margin-left: auto; margin-bottom: 40px; }
          .totals-table td { padding: 8px 12px; font-size: 13px; }
          .totals-table tr.grand-total { font-weight: bold; font-size: 16px; color: #1e3a8a; background-color: #fef3c7; }
          .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
          .print-btn { background-color: #f59e0b; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; margin-bottom: 20px; display: inline-block; }
          .attendance-card { background-color: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 30px; font-size: 13px; }
          .attendance-card h4 { margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px; }
          .attendance-card ul { margin: 0; padding-left: 20px; line-height: 1.6; }
          @media print { .print-btn { display: none; } body { padding: 0; } .invoice-box { border: none; box-shadow: none; padding: 0; } }
        </style>
      </head>
      <body>
        <div style="text-align: center;">
          <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
        </div>
        <div class="invoice-box">
          <div class="header">
            <div>
              <h1 style="color: #f59e0b;">INVOICE</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Invoice #: ${invoiceNumber}</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; font-size: 18px; color: #334155;">${staffMember.fullName}</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">${staffMember.jobTitle || 'Freelance Contractor'}</p>
              <p style="margin: 3px 0 0 0; font-size: 13px; color: #64748b;">${staffMember.businessEmail || staffMember.personalEmail || ''}</p>
            </div>
          </div>
          <div class="meta-info">
            <div class="meta-block">
              <h3 style="color: #f59e0b;">Billed To:</h3>
              <strong>${companyName}</strong><br>Accounts Payable Department<br>Humres Group Head Office
            </div>
            <div class="meta-block" style="text-align: right;">
              <h3 style="color: #f59e0b;">Invoice Date:</h3>
              ${invoiceDate}<br><h3 style="color: #f59e0b; margin-top: 10px;">Billing Period:</h3>
              ${monthKey}
            </div>
          </div>

          ${!isCommission ? `
          <div class="attendance-card">
            <h4>🗓️ Attendance & Days Worked Summary</h4>
            <ul>
              <li><strong>Total Business Working Days in Month:</strong> ${totalBusinessDays} days</li>
              <li><strong>Days Off (Approved Leaves / Holidays):</strong> ${leaveDays} days</li>
              <li><strong>Actual Days Worked:</strong> ${attendanceDays} days</li>
            </ul>
          </div>
          ` : ''}

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">${isCommission ? '—' : 'Days Worked'}</th>
                <th style="text-align: right;">${isCommission ? '—' : 'Daily Rate'}</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${!isCommission ? `
              <tr>
                <td>
                  <strong>Professional Consulting Services (Base)</strong><br>
                  Base contractor attendance billing (computed from roster calendar business days minus approved leaves).
                </td>
                <td style="text-align: center;">${attendanceDays}</td>
                <td style="text-align: right;">£${((amount / (attendanceDays || 1))).toFixed(2)}</td>
                <td style="text-align: right;">£${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : `
              <tr>
                <td>
                  <strong>Recruiter Commission Payout</strong><br>
                  Commission share accrued for placement credits in the billing cycle ${monthKey}.
                </td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">—</td>
                <td style="text-align: right;">£${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              `}
            </tbody>
          </table>
          <table class="totals-table">
            <tr><td>Subtotal:</td><td style="text-align: right;">£${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr class="grand-total"><td>Total Due:</td><td style="text-align: right;">£${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
          </table>
          <div style="margin-top: 50px; font-size: 13px; color: #475569; background: #fffbeb; padding: 15px; border-radius: 6px; border: 1px solid #fef3c7;">
            <strong>Bank Remittance Account:</strong><br>Bank Name: Lloyds Bank plc<br>Account Name: ${staffMember.fullName}<br>Sort Code: 30-90-09<br>Account Number: 12345678
          </div>
          <div class="footer" style="margin-top: 60px;">
            Thank you for your business. For any billing queries, please contact ${staffMember.businessEmail || staffMember.personalEmail || 'the contractor directly'}.<br>Generated automatically via Humres Group Business Management Suite.
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSaveOverride = async () => {
    if (!selectedCell) return;
    const { staffMember, month } = selectedCell;

    const pureBasicVal = splitFromTotalPaid ? derivedPureBasicSalary : (Number(basicSalaryOverride) || 0);
    const totalPaidVal = Number(basicSalaryOverride) || 0;
    const commVal = Number(commissionOverride) || 0;
    const bonusVal = Number(bonusOverride) || 0;
    const empNiVal = Number(employerNi) || 0;
    const empPensionVal = Number(employerPension) || 0;
    const taxNicVal = Number(employeeTaxNic) || 0;
    const pensionVal = Number(employeePension) || 0;
    const reimbursementsVal = totalReimbursementsGBP;

    const record = {
      id: `${staffMember.id}_${month}`,
      staffId: staffMember.id,
      month,
      isReconciled,
      basicSalary: pureBasicVal,
      splitFromTotalPaid,
      totalPaidAmount: splitFromTotalPaid ? totalPaidVal : undefined,
      commission: commVal,
      reimbursements: reimbursementsVal,
      reimbursementItems,
      bonus: bonusVal,
      employerNi: empNiVal,
      employerPension: empPensionVal,
      employeeTaxNic: taxNicVal,
      employeePension: pensionVal,
      notes: reconcileNotes.trim(),
      linkedExpenseId: linkedExpenseId || '',
      bonusCurrency,
      bonusAmountEntered: Number(bonusAmountInput) || 0,
      reimbursementsCurrency: reimbursementItems.length === 1 ? reimbursementItems[0].currency : 'GBP',
      reimbursementsAmountEntered: reimbursementItems.length === 1 ? (Number(reimbursementItems[0].amount) || 0) : reimbursementsVal,
      reimbursementNominalCode: reimbursementItems.length === 1 ? reimbursementItems[0].nominalCode : (reimbursementNominalCode || ''),
      reimbursementAllocation: reimbursementItems.length === 1 ? reimbursementItems[0].allocation : (reimbursementAllocation || 'company'),
      reimbursementDepartment: reimbursementItems.length === 1 ? (reimbursementItems[0].department || '') : (reimbursementDepartment || '')
    };

    try {
      await onSavePayrollRecord(record);

      if (linkedExpenseId !== initialLinkedExpenseId) {
        if (initialLinkedExpenseId) {
          const oldExp = expenses.find(e => e.id === initialLinkedExpenseId);
          if (oldExp) {
            await onSaveExpense({
              ...oldExp,
              linkedPayrollCellId: null
            });
          }
        }
        if (linkedExpenseId) {
          const newExp = expenses.find(e => e.id === linkedExpenseId);
          if (newExp) {
            await onSaveExpense({
              ...newExp,
              linkedPayrollCellId: `${staffMember.id}_${month}`
            });
          }
        }
      } else if (linkedExpenseId) {
        const curExp = expenses.find(e => e.id === linkedExpenseId);
        if (curExp && curExp.linkedPayrollCellId !== `${staffMember.id}_${month}`) {
          await onSaveExpense({
            ...curExp,
            linkedPayrollCellId: `${staffMember.id}_${month}`
          });
        }
      }

      // Cleanup any previously booked reimbursement expenses for this staff member + month
      const existingReimburseExpenses = expenses.filter(e => e.id.startsWith(`payroll-reimburse-${staffMember.id}-${month}`));
      for (const exp of existingReimburseExpenses) {
        await onDeleteExpense(exp.id);
      }
      await onDeleteExpense(`payroll-reimburse-${staffMember.id}-${month}`);

      if (!isReconciled || !bookExpense) {
        await onDeleteExpense(`payroll-salary-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-tax-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-pension-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-exp-${staffMember.id}-${month}`);
      } else {
        const policy = payrollPolicies.find(p => p.id === staffMember.payrollPolicyId);
        const isFreelance = policy?.type === 'freelance' || (staffMember as any).employmentStatus === 'contractor' || (staffMember as any).employmentStatus === 'freelance' || (staffMember as any).contractType === 'contractor' || (staffMember as any).contractType === 'freelance';
        const freelanceNominal = policy?.nominalCode || nominalCodes.find(nc => nc.code?.toLowerCase().includes('freelance') || nc.code?.toLowerCase().includes('contractor') || nc.code?.toLowerCase().includes('subcontractor'))?.code || '1001 - Freelancer Payments';
        const standardSalaryNominal = nominalCodes.find(c => c.id === '500' || c.code?.includes('500') || c.code?.toLowerCase().includes('salary'))?.code || '500 - Salaries & Wages';
        const salaryNominal = isFreelance ? freelanceNominal : standardSalaryNominal;
        const taxNominal = nominalCodes.find(c => c.id === '501' || c.code?.includes('501') || c.code?.toLowerCase().includes('paye') || c.code?.toLowerCase().includes('tax') || c.code?.toLowerCase().includes('ni'))?.code || '501 - HMRC PAYE & NI Contributions';
        const pensionNominal = nominalCodes.find(c => c.id === '502' || c.code?.includes('502') || c.code?.toLowerCase().includes('pension'))?.code || '502 - Royal London Pension Contributions';

        // 1. Net Remuneration Expense (strictly basic + commission + bonus less employee deductions)
        const netSalaryAmt = pureBasicVal + commVal + bonusVal - taxNicVal - pensionVal;
        const netExp = {
          id: `payroll-salary-${staffMember.id}-${month}`,
          date: `${month}-28`,
          payee: `${isFreelance ? 'Freelancer Payment' : 'Net Salary'}: ${staffMember.fullName}`,
          amount: netSalaryAmt,
          currency: 'GBP',
          nominalCode: salaryNominal,
          allocationType: 'staff' as const,
          allocationTarget: [staffMember.id],
          plMonth: month,
          notes: `${isFreelance ? 'Freelancer net remuneration' : 'Net take-home pay'} (Basic + Commission + Bonus less deductions). Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
        };
        await onSaveExpense(netExp);

        // 2. Separate Reimbursement Expenses booked to individual nominal codes and allocation
        if (reimbursementItems && reimbursementItems.length > 0) {
          for (let idx = 0; idx < reimbursementItems.length; idx++) {
            const item = reimbursementItems[idx];
            const itemAmt = Number(item.amount) || 0;
            if (itemAmt <= 0) continue;

            const targetReimburseNominal = item.nominalCode || reimbursementNominalCode || nominalCodes.find(c => c.code?.toLowerCase().includes('travel') || c.code?.toLowerCase().includes('expense') || c.code?.toLowerCase().includes('reimburse'))?.code || '7400 - Travel & Entertaining';
            const itemDesc = item.description?.trim() ? `: ${item.description.trim()}` : '';

            let allocationType: 'company' | 'department' | 'staff' = 'company';
            let allocationTarget: string[] = [staffMember.companyId];
            let costNote = 'Company Overhead (Staff not burdened)';

            if (item.allocation === 'department') {
              allocationType = 'department';
              const targetDept = item.department || staffMember.department || (allAvailableDepts[0] || 'Operations');
              allocationTarget = [targetDept];
              costNote = `Department Overhead: ${targetDept} (Staff not burdened)`;
            } else if (item.allocation === 'staff') {
              allocationType = 'staff';
              allocationTarget = [staffMember.id];
              costNote = 'Staff Member (Direct personal P&L cost)';
            }

            const reimburseExp = {
              id: `payroll-reimburse-${staffMember.id}-${month}-${item.id || idx}`,
              date: `${month}-28`,
              payee: `Reimbursement${itemDesc} (${staffMember.fullName})`,
              amount: itemAmt,
              currency: item.currency || staffMember.currency || 'GBP',
              nominalCode: targetReimburseNominal,
              allocationType,
              allocationTarget,
              plMonth: month,
              notes: `Expense reimbursement for ${staffMember.fullName}${itemDesc ? ' - ' + item.description.trim() : ''}. Reconciled via Group Payroll Module. Cost absorbed by: ${costNote}. ${reconcileNotes.trim()}`
            };
            await onSaveExpense(reimburseExp);
          }
        }

        const totalHmrcAmt = empNiVal + taxNicVal;
        if (totalHmrcAmt > 0) {
          const taxExp = {
            id: `payroll-tax-${staffMember.id}-${month}`,
            date: `${month}-28`,
            payee: `HMRC PAYE & NI: ${staffMember.fullName}`,
            amount: totalHmrcAmt,
            currency: staffMember.currency || 'GBP',
            nominalCode: taxNominal,
            allocationType: 'staff' as const,
            allocationTarget: [staffMember.id],
            plMonth: month,
            notes: `HMRC payroll taxes (Employer NI: £${empNiVal.toFixed(2)}, Employee tax/NI deduction: £${taxNicVal.toFixed(2)}). Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
          };
          await onSaveExpense(taxExp);
        } else {
          await onDeleteExpense(`payroll-tax-${staffMember.id}-${month}`);
        }

        const totalPensionAmt = empPensionVal + pensionVal;
        if (totalPensionAmt > 0) {
          const pensionExp = {
            id: `payroll-pension-${staffMember.id}-${month}`,
            date: `${month}-28`,
            payee: `Royal London Pension: ${staffMember.fullName}`,
            amount: totalPensionAmt,
            currency: staffMember.currency || 'GBP',
            nominalCode: pensionNominal,
            allocationType: 'staff' as const,
            allocationTarget: [staffMember.id],
            plMonth: month,
            notes: `Royal London Pension contributions (Employer share: £${empPensionVal.toFixed(2)}, Employee deduction: £${pensionVal.toFixed(2)}). Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
          };
          await onSaveExpense(pensionExp);
        } else {
          await onDeleteExpense(`payroll-pension-${staffMember.id}-${month}`);
        }
      }

      onShowToast(`Payroll details and double-entry split ledger records saved for ${staffMember.fullName} (${month})`, 'success');
      setSelectedCell(null);
    } catch (err: any) {
      onShowToast(`Error saving overrides: ${err.message}`, 'warning');
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      // If recruiter, only see themselves
      if (isRecruiter && s.id !== currentUser?.id) return false;

      const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (s.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompany = selectedCompanyId.includes('all') || selectedCompanyId.includes(s.companyId);
      const matchesDept = selectedDept.includes('all') || selectedDept.includes(s.department || '');
      
      if (selectedStatus !== 'all') {
        const cellStatuses = MONTHS.map(m => getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies).isReconciled);
        const hasReconciled = cellStatuses.some(status => status === true);
        if (selectedStatus === 'reconciled' && !hasReconciled) return false;
        if (selectedStatus === 'projected' && hasReconciled && cellStatuses.every(status => status === true)) return false;
      }

      if (!isRecruiter && selectedInvoiceStatusFilter !== 'all') {
        const hasSubmitted = MONTHS.some(m => {
          const record = payrollRecords.find(r => r.staffId === s.id && r.month === m);
          return !!record?.invoicesSubmitted && !record?.isReconciled;
        });
        const hasPending = MONTHS.some(m => {
          const record = payrollRecords.find(r => r.staffId === s.id && r.month === m);
          return !record?.invoicesSubmitted && !record?.isReconciled;
        });

        if (selectedInvoiceStatusFilter === 'submitted' && !hasSubmitted) return false;
        if (selectedInvoiceStatusFilter === 'pending' && !hasPending) return false;
      }

      return matchesSearch && matchesCompany && matchesDept;
    });
  }, [staff, searchTerm, selectedCompanyId, selectedDept, selectedStatus, selectedInvoiceStatusFilter, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies, isRecruiter, currentUser]);

  const activeStaffList = useMemo(() => filteredStaff.filter(s => s.status !== 'exited'), [filteredStaff]);
  const exitedStaffList = useMemo(() => filteredStaff.filter(s => s.status === 'exited'), [filteredStaff]);

  const groupedRoster = useMemo(() => {
    const roster: Record<string, Record<string, Staff[]>> = {};
    activeStaffList.forEach(s => {
      const compId = s.companyId || 'unassigned';
      const dept = s.department || 'Other';

      if (!roster[compId]) roster[compId] = {};
      if (!roster[compId][dept]) roster[compId][dept] = [];
      roster[compId][dept].push(s);
    });
    return roster;
  }, [activeStaffList]);

  const monthlyTotals = useMemo(() => {
    return MONTHS.map(m => {
      let totalBasic = 0;
      let totalComm = 0;
      let totalPaid = 0;
      let countReconciled = 0;

      filteredStaff.forEach(s => {
        const data = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
        totalBasic += data.basic;
        totalComm += data.commission;
        totalPaid += data.total;
        if (data.isReconciled) countReconciled++;
      });

      return {
        month: m,
        basic: totalBasic,
        commission: totalComm,
        total: totalPaid,
        reconciledCount: countReconciled
      };
    });
  }, [filteredStaff, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies]);

  const renderRowCells = (s: Staff) => {
    let annualSum = 0;
    return (
      <>
        {MONTHS.map(m => {
          const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
          const ukOverhead = getUkStaffOverhead(s.id, m);
          
          let isReconciled = cell.isReconciled;
          let displayTotal = cell.total;
          let displayBasic = cell.basic;
          
          const targetId = `${s.id}_${m}`;
          const record = payrollRecords.find(r => r.id === targetId);

          if (!isReconciled) {
            const matchedExpense = expenses.find(e => {
              const payeeLower = (e.payee || '').toLowerCase();
              const staffLower = (s.fullName || '').toLowerCase();
              const isNameMatch = payeeLower.includes(staffLower) || staffLower.includes(payeeLower);
              const nom = (e.nominalCode || '').toLowerCase();
              const isSalaryNominal = nom.includes('salary') || nom.includes('wage') || nom.includes('500') || nom.includes('1001') || nom.includes('freelance');
              return isNameMatch && isSalaryNominal && e.plMonth === m && !e.linkedPayrollCellId;
            });
            if (matchedExpense) {
              isReconciled = true;
              displayTotal = matchedExpense.amount + cell.commission;
              displayBasic = matchedExpense.amount;
            }
          }

          annualSum += displayTotal;
          const isSubmitted = !!record?.invoicesSubmitted;

          const cellTitle = ukOverhead 
            ? formatOverheadTitle(ukOverhead, 'Click to edit override')
            : `${s.fullName} - ${m}
Salary (Gross): £${Math.round(displayBasic).toLocaleString()}
Comm: £${Math.round(cell.commission).toLocaleString()}
${cell.bonus > 0 ? `Bonus: £${Math.round(cell.bonus).toLocaleString()}\n` : ''}${cell.reimbursements > 0 ? `Reimbursements: £${Math.round(cell.reimbursements).toLocaleString()}\n` : ''}${cell.employerNi > 0 ? `Employer NI: £${Math.round(cell.employerNi).toLocaleString()}\n` : ''}${cell.employerPension > 0 ? `Employer Pension: £${Math.round(cell.employerPension).toLocaleString()}\n` : ''}${cell.employeeTaxNic > 0 ? `Employee Tax/NIC: £${Math.round(cell.employeeTaxNic).toLocaleString()}\n` : ''}${cell.employeePension > 0 ? `Employee Pension: £${Math.round(cell.employeePension).toLocaleString()}\n` : ''}Click to edit override`;

          const effectiveBonus = ukOverhead ? ukOverhead.bonus : cell.bonus;

          return (
            <td 
              key={m}
              onClick={() => handleCellClick(s, m)}
              style={{ 
                textAlign: 'center', 
                cursor: 'pointer', 
                fontSize: '11px',
                fontWeight: isReconciled ? 600 : 400,
                position: 'relative',
                transition: 'all 0.15s'
              }}
              className={`payroll-cell ${isReconciled ? 'reconciled' : 'projected'}`}
              title={cellTitle}
            >
              <WithOverheadTooltip item={ukOverhead} position="bottom">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span>£{Math.round(displayTotal).toLocaleString()}</span>
                  {effectiveBonus > 0 ? (
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '2px', 
                        fontSize: '8px', 
                        fontWeight: 700, 
                        color: '#059669', 
                        backgroundColor: 'rgba(16, 185, 129, 0.12)', 
                        padding: '1px 4px', 
                        borderRadius: '3px' 
                      }}
                      title={`Bonus: £${Number(effectiveBonus).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    >
                      🎁 +£{Math.round(effectiveBonus).toLocaleString()}
                    </span>
                  ) : isReconciled ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontSize: '8px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                      <CheckCircle2 size={7} /> Paid
                    </span>
                  ) : isSubmitted ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontSize: '8px', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1px 4px', borderRadius: '3px' }} title={`Invoices submitted on ${new Date(record.invoicesSubmittedAt || '').toLocaleString()}`}>
                      📤 Submitted
                    </span>
                  ) : (
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Proj</span>
                  )}
                </div>
              </WithOverheadTooltip>
            </td>
          );
        })}
        <td style={{ 
          textAlign: 'right', 
          fontWeight: 700, 
          fontFamily: 'monospace', 
          borderLeft: '2px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          fontSize: '12px',
          paddingRight: '12px'
        }}>
          £{Math.round(annualSum).toLocaleString()}
        </td>
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {isRecruiter && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>📤 Monthly Invoice Submission Checklist</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Verify your calculated basic salary, commissions, and reimbursements before sending to the accounts team.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Select Month:</span>
              <select
                className="select-filter"
                value={recruiterSelectedMonth}
                onChange={(e) => setRecruiterSelectedMonth(e.target.value)}
                style={{ padding: '6px 12px' }}
              >
                {MONTHS.map(m => {
                  const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          {(() => {
            const recruiterStaff = staff.find(s => s.id === currentUser?.id);
            if (!recruiterStaff) return <p style={{ color: 'var(--danger)', fontSize: '12px' }}>Error: Recruiter staff profile not found.</p>;

            const cell = getCellData(
              recruiterStaff,
              recruiterSelectedMonth,
              payrollRecords,
              payrollPolicies,
              leaveRequests,
              holidays,
              staff,
              companies,
              placements,
              commissionPolicies
            );

            const targetId = `${currentUser.id}_${recruiterSelectedMonth}`;
            const record = payrollRecords.find(r => r.id === targetId);

            const staffExpenses = expenses.filter(e => {
              const matchStaff = e.recipientId === currentUser?.id;
              const matchMonth = e.plMonth === recruiterSelectedMonth;
              return matchStaff && matchMonth;
            });
            const dynamicReimbursements = staffExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            
            const salaryVal = cell.basic;
            const commissionVal = cell.commission;
            const reimbursementsVal = record?.isReconciled ? (record.reimbursements || 0) : dynamicReimbursements;
            const bonusVal = record?.bonus || 0;
            const currencySymbol = symbolMap[recruiterStaff.currency || 'GBP'] || '£';

            const totalPay = salaryVal + commissionVal + reimbursementsVal + bonusVal;

            const isSubmitted = !!record?.invoicesSubmitted;
            const submittedAt = record?.invoicesSubmittedAt;

            const handleSendInvoices = async () => {
              setSubmittingInvoices(true);
              try {
                const monthLabel = new Date(recruiterSelectedMonth + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                const subject = `[Payroll Invoices] Submitted by ${recruiterStaff.fullName} - ${monthLabel}`;
                
                // Helper to generate professional PDF invoice bytes
                const createPdfBase64 = (invoiceTitle, pdfItems, currencySym, totalSum) => {
                  const doc = new jsPDF();
                  
                  // Primary Header Brand Color
                  doc.setFillColor(15, 23, 42); // slate-900 dark slate
                  doc.rect(0, 0, 210, 40, 'F');
                  
                  doc.setTextColor(255, 255, 255);
                  doc.setFont("Helvetica", "bold");
                  doc.setFontSize(18);
                  doc.text(invoiceTitle, 20, 26);
                  
                  // Meta details section
                  doc.setTextColor(71, 85, 105);
                  doc.setFont("Helvetica", "normal");
                  doc.setFontSize(10);
                  doc.text(`Employee Name:  ${recruiterStaff.fullName}`, 20, 55);
                  doc.text(`Job Title:      ${recruiterStaff.jobTitle || 'Recruiter'}`, 20, 62);
                  doc.text(`Billing Month:  ${monthLabel}`, 20, 69);
                  doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, 76);
                  
                  // Separation Line
                  doc.setDrawColor(226, 232, 240);
                  doc.setLineWidth(0.5);
                  doc.line(20, 83, 190, 83);
                  
                  // Table headers
                  doc.setFont("Helvetica", "bold");
                  doc.setTextColor(15, 23, 42);
                  doc.text("Line Description", 20, 93);
                  doc.text("Amount Due", 150, 93);
                  
                  doc.line(20, 98, 190, 98);
                  
                  // Table contents
                  doc.setFont("Helvetica", "normal");
                  doc.setTextColor(51, 65, 85);
                  let y = 108;
                  pdfItems.forEach(item => {
                    const splitDesc = doc.splitTextToSize(item.description, 110);
                    doc.text(splitDesc, 20, y);
                    doc.text(`${currencySym}${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 150, y);
                    y += 10 + (splitDesc.length - 1) * 5;
                  });
                  
                  doc.line(20, y - 5, 190, y - 5);
                  
                  // Sum total
                  doc.setFont("Helvetica", "bold");
                  doc.setTextColor(15, 23, 42);
                  doc.text("Total Payout Amount:", 20, y + 5);
                  doc.text(`${currencySym}${Number(totalSum).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 150, y + 5);
                  
                  // Branded footer
                  doc.setFont("Helvetica", "italic");
                  doc.setFontSize(8);
                  doc.setTextColor(148, 163, 184);
                  doc.text("This invoice is automatically compiled and submitted via the Humres Management Platform.", 20, 275);
                  
                  return doc.output('datauristring').split(',')[1];
                };

                // 1. Generate Salary Invoice PDF
                const salaryItems = [
                  { description: `Monthly Basic Salary Payout (${recruiterStaff.currency || 'GBP'})`, amount: salaryVal }
                ];
                const salaryBase64 = createPdfBase64("BASIC SALARY INVOICE", salaryItems, currencySymbol, salaryVal);

                // 2. Generate Commissions Invoice PDF
                const commissionPolicy = commissionPolicies.find(p => p.id === recruiterStaff.commissionPolicyId);
                let targetStaffIds = [recruiterStaff.id];
                if (commissionPolicy?.type === 'manager') {
                  if (commissionPolicy.assignedDepartments && commissionPolicy.assignedDepartments.length > 0) {
                    const deptStaff = staff.filter(s => commissionPolicy.assignedDepartments.includes(s.department));
                    targetStaffIds = Array.from(new Set([recruiterStaff.id, ...deptStaff.map(s => s.id)]));
                  } else {
                    const teamMembers = staff.filter(s => {
                      const mgrIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
                      return mgrIds.includes(recruiterStaff.id);
                    });
                    targetStaffIds = [recruiterStaff.id, ...teamMembers.map(s => s.id)];
                  }
                }

                const activeSplits = [];
                placements.forEach(p => {
                  if (!p.startDate || p.status === 'dns') return;
                  const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
                    const d = new Date(p.startDate);
                    d.setMonth(d.getMonth() + 1);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  })();
                  if (pMonth !== recruiterSelectedMonth) return;
                  p.splits?.forEach(s => {
                    if (targetStaffIds.includes(s.staffId)) {
                      activeSplits.push({
                        description: `Split share (${s.percentage}%) on Placement ${p.placementId} (Cand: ${p.candidateName}, Client: ${p.clientCompany})`,
                        amount: (p.netScoreValue * s.percentage) / 100
                      });
                    }
                  });
                });

                if (activeSplits.length === 0) {
                  activeSplits.push({ description: 'No placement splits registered this month', amount: 0 });
                }
                const commissionBase64 = createPdfBase64("SALES COMMISSIONS INVOICE", activeSplits, "£", commissionVal);

                // 3. Generate Reimbursements Invoice PDF
                const expenseItems = staffExpenses.map(e => ({
                  description: `${e.date} - ${e.description || e.payee} (${e.nominalCode})`,
                  amount: e.amount
                }));
                if (expenseItems.length === 0) {
                  expenseItems.push({ description: 'No approved expense reimbursement claims this month', amount: 0 });
                }
                const reimbursementsBase64 = createPdfBase64("APPROVED EXPENSES REIMBURSEMENT", expenseItems, "£", reimbursementsVal);

                // Construct Graph API Attachments array
                const attachments = [
                  {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": `Salary_Invoice_${recruiterStaff.fullName.replace(/\s+/g, '_')}_${recruiterSelectedMonth}.pdf`,
                    "contentType": "application/pdf",
                    "contentBytes": salaryBase64
                  },
                  {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": `Commissions_Invoice_${recruiterStaff.fullName.replace(/\s+/g, '_')}_${recruiterSelectedMonth}.pdf`,
                    "contentType": "application/pdf",
                    "contentBytes": commissionBase64
                  },
                  {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": `Reimbursements_Invoice_${recruiterStaff.fullName.replace(/\s+/g, '_')}_${recruiterSelectedMonth}.pdf`,
                    "contentType": "application/pdf",
                    "contentBytes": reimbursementsBase64
                  }
                ];

                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; max-width: 600px;">
                    <h2 style="color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 8px;">Recruiter Payroll Invoice Submission</h2>
                    <p>Dear Accounts Team,</p>
                    <p>My monthly payroll details and invoice packet for <strong>${monthLabel}</strong> has been reviewed and submitted for processing. Please find the three detailed invoice PDFs attached.</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 16px 0;">
                      <strong style="display: block; margin-bottom: 8px; color: #1e293b;">Invoice Components Summary:</strong>
                      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tbody>
                          <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; color: #475569;">1. Basic Salary Invoice (${recruiterStaff.currency || 'GBP'})</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${currencySymbol}${salaryVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; color: #475569;">2. Commissions Invoice (GBP)</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold;">£${commissionVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; color: #475569;">3. Approved Reimbursements Invoice (GBP)</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold;">£${reimbursementsVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          ${bonusVal > 0 ? `
                          <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; color: #475569;">4. Additional Management Bonus (GBP)</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: bold;">£${bonusVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                          ` : ''}
                          <tr style="font-size: 14px; font-weight: bold;">
                            <td style="padding: 12px 0 0 0; color: #0f172a;">Estimated Total Gross Payout</td>
                            <td style="padding: 12px 0 0 0; text-align: right; color: #6366f1;">£${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p>Please reconcile and release payout. You can check the submitted checklist inside the Group Payroll dashboard.</p>
                    <p>Best regards,<br><strong>${recruiterStaff.fullName}</strong></p>
                  </div>
                `;

                const invoiceRecipients = reminderSettings?.payrollInvoiceEmails || 'groupadmin@globalrecruiters.ae';

                const emailRes = await fetch('/api/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    recipient: invoiceRecipients,
                    subject: subject,
                    body: emailHtml,
                    attachments: attachments,
                    triggerType: 'recruiter-invoice-packet'
                  })
                });
                
                if (!emailRes.ok) {
                  throw new Error(`Failed to send email (status ${emailRes.status})`);
                }

                const updatedRecord = {
                  id: targetId,
                  staffId: currentUser.id,
                  month: recruiterSelectedMonth,
                  basicSalary: cell.basic,
                  commission: cell.commission,
                  reimbursements: reimbursementsVal,
                  isReconciled: record ? record.isReconciled : false,
                  employerNi: cell.employerNi,
                  employerPension: cell.employerPension,
                  employeeTaxNic: cell.employeeTaxNic,
                  employeePension: cell.employeePension,
                  invoicesSubmitted: true,
                  invoicesSubmittedAt: new Date().toISOString(),
                  notes: record?.notes || 'Invoices submitted by recruiter.'
                };
                await onSavePayrollRecord(updatedRecord);

                onShowToast("📤 Invoice packet sent to accounts successfully!", "success");
              } catch (err: any) {
                console.error(err);
                onShowToast(`Submission failed: ${err.message}`, "warning");
              } finally {
                setSubmittingInvoices(false);
              }
            };

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  
                  <div 
                    onClick={() => setDetailBreakdownType('salary')}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    className="hover-card"
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>1. Basic Salary</span>
                    <h3 style={{ margin: '8px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {currencySymbol}{salaryVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ● Calculated (Local Currency)
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>🔍 Details</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setDetailBreakdownType('commission')}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    className="hover-card"
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>2. Sales Commissions</span>
                    <h3 style={{ margin: '8px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      £{commissionVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--success)' }}>
                        ● Auto-calculated from placements
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>🔍 Details</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setDetailBreakdownType('expenses')}
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    className="hover-card"
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>3. Approved Expenses</span>
                    <h3 style={{ margin: '8px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      £{reimbursementsVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: reimbursementsVal > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        ● {reimbursementsVal > 0 ? 'Approved claims found' : 'No claims this month'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>🔍 Details</span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginTop: '4px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Submission Status:</span>
                    {isSubmitted ? (
                      <span style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        color: 'var(--success)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <CheckCircle2 size={14} /> Submitted on {new Date(submittedAt || '').toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 700
                      }}>
                        ⏳ Pending Submission
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSubmitted || submittingInvoices}
                    onClick={handleSendInvoices}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isSubmitted ? 'not-allowed' : 'pointer',
                      opacity: isSubmitted ? 0.6 : 1
                    }}
                  >
                    {submittingInvoices ? 'Submitting...' : isSubmitted ? 'Invoices Sent to Accounts' : '📤 Send Invoice Packet'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Control Filter Bar */}
      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search staff name..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!isRecruiter && (
            <>
              <MultiSelectFilter
                options={companyOptions}
                selectedValues={selectedCompanyId}
                onChange={(vals: string[]) => {
                  setSelectedCompanyId(vals);
                  setSelectedDept(['all']);
                }}
                placeholder="Select Companies"
              />

              <MultiSelectFilter
                options={departmentOptionsList}
                selectedValues={selectedDept}
                onChange={(vals: string[]) => setSelectedDept(vals)}
                placeholder="Select Departments"
              />
            </>
          )}

          <select 
            className="select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Cell Statuses</option>
            <option value="reconciled">Has Reconciled Months</option>
            <option value="projected">Projections Only</option>
          </select>

          {!isRecruiter && (
            <select 
              className="select-filter"
              value={selectedInvoiceStatusFilter}
              onChange={(e) => setSelectedInvoiceStatusFilter(e.target.value)}
            >
              <option value="all">All Submission Statuses</option>
              <option value="submitted">Invoices Submitted</option>
              <option value="pending">Awaiting Invoices</option>
            </select>
          )}

          {!isRecruiter && (
            <>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowBulkReconcile(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '10px 14px', marginLeft: 'auto' }}
              >
                ⚡ Bulk Reconcile Statement
              </button>

              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleExportSage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '10px 14px' }}
              >
                ⚡ Export Sage Payroll CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Roster Spreadsheet Scroll Grid */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table className="entity-table dense" style={{ minWidth: '1600px', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={{ width: '220px', minWidth: '220px', left: 0, position: 'sticky', backgroundColor: 'var(--bg-secondary)', zIndex: 12, borderRight: '2px solid var(--border-color)' }}>
                Staff Member
              </th>
              <th style={{ width: '130px', minWidth: '130px', borderRight: '1px solid var(--border-color)' }}>
                Basic Salary (Base)
              </th>
              {MONTHS.map(m => {
                const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                return (
                  <th key={m} style={{ textAlign: 'center', minWidth: '100px' }}>{label}</th>
                );
              })}
              <th style={{ width: '130px', minWidth: '130px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid var(--border-color)' }}>
                Annual Total (£)
              </th>
            </tr>
          </thead>
          <tbody>
            {companies
              .filter(c => selectedCompanyId.includes('all') || selectedCompanyId.includes(c.id))
              .map(c => {
                const depts = groupedRoster[c.id];
                if (!depts || Object.keys(depts).length === 0) return null;

                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                      <td colSpan={MONTHS.length + 3} style={{ fontWeight: 700, padding: '8px 12px', fontSize: '11px', color: 'var(--accent)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={12} />
                          {c.name.toUpperCase()} ({c.country})
                        </div>
                      </td>
                    </tr>

                    {Object.keys(depts)
                      .filter(d => selectedDept.includes('all') || selectedDept.includes(d))
                      .map(d => {
                        const members = depts[d];
                        if (members.length === 0) return null;

                        return (
                          <React.Fragment key={d}>
                            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                              <td colSpan={MONTHS.length + 3} style={{ fontWeight: 600, padding: '6px 16px', fontSize: '10px', color: 'var(--text-secondary)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Layers size={10} />
                                  {d} Team
                                </div>
                              </td>
                            </tr>

                            {members.map(s => {
                              const symbol = symbolMap[s.currency || 'GBP'] || '£';
                              return (
                                <tr key={s.id}>
                                  <td style={{ 
                                    left: 0, 
                                    position: 'sticky', 
                                    backgroundColor: 'var(--bg-card)', 
                                    zIndex: 6, 
                                    borderRight: '2px solid var(--border-color)',
                                    padding: '8px 12px' 
                                  }}>
                                    <div style={{ fontWeight: 600, fontSize: '12px' }}>
                                      {s.fullName}
                                      {s.status === 'exited' && (
                                        <span style={{ marginLeft: '4px', fontSize: '8px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 3px', borderRadius: '3px' }}>Exited</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.jobTitle}</div>
                                  </td>
                                  <td style={{ fontSize: '11px', borderRight: '1px solid var(--border-color)' }}>
                                    {symbol}{Number(s.salary).toLocaleString()} / yr
                                  </td>
                                  {renderRowCells(s)}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}

            {exitedStaffList.length > 0 && (
              <>
                <tr 
                  onClick={() => setShowExitedRoster(!showExitedRoster)}
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)', cursor: 'pointer', userSelect: 'none' }}
                >
                  <td colSpan={MONTHS.length + 3} style={{ fontWeight: 700, padding: '10px 12px', fontSize: '11px', color: 'var(--danger)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ marginRight: '6px' }}>{showExitedRoster ? '▼' : '▶'}</span>
                      EXITED STAFF ({exitedStaffList.length})
                    </div>
                  </td>
                </tr>

                {showExitedRoster && exitedStaffList.map(s => {
                  const symbol = symbolMap[s.currency || 'GBP'] || '£';
                  return (
                    <tr key={s.id} style={{ opacity: 0.75 }}>
                      <td style={{ 
                        left: 0, 
                        position: 'sticky', 
                        backgroundColor: 'var(--bg-card)', 
                        zIndex: 6, 
                        borderRight: '2px solid var(--border-color)',
                        padding: '8px 12px' 
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '12px' }}>
                          {s.fullName}
                          <span style={{ marginLeft: '4px', fontSize: '8px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 3px', borderRadius: '3px' }}>Exited</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.jobTitle}</div>
                      </td>
                      <td style={{ fontSize: '11px', borderRight: '1px solid var(--border-color)' }}>
                        {symbol}{Number(s.salary).toLocaleString()} / yr
                      </td>
                      {renderRowCells(s)}
                    </tr>
                  );
                })}
              </>
            )}

            {/* Matrix totals Row */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700 }}>
              <td style={{ left: 0, position: 'sticky', backgroundColor: 'var(--bg-secondary)', zIndex: 8, borderRight: '2px solid var(--border-color)', padding: '12px' }}>
                GROUP TOTALS COST
              </td>
              <td style={{ borderRight: '1px solid var(--border-color)' }}>—</td>
              {monthlyTotals.map((tot, idx) => (
                <td key={idx} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '11px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span>£{Math.round(tot.total).toLocaleString()}</span>
                    <span style={{ fontSize: '8px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      Recon: {tot.reconciledCount}
                    </span>
                  </div>
                </td>
              ))}
              <td style={{ textAlign: 'right', borderLeft: '2px solid var(--border-color)', fontSize: '12px', fontFamily: 'monospace', paddingRight: '12px' }}>
                £{Math.round(monthlyTotals.reduce((sum, t) => sum + t.total, 0)).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Spreadsheet Override Modal */}
      {selectedCell !== null && (
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
            width: '95%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  {isRecruiter ? '📋 My Payout Breakdown' : '📝 Payroll Override & Reconciliation'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedCell.staffMember.fullName} &bull; {selectedCell.month}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedCell(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const targetId = `${selectedCell.staffMember.id}_${selectedCell.month}`;
                const record = payrollRecords.find(r => r.id === targetId);
                if (record?.invoicesSubmitted) {
                  return (
                    <div style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.06)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📤 Invoices Submitted by Recruiter</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Sent on: {new Date(record.invoicesSubmittedAt || '').toLocaleString()}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px', 
                backgroundColor: 'var(--bg-secondary)', 
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>Mark Month Reconciled / Paid</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Overwrites baseline formulas and locks cell payout</div>
                </div>
                <input 
                  type="checkbox"
                  checked={isReconciled}
                  onChange={(e) => setIsReconciled(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  🔗 Reconcile with Expense Ledger Payment
                </label>
                {(() => {
                  const unlinkedExpenses = expenses.filter(e => {
                    if (e.id === linkedExpenseId) return true;
                    if (e.linkedPayrollCellId) return false;
                    
                    const nom = (e.nominalCode || '').toLowerCase();
                    const payeeLower = (e.payee || '').toLowerCase();
                    const staffLower = (selectedCell.staffMember.fullName || '').toLowerCase();
                    
                    const isSalaryNominal = nom.includes('salary') || nom.includes('wage') || nom.includes('500') || nom.includes('director');
                    const isContractorNominal = nom.includes('contractor') || nom.includes('freelance') || nom.includes('consult');
                    const isStaffNameMatch = payeeLower.includes(staffLower) || staffLower.includes(payeeLower);

                    return isSalaryNominal || isContractorNominal || isStaffNameMatch;
                  });

                  return (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="select-filter"
                        value={linkedExpenseId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLinkedExpenseId(val);
                          if (val) {
                            const expMatched = expenses.find(item => item.id === val);
                            if (expMatched) {
                              setIsReconciled(true);
                              setSplitFromTotalPaid(true);
                              setBasicSalaryOverride(expMatched.amount.toFixed(2));
                              setCommissionOverride('0.00');
                              setReconcileNotes(prev => `Linked to payment: ${expMatched.payee.split(' [Ref:')[0]} on ${expMatched.date}. ${prev}`);
                              setBookExpense(false);
                            }
                          }
                        }}
                        style={{ flex: 1, padding: '8px', fontSize: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                      >
                        <option value="">-- Select payment to reconcile --</option>
                        {unlinkedExpenses.map(e => (
                          <option key={e.id} value={e.id}>
                            [{e.date}] {e.payee.split(' [Ref:')[0]} - £{e.amount.toLocaleString()} ({e.nominalCode})
                          </option>
                        ))}
                      </select>
                      {linkedExpenseId && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => {
                            setLinkedExpenseId('');
                            setBookExpense(true);
                          }}
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Reconciliation Input Mode Selector */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setSplitFromTotalPaid(true)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontSize: '11px',
                      fontWeight: splitFromTotalPaid ? 700 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: splitFromTotalPaid ? 'var(--primary)' : 'transparent',
                      color: splitFromTotalPaid ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ⚡ Total Paid is Split (Remittance)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitFromTotalPaid(false)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      fontSize: '11px',
                      fontWeight: !splitFromTotalPaid ? 700 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: !splitFromTotalPaid ? 'var(--primary)' : 'transparent',
                      color: !splitFromTotalPaid ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ➕ Additive Components (Base + Extra)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {splitFromTotalPaid ? 'Total Remittance / Payment to Staff (£ GBP)' : 'Basic Salary Component (£ GBP)'} <span>*</span>
                    </span>
                    {splitFromTotalPaid && (
                      <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', padding: '1px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        Auto-Carves Bonus & Reimbursements
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                    {splitFromTotalPaid 
                      ? 'Total lump-sum paid to staff via bank transfer. Bonus & reimbursements below are carved out of this total.' 
                      : 'Standard monthly baseline contract rate / salary'}
                  </span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={basicSalaryOverride}
                  onChange={(e) => setBasicSalaryOverride(e.target.value)}
                  disabled={isRecruiter}
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />

                {/* Split Calculation Breakdown Helper */}
                {splitFromTotalPaid && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)', 
                    backgroundColor: 'var(--bg-secondary)', 
                    fontSize: '11px' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      <span>Total Remitted Amount:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>£{(Number(basicSalaryOverride) || 0).toFixed(2)}</span>
                    </div>
                    {totalReimbursementsGBP > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Less Reimbursements ({reimbursementItems.length} items):</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>-£{totalReimbursementsGBP.toFixed(2)}</span>
                      </div>
                    )}
                    {Number(bonusOverride) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Less Bonus Component:</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>-£{Number(bonusOverride).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(commissionOverride) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Less Commission Component:</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>-£{Number(commissionOverride).toFixed(2)}</span>
                      </div>
                    )}
                    {(Number(employeeTaxNic) > 0 || Number(employeePension) > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Add Back Employee Deductions:</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>+£{(Number(employeeTaxNic) + Number(employeePension)).toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      borderTop: '1px dashed var(--border-color)', 
                      paddingTop: '5px', 
                      marginTop: '4px',
                      fontWeight: 700 
                    }}>
                      <span>Derived Pure Basic Salary:</span>
                      <span style={{ color: derivedPureBasicSalary <= 0 && (Number(basicSalaryOverride) || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        £{derivedPureBasicSalary.toFixed(2)}
                      </span>
                    </div>
                    {derivedPureBasicSalary <= 0 && (Number(basicSalaryOverride) || 0) > 0 && (
                      <div style={{ color: 'var(--danger)', fontSize: '10px', marginTop: '3px' }}>
                        ⚠️ Warning: Bonus & reimbursements exceed or equal total payment!
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Commission Component (£ GBP) <span>*</span></span>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>Add sales recruiter commission element</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={commissionOverride}
                  onChange={(e) => setCommissionOverride(e.target.value)}
                  disabled={isRecruiter}
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />
                {!isRecruiter && (() => {
                  const commWritten = calculateCommissionForRecruiter(selectedCell.staffMember.id, selectedCell.month, staff, companies, placements, commissionPolicies, 'written');
                  const commCash = calculateCommissionForRecruiter(selectedCell.staffMember.id, selectedCell.month, staff, companies, placements, commissionPolicies, 'cash_received');
                  
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', marginTop: '6px' }}>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 500 }}
                        onClick={() => setCommissionOverride(commWritten.toFixed(2))}
                      >
                        Use Projected (Written): £{Math.round(commWritten).toLocaleString()}
                      </button>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 500 }}
                        onClick={() => {
                          setCommissionOverride(commCash.toFixed(2));
                          setIsReconciled(true);
                        }}
                      >
                        Use Concluded (Cash): £{Math.round(commCash).toLocaleString()}
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Bonus Component</span>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>Add discretionary, performance, or exit bonus elements</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="number"
                    className="form-input"
                    value={bonusAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBonusAmountInput(val);
                      const rate = FX_RATES[bonusCurrency] || 1.0;
                      setBonusOverride((Number(val) * rate).toFixed(2));
                    }}
                    placeholder="0.00"
                    disabled={isRecruiter}
                    style={{ flex: 1, padding: '10px' }}
                  />
                  <select
                    className="select-filter"
                    value={bonusCurrency}
                    onChange={(e) => {
                      const newCur = e.target.value;
                      setBonusCurrency(newCur);
                      const rate = FX_RATES[newCur] || 1.0;
                      setBonusOverride((Number(bonusAmountInput) * rate).toFixed(2));
                    }}
                    disabled={isRecruiter}
                    style={{ width: '120px', padding: '10px' }}
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (AED)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="ZAR">ZAR (R)</option>
                  </select>
                </div>
                {bonusCurrency !== 'GBP' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Rate: 1 {bonusCurrency} = £{(FX_RATES[bonusCurrency] || 1.0).toFixed(4)} | <strong>GBP Equivalent: £{bonusOverride}</strong>
                  </div>
                )}
              </div>

              {/* Itemized Expense Reimbursements */}
              <div className="form-group" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Itemized Expense Reimbursements</span>
                      {reimbursementItems.length > 0 && (
                        <span style={{ fontSize: '11px', background: 'var(--primary-light, #e0e7ff)', color: 'var(--primary, #4f46e5)', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                          {reimbursementItems.length} {reimbursementItems.length === 1 ? 'item' : 'items'} (Total: £{totalReimbursementsGBP.toFixed(2)})
                        </span>
                      )}
                    </label>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Add itemized expense claims. Each claim can be assigned to its own nominal & cost absorption rule.
                    </div>
                  </div>
                  {!isRecruiter && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAddReimbursementItem}
                      style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={13} />
                      Add Claim Item
                    </button>
                  )}
                </div>

                {reimbursementItems.length === 0 ? (
                  <div style={{
                    padding: '14px',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '11px'
                  }}>
                    <span>No expense claims added for this period. Click "+ Add Claim Item" to allocate travel, client dinner, software, or office supplies.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reimbursementItems.map((item, idx) => {
                      const itemRate = FX_RATES[item.currency] || 1.0;
                      const itemAmtNum = Number(item.amount) || 0;
                      const itemGbpEquiv = itemAmtNum * itemRate;

                      return (
                        <div
                          key={item.id || idx}
                          style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            backgroundColor: 'var(--bg-secondary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {/* Row 1: Description + Delete button */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', width: '18px' }}>
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Description (e.g. Client dinner, Train ticket, Office stationery)"
                              value={item.description}
                              onChange={(e) => handleUpdateReimbursementItem(item.id, { description: e.target.value })}
                              disabled={isRecruiter}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                            />
                            {!isRecruiter && (
                              <button
                                type="button"
                                onClick={() => handleRemoveReimbursementItem(item.id)}
                                title="Remove claim item"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--danger, #ef4444)',
                                  padding: '4px 6px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          {/* Row 2: Amount + Currency */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '8px' }}>
                            <div>
                              <input
                                type="number"
                                step="any"
                                className="form-input"
                                placeholder="Amount (e.g. 150.00)"
                                value={item.amount}
                                onChange={(e) => handleUpdateReimbursementItem(item.id, { amount: e.target.value })}
                                disabled={isRecruiter}
                                style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }}
                              />
                              {item.currency !== 'GBP' && itemAmtNum > 0 && (
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Rate: 1 {item.currency} = £{itemRate.toFixed(4)} | <strong>£{itemGbpEquiv.toFixed(2)} GBP</strong>
                                </div>
                              )}
                            </div>
                            <select
                              className="select-filter"
                              value={item.currency}
                              onChange={(e) => handleUpdateReimbursementItem(item.id, { currency: e.target.value })}
                              disabled={isRecruiter}
                              style={{ padding: '6px 8px', fontSize: '11px', height: '34px' }}
                            >
                              <option value="GBP">GBP (£)</option>
                              <option value="USD">USD ($)</option>
                              <option value="AED">AED (AED)</option>
                              <option value="INR">INR (₹)</option>
                              <option value="ZAR">ZAR (R)</option>
                            </select>
                          </div>

                          {/* Row 3: Nominal Code + Cost Absorption + Target Department (if department) */}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: item.allocation === 'department' ? '1fr 1fr 1fr' : '1.2fr 1fr', 
                            gap: '8px', 
                            paddingTop: '2px' 
                          }}>
                            <div>
                              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                Nominal Code:
                              </label>
                              <select
                                className="select-filter"
                                value={item.nominalCode}
                                onChange={(e) => handleUpdateReimbursementItem(item.id, { nominalCode: e.target.value })}
                                disabled={isRecruiter}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '11px' }}
                              >
                                {nominalCodes.map(nc => (
                                  <option key={nc.id} value={nc.code}>{nc.code}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                Cost Absorbed By:
                              </label>
                              <select
                                className="select-filter"
                                value={item.allocation}
                                onChange={(e) => {
                                  const newAlloc = e.target.value as 'company' | 'department' | 'staff';
                                  handleUpdateReimbursementItem(item.id, {
                                    allocation: newAlloc,
                                    department: item.department || selectedCell?.staffMember?.department || allAvailableDepts[0] || 'Operations'
                                  });
                                }}
                                disabled={isRecruiter}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '11px' }}
                              >
                                <option value="company">🏢 Company Overhead</option>
                                <option value="department">📂 Department Overhead</option>
                                <option value="staff">👤 Staff Direct Cost</option>
                              </select>
                            </div>
                            {item.allocation === 'department' && (
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                                  Target Department:
                                </label>
                                <select
                                  className="select-filter"
                                  value={item.department || selectedCell?.staffMember?.department || allAvailableDepts[0] || ''}
                                  onChange={(e) => handleUpdateReimbursementItem(item.id, { department: e.target.value })}
                                  disabled={isRecruiter}
                                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px' }}
                                >
                                  {allAvailableDepts.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    🏢 Employer Contributions
                  </h4>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Employer NI (£)</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={employerNi}
                      onChange={(e) => setEmployerNi(e.target.value)}
                      disabled={isRecruiter}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Employer Pension (£)</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={employerPension}
                      onChange={(e) => setEmployerPension(e.target.value)}
                      disabled={isRecruiter}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    👥 Employee Deductions
                  </h4>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Employee Tax & NI (£)</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={employeeTaxNic}
                      onChange={(e) => setEmployeeTaxNic(e.target.value)}
                      disabled={isRecruiter}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Employee Pension (£)</label>
                    <input 
                      type="number"
                      className="form-input"
                      value={employeePension}
                      onChange={(e) => setEmployeePension(e.target.value)}
                      disabled={isRecruiter}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                padding: '12px', 
                backgroundColor: 'rgba(99, 102, 241, 0.05)', 
                borderRadius: '6px', 
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Gross Earnings (Basic + Comm + Bonus):</span>
                  <span>£{((splitFromTotalPaid ? derivedPureBasicSalary : (Number(basicSalaryOverride) || 0)) + Number(commissionOverride) + Number(bonusOverride)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Net Take-Home Pay (to Recruiter):</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    £{((splitFromTotalPaid ? derivedPureBasicSalary : (Number(basicSalaryOverride) || 0)) + Number(commissionOverride) + Number(bonusOverride) + totalReimbursementsGBP - Number(employeeTaxNic) - Number(employeePension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '4px' }}>
                  <span>Total Cost to Company (CoC):</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    £{((splitFromTotalPaid ? derivedPureBasicSalary : (Number(basicSalaryOverride) || 0)) + Number(commissionOverride) + Number(bonusOverride) + totalReimbursementsGBP + Number(employerNi) + Number(employerPension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bookkeeping Notes / Reference</label>
                <textarea 
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Cleared via Barclays Statement Ref #48192"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  disabled={isRecruiter}
                  style={{ width: '100%', padding: '10px', resize: 'none' }}
                />
              </div>

              {isReconciled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox"
                    checked={bookExpense}
                    onChange={(e) => setBookExpense(e.target.checked)}
                    id="auto-book-expense-check"
                    disabled={isRecruiter}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="auto-book-expense-check" style={{ cursor: 'pointer' }}>
                    Auto-book matching split transactions to nominal ledger (Salaries, PAYE/NIC, and Pension)
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              {(() => {
                const policy = payrollPolicies.find(p => p.id === selectedCell.staffMember.payrollPolicyId);
                if (policy && policy.type === 'freelance') {
                  const hasCommission = (Number(commissionOverride) || 0) > 0;
                  return (
                    <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={() => handleDownloadInvoice(
                          selectedCell.staffMember,
                          selectedCell.month,
                          Number(basicSalaryOverride) || 0,
                          0,
                          'base'
                        )}
                        style={{ backgroundColor: '#f59e0b', color: 'white', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        📥 {hasCommission ? 'Download Base Invoice' : 'Download Invoice'}
                      </button>
                      {hasCommission && (
                        <button
                          type="button"
                          className="btn-accent"
                          onClick={() => handleDownloadInvoice(
                            selectedCell.staffMember,
                            selectedCell.month,
                            0,
                            Number(commissionOverride) || 0,
                            'commission'
                          )}
                          style={{ backgroundColor: '#10b981', color: 'white', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          📥 Download Commission Invoice
                        </button>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              {isRecruiter ? (
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedCell(null)}
                  style={{ width: '120px' }}
                >
                  Close View
                </button>
              ) : (
                <>
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedCell(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveOverride}
                  >
                    Save Roster Cell
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reconciliation Modal Drawer */}
      {showBulkReconcile && (
        <div className="form-wizard-overlay" onClick={() => setShowBulkReconcile(false)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="wizard-header">
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>⚡ Bulk Payroll Bank Reconciliation Matcher</h2>
              <button type="button" className="btn-close" onClick={() => setShowBulkReconcile(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span className="form-label" style={{ margin: 0 }}>Target Month:</span>
                <select 
                  className="select-filter"
                  value={selectedBulkMonth}
                  onChange={(e) => {
                    setSelectedBulkMonth(e.target.value);
                    setBulkMatches([]);
                  }}
                  style={{ padding: '6px 12px' }}
                >
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paste Bank Statement / Excel Rows (Format: "Employee Name, Payout Amount")</label>
                <textarea 
                  className="form-input" 
                  rows={6}
                  placeholder="e.g.&#10;John Doe, 3250.00&#10;Sarah Connor, 4100.50"
                  value={bulkReconcileText}
                  onChange={(e) => setBulkReconcileText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}
                />
              </div>

              <button type="button" className="btn-secondary" onClick={handleAnalyzeBulkStatement} style={{ alignSelf: 'flex-start' }}>
                Analyze & Match Statement Rows
              </button>

              {bulkMatches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Matched Roster Rows:</div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Reconcile</th>
                          <th style={{ padding: '6px 8px' }}>Employee</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Statement Amt</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Projected Amt</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkMatches.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={m.checked}
                                onChange={(e) => {
                                  const copy = [...bulkMatches];
                                  copy[idx].checked = e.target.checked;
                                  setBulkMatches(copy);
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{m.staffMember.fullName}</strong>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                              £{m.pastedAmount.toFixed(2)}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              £{m.projectedAmount.toFixed(2)}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '3px',
                                textTransform: 'uppercase',
                                color: m.confidence === 'high' ? 'var(--success)' : m.confidence === 'medium' ? 'var(--warning)' : 'var(--danger)',
                                backgroundColor: m.confidence === 'high' ? 'rgba(16,185,129,0.1)' : m.confidence === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
                              }}>
                                {m.confidence}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowBulkReconcile(false)}>Cancel</button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleExecuteBulkReconcile}
                disabled={bulkMatches.filter(m => m.checked).length === 0}
              >
                Perform Bulk Reconciliation ({bulkMatches.filter(m => m.checked).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {detailBreakdownType && (
        <div className="form-wizard-overlay" onClick={() => setDetailBreakdownType(null)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                {detailBreakdownType === 'salary' && '📋 Basic Salary Calculation Details'}
                {detailBreakdownType === 'commission' && '💰 Sales Commission Placement Splits'}
                {detailBreakdownType === 'expenses' && '✈️ Approved Expense Reimbursements'}
              </h2>
              <button type="button" className="btn-close" onClick={() => setDetailBreakdownType(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(() => {
                const recruiterStaff = staff.find(s => s.id === currentUser?.id);
                if (!recruiterStaff) return <p style={{ color: 'var(--danger)', fontSize: '12px' }}>No user profile loaded.</p>;

                const cell = getCellData(
                  recruiterStaff,
                  recruiterSelectedMonth,
                  payrollRecords,
                  payrollPolicies,
                  leaveRequests,
                  holidays,
                  staff,
                  companies,
                  placements,
                  commissionPolicies
                );

                const targetId = `${currentUser.id}_${recruiterSelectedMonth}`;
                const record = payrollRecords.find(r => r.id === targetId);
                const currencySymbol = symbolMap[recruiterStaff.currency || 'GBP'] || '£';

                const staffExpenses = expenses.filter(e => {
                  const matchStaff = e.recipientId === currentUser?.id;
                  const matchMonth = e.plMonth === recruiterSelectedMonth;
                  return matchStaff && matchMonth;
                });
                const dynamicReimbursements = staffExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                const reimbursementsVal = record?.isReconciled ? (record.reimbursements || 0) : dynamicReimbursements;

                if (detailBreakdownType === 'salary') {
                  const annualBase = Number(recruiterStaff.salary || 0);
                  const monthlyBase = annualBase / 12;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Annual Base Salary:</span>
                          <h4 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 700 }}>{currencySymbol}{annualBase.toLocaleString()} / year</h4>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Monthly Base Calculation:</span>
                          <h4 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 700 }}>{currencySymbol}{monthlyBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} / month</h4>
                        </div>
                      </div>

                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700 }}>Calculation Summary</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                          Your monthly salary is calculated by dividing your annual base salary by 12, as configured in your profile. 
                          It is paid in your profile's configured local currency (<strong>{recruiterStaff.currency || 'GBP'}</strong>).
                        </p>
                        {record?.isReconciled && (
                          <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '12px', color: 'var(--success)' }}>
                            ● This month has been marked as reconciled and locked by management at: <strong>{currencySymbol}{Number(record.basicSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (detailBreakdownType === 'commission') {
                  const policy = commissionPolicies.find(p => p.id === recruiterStaff.commissionPolicyId);
                  
                  let targetStaffIds = [recruiterStaff.id];
                  if (policy?.type === 'manager') {
                    if (policy.assignedDepartments && policy.assignedDepartments.length > 0) {
                      const deptStaff = staff.filter(s => policy.assignedDepartments.includes(s.department));
                      targetStaffIds = Array.from(new Set([recruiterStaff.id, ...deptStaff.map(s => s.id)]));
                    } else {
                      const teamMembers = staff.filter(s => {
                        const mgrIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
                        return mgrIds.includes(recruiterStaff.id);
                      });
                      targetStaffIds = [recruiterStaff.id, ...teamMembers.map(s => s.id)];
                    }
                  }

                  const activeSplits = [];
                  placements.forEach(p => {
                    if (!p.startDate || p.status === 'dns') return;
                    
                    const pMonth = p.commissionPaidMonth ? p.commissionPaidMonth : (() => {
                      const d = new Date(p.startDate);
                      d.setMonth(d.getMonth() + 1);
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    })();

                    if (pMonth !== recruiterSelectedMonth) return;

                    p.splits?.forEach(s => {
                      if (targetStaffIds.includes(s.staffId)) {
                        const stName = staff.find(st => st.id === s.staffId)?.fullName || 'Team Member';
                        activeSplits.push({
                          id: p.id,
                          placementId: p.placementId,
                          candidate: p.candidateName,
                          client: p.clientCompany,
                          startDate: p.startDate,
                          netValue: p.netScoreValue,
                          percentage: s.percentage,
                          share: (p.netScoreValue * s.percentage) / 100,
                          staffName: stName
                        });
                      }
                    });
                  });

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Commission Policy:</span>
                          <strong style={{ display: 'block', fontSize: '13px' }}>{policy?.name || 'Standard Recruiter Policy'}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Commission:</span>
                          <strong style={{ display: 'block', fontSize: '15px', color: 'var(--accent)' }}>£{cell.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                      </div>

                      {activeSplits.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '12px' }}>No qualifying placement splits found for this month.</p>
                      ) : (
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                          <table className="entity-table dense" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Placement ID / Candidate</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Client Company</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Start Date</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Net Value</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Split %</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Your Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeSplits.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '8px' }}>
                                    <strong>{item.placementId}</strong>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.candidate}</div>
                                  </td>
                                  <td style={{ padding: '8px' }}>{item.client}</td>
                                  <td style={{ padding: '8px' }}>{item.startDate}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>£{item.netValue.toLocaleString()}</td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>{item.percentage}%</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>£{item.share.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                }

                if (detailBreakdownType === 'expenses') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status:</span>
                          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--success)' }}>Approved Expense Claims</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Reimbursements:</span>
                          <strong style={{ display: 'block', fontSize: '15px', color: 'var(--accent)' }}>£{reimbursementsVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                      </div>

                      {staffExpenses.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '12px' }}>No approved reimbursement expense claims found for this month.</p>
                      ) : (
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                          <table className="entity-table dense" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Nominal Category</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Description</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staffExpenses.map((exp, idx) => {
                                const nomObj = nominalCodes.find(n => n.code === exp.nominalCode);
                                const nomLabel = nomObj ? `${exp.nominalCode} - ${nomObj.type || ''}` : exp.nominalCode;
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '8px' }}>{exp.date}</td>
                                    <td style={{ padding: '8px' }}>{nomLabel}</td>
                                    <td style={{ padding: '8px' }}>{exp.description || exp.payee}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>£{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setDetailBreakdownType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
