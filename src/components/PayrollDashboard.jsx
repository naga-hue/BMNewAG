import React, { useState } from 'react';
import { 
  DollarSign, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  Search, 
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Users,
  Briefcase,
  Layers,
  BookOpen,
  Plus
} from 'lucide-react';
import { toGBP, formatGBP } from '../utils/currency';

const MONTHS = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
];

export default function PayrollDashboard({
  companies = [],
  staff = [],
  commissionPolicies = [],
  placements = [],
  payrollRecords = [],
  payrollPolicies = [],
  leaveRequests = [],
  holidays = [],
  expenses = [],
  nominalCodes = [],
  onSavePayrollRecord,
  onSavePayrollPolicy,
  onDeletePayrollPolicy,
  onUpdateStaff,
  onSaveExpense,
  onDeleteExpense,
  onShowToast
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, reconciled, projected
  const [activeSubTab, setActiveSubTab] = useState('grid'); // grid, policies

  // Payroll policy creator states
  const [policyName, setPolicyName] = useState('');
  const [policyType, setPolicyType] = useState('ft_uk'); // ft_uk, freelance, custom
  const [employerNiRate, setEmployerNiRate] = useState('13.8');
  const [employerNiThreshold, setEmployerNiThreshold] = useState('758');
  const [employerPensionRate, setEmployerPensionRate] = useState('3.0');
  const [employeeTaxNicRate, setEmployeeTaxNicRate] = useState('20.0');
  const [employeePensionRate, setEmployeePensionRate] = useState('5.0');
  const [studentLoanActive, setStudentLoanActive] = useState(false);
  const [studentLoanRate, setStudentLoanRate] = useState('9.0');
  const [studentLoanThreshold, setStudentLoanThreshold] = useState('2274');
  const [dailyRateDefault, setDailyRateDefault] = useState('0');
  const [expectedDaysPerMonth, setExpectedDaysPerMonth] = useState('21.67');
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [selectedPayrollStaffIds, setSelectedPayrollStaffIds] = useState([]);

  // Progressive Tax & NI slab states
  const [payeSlabs, setPayeSlabs] = useState([
    { minAmount: 0, maxAmount: 1047.50, rate: 0 },
    { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
    { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
    { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
  ]);
  const [employeeNiSlabs, setEmployeeNiSlabs] = useState([
    { minAmount: 0, maxAmount: 1047.00, rate: 0 },
    { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
    { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
  ]);
  const [employerNiSlabs, setEmployerNiSlabs] = useState([
    { minAmount: 0, maxAmount: 758.00, rate: 0 },
    { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
  ]);

  const handleUpdateSlab = (type, index, field, value) => {
    const numVal = Number(value) || 0;
    if (type === 'paye') {
      setPayeSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    }
  };

  const handleAddSlab = (type) => {
    const newSlab = { minAmount: 0, maxAmount: 9999999, rate: 0 };
    if (type === 'paye') {
      setPayeSlabs(prev => [...prev, newSlab]);
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => [...prev, newSlab]);
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => [...prev, newSlab]);
    }
  };

  const handleRemoveSlab = (type, index) => {
    if (type === 'paye') {
      setPayeSlabs(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  // Selected cell for override modal
  const [selectedCell, setSelectedCell] = useState(null); // { staffMember, month, basic, commission }
  
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

  // FX Rates representation
  const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

  const handleDownloadInvoice = (staffMember, monthKey, basic, commission) => {
    const total = basic + commission;
    const invoiceNumber = `INV-${monthKey.replace('-', '')}-${staffMember.id.substring(0, 4).toUpperCase()}`;
    const invoiceDate = new Date().toISOString().split('T')[0];
    const companyName = companies.find(c => c.id === staffMember.companyId)?.name || 'Humres Technical Recruitment Ltd';
    
    const approvedLeaves = leaveRequests?.filter(req => 
      req.staffId === staffMember.id && 
      req.status === 'approved' && 
      req.startDate && 
      req.startDate.substring(0, 7) === monthKey
    ) || [];
    const leaveDays = approvedLeaves.reduce((sum, req) => sum + (Number(req.totalDays) || 0), 0);
    const totalBusinessDays = getBusinessDaysInMonth(monthKey, staffMember);
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
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
            padding: 30px;
            border-radius: 8px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #f59e0b;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            color: #1e3a8a;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            font-size: 13px;
            line-height: 1.6;
          }
          .meta-block {
            flex: 1;
          }
          .meta-block h3 {
            margin: 0 0 8px 0;
            color: #1e3a8a;
            font-size: 14px;
            text-transform: uppercase;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          .table th {
            background-color: #f8fafc;
            border-bottom: 2px solid #e2e8f0;
            color: #475569;
            font-weight: bold;
            text-align: left;
            padding: 12px;
            font-size: 13px;
          }
          .table td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px;
            font-size: 13px;
            color: #334155;
          }
          .totals-table {
            width: 300px;
            margin-left: auto;
            margin-bottom: 40px;
          }
          .totals-table td {
            padding: 8px 12px;
            font-size: 13px;
          }
          .totals-table tr.grand-total {
            font-weight: bold;
            font-size: 16px;
            color: #1e3a8a;
            background-color: #fef3c7;
          }
          .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            line-height: 1.5;
          }
          .print-btn {
            background-color: #f59e0b;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
            display: inline-block;
          }
          @media print {
            .print-btn {
              display: none;
            }
            body {
              padding: 0;
            }
            .invoice-box {
              border: none;
              box-shadow: none;
              padding: 0;
            }
          }
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
              <p style="margin: 3px 0 0 0; font-size: 13px; color: #64748b;">${staffMember.email || ''}</p>
            </div>
          </div>
          
          <div class="meta-info">
            <div class="meta-block">
              <h3 style="color: #f59e0b;">Billed To:</h3>
              <strong>${companyName}</strong><br>
              Accounts Payable Department<br>
              Humres Group Head Office
            </div>
            <div class="meta-block" style="text-align: right;">
              <h3 style="color: #f59e0b;">Invoice Date:</h3>
              ${invoiceDate}<br>
              <h3 style="color: #f59e0b; margin-top: 10px;">Billing Period:</h3>
              ${monthKey}
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Days Worked</th>
                <th style="text-align: right;">Daily Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Professional Consulting Services</strong><br>
                  Base contractor attendance in ${monthKey} (computed from roster calendar business days minus approved leaves).<br>
                  Total Business Days: ${totalBusinessDays} &bull; Approved Leave Days: ${leaveDays}
                </td>
                <td style="text-align: center;">${attendanceDays}</td>
                <td style="text-align: right;">£${((basic / (attendanceDays || 1))).toFixed(2)}</td>
                <td style="text-align: right;">£${basic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              ${commission > 0 ? `
              <tr>
                <td>
                  <strong>Recruiter Commission Payout</strong><br>
                  Commission share accrued for placement credits in the billing cycle.
                </td>
                <td style="text-align: center;">—</td>
                <td style="text-align: right;">—</td>
                <td style="text-align: right;">£${commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
          
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">£${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Due:</td>
              <td style="text-align: right;">£${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>

          <div style="margin-top: 50px; font-size: 13px; color: #475569; background: #fffbeb; padding: 15px; border-radius: 6px; border: 1px solid #fef3c7;">
            <strong>Bank Remittance Account:</strong><br>
            Bank Name: Lloyds Bank plc<br>
            Account Name: ${staffMember.fullName}<br>
            Sort Code: 30-90-09<br>
            Account Number: 12345678
          </div>
          
          <div class="footer" style="margin-top: 60px;">
            Thank you for your business. For any billing queries, please contact ${staffMember.email || 'the contractor directly'}.<br>
            Generated automatically via Humres Group Business Management Suite.
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Save or Update Payroll Policy
  const handleSavePolicySubmit = async (e) => {
    e.preventDefault();
    if (!policyName.trim()) {
      onShowToast("Please enter a policy name.", "warning");
      return;
    }

    const savedPolicy = {
      id: editingPolicyId || `policy-${Date.now()}`,
      name: policyName.trim(),
      type: policyType,
      employerNiRate: policyType === 'freelance' ? 0 : Number(employerNiRate) || 0,
      employerNiThreshold: policyType === 'freelance' ? 0 : Number(employerNiThreshold) || 0,
      employerPensionRate: policyType === 'freelance' ? 0 : Number(employerPensionRate) || 0,
      employeeTaxNicRate: policyType === 'freelance' ? 0 : Number(employeeTaxNicRate) || 0,
      employeePensionRate: policyType === 'freelance' ? 0 : Number(employeePensionRate) || 0,
      studentLoanActive: policyType === 'ft_uk' ? studentLoanActive : false,
      studentLoanRate: policyType === 'ft_uk' ? (Number(studentLoanRate) || 0) : 0,
      studentLoanThreshold: policyType === 'ft_uk' ? (Number(studentLoanThreshold) || 0) : 0,
      dailyRateDefault: policyType === 'freelance' ? (Number(dailyRateDefault) || 0) : 0,
      expectedDaysPerMonth: policyType === 'freelance' ? (Number(expectedDaysPerMonth) || 0) : 21.67,
      payeSlabs: policyType === 'freelance' ? [] : payeSlabs,
      employeeNiSlabs: policyType === 'freelance' ? [] : employeeNiSlabs,
      employerNiSlabs: policyType === 'freelance' ? [] : employerNiSlabs
    };

    try {
      if (onSavePayrollPolicy) {
        await onSavePayrollPolicy(savedPolicy);
        onShowToast(`Payroll Policy "${policyName}" saved successfully.`, "success");
        // Reset states
        setPolicyName('');
        setPolicyType('ft_uk');
        setEmployerNiRate('13.8');
        setEmployerNiThreshold('758');
        setEmployerPensionRate('3.0');
        setEmployeeTaxNicRate('20.0');
        setEmployeePensionRate('5.0');
        setStudentLoanActive(false);
        setStudentLoanRate('9.0');
        setStudentLoanThreshold('2274');
        setDailyRateDefault('0');
        setExpectedDaysPerMonth('21.67');
        setPayeSlabs([
          { minAmount: 0, maxAmount: 1047.50, rate: 0 },
          { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
          { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
          { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
        ]);
        setEmployeeNiSlabs([
          { minAmount: 0, maxAmount: 1047.00, rate: 0 },
          { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
          { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
        ]);
        setEmployerNiSlabs([
          { minAmount: 0, maxAmount: 758.00, rate: 0 },
          { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
        ]);
        setEditingPolicyId(null);
      }
    } catch (err) {
      onShowToast(`Error saving policy: ${err.message}`, "warning");
    }
  };

  const handleEditPolicyClick = (policy) => {
    setEditingPolicyId(policy.id);
    setPolicyName(policy.name || '');
    setPolicyType(policy.type || 'ft_uk');
    setEmployerNiRate(String(policy.employerNiRate ?? '13.8'));
    setEmployerNiThreshold(String(policy.employerNiThreshold ?? '758'));
    setEmployerPensionRate(String(policy.employerPensionRate ?? '3.0'));
    setEmployeeTaxNicRate(String(policy.employeeTaxNicRate ?? '20.0'));
    setEmployeePensionRate(String(policy.employeePensionRate ?? '5.0'));
    setStudentLoanActive(!!policy.studentLoanActive);
    setStudentLoanRate(String(policy.studentLoanRate ?? '9.0'));
    setStudentLoanThreshold(String(policy.studentLoanThreshold ?? '2274'));
    setDailyRateDefault(String(policy.dailyRateDefault ?? '0'));
    setExpectedDaysPerMonth(String(policy.expectedDaysPerMonth ?? '21.67'));
    setPayeSlabs(policy.payeSlabs || [
      { minAmount: 0, maxAmount: 1047.50, rate: 0 },
      { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
      { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
      { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
    ]);
    setEmployeeNiSlabs(policy.employeeNiSlabs || [
      { minAmount: 0, maxAmount: 1047.00, rate: 0 },
      { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
      { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
    ]);
    setEmployerNiSlabs(policy.employerNiSlabs || [
      { minAmount: 0, maxAmount: 758.00, rate: 0 },
      { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
    ]);
  };

  // Helper to calculate exact cash-received commission payout (matching Incentive Commissions ledger)
  const calculateCashReceivedCommission = (member, policy, monthStr, staffList, companiesList, placementsList) => {
    if (!policy) return 0;

    const getMonthsOfService = (startStr, dateStr) => {
      if (!startStr) return 999;
      try {
        const [startYear, startMonth] = startStr.substring(0, 7).split('-').map(Number);
        const [payYear, payMonth] = dateStr.split('-').map(Number);
        return (payYear - startYear) * 12 + (payMonth - startMonth);
      } catch (e) {
        return 999;
      }
    };

    const monthsOfService = getMonthsOfService(member.startDate, monthStr);
    const isStarterWaiverActive = policy.starterWaiveThreshold && monthsOfService < 12;
    const isLocked = policy.effectiveFrom === 'one_year_service' && monthsOfService < 12 && !isStarterWaiverActive;

    if (isLocked) return 0;

    const [payYear, payMonth] = monthStr.split('-').map(Number);
    
    // Placements evaluated are those starting in the PREVIOUS month
    let cycleYear = payYear;
    let cycleMonth = payMonth - 1;
    if (cycleMonth === 0) {
      cycleMonth = 12;
      cycleYear = payYear - 1;
    }

    // Determine target staff members
    let targetStaffIds = [member.id];
    if (policy.type === 'manager') {
      if (policy.assignedDepartments && policy.assignedDepartments.length > 0) {
        const deptStaff = staffList.filter(s => policy.assignedDepartments.includes(s.department));
        targetStaffIds = Array.from(new Set([member.id, ...deptStaff.map(s => s.id)]));
      } else {
        const teamMembers = staffList.filter(s => s.reportingManagerId === member.id);
        targetStaffIds = [member.id, ...teamMembers.map(s => s.id)];
      }
    }

    // Helper to calculate total recruiter split billing for a specific start month
    const getRecruiterBillingForStartMonth = (yearVal, monthVal) => {
      let sum = 0;
      placementsList.forEach(p => {
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

    // Helper to apply slabs to a billing amount (normalized to GBP)
    const getPolicyCommission = (billingAmt) => {
      const policyCompany = companiesList.find(c => c.id === policy.companyId);
      const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
      
      const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold || 0, policyCurrency);
      const commissionable = Math.max(0, billingAmt - thresh);
      const slabs = policy.slabs || [];

      if (commissionable <= 0) return 0;

      if (policy.slabType === 'flat_rate') {
        let highestRate = 0;
        for (const slab of slabs) {
          const min = toGBP(slab.minAmount || 0, policyCurrency);
          if (commissionable > min) {
            highestRate = Number(slab.rate) || 0;
          }
        }
        return (commissionable * highestRate) / 100;
      } else {
        let earned = 0;
        let remaining = commissionable;
        for (const slab of slabs) {
          const min = toGBP(slab.minAmount || 0, policyCurrency);
          const max = toGBP(slab.maxAmount || 0, policyCurrency);
          const rate = Number(slab.rate) || 0;
          const slabCap = max - min;

          if (remaining <= 0) break;
          const applicable = Math.min(remaining, slabCap);
          earned += (applicable * rate) / 100;
          remaining -= applicable;
        }
        return earned;
      }
    };

    // Quarterly accumulator helper
    const getQuarterlyCommissionForMonth = (yearVal, monthVal) => {
      const quarterIdx = Math.floor((monthVal - 1) / 3);
      const startMonthOfQuarter = quarterIdx * 3 + 1;

      let cumulativeBilling = 0;
      for (let m = startMonthOfQuarter; m <= monthVal; m++) {
        cumulativeBilling += getRecruiterBillingForStartMonth(yearVal, m);
      }
      const cumulativeCommission = getPolicyCommission(cumulativeBilling);

      let previousBilling = 0;
      for (let m = startMonthOfQuarter; m <= monthVal - 1; m++) {
        previousBilling += getRecruiterBillingForStartMonth(yearVal, m);
      }
      const previousCommission = getPolicyCommission(previousBilling);

      return Math.max(0, cumulativeCommission - previousCommission);
    };

    // 1. Current Cycle calculations (starts in previous month)
    const currentCycleBilling = getRecruiterBillingForStartMonth(cycleYear, cycleMonth);
    const baseEarned = policy.calcInterval === 'quarterly'
      ? getQuarterlyCommissionForMonth(cycleYear, cycleMonth)
      : getPolicyCommission(currentCycleBilling);

    let totalPaidNow = 0;

    placementsList.forEach(p => {
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
          }
        }
      }
    });

    // 2. Releases from Prior Withholds (starts before the previous month)
    let totalReleased = 0;

    placementsList.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pStart = new Date(p.startDate);
      const pStartYear = pStart.getFullYear();
      const pStartMonth = pStart.getMonth() + 1;

      const isPriorStart = pStartYear < cycleYear || (pStartYear === cycleYear && pStartMonth < cycleMonth);

      if (isPriorStart) {
        const mySplits = p.splits?.filter(s => targetStaffIds.includes(s.staffId)) || [];
        if (mySplits.length > 0) {
          const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
          const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;

          const histCycleBilling = getRecruiterBillingForStartMonth(pStartYear, pStartMonth);
          const histBaseEarned = policy.calcInterval === 'quarterly'
            ? getQuarterlyCommissionForMonth(pStartYear, pStartMonth)
            : getPolicyCommission(histCycleBilling);

          const myCommShare = histCycleBilling > 0 
            ? (myBillingShare / histCycleBilling) * histBaseEarned 
            : 0;

          if (myCommShare > 0) {
            const isPaid = p.clientPaymentStatus === 'paid';
            
            let paidInCurrentMonth = false;
            if (p.clientPaidDate) {
              const pPaidDate = new Date(p.clientPaidDate);
              paidInCurrentMonth = pPaidDate.getFullYear() === payYear && (pPaidDate.getMonth() + 1) === payMonth;
            }

            if (isPaid && paidInCurrentMonth) {
              totalReleased += myCommShare;
            }
          }
        }
      }
    });

    return totalPaidNow + totalReleased;
  };

  // Helper to calculate commission on placements starting in a specific month
  const calculateCommissionForRecruiter = (recruiterId, monthKey) => {
    const member = staff.find(s => s.id === recruiterId);
    if (!member) return 0;
    const policy = commissionPolicies.find(p => p.id === member.commissionPolicyId);
    return calculateCashReceivedCommission(member, policy, monthKey, staff, companies, placements);
  };

  // Get active departments
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))].sort();

  const calculateSlabCost = (amount, slabs) => {
    if (!slabs || slabs.length === 0) return 0;
    let totalCost = 0;
    const sortedSlabs = [...slabs].sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
    for (const slab of sortedSlabs) {
      const min = Number(slab.minAmount) || 0;
      const max = Number(slab.maxAmount) || 999999999;
      const rate = Number(slab.rate) || 0;
      
      if (amount <= min) continue;
      const applicableRange = Math.min(amount, max) - min;
      if (applicableRange > 0) {
        totalCost += (applicableRange * rate) / 100;
      }
    }
    return totalCost;
  };

  const getBusinessDaysInMonth = (monthKey, staffMember) => {
    const parts = monthKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    
    let count = 0;
    const days = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const dayOfWeek = new Date(year, month, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateString = `${year}-${mm}-${dd}`;
        const isHoliday = holidays.some(h => h.companyId === staffMember?.companyId && h.date === dateString);
        if (!isHoliday) {
          count++;
        }
      }
    }
    return count || 22;
  };

  // Helper to fetch cell status and values
  const getCellData = (staffMember, month) => {
    const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);
    
    // Project base monthly salaries in GBP
    let baselineBasic = toGBP(Number(staffMember.salary || 0) / 12, staffMember.currency || 'GBP');
    let baselineCommission = calculateCommissionForRecruiter(staffMember.id, month);

    if (staffMember.status === 'exited') {
      const exitMonth = staffMember.exitDate ? staffMember.exitDate.substring(0, 7) : '';
      const cutoffStr = staffMember.salaryPaidUntilDate || staffMember.exitDate || '';
      if (cutoffStr) {
        const cutoffMonth = cutoffStr.substring(0, 7);
        if (month > cutoffMonth) {
          baselineBasic = 0;
          baselineCommission = 0;
        } else if (month === cutoffMonth) {
          const [y, m, d] = cutoffStr.split('-').map(Number);
          const daysInMonth = new Date(y, m, 0).getDate();
          const proration = Math.min(1.0, Math.max(0.0, d / daysInMonth));
          baselineBasic = baselineBasic * proration;
        }
      }
      if (exitMonth && month === exitMonth && staffMember.additionalExitPayment) {
        baselineBasic += toGBP(Number(staffMember.additionalExitPayment) || 0, staffMember.currency || 'GBP');
      }
    }

    // Read policy template
    const policy = payrollPolicies.find(p => p.id === staffMember.payrollPolicyId);
    let projectedEmployerNi = 0;
    let projectedEmployerPension = 0;
    let projectedEmployeeTaxNic = 0;
    let projectedEmployeePension = 0;

    if (policy) {
      if (policy.type === 'freelance') {
        const totalBusinessDays = getBusinessDaysInMonth(month, staffMember);
        const approvedLeaves = leaveRequests.filter(req => 
          req.staffId === staffMember.id && 
          req.status === 'approved' && 
          req.startDate && 
          req.startDate.substring(0, 7) === month
        );
        const leaveDays = approvedLeaves.reduce((sum, req) => sum + (Number(req.totalDays) || 0), 0);
        const attendanceDays = Math.max(0, totalBusinessDays - leaveDays);

        let dailyRate = 0;
        if (staffMember.attendanceRate && Number(staffMember.attendanceRate) > 0) {
          dailyRate = Number(staffMember.attendanceRate);
        } else if (staffMember.salary && Number(staffMember.salary) > 0) {
          dailyRate = (Number(staffMember.salary) / 12) / totalBusinessDays;
        } else {
          dailyRate = Number(policy.dailyRateDefault || 0);
        }
        
        const monthlyContractorRateVal = dailyRate * attendanceDays;
        baselineBasic = toGBP(monthlyContractorRateVal, staffMember.currency || 'GBP');
      } else {
        const grossSalaryAndComm = baselineBasic + baselineCommission;
        
        // Calculate Employer NIC
        if (policy.employerNiSlabs && policy.employerNiSlabs.length > 0) {
          projectedEmployerNi = calculateSlabCost(grossSalaryAndComm, policy.employerNiSlabs);
        } else if (policy.employerNiRate > 0) {
          const thresholdGBP = toGBP(Number(policy.employerNiThreshold || 0), 'GBP');
          const taxableNiAmount = Math.max(0, grossSalaryAndComm - thresholdGBP);
          projectedEmployerNi = (taxableNiAmount * Number(policy.employerNiRate)) / 100;
        }
        
        // Calculate Employer Pension
        if (policy.employerPensionRate > 0) {
          projectedEmployerPension = (grossSalaryAndComm * Number(policy.employerPensionRate)) / 100;
        }

        // Calculate Employee Tax (PAYE)
        let projectedPAYE = 0;
        if (policy.payeSlabs && policy.payeSlabs.length > 0) {
          projectedPAYE = calculateSlabCost(grossSalaryAndComm, policy.payeSlabs);
        } else if (policy.employeeTaxNicRate > 0) {
          projectedPAYE = (grossSalaryAndComm * Number(policy.employeeTaxNicRate)) / 100;
        }

        // Calculate Employee NIC
        let projectedEmployeeNic = 0;
        if (policy.employeeNiSlabs && policy.employeeNiSlabs.length > 0) {
          projectedEmployeeNic = calculateSlabCost(grossSalaryAndComm, policy.employeeNiSlabs);
        }

        projectedEmployeeTaxNic = projectedPAYE + projectedEmployeeNic;

        // Calculate Employee Pension
        if (policy.employeePensionRate > 0) {
          projectedEmployeePension = (grossSalaryAndComm * Number(policy.employeePensionRate)) / 100;
        }

        // Calculate Student Loan
        if (policy.studentLoanActive && policy.studentLoanRate > 0) {
          const slThresholdGBP = toGBP(Number(policy.studentLoanThreshold || 0), 'GBP');
          const slTaxable = Math.max(0, grossSalaryAndComm - slThresholdGBP);
          const studentLoanDeduction = (slTaxable * Number(policy.studentLoanRate)) / 100;
          projectedEmployeeTaxNic += studentLoanDeduction;
        }
      }
    }

    if (staffMember.startDate) {
      const startMonth = staffMember.startDate.substring(0, 7);
      if (month < startMonth) {
        baselineBasic = 0;
        baselineCommission = 0;
        projectedEmployerNi = 0;
        projectedEmployerPension = 0;
        projectedEmployeeTaxNic = 0;
        projectedEmployeePension = 0;
      } else if (month === startMonth) {
        const [y, m, d] = staffMember.startDate.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const proration = Math.min(1.0, Math.max(0.0, (daysInMonth - d + 1) / daysInMonth));
        baselineBasic = baselineBasic * proration;
        projectedEmployerNi = projectedEmployerNi * proration;
        projectedEmployerPension = projectedEmployerPension * proration;
        projectedEmployeeTaxNic = projectedEmployeeTaxNic * proration;
        projectedEmployeePension = projectedEmployeePension * proration;
      }
    }

    if (record) {
      return {
        isReconciled: !!record.isReconciled,
        basic: record.isReconciled ? Number(record.basicSalary) : baselineBasic,
        commission: record.isReconciled ? Number(record.commission) : baselineCommission,
        total: record.isReconciled 
          ? (Number(record.basicSalary) + Number(record.commission) + Number(record.employerNi || 0) + Number(record.employerPension || 0)) 
          : (baselineBasic + baselineCommission + projectedEmployerNi + projectedEmployerPension),
        employerNi: record.isReconciled ? Number(record.employerNi || 0) : projectedEmployerNi,
        employerPension: record.isReconciled ? Number(record.employerPension || 0) : projectedEmployerPension,
        employeeTaxNic: record.isReconciled ? Number(record.employeeTaxNic || 0) : projectedEmployeeTaxNic,
        employeePension: record.isReconciled ? Number(record.employeePension || 0) : projectedEmployeePension,
        notes: record.notes || '',
        id: record.id
      };
    }

    return {
      isReconciled: false,
      basic: baselineBasic,
      commission: baselineCommission,
      total: baselineBasic + baselineCommission + projectedEmployerNi + projectedEmployerPension,
      employerNi: projectedEmployerNi,
      employerPension: projectedEmployerPension,
      employeeTaxNic: projectedEmployeeTaxNic,
      employeePension: projectedEmployeePension,
      notes: '',
      id: null
    };
  };

  // Open editor modal for specific cell
  const handleCellClick = (staffMember, month) => {
    const data = getCellData(staffMember, month);
    setSelectedCell({ staffMember, month });
    setIsReconciled(data.isReconciled);
    setBasicSalaryOverride(data.basic.toFixed(2));
    setCommissionOverride(data.commission.toFixed(2));
    setEmployerNi((data.employerNi || 0).toFixed(2));
    setEmployerPension((data.employerPension || 0).toFixed(2));
    setEmployeeTaxNic((data.employeeTaxNic || 0).toFixed(2));
    setEmployeePension((data.employeePension || 0).toFixed(2));
    
    const record = payrollRecords.find(r => r.staffId === staffMember.id && r.month === month);
    setLinkedExpenseId(record?.linkedExpenseId || '');
    setInitialLinkedExpenseId(record?.linkedExpenseId || '');
    
    setReconcileNotes(data.notes);
    setBookExpense(true);
  };

  // Save the override / reconciliation details
  const handleSaveOverride = async () => {
    if (!selectedCell) return;
    const { staffMember, month } = selectedCell;

    const baseVal = Number(basicSalaryOverride) || 0;
    const commVal = Number(commissionOverride) || 0;
    const empNiVal = Number(employerNi) || 0;
    const empPensionVal = Number(employerPension) || 0;
    const taxNicVal = Number(employeeTaxNic) || 0;
    const pensionVal = Number(employeePension) || 0;

    const record = {
      id: `${staffMember.id}_${month}`,
      staffId: staffMember.id,
      month,
      isReconciled,
      basicSalary: baseVal,
      commission: commVal,
      employerNi: empNiVal,
      employerPension: empPensionVal,
      employeeTaxNic: taxNicVal,
      employeePension: pensionVal,
      notes: reconcileNotes.trim(),
      linkedExpenseId: linkedExpenseId || ''
    };

    try {
      // 1. Save the payroll record override
      await onSavePayrollRecord(record);

      // 1b. Update cross-references on expenses
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

      // 2. Double-entry bookkeeping: Auto-create split Expenses if checked and reconciled
      if (!isReconciled || !bookExpense) {
        // Delete all payroll expenses associated with this cell if unmarked
        if (onDeleteExpense) {
          await onDeleteExpense(`payroll-salary-${staffMember.id}-${month}`);
          await onDeleteExpense(`payroll-tax-${staffMember.id}-${month}`);
          await onDeleteExpense(`payroll-pension-${staffMember.id}-${month}`);
          await onDeleteExpense(`payroll-exp-${staffMember.id}-${month}`);
        }
      } else {
        // Clean up legacy single-booking expense if any exists
        if (onDeleteExpense) {
          await onDeleteExpense(`payroll-exp-${staffMember.id}-${month}`);
        }

        // Find Nominal Codes
        const salaryNominal = nominalCodes.find(c => c.id === '500' || c.code?.includes('500') || c.code?.toLowerCase().includes('salary'))?.code || '500 - Salaries & Wages';
        const taxNominal = nominalCodes.find(c => c.id === '501' || c.code?.includes('501') || c.code?.toLowerCase().includes('paye') || c.code?.toLowerCase().includes('tax') || c.code?.toLowerCase().includes('ni'))?.code || '501 - HMRC PAYE & NI Contributions';
        const pensionNominal = nominalCodes.find(c => c.id === '502' || c.code?.includes('502') || c.code?.toLowerCase().includes('pension') || c.code?.toLowerCase().includes('london'))?.code || '502 - Royal London Pension Contributions';

        // 2a. Net Take-Home Salary Payment (Gross Salary + Comm - Deductions)
        const netSalaryAmt = baseVal + commVal - taxNicVal - pensionVal;
        const netExp = {
          id: `payroll-salary-${staffMember.id}-${month}`,
          date: `${month}-28`,
          payee: `Net Salary: ${staffMember.fullName}`,
          amount: netSalaryAmt,
          currency: staffMember.currency || 'GBP',
          nominalCode: salaryNominal,
          allocationType: 'staff',
          allocationTarget: [staffMember.id],
          plMonth: month,
          notes: `Net take-home pay. Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
        };
        await onSaveExpense(netExp);

        // 2b. HMRC PAYE / NI (Employer NI + Employee Tax/NI)
        const totalHmrcAmt = empNiVal + taxNicVal;
        if (totalHmrcAmt > 0) {
          const taxExp = {
            id: `payroll-tax-${staffMember.id}-${month}`,
            date: `${month}-28`,
            payee: `HMRC PAYE & NI: ${staffMember.fullName}`,
            amount: totalHmrcAmt,
            currency: staffMember.currency || 'GBP',
            nominalCode: taxNominal,
            allocationType: 'staff',
            allocationTarget: [staffMember.id],
            plMonth: month,
            notes: `HMRC payroll taxes (Employer NI: £${empNiVal.toFixed(2)}, Employee tax/NI deduction: £${taxNicVal.toFixed(2)}). Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
          };
          await onSaveExpense(taxExp);
        } else if (onDeleteExpense) {
          await onDeleteExpense(`payroll-tax-${staffMember.id}-${month}`);
        }

        // 2c. Royal London Pension (Employer Pension + Employee Pension deduction)
        const totalPensionAmt = empPensionVal + pensionVal;
        if (totalPensionAmt > 0) {
          const pensionExp = {
            id: `payroll-pension-${staffMember.id}-${month}`,
            date: `${month}-28`,
            payee: `Royal London Pension: ${staffMember.fullName}`,
            amount: totalPensionAmt,
            currency: staffMember.currency || 'GBP',
            nominalCode: pensionNominal,
            allocationType: 'staff',
            allocationTarget: [staffMember.id],
            plMonth: month,
            notes: `Royal London Pension contributions (Employer share: £${empPensionVal.toFixed(2)}, Employee deduction: £${pensionVal.toFixed(2)}). Reconciled via Group Payroll Module. ${reconcileNotes.trim()}`
          };
          await onSaveExpense(pensionExp);
        } else if (onDeleteExpense) {
          await onDeleteExpense(`payroll-pension-${staffMember.id}-${month}`);
        }
      }

      onShowToast(`Payroll details and double-entry split ledger records saved for ${staffMember.fullName} (${month})`, 'success');
      setSelectedCell(null);
    } catch (err) {
      onShowToast(`Error saving overrides: ${err.message}`, 'warning');
    }
  };

  // Roster listing filtering
  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.jobTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompanyId === 'all' || s.companyId === selectedCompanyId;
    const matchesDept = selectedDept === 'all' || s.department === selectedDept;
    
    // Status check (reconciled vs projected)
    if (selectedStatus !== 'all') {
      const cellStatuses = MONTHS.map(m => getCellData(s, m).isReconciled);
      const hasReconciled = cellStatuses.some(status => status === true);
      if (selectedStatus === 'reconciled' && !hasReconciled) return false;
      if (selectedStatus === 'projected' && hasReconciled && cellStatuses.every(status => status === true)) return false;
    }

    return matchesSearch && matchesCompany && matchesDept;
  });

  // Roster Grouping Logic: Group by Company, then by Department
  const groupedRoster = {};
  filteredStaff.forEach(s => {
    const compId = s.companyId || 'unassigned';
    const dept = s.department || 'Other';

    if (!groupedRoster[compId]) groupedRoster[compId] = {};
    if (!groupedRoster[compId][dept]) groupedRoster[compId][dept] = [];
    groupedRoster[compId][dept].push(s);
  });

  // Calculate monthly summaries for visual indicator row
  const monthlyTotals = MONTHS.map(m => {
    let totalBasic = 0;
    let totalComm = 0;
    let totalPaid = 0;
    let countReconciled = 0;

    filteredStaff.forEach(s => {
      const data = getCellData(s, m);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      
      {/* Top Banner Details */}
      <div className="detail-section" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
            <DollarSign size={28} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Spreadsheet Forecast & Actuals Ledgers</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Interactive workspace for group-wide salaries and commissions normalized to GBP (£). Click on any monthly cell to reconcile with your bank statement uploads or book expenses directly.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        width: 'fit-content',
        gap: '4px',
        marginBottom: '4px'
      }}>
        {[
          { key: 'grid', label: 'Group Payroll & Projections' },
          { key: 'policies', label: 'Payroll Policy Templates' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 600,
              color: activeSubTab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'grid' && (
        <>
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

          <select 
            className="select-filter"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="all">All Group Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All Cell Statuses</option>
            <option value="reconciled">Has Reconciled Months</option>
            <option value="projected">Projections Only</option>
          </select>
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
              
              {/* Month Columns */}
              {MONTHS.map(m => {
                const label = new Date(m + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                return (
                  <th key={m} style={{ textAlign: 'center', minWidth: '100px' }}>
                    {label}
                  </th>
                );
              })}
              
              <th style={{ width: '130px', minWidth: '130px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid var(--border-color)' }}>
                Annual Total (£)
              </th>
            </tr>
          </thead>
          <tbody>
            
            {/* Iterating Companies */}
            {companies
              .filter(c => selectedCompanyId === 'all' || c.id === selectedCompanyId)
              .map(c => {
                const depts = groupedRoster[c.id];
                if (!depts || Object.keys(depts).length === 0) return null;

                return (
                  <React.Fragment key={c.id}>
                    
                    {/* Company Roster Subheader */}
                    <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                      <td colSpan={MONTHS.length + 3} style={{ fontWeight: 700, padding: '8px 12px', fontSize: '11px', color: 'var(--accent)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={12} />
                          {c.name.toUpperCase()} ({c.country})
                        </div>
                      </td>
                    </tr>

                    {/* Iterating Departments inside Company */}
                    {Object.keys(depts)
                      .filter(d => selectedDept === 'all' || d === selectedDept)
                      .map(d => {
                        const members = depts[d];
                        if (members.length === 0) return null;

                        return (
                          <React.Fragment key={d}>
                            
                            {/* Department title */}
                            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                              <td colSpan={MONTHS.length + 3} style={{ fontWeight: 600, padding: '6px 16px', fontSize: '10px', color: 'var(--text-secondary)', borderRight: '2px solid var(--border-color)', left: 0, position: 'sticky', zIndex: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Layers size={10} />
                                  {d} Team
                                </div>
                              </td>
                            </tr>

                            {/* Recruiter Rows */}
                            {members.map(s => {
                              let annualSum = 0;
                              const symbol = symbolMap[s.currency || 'GBP'] || '£';

                              return (
                                <tr key={s.id} hover="true">
                                  {/* Recruiter Sticky Profile cell */}
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

                                  {/* Basic Contract Roster */}
                                  <td style={{ fontSize: '11px', borderRight: '1px solid var(--border-color)' }}>
                                    {symbol}{Number(s.salary).toLocaleString()} / yr
                                  </td>

                                  {/* Render Cells dynamically */}
                                  {MONTHS.map(m => {
                                    const cell = getCellData(s, m);
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
${cell.employerNi > 0 ? `Employer NI: £${Math.round(cell.employerNi).toLocaleString()}\n` : ''}${cell.employerPension > 0 ? `Employer Pension: £${Math.round(cell.employerPension).toLocaleString()}\n` : ''}${cell.employeeTaxNic > 0 ? `Employee Tax/NIC: £${Math.round(cell.employeeTaxNic).toLocaleString()}\n` : ''}${cell.employeePension > 0 ? `Employee Pension: £${Math.round(cell.employeePension).toLocaleString()}\n` : ''}Click to edit override`}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          <span>£{Math.round(cell.total).toLocaleString()}</span>
                                          {cell.isReconciled ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontSize: '8px', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>
                                              <CheckCircle2 size={7} /> Paid
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                                              Proj
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}

                                  {/* Annual Total Cell */}
                                  <td style={{ 
                                    textAlign: 'right', 
                                    fontWeight: 700, 
                                    fontFamily: 'monospace', 
                                    borderLeft: '2px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    fontSize: '12px'
                                  }}>
                                    £{Math.round(annualSum).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}

            {/* Matrix totals Row */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700 }}>
              <td style={{ left: 0, position: 'sticky', backgroundColor: 'var(--bg-secondary)', zIndex: 8, borderRight: '2px solid var(--border-color)' }}>
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
              
              <td style={{ textAlign: 'right', borderLeft: '2px solid var(--border-color)', fontSize: '12px', fontFamily: 'monospace' }}>
                £{Math.round(monthlyTotals.reduce((sum, t) => sum + t.total, 0)).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* ==============================================================
          SUB-TAB: PAYROLL POLICIES MANAGER
          ============================================================== */}
      {activeSubTab === 'policies' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', animation: 'fadeIn 0.2s' }}>
          
          {/* Left Column: Form to create/edit policy */}
          <form onSubmit={handleSavePolicySubmit} className="detail-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={16} style={{ color: 'var(--primary)' }} /> 
              {editingPolicyId ? 'Modify' : 'Create'} Payroll Policy Template
            </div>
            
            <div className="form-group">
              <label className="form-label">Template Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. UK Full Time Staff"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Policy Structure Type <span>*</span></label>
              <select 
                className="select-filter"
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="ft_uk">FT UK Employee (PAYE, NIC, Pension, Student Loan)</option>
                <option value="freelance">Freelance Contractor (Daily Rate, Attendance-based)</option>
                <option value="custom">Custom Formula (Global / Multi-rate)</option>
              </select>
            </div>

            {policyType !== 'freelance' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      🏢 Employer Benefits
                    </h4>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '10px' }}>Employer Pension Rate (%)</label>
                      <input 
                        type="number" step="any" className="form-input" value={employerPensionRate} onChange={(e) => setEmployerPensionRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      👥 Employee Deductions
                    </h4>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '10px' }}>Employee Pension Rate (%)</label>
                      <input 
                        type="number" step="any" className="form-input" value={employeePensionRate} onChange={(e) => setEmployeePensionRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px' }}>
                    📈 Progressive Tax & NI Bands (Monthly)
                  </h4>
                  
                  {/* 1. PAYE Slabs */}
                  <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Employee PAYE (Income Tax) Brackets:</span>
                      <button type="button" onClick={() => handleAddSlab('paye')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                        + Add Band
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {payeSlabs.map((slab, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('paye', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                          <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('paye', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                          <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('paye', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '11px' }}>%</span>
                          <button type="button" onClick={() => handleRemoveSlab('paye', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Employee NI Slabs */}
                  <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Employee NI (NIC) Brackets:</span>
                      <button type="button" onClick={() => handleAddSlab('eeNi')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                        + Add Band
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {employeeNiSlabs.map((slab, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('eeNi', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                          <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('eeNi', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                          <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('eeNi', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '11px' }}>%</span>
                          <button type="button" onClick={() => handleRemoveSlab('eeNi', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Employer NI Slabs */}
                  <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>Employer NI (NIC) Brackets:</span>
                      <button type="button" onClick={() => handleAddSlab('erNi')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                        + Add Band
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {employerNiSlabs.map((slab, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('erNi', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                          <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('erNi', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                          <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('erNi', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                          <span style={{ fontSize: '11px' }}>%</span>
                          <button type="button" onClick={() => handleRemoveSlab('erNi', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {policyType === 'ft_uk' && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="policy-student-loan-check" 
                        checked={studentLoanActive} 
                        onChange={(e) => setStudentLoanActive(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor="policy-student-loan-check" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                        Estimate Student Loan Deductions
                      </label>
                    </div>
                    {studentLoanActive && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px', animation: 'fadeIn 0.2s' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '10px' }}>Student Loan Rate (%)</label>
                          <input 
                            type="number" step="any" className="form-input" value={studentLoanRate} onChange={(e) => setStudentLoanRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '10px' }}>Monthly Threshold (£)</label>
                          <input 
                            type="number" step="any" className="form-input" value={studentLoanThreshold} onChange={(e) => setStudentLoanThreshold(e.target.value)} style={{ width: '100%', padding: '6px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Default Daily Rate (£)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 300"
                    value={dailyRateDefault} 
                    onChange={(e) => setDailyRateDefault(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Est. Working Days / Month</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    placeholder="e.g. 21.67"
                    value={expectedDaysPerMonth} 
                    onChange={(e) => setExpectedDaysPerMonth(e.target.value)} 
                  />
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    💡 Calculated automatically based on weekends & public holidays. Enter fallback estimate (e.g. 0 to calculate dynamically).
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                {editingPolicyId ? 'Update Policy Template' : 'Create Policy Template'}
              </button>
              {editingPolicyId && (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setEditingPolicyId(null);
                    setPolicyName('');
                    setPolicyType('ft_uk');
                    setEmployerNiRate('13.8');
                    setEmployerNiThreshold('758');
                    setEmployerPensionRate('3.0');
                    setEmployeeTaxNicRate('20.0');
                    setEmployeePensionRate('5.0');
                    setStudentLoanActive(false);
                    setStudentLoanRate('9.0');
                    setStudentLoanThreshold('2274');
                    setDailyRateDefault('0');
                    setExpectedDaysPerMonth('21.67');
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {/* Right Column: Policies Registry & Assignment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="detail-section">
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Active Policy Templates</h3>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="entity-table dense" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Template Name</th>
                      <th>Structure</th>
                      <th>Summary Rates</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollPolicies.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>
                          <span style={{ 
                            fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: p.type === 'ft_uk' ? 'rgba(99, 102, 241, 0.12)' : p.type === 'freelance' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                            color: p.type === 'ft_uk' ? 'var(--primary)' : p.type === 'freelance' ? 'var(--warning)' : 'var(--text-secondary)'
                          }}>
                            {p.type === 'ft_uk' ? 'FT UK' : p.type === 'freelance' ? 'Freelance' : 'Custom'}
                          </span>
                        </td>
                        <td>
                          {p.type === 'freelance' ? (
                            <span>Daily: £{p.dailyRateDefault} ({p.expectedDaysPerMonth} days)</span>
                          ) : (
                            <span>Er NI: {p.employerNiRate}%, Er Pen: {p.employerPensionRate}%, Ee Tax: {p.employeeTaxNicRate}%</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            <button className="btn-icon" onClick={() => handleEditPolicyClick(p)} title="Edit Policy" style={{ border: 'none', background: 'none' }}>
                              📝
                            </button>
                            <button 
                              className="btn-icon delete" 
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete policy template "${p.name}"?`)) {
                                  onDeletePayrollPolicy(p.id);
                                }
                              }}
                              title="Delete Policy"
                              style={{ border: 'none', background: 'none' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {payrollPolicies.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                          No policies defined. Create one on the left.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Assignment Panel */}
            <div className="detail-section">
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Roster Policy Assignment Desk</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Quickly link staff members to payroll templates for real-time projections.
              </p>

              {selectedPayrollStaffIds.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  gap: '12px'
                }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    Selected: {selectedPayrollStaffIds.length} staff member(s)
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      id="bulkPayrollPolicySelect"
                      className="select-filter"
                      defaultValue=""
                      style={{ padding: '4px 8px', fontSize: '11px', minWidth: '150px', height: '28px' }}
                    >
                      <option value="">-- No Policy (Salaried Default) --</option>
                      {payrollPolicies.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={async () => {
                        const selectedVal = document.getElementById('bulkPayrollPolicySelect')?.value || '';
                        try {
                          for (const staffId of selectedPayrollStaffIds) {
                            const s = staff.find(x => x.id === staffId);
                            if (s && onUpdateStaff) {
                              await onUpdateStaff({ ...s, payrollPolicyId: selectedVal });
                            }
                          }
                          onShowToast(`Assigned policy template to ${selectedPayrollStaffIds.length} staff members.`, "success");
                          setSelectedPayrollStaffIds([]);
                        } catch (err) {
                          onShowToast(`Error updating policies: ${err.message}`, "warning");
                        }
                      }}
                      style={{ padding: '4px 12px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPayrollStaffIds([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: 0
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="entity-table dense" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={staff.length > 0 && staff.every(s => selectedPayrollStaffIds.includes(s.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPayrollStaffIds(staff.map(s => s.id));
                            } else {
                              setSelectedPayrollStaffIds([]);
                            }
                          }}
                        />
                      </th>
                      <th>Recruiter / Staff</th>
                      <th>Assign Policy Template</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => {
                      const isChecked = selectedPayrollStaffIds.includes(s.id);
                      return (
                        <tr 
                          key={s.id}
                          style={{ backgroundColor: isChecked ? 'rgba(99,102,241,0.04)' : 'transparent' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedPayrollStaffIds(prev => 
                                  prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                );
                              }}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.fullName} ({s.department})</td>
                          <td>
                            <select
                              className="select-filter"
                              value={s.payrollPolicyId || ''}
                              onChange={async (e) => {
                                const val = e.target.value;
                                try {
                                  if (onUpdateStaff) {
                                    await onUpdateStaff({ ...s, payrollPolicyId: val });
                                    onShowToast(`Assigned policy template to ${s.fullName}`, "success");
                                  }
                                } catch (err) {
                                  onShowToast(`Error: ${err.message}`, "warning");
                                }
                              }}
                              style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                            >
                              <option value="">-- No Policy (Salaried Default) --</option>
                              {payrollPolicies.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
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
              
              {/* Reconciliation Status Toggle */}
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

              {/* Reconcile with Expense Ledger Payment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  🔗 Reconcile with Expense Ledger Payment
                </label>
                {(() => {
                  const currentLinked = expenses.find(e => e.id === linkedExpenseId);
                  
                  // Filter unlinked expenses + include currently linked if present
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
                              setBookExpense(false); // Prevent double-booking since it already exists!
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
                          title="Clear linkage"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Basic Salary Override Field */}
              <div className="form-group">
                <label className="form-label">
                  Basic Salary Component (£ GBP) <span>*</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={basicSalaryOverride}
                  onChange={(e) => setBasicSalaryOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {/* Commission Override Field */}
              <div className="form-group">
                <label className="form-label">
                  Commission Component (£ GBP) <span>*</span>
                </label>
                <input 
                  type="number"
                  className="form-input"
                  value={commissionOverride}
                  onChange={(e) => setCommissionOverride(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {/* Contributions & Deductions Breakdown */}
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

              {/* Total Summary */}
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
                  <span>Gross Earnings (Basic + Comm):</span>
                  <span>£{(Number(basicSalaryOverride) + Number(commissionOverride)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Net Take-Home Pay (to Recruiter):</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                    £{(Number(basicSalaryOverride) + Number(commissionOverride) - Number(employeeTaxNic) - Number(employeePension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '4px' }}>
                  <span>Total Cost to Company (CoC):</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    £{(Number(basicSalaryOverride) + Number(commissionOverride) + Number(employerNi) + Number(employerPension)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Notes */}
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

              {/* Auto Book Expense option */}
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              {(() => {
                const policy = payrollPolicies.find(p => p.id === selectedCell.staffMember.payrollPolicyId);
                if (policy && policy.type === 'freelance') {
                  return (
                    <button
                      type="button"
                      className="btn-accent"
                      onClick={() => handleDownloadInvoice(
                        selectedCell.staffMember,
                        selectedCell.month,
                        Number(basicSalaryOverride) || 0,
                        Number(commissionOverride) || 0
                      )}
                      style={{ marginRight: 'auto', backgroundColor: '#f59e0b', color: 'white' }}
                    >
                      📥 Download Invoice
                    </button>
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

    </div>
  );
}
