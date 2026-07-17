import React, { useState, useMemo } from 'react';
import { CheckCircle2, Search, Building2, Layers } from 'lucide-react';
// @ts-ignore
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff, Placement, Expense, NominalCode } from '../../types';
import { symbolMap, MONTHS, getBusinessDaysInMonth, getCellData, calculateCommissionForRecruiter } from './utils';

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
  onShowToast
}: PayrollRegisterTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string[]>(['all']);
  const [selectedDept, setSelectedDept] = useState<string[]>(['all']);
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, reconciled, projected
  const [showExitedRoster, setShowExitedRoster] = useState(false);

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
    setIsReconciled(cell.isReconciled);
    setBasicSalaryOverride(cell.basic.toFixed(2));
    setCommissionOverride(cell.commission.toFixed(2));
    setEmployerNi((cell.employerNi || 0).toFixed(2));
    setEmployerPension((cell.employerPension || 0).toFixed(2));
    setEmployeeTaxNic((cell.employeeTaxNic || 0).toFixed(2));
    setEmployeePension((cell.employeePension || 0).toFixed(2));
    setReimbursementsInput((cell.reimbursements || 0).toFixed(2));
    setBonusOverride((cell.bonus || 0).toFixed(2));
    
    const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);
    setLinkedExpenseId(record?.linkedExpenseId || '');
    setInitialLinkedExpenseId(record?.linkedExpenseId || '');
    
    setReconcileNotes(cell.notes);
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

    const baseVal = Number(basicSalaryOverride) || 0;
    const commVal = Number(commissionOverride) || 0;
    const bonusVal = Number(bonusOverride) || 0;
    const empNiVal = Number(employerNi) || 0;
    const empPensionVal = Number(employerPension) || 0;
    const taxNicVal = Number(employeeTaxNic) || 0;
    const pensionVal = Number(employeePension) || 0;
    const reimbursementsVal = Number(reimbursementsInput) || 0;

    const record = {
      id: `${staffMember.id}_${month}`,
      staffId: staffMember.id,
      month,
      isReconciled,
      basicSalary: baseVal,
      commission: commVal,
      reimbursements: reimbursementsVal,
      bonus: bonusVal,
      employerNi: empNiVal,
      employerPension: empPensionVal,
      employeeTaxNic: taxNicVal,
      employeePension: pensionVal,
      notes: reconcileNotes.trim(),
      linkedExpenseId: linkedExpenseId || ''
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
      }

      if (!isReconciled || !bookExpense) {
        await onDeleteExpense(`payroll-salary-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-tax-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-pension-${staffMember.id}-${month}`);
        await onDeleteExpense(`payroll-exp-${staffMember.id}-${month}`);
      } else {
        await onDeleteExpense(`payroll-exp-${staffMember.id}-${month}`);

        const salaryNominal = nominalCodes.find(c => c.id === '500' || c.code?.includes('500') || c.code?.toLowerCase().includes('salary'))?.code || '500 - Salaries & Wages';
        const taxNominal = nominalCodes.find(c => c.id === '501' || c.code?.includes('501') || c.code?.toLowerCase().includes('paye') || c.code?.toLowerCase().includes('tax') || c.code?.toLowerCase().includes('ni'))?.code || '501 - HMRC PAYE & NI Contributions';
        const pensionNominal = nominalCodes.find(c => c.id === '502' || c.code?.includes('502') || c.code?.toLowerCase().includes('pension'))?.code || '502 - Royal London Pension Contributions';

        const netSalaryAmt = baseVal + commVal + bonusVal + reimbursementsVal - taxNicVal - pensionVal;
        const netExp = {
          id: `payroll-salary-${staffMember.id}-${month}`,
          date: `${month}-28`,
          payee: `Net Salary: ${staffMember.fullName}`,
          amount: netSalaryAmt,
          currency: staffMember.currency || 'GBP',
          nominalCode: salaryNominal,
          allocationType: 'staff' as const,
          allocationTarget: [staffMember.id],
          plMonth: month,
          notes: `Net take-home pay. Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
        };
        await onSaveExpense(netExp);

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

      return matchesSearch && matchesCompany && matchesDept;
    });
  }, [staff, searchTerm, selectedCompanyId, selectedDept, selectedStatus, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies]);

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
          annualSum += cell.total;

          return (
            <td 
              key={m}
              onClick={() => handleCellClick(s, m)}
              style={{ 
                textAlign: 'center', 
                cursor: 'pointer', 
                fontSize: '11px',
                fontWeight: cell.isReconciled ? 600 : 400,
                position: 'relative',
                transition: 'all 0.15s'
              }}
              className={`payroll-cell ${cell.isReconciled ? 'reconciled' : 'projected'}`}
              title={`${s.fullName} - ${m}
Salary (Gross): £${Math.round(cell.basic).toLocaleString()}
Comm: £${Math.round(cell.commission).toLocaleString()}
${cell.reimbursements > 0 ? `Reimbursements: £${Math.round(cell.reimbursements).toLocaleString()}\n` : ''}${cell.employerNi > 0 ? `Employer NI: £${Math.round(cell.employerNi).toLocaleString()}\n` : ''}${cell.employerPension > 0 ? `Employer Pension: £${Math.round(cell.employerPension).toLocaleString()}\n` : ''}${cell.employeeTaxNic > 0 ? `Employee Tax/NIC: £${Math.round(cell.employeeTaxNic).toLocaleString()}\n` : ''}${cell.employeePension > 0 ? `Employee Pension: £${Math.round(cell.employeePension).toLocaleString()}\n` : ''}Click to edit override`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span>£{Math.round(cell.total).toLocaleString()}</span>
                {cell.isReconciled ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontSize: '8px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                    <CheckCircle2 size={7} /> Paid
                  </span>
                ) : (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Proj</span>
                )}
              </div>
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

          <select 
            className="select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Cell Statuses</option>
            <option value="reconciled">Has Reconciled Months</option>
            <option value="projected">Projections Only</option>
          </select>

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
                  📝 Payroll Override & Reconciliation
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

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Basic Salary Component (£ GBP) <span>*</span></span>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>Standard monthly baseline contract rate / salary</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={basicSalaryOverride}
                  onChange={(e) => setBasicSalaryOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />
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
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />
                {(() => {
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

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Bonus Component (£ GBP)</span>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>Add discretionary, performance, or exit bonus elements</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={bonusOverride}
                  onChange={(e) => setBonusOverride(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Reimbursements & Allowances Component (£ GBP)</span>
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>Request or add approved business expense reimbursements</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={reimbursementsInput}
                  onChange={(e) => setReimbursementsInput(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '10px', marginTop: '4px' }}
                />
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
                  <span>£{(Number(basicSalaryOverride) + Number(commissionOverride) + Number(bonusOverride)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Net Take-Home Pay (to Recruiter):</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    £{(Number(basicSalaryOverride) + Number(commissionOverride) + Number(bonusOverride) + Number(reimbursementsInput) - Number(employeeTaxNic) - Number(employeePension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '4px' }}>
                  <span>Total Cost to Company (CoC):</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    £{(Number(basicSalaryOverride) + Number(commissionOverride) + Number(bonusOverride) + Number(reimbursementsInput) + Number(employerNi) + Number(employerPension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
    </div>
  );
}
