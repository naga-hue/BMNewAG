import React, { useState } from 'react';
import { 
  X, 
  User, 
  Building2, 
  Wallet, 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  Trash2, 
  UploadCloud, 
  Eye, 
  ClipboardList,
  Clock,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Percent,
  Laptop,
  Unlock,
  Printer
} from 'lucide-react';
import { firebaseService } from '../services/firebase';
import { toGBP } from '../utils/currency';

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

export default function StaffDetail({ 
  staffMember, 
  companies, 
  isOpen, 
  onClose, 
  onUpdateStaff, 
  onShowToast, 
  staffList = [], 
  onSelectStaff,
  leavePolicies = [],
  leaveRequests = [],
  onSaveLeaveRequest,
  commissionPolicies = [],
  contracts = [],
  assetAssignments = [], 
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  placements = [],
  letterTemplates = []
}) {
  const [activeTab, setActiveTab] = useState('profile'); // profile, documents, leaves, commissions, assets

  const DEFAULT_TEMPLATES = {
    'offer-letter': `Date: ${new Date().toLocaleDateString('en-GB')}

PRIVATE & CONFIDENTIAL
To: {{staff_name}}
Address: {{staff_address}}

Dear {{staff_name}},

Subject: Offer of Employment - {{job_title}}

On behalf of {{company_name}}, we are pleased to offer you the position of {{job_title}} starting on {{start_date}}.

Terms of Offer:
- Gross Base Pay: {{salary}} per annum
- Department: {{department}}
- Notice Period: 1 Month

We look forward to welcoming you to {{company_name}}.

Yours sincerely,

{{signature}}
{{company_name}}`,

    'service-agreement': `CONTRACT FOR SERVICES / AGREEMENT

This Agreement is made on ${new Date().toLocaleDateString('en-GB')} between:
1. {{company_name}} (the "Company")
2. {{staff_name}} (the "Contractor")

Services and Terms:
- Position / Role: {{job_title}}
- Department: {{department}}
- Commencement Date: {{start_date}}
- Compensation Rate: {{salary}} per annum (subject to services delivered)

The Contractor agrees to provide recruitment services in accordance with company policy.

Signed:

______________________
For the Company ({{signature}})

______________________
{{staff_name}} (Contractor)`,

    'exit-letter': `Date: ${new Date().toLocaleDateString('en-GB')}

To: {{staff_name}}

Dear {{staff_name}},

Subject: Confirmation of Termination / Exit Agreement

We write to confirm that your last working date with {{company_name}} is agreed as {{last_working_date}}.

Notice Pay Terms:
- Notice Period: {{notice_period}}
- Notice Pay Period: {{notice_pay_period}}
- Notice Payment Date: {{notice_pay_terms}}
- Additional Exit Compensation: {{additional_payment}}

Please return all company equipment and software licenses. We thank you for your services.

Yours sincerely,

{{signature}}
{{company_name}}`,

    'general': `Date: ${new Date().toLocaleDateString('en-GB')}

To: {{staff_name}}

Dear {{staff_name}},

[Write your official communication here...]

Yours sincerely,

{{signature}}
{{company_name}}`
  };

  const [deactivationStates, setDeactivationStates] = useState(() => {
    try {
      const saved = localStorage.getItem('deactivation_states');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [docTemplateType, setDocTemplateType] = useState('offer-letter');
  const [selectedTemplateId, setSelectedTemplateId] = useState('offer-letter');
  const [docCompanyId, setDocCompanyId] = useState(staffMember ? staffMember.companyId : '');
  const [docContent, setDocContent] = useState('');
  
  // Custom Letterhead states
  const [lhLogoUrl, setLhLogoUrl] = useState('');
  const [lhAddress, setLhAddress] = useState('');
  const [lhSignatureText, setLhSignatureText] = useState('');
  const [lhLetterheadBgUrl, setLhLetterheadBgUrl] = useState('');

  // Update docContent when template changes or company letterhead selection changes
  React.useEffect(() => {
    if (staffMember) {
      const matched = letterTemplates.find(t => t.id === selectedTemplateId);
      if (matched) {
        setDocTemplateType(matched.type || 'general');
        setDocContent(matched.body || '');
      } else if (DEFAULT_TEMPLATES[selectedTemplateId]) {
        setDocTemplateType(selectedTemplateId);
        setDocContent(DEFAULT_TEMPLATES[selectedTemplateId]);
      }
    }
  }, [selectedTemplateId, staffMember, letterTemplates]);

  // Autoload letterhead branding when selected company changes
  React.useEffect(() => {
    if (staffMember) {
      const resolvedCompany = companies.find(c => c.id === docCompanyId);
      if (resolvedCompany) {
        setLhLogoUrl(resolvedCompany.logoUrl || '');
        setLhAddress(resolvedCompany.addressOverride || resolvedCompany.address || '');
        setLhSignatureText(resolvedCompany.signatureText || 'Authorized Signatory');
        setLhLetterheadBgUrl(resolvedCompany.letterheadBgUrl || '');
      }
    }
  }, [docCompanyId, companies, staffMember]);

  const handleToggleDeactivationState = (key, val) => {
    const next = { ...deactivationStates, [key]: val };
    setDeactivationStates(next);
    try {
      localStorage.setItem('deactivation_states', JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  const getParsedLetter = () => {
    let text = docContent || DEFAULT_TEMPLATES[docTemplateType] || '';
    if (!staffMember) return text;
    
    const resolvedCompany = companies.find(c => c.id === docCompanyId) || employerCompany || { name: 'Humres Group' };
    
    text = text.replace(/{{staff_name}}/g, staffMember.fullName || '');
    text = text.replace(/{{candidate_name}}/g, staffMember.fullName || '');
    text = text.replace(/{{staff_address}}/g, staffMember.address || 'Address Not Set');
    text = text.replace(/{{candidate_address}}/g, staffMember.address || 'Address Not Set');
    text = text.replace(/{{job_title}}/g, staffMember.jobTitle || '');
    text = text.replace(/{{start_date}}/g, staffMember.startDate || '');
    text = text.replace(/{{date_of_joining}}/g, staffMember.startDate || '');
    text = text.replace(/{{department}}/g, staffMember.department || '');
    text = text.replace(/{{company_name}}/g, resolvedCompany.name || '');
    text = text.replace(/{{salary}}/g, `${currencyObj.symbol}${Number(staffMember.salary || 0).toLocaleString()}`);
    text = text.replace(/{{candidate_salary}}/g, `${currencyObj.symbol}${Number(staffMember.salary || 0).toLocaleString()}`);
    text = text.replace(/{{last_working_date}}/g, staffMember.lastWorkingDate || 'Not Specified');
    text = text.replace(/{{notice_period}}/g, staffMember.noticePeriod || 'None');
    text = text.replace(/{{notice_pay_period}}/g, staffMember.noticePayPeriod || 'None');
    text = text.replace(/{{additional_payment}}/g, `${currencyObj.symbol}${Number(staffMember.additionalExitPayment || 0).toLocaleString()}`);
    
    const termsText = staffMember.noticePayoutOption === 'regular-payroll' ? 'Paid on Next Regular Payroll' :
                      staffMember.noticePayoutOption === 'end-of-notice' ? 'Paid at End of Notice Period' :
                      staffMember.noticePayoutOption === 'custom-date' ? `Paid on Custom Date (${staffMember.noticePayoutCustomDate})` :
                      'Next Payroll';
    text = text.replace(/{{notice_pay_terms}}/g, termsText);
    text = text.replace(/{{signature}}/g, lhSignatureText || 'Authorized Signatory');
    text = text.replace(/{{signature_authority}}/g, lhSignatureText || 'Authorized Signatory');
    
    return text;
  };

  const handlePrintLetter = () => {
    const printContent = document.getElementById('print-letterhead-content');
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Print Document - ${staffMember.fullName}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; font-family: serif; color: #000; background: #fff; line-height: 1.6; }
            #print-letterhead-content {
              width: 210mm;
              height: 297mm;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            a { color: #000; text-decoration: none; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleSaveGeneratedLetter = async () => {
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: `${docTemplateType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}.pdf`,
      type: 'letter',
      fileSize: `${Math.round(getParsedLetter().length / 1024) || 1} KB`,
      uploadDate: new Date().toISOString().split('T')[0],
      content: getParsedLetter(),
      companyId: docCompanyId
    };
    
    const updatedStaff = {
      ...staffMember,
      documents: [...(staffMember.documents || []), newDoc]
    };
    try {
      await onUpdateStaff(updatedStaff);
      onShowToast("Document saved to employee records library!", "success");
    } catch (e) {
      onShowToast("Error saving document: " + e.message, "danger");
    }
  };
  const [uploadDocType, setUploadDocType] = useState('appointment');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // New leave request form state
  const [requestLeaveType, setRequestLeaveType] = useState('annual');
  const [requestStartDate, setRequestStartDate] = useState('');
  const [requestEndDate, setRequestEndDate] = useState('');
  const [requestDays, setRequestDays] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Commission Simulator & Actual statement states
  const [payrollMonth, setPayrollMonth] = useState('2026-06');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedBilling, setSimulatedBilling] = useState('');
  const [simulatedTeamBilling, setSimulatedTeamBilling] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);

  // Asset Assignment state
  const [newAssetContractId, setNewAssetContractId] = useState('');

  if (!staffMember || !isOpen) return null;

  // Resolve employer company details
  const employerCompany = companies.find(c => c.id === staffMember.companyId);
  const companyName = employerCompany ? employerCompany.name : 'Unknown Company';
  const companyCountry = employerCompany ? employerCompany.country : 'Unknown Country';
  const currencyObj = CURRENCIES.find(c => c.code === (staffMember.currency || 'GBP')) || { code: 'GBP', symbol: '£' };

  // Resolve manager details
  const reportingManager = staffList.find(s => s.id === staffMember.reportingManagerId);
  const policy = leavePolicies.find(p => p.id === staffMember.leavePolicyId);

  // Resolve commission policy details
  const commPolicy = commissionPolicies.find(p => p.id === staffMember.commissionPolicyId);

  // Filter leave requests for this staff member
  const staffLeaves = leaveRequests.filter(r => r.staffId === staffMember.id);
  const approvedLeaves = staffLeaves.filter(r => r.status === 'approved');

  // Compute taken balances
  const annualTaken = approvedLeaves.filter(r => r.leaveType === 'annual').reduce((sum, r) => sum + r.totalDays, 0);
  const sickTaken = approvedLeaves.filter(r => r.leaveType === 'sick').reduce((sum, r) => sum + r.totalDays, 0);

  // Filter staff assets
  const myAssignments = assetAssignments.filter(a => a.staffId === staffMember.id);

  // Currency helper already initialized above.

  // File Upload Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    onShowToast(`Uploading file "${file.name}"...`, 'info');
    try {
      const docMetadata = await firebaseService.uploadStaffFile(staffMember.id, file, uploadDocType);
      
      const updatedDocuments = [...(staffMember.documents || []), docMetadata];
      const updatedStaff = { ...staffMember, documents: updatedDocuments };
      
      await onUpdateStaff(updatedStaff);
      onShowToast(`Uploaded "${file.name}" successfully!`, 'success');
    } catch (err) {
      console.error("Staff upload error:", err);
      onShowToast(`Failed to upload file: ${err.message}`, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (docObj) => {
    if (window.confirm(`Are you sure you want to delete "${docObj.name}"?`)) {
      try {
        await firebaseService.deleteFile(docObj);
        const updatedDocuments = (staffMember.documents || []).filter(d => d.id !== docObj.id);
        const updatedStaff = { ...staffMember, documents: updatedDocuments };
        
        await onUpdateStaff(updatedStaff);
        onShowToast(`Deleted document "${docObj.name}"`, 'info');
      } catch (err) {
        console.error("Delete doc error:", err);
        onShowToast(`Error deleting file: ${err.message}`, 'danger');
      }
    }
  };

  const handlePreviewDoc = (doc) => {
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    } else {
      alert(`[SIMULATED FILE VIEWER]\nViewing file: ${doc.name}\nType: ${doc.type.toUpperCase()}\nUploaded: ${doc.uploadDate}\nSize: ${doc.fileSize}`);
    }
  };

  // Submit Leave Request
  const handleRequestLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!requestStartDate || !requestEndDate || !requestDays || Number(requestDays) <= 0) {
      onShowToast("Please enter valid leave request dates and days.", "warning");
      return;
    }

    const newRequest = {
      id: `req-${Date.now()}`,
      staffId: staffMember.id,
      leaveType: requestLeaveType,
      startDate: requestStartDate,
      endDate: requestEndDate,
      totalDays: Number(requestDays),
      status: "pending",
      notes: requestNotes.trim()
    };

    try {
      await onSaveLeaveRequest(newRequest);
      onShowToast("Submitted leave request for review.", "success");
      
      // Reset form
      setRequestStartDate('');
      setRequestEndDate('');
      setRequestDays('');
      setRequestNotes('');
      setShowRequestForm(false);
    } catch (err) {
      console.error("Error saving leave request:", err);
      onShowToast(`Error submitting request: ${err.message}`, "warning");
    }
  };

  // Run Commission simulation
  const handleCalculateSimulation = (e) => {
    e.preventDefault();
    if (!commPolicy) return;

    const isManager = commPolicy.type === 'manager';
    const billingVal = isManager ? (Number(simulatedTeamBilling) || 0) : (Number(simulatedBilling) || 0);
    const threshold = commPolicy.monthlyThreshold || 0;
    
    // Deduct monthly threshold
    const commissionableBilling = Math.max(0, billingVal - threshold);
    
    // Calculate slab commission
    let remainingBilling = commissionableBilling;
    let totalCommission = 0;
    const slabBreakdown = [];
    
    const sortedSlabs = [...(commPolicy.slabs || [])].sort((a, b) => a.minAmount - b.minAmount);
    
    for (const slab of sortedSlabs) {
      if (remainingBilling <= 0) break;
      
      const slabLimit = slab.maxAmount - slab.minAmount;
      const slabApplicable = Math.min(remainingBilling, slabLimit);
      const slabEarned = (slabApplicable * slab.rate) / 100;
      
      totalCommission += slabEarned;
      remainingBilling -= slabApplicable;
      
      slabBreakdown.push({
        slabRange: `${currencyObj.symbol}${slab.minAmount.toLocaleString()} to ${slab.maxAmount >= 999999 ? '∞' : `${currencyObj.symbol}${slab.maxAmount.toLocaleString()}`}`,
        rate: slab.rate,
        applicable: slabApplicable,
        earned: slabEarned
      });
    }
    
    setSimulationResult({
      inputBilling: billingVal,
      commissionableBilling,
      slabBreakdown,
      totalEarned: totalCommission
    });
  };

  // Assign asset/license
  const handleAssignAsset = async (e) => {
    e.preventDefault();
    if (!newAssetContractId) return;

    const selectedContract = contracts.find(c => c.id === newAssetContractId);
    if (!selectedContract) return;

    const newAssignment = {
      id: `ass-${Date.now()}`,
      contractId: newAssetContractId,
      staffId: staffMember.id,
      assignedDate: new Date().toISOString().split('T')[0]
    };

    try {
      await onSaveAssetAssignment(newAssignment);
      onShowToast(`Assigned license "${selectedContract.name}" to ${staffMember.fullName}.`, 'success');
      setNewAssetContractId('');
    } catch (err) {
      onShowToast(`Error allocating license: ${err.message}`, 'warning');
    }
  };

  // Release Asset
  const handleReleaseAsset = async (assignmentId, assetName) => {
    if (window.confirm(`Are you sure you want to release the "${assetName}" license seat from this employee?`)) {
      try {
        await onDeleteAssetAssignment(assignmentId);
        onShowToast(`Released "${assetName}" seat back to corporate pool.`, 'info');
      } catch (err) {
        onShowToast(`Error releasing asset: ${err.message}`, 'warning');
      }
    }
  };

  // Filter available license pools (contracts with remaining seats and owned by company)
  const companyContracts = contracts.filter(c => c.companyId === staffMember.companyId && c.quantityPurchased > 1);
  const availablePools = companyContracts.filter(c => {
    const assignedCount = assetAssignments.filter(a => a.contractId === c.id).length;
    const alreadyAssignedToMe = myAssignments.some(a => a.contractId === c.id);
    return assignedCount < c.quantityPurchased && !alreadyAssignedToMe;
  });

  const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

  // 1. Centralized Cash-Received Commission Calculation for this employee
  const calculateCashReceivedCommission = (member, policy, monthStr) => {
    if (!policy) {
      return { 
        billing: 0, 
        baseEarned: 0, 
        withheld: 0, 
        paidNow: 0, 
        released: 0, 
        totalPayout: 0, 
        currentPlacements: [], 
        releasedPlacements: [], 
        historicalWithheld: [],
        slabBreakdown: [],
        commissionableBilling: 0
      };
    }

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

    if (isLocked) {
      return { 
        billing: 0, 
        baseEarned: 0, 
        withheld: 0, 
        paidNow: 0, 
        released: 0, 
        totalPayout: 0, 
        currentPlacements: [], 
        releasedPlacements: [], 
        historicalWithheld: [],
        slabBreakdown: [],
        commissionableBilling: 0
      };
    }

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
      placements.forEach(p => {
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
      const policyCompany = companies.find(c => c.id === policy.companyId);
      const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
      
      const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold || 0, policyCurrency);
      const commissionable = Math.max(0, billingAmt - thresh);
      const slabs = policy.slabs || [];

      if (commissionable <= 0) return { earned: 0, commissionable: 0 };

      if (policy.slabType === 'flat_rate') {
        let highestRate = 0;
        for (const slab of slabs) {
          const min = toGBP(slab.minAmount || 0, policyCurrency);
          if (commissionable > min) {
            highestRate = Number(slab.rate) || 0;
          }
        }
        return { earned: (commissionable * highestRate) / 100, commissionable };
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
        return { earned, commissionable };
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
      const cumulativeRes = getPolicyCommission(cumulativeBilling);

      let previousBilling = 0;
      for (let m = startMonthOfQuarter; m <= monthVal - 1; m++) {
        previousBilling += getRecruiterBillingForStartMonth(yearVal, m);
      }
      const previousRes = getPolicyCommission(previousBilling);

      return {
        earned: Math.max(0, cumulativeRes.earned - previousRes.earned),
        commissionable: cumulativeRes.commissionable
      };
    };

    // 1. Current Cycle calculations (starts in previous month)
    const currentCycleBilling = getRecruiterBillingForStartMonth(cycleYear, cycleMonth);
    const policyRes = policy.calcInterval === 'quarterly'
      ? getQuarterlyCommissionForMonth(cycleYear, cycleMonth)
      : getPolicyCommission(currentCycleBilling);
    const baseEarned = policyRes.earned;

    const currentPlacements = [];
    let totalPaidNow = 0;
    let totalWithheld = 0;

    placements.forEach(p => {
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
          } else {
            totalWithheld += myCommShare;
          }

          currentPlacements.push({
            id: p.id,
            placementId: p.placementId,
            clientCompany: p.clientCompany,
            candidateName: p.candidateName,
            startDate: p.startDate,
            netScoreValue: p.netScoreValue,
            mySplitPct: totalSplitPct,
            myBillingShare,
            myCommShare,
            paymentStatus: p.clientPaymentStatus,
            clientPaidDate: p.clientPaidDate
          });
        }
      }
    });

    // 2. Releases from Prior Withholds (starts before the previous month)
    const releasedPlacements = [];
    const historicalWithheld = [];
    let totalReleased = 0;

    placements.forEach(p => {
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
          const histPolicyRes = policy.calcInterval === 'quarterly'
            ? getQuarterlyCommissionForMonth(pStartYear, pStartMonth)
            : getPolicyCommission(histCycleBilling);
          const histBaseEarned = histPolicyRes.earned;

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
              releasedPlacements.push({
                id: p.id,
                placementId: p.placementId,
                clientCompany: p.clientCompany,
                candidateName: p.candidateName,
                startDate: p.startDate,
                myBillingShare,
                myCommShare,
                clientPaidDate: p.clientPaidDate
              });
            } else if (!isPaid) {
              historicalWithheld.push({
                id: p.id,
                placementId: p.placementId,
                clientCompany: p.clientCompany,
                candidateName: p.candidateName,
                startDate: p.startDate,
                myBillingShare,
                myCommShare
              });
            }
          }
        }
      }
    });

    // Generate slab breakdown
    const slabBreakdown = [];
    const policyCompany = companies.find(c => c.id === policy.companyId);
    const currencyObj = policyCompany ? symbolMap[policyCompany.currency] || '£' : '£';
    
    if (policy.slabType === 'flat_rate') {
      let highestRate = 0;
      for (const slab of policy.slabs || []) {
        if (policyRes.commissionable > slab.minAmount) {
          highestRate = slab.rate;
        }
      }
      slabBreakdown.push({
        slabRange: `Flat rate tier (exceeds ${currencyObj}${policyRes.commissionable.toLocaleString()})`,
        rate: highestRate,
        applicable: policyRes.commissionable,
        earned: baseEarned
      });
    } else {
      let remainingBilling = policyRes.commissionable;
      const sortedSlabs = [...(policy.slabs || [])].sort((a, b) => a.minAmount - b.minAmount);
      
      for (const slab of sortedSlabs) {
        if (remainingBilling <= 0) break;
        
        const slabLimit = slab.maxAmount - slab.minAmount;
        const slabApplicable = Math.min(remainingBilling, slabLimit);
        const slabEarned = (slabApplicable * slab.rate) / 100;
        
        remainingBilling -= slabApplicable;
        
        slabBreakdown.push({
          slabRange: `${currencyObj}${slab.minAmount.toLocaleString()} to ${slab.maxAmount >= 999999 ? '∞' : `${currencyObj}${slab.maxAmount.toLocaleString()}`}`,
          rate: slab.rate,
          applicable: slabApplicable,
          earned: slabEarned
        });
      }
    }

    return {
      billing: currentCycleBilling,
      baseEarned,
      withheld: totalWithheld,
      paidNow: totalPaidNow,
      released: totalReleased,
      totalPayout: totalPaidNow + totalReleased,
      currentPlacements,
      releasedPlacements,
      historicalWithheld,
      slabBreakdown,
      commissionableBilling: policyRes.commissionable
    };
  };

  const actualStatementResult = calculateCashReceivedCommission(staffMember, commPolicy, payrollMonth);
  const actualPlacements = {
    items: actualStatementResult.currentPlacements.map(p => ({
      candidateName: p.candidateName,
      clientCompany: p.clientCompany,
      scoredDate: p.startDate,
      netScoreValue: p.netScoreValue,
      percentage: p.mySplitPct,
      allocatedVal: p.myBillingShare,
      paymentStatus: p.paymentStatus,
      clientPaidDate: p.clientPaidDate
    }))
  };

  // Helper to extract name of cycle month
  const getCycleMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const date = new Date(prevYear, prevMonth - 1, 15);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  return (
    <div className={`slide-over-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className="slide-over-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Panel Header */}
        <div className="panel-header">
          <div className="panel-title">
            <span className="country-badge country-us" style={{ width: 'fit-content', marginBottom: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              {staffMember.jobTitle}
            </span>
            <h2>
              {staffMember.fullName}
              {staffMember.status === 'exited' && (
                <span style={{ marginLeft: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', verticalAlign: 'middle' }}>
                  Exited
                </span>
              )}
            </h2>
            <span className="entity-legal-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
              <Building2 size={12} />
              {companyName} ({companyCountry}) &bull; {staffMember.department}
            </span>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--bg-sidebar)', 
          padding: '0 24px', 
          borderBottom: '1px solid var(--border-color)',
          gap: '16px' 
        }}>
          <button 
            onClick={() => setActiveTab('profile')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'profile' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Profile Info
          </button>
          <button 
            onClick={() => setActiveTab('documents')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'documents' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'documents' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Documents
            <span style={{ 
              fontSize: '11px', 
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '10px',
              marginLeft: '6px'
            }}>
              {(staffMember.documents || []).length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('leaves')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'leaves' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'leaves' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Leaves
            <span style={{ 
              fontSize: '11px', 
              background: staffLeaves.filter(r => r.status === 'pending').length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
              color: staffLeaves.filter(r => r.status === 'pending').length > 0 ? 'var(--warning)' : 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              {staffLeaves.filter(r => r.status === 'pending').length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('commissions')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'commissions' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'commissions' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Commission Plan
          </button>
          <button 
            onClick={() => setActiveTab('assets')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'assets' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'assets' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Assets & Tools
            <span style={{ 
              fontSize: '11px', 
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              {myAssignments.length}
            </span>
          </button>
        </div>

        {/* Panel Content */}
        <div className="panel-content">
          
          {/* TAB 1: Profile Info */}
          {activeTab === 'profile' && (
            <>
              {/* Job details Card */}
              <div className="detail-section">
                <div className="section-title">
                  <Building2 size={16} /> Job & Placement Details
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Employer Company</span>
                    <span className="detail-value">{companyName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department</span>
                    <span className="detail-value">{staffMember.department}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Designation / Title</span>
                    <span className="detail-value" style={{ fontWeight: 600 }}>{staffMember.jobTitle}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Official Start Date</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      {staffMember.startDate}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reporting Manager</span>
                    {reportingManager ? (
                      <button 
                        onClick={() => {
                          if (onSelectStaff) {
                            onSelectStaff(reportingManager);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          padding: 0,
                          textAlign: 'left',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title={`View ${reportingManager.fullName}'s profile`}
                      >
                        {reportingManager.fullName}
                      </button>
                    ) : (
                      <span className="detail-value" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        None / Reports to Board
                      </span>
                    )}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Employment Status</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: staffMember.status === 'exited' ? 'var(--danger)' : 'var(--success)',
                        backgroundColor: staffMember.status === 'exited' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        border: staffMember.status === 'exited' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                      }}>
                        {staffMember.status === 'exited' ? 'Exited / Inactive' : 'Active'}
                      </span>
                    </span>
                  </div>
                  {staffMember.status === 'exited' && (
                    <>
                      <div className="detail-item">
                        <span className="detail-label">Date of Exit Notification</span>
                        <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 600 }}>
                          <Calendar size={14} />
                          {staffMember.exitDate}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Actual Last Working Date</span>
                        <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 600 }}>
                          <Calendar size={14} />
                          {staffMember.lastWorkingDate || 'Not Specified'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Notice Period Served</span>
                        <span className="detail-value" style={{ fontWeight: 600 }}>
                          {staffMember.noticePeriod || 'None'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Notice Pay Period</span>
                        <span className="detail-value" style={{ fontWeight: 600 }}>
                          {staffMember.noticePayPeriod || 'None'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Notice Payout Terms</span>
                        <span className="detail-value" style={{ fontWeight: 600 }}>
                          {staffMember.noticePayoutOption === 'regular-payroll' ? 'Paid on Next Regular Payroll' :
                           staffMember.noticePayoutOption === 'end-of-notice' ? 'Paid at End of Notice Period' :
                           staffMember.noticePayoutOption === 'custom-date' ? `Paid on Custom Date (${staffMember.noticePayoutCustomDate})` :
                           'Paid on Next Regular Payroll'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Salary Paid Until Date</span>
                        <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {staffMember.salaryPaidUntilDate || 'Not Specified'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Additional Exit Payment</span>
                        <span className="detail-value" style={{ fontWeight: 600 }}>
                          {currencyObj.symbol}{(staffMember.additionalExitPayment || 0).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                  {staffMember.status === 'exited' && (
                    <div className="detail-section" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.02)', gridColumn: 'span 2', padding: '16px', marginTop: '16px' }}>
                      <div className="section-title" style={{ color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ClipboardList size={16} /> Asset Recovery & Account Deactivation Checklist
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        {/* Software licenses recovery */}
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                          Software Licenses & Assets
                        </div>
                        {myAssignments.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✅ No active license seats or assets assigned.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {myAssignments.map(assign => {
                              const matchedContract = contracts.find(c => c.id === assign.contractId);
                              const assetName = matchedContract ? matchedContract.name : 'Unknown License';
                              return (
                                <div key={assign.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                                    ⚠️ <strong>Recover:</strong> {assetName}
                                  </span>
                                  <button 
                                    className="btn-secondary" 
                                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    onClick={() => handleReleaseAsset(assign.id, assetName)}
                                  >
                                    Release & Deallocate
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Account Deactivations */}
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginTop: '8px' }}>
                          Account Deactivations & IT Clearance
                        </div>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={!!deactivationStates[`email-${staffMember.id}`]}
                            onChange={(e) => handleToggleDeactivationState(`email-${staffMember.id}`, e.target.checked)}
                          />
                          <span>Revoke business email access (<strong>{staffMember.businessEmail}</strong>)</span>
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={!!deactivationStates[`slack-${staffMember.id}`]}
                            onChange={(e) => handleToggleDeactivationState(`slack-${staffMember.id}`, e.target.checked)}
                          />
                          <span>Disable Slack / messaging accounts & workspace access</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <input 
                            type="checkbox" 
                            checked={!!deactivationStates[`payroll-${staffMember.id}`]}
                            onChange={(e) => handleToggleDeactivationState(`payroll-${staffMember.id}`, e.target.checked)}
                          />
                          <span>Suspend payroll profile & set final payout processing</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Salary Compensation */}
              <div className="detail-section">
                <div className="section-title">
                  <Wallet size={16} /> Salary Package
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Annual Gross Base Pay</span>
                    <span className="detail-value" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
                      {currencyObj.symbol}{Number(staffMember.salary).toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ yr ({staffMember.currency})</span>
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Monthly Payout (Est)</span>
                    <span className="detail-value">
                      {currencyObj.symbol}{Math.round(Number(staffMember.salary) / 12).toLocaleString()} {staffMember.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="detail-section">
                <div className="section-title">
                  <Mail size={16} /> Contact Details
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Business Email</span>
                    <a href={`mailto:${staffMember.businessEmail}`} className="detail-value" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} />
                      {staffMember.businessEmail}
                    </a>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Business Phone</span>
                    <a href={`tel:${staffMember.businessPhone}`} className="detail-value" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} />
                      {staffMember.businessPhone}
                    </a>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Personal Email</span>
                    <a href={`mailto:${staffMember.personalEmail}`} className="detail-value" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} />
                      {staffMember.personalEmail}
                    </a>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Personal Phone</span>
                    <a href={`tel:${staffMember.personalPhone}`} className="detail-value" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} />
                      {staffMember.personalPhone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Personal demographics */}
              <div className="detail-section">
                <div className="section-title">
                  <User size={16} /> Personal Profile
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Date of Birth</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      {staffMember.dateOfBirth}
                    </span>
                  </div>
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="detail-label">Residential Address</span>
                    <span className="detail-value" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{staffMember.address}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Documents */}
          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="detail-section" style={{ border: 'none', padding: 0 }}>
                <div className="section-title">
                  <ClipboardList size={16} /> Employment Document Library ({(staffMember.documents || []).length})
                </div>

                {!staffMember.documents || staffMember.documents.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <FileText size={32} className="empty-state-icon" />
                    <div style={{ fontSize: '13px' }}>No contract letters uploaded for this employee.</div>
                  </div>
                ) : (
                  <div className="doc-list">
                    {staffMember.documents.map(doc => (
                      <div className="doc-card" key={doc.id}>
                        <div className="doc-info">
                          <div className="doc-icon">
                            <FileText size={18} />
                          </div>
                          <div className="doc-name-group">
                            <span className="doc-name" title={doc.name}>{doc.name}</span>
                            <span className="doc-meta">
                              <span style={{ textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>{doc.type}</span> 
                              {' '}&bull; {doc.fileSize} &bull; Uploaded {doc.uploadDate}
                            </span>
                          </div>
                        </div>
                        <div className="doc-actions">
                          <button className="btn-icon" title="View Document" onClick={() => handlePreviewDoc(doc)}>
                            <Eye size={14} />
                          </button>
                          <button className="btn-icon delete" title="Delete Document" onClick={() => handleDeleteDoc(doc)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="form-label">Upload Employment File</span>
                    <select 
                      className="select-filter" 
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      style={{ padding: '6px 28px 6px 10px', fontSize: '12px', width: '200px' }}
                    >
                      <option value="appointment">Appointment Order</option>
                      <option value="appraisal">Appraisal Letter</option>
                      <option value="letter">Official Letter / Communications</option>
                      <option value="other">Other Document</option>
                    </select>
                  </div>

                  <div 
                    className={`upload-zone ${isDragging ? 'active' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && document.getElementById('staff-file-uploader-input').click()}
                    style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                  >
                    <input 
                      type="file" 
                      id="staff-file-uploader-input" 
                      style={{ display: 'none' }} 
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                    <UploadCloud size={32} className="upload-icon" />
                    <span className="upload-text">
                      {isUploading ? "Uploading file..." : "Drag and drop file here or Browse"}
                    </span>
                    <span className="upload-subtext">PDF, PNG, JPG or DOCX up to 10MB</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Contract & Exit Letters Generator Section */}
              <div className="detail-section" style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '24px', paddingLeft: 0, paddingRight: 0 }}>
                <div className="section-title" style={{ paddingLeft: '16px' }}>
                  <Printer size={16} /> Official Contracts & HR Letter Generator
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Select Document Template</label>
                      <select 
                        className="select-filter" 
                        value={selectedTemplateId} 
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        {letterTemplates.length > 0 && (
                          <optgroup label="Saved Templates (Database)">
                            {letterTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Default Templates (Backup)">
                          <option value="offer-letter">Offer Letter of Employment</option>
                          <option value="service-agreement">Contract for Services</option>
                          <option value="exit-letter">Exit / Termination Mutual Agreement</option>
                          <option value="general">General Official Correspondence</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label className="form-label">Company Letterhead branding</label>
                      <select 
                        className="select-filter" 
                        value={docCompanyId} 
                        onChange={(e) => setDocCompanyId(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Letterhead Configuration Overrides */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--accent)' }}>
                      Letterhead / Signatory Customizer
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      <div className="form-group" style={{ flex: '1 1 200px' }}>
                        <label className="form-label" style={{ fontSize: '10px' }}>Letterhead Logo URL (Optional)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. https://domain.com/logo.png" 
                          value={lhLogoUrl} 
                          onChange={(e) => setLhLogoUrl(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        />
                      </div>
                      <div className="form-group" style={{ flex: '1 1 200px' }}>
                        <label className="form-label" style={{ fontSize: '10px' }}>Official Address Text</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. 1 London Wall, London EC2Y 5EB" 
                          value={lhAddress} 
                          onChange={(e) => setLhAddress(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        />
                      </div>
                      <div className="form-group" style={{ flex: '1 1 180px' }}>
                        <label className="form-label" style={{ fontSize: '10px' }}>Authorized Signatory Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Director / CEO Name" 
                          value={lhSignatureText} 
                          onChange={(e) => setLhSignatureText(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                    {/* Draft Editor */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Draft Letter Body (Edit text directly)</label>
                      <textarea 
                        className="form-input" 
                        rows="18" 
                        value={docContent} 
                        onChange={(e) => setDocContent(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5, resize: 'vertical' }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        <strong>Available Tokens (Auto-Parsed):</strong> {"{{staff_name}}, {{staff_address}}, {{job_title}}, {{start_date}}, {{department}}, {{company_name}}, {{salary}}, {{last_working_date}}, {{notice_period}}, {{notice_pay_period}}, {{notice_pay_terms}}, {{additional_payment}}, {{signature}}"}
                      </div>
                    </div>

                    {/* Styled Letterhead Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Live Letterhead Layout Preview</label>
                      
                      {(() => {
                        const selectedCompany = companies.find(c => c.id === docCompanyId) || employerCompany || { name: 'Humres Group' };
                        return (
                          <div id="print-letterhead-content" style={{ 
                            backgroundColor: '#fff', 
                            color: '#000', 
                            padding: '30px', 
                            padding: lhLetterheadBgUrl ? '120px 60px 100px 60px' : '40px',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-color)', 
                            borderRadius: '6px',
                            fontFamily: 'serif',
                            minHeight: '450px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            lineHeight: 1.5,
                            overflowY: 'auto',
                            backgroundImage: lhLetterheadBgUrl ? `url(${lhLetterheadBgUrl})` : 'none',
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}>
                            {/* Header */}
                            {!lhLetterheadBgUrl && (
                              <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                {lhLogoUrl ? (
                                  <img src={lhLogoUrl} alt="Logo" style={{ maxHeight: '35px', marginBottom: '6px' }} />
                                ) : (
                                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {selectedCompany ? selectedCompany.name : 'COMPANY LETTERHEAD'}
                                  </div>
                                )}
                                <div style={{ fontSize: '9px', color: '#4b5563', marginTop: '2px', maxWidth: '280px', lineHeight: 1.3 }}>
                                  {lhAddress || '1 London Wall, London EC2Y 5EB, United Kingdom'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: '9px', color: '#4b5563', lineHeight: 1.3 }}>
                                <strong>Official Communications</strong><br />
                                Email: {selectedCompany?.pointOfContact?.email || 'hr@company.com'}<br />
                                Tel: {selectedCompany?.pointOfContact?.phone || ''}
                              </div>
                            </div>
                            )}

                            {/* Body */}
                            <div style={{ flex: 1, padding: '20px 0', fontSize: '12px', whiteSpace: 'pre-wrap', color: '#111827', textAlign: 'left' }}>
                              {getParsedLetter()}
                            </div>

                            {/* Footer */}
                            {!lhLetterheadBgUrl && (
                              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#6b7280' }}>
                                <div>
                                  <strong>Legal Entity:</strong> {selectedCompany?.legalName || selectedCompany?.name || ''}
                                </div>
                                <div>
                                  {selectedCompany?.registrationNumber && `Reg No: ${selectedCompany.registrationNumber}`}
                                  {selectedCompany?.vatNumber && ` | VAT: ${selectedCompany.vatNumber}`}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button className="btn-primary" onClick={handlePrintLetter} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Printer size={14} /> Open Print / Save PDF View
                    </button>
                    <button className="btn-secondary" onClick={handleSaveGeneratedLetter}>
                      Save generated letter to records library
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Leaves */}
          {activeTab === 'leaves' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {!policy ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '24px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No Leave Policy Assigned</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      This employee needs to be mapped to a leave policy to track time-off balances. Edit their profile to apply one.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Active Policy: {policy.name}</span>
                    <div className="form-group-row">
                      
                      <div className="detail-section" style={{ flex: 1, marginBottom: 0, padding: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Annual Leave</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>
                            {policy.annualAllowance - annualTaken}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>days left</span>
                        </div>
                        
                        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, (annualTaken / policy.annualAllowance) * 100)}%`, 
                            height: '100%', 
                            backgroundColor: 'var(--primary)' 
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          <span>{annualTaken} taken</span>
                          <span>{policy.annualAllowance} allowed</span>
                        </div>
                      </div>

                      <div className="detail-section" style={{ flex: 1, marginBottom: 0, padding: '16px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sick Leave</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)' }}>
                            {policy.sickAllowance - sickTaken}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>days left</span>
                        </div>

                        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, (sickTaken / policy.sickAllowance) * 100)}%`, 
                            height: '100%', 
                            backgroundColor: 'var(--warning)' 
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          <span>{sickTaken} taken</span>
                          <span>{policy.sickAllowance} allowed</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="form-label" style={{ fontSize: '14px', fontWeight: 600 }}>Leaves Audit & Requests</span>
                    <button 
                      className="btn-secondary" 
                      onClick={() => setShowRequestForm(prev => !prev)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {showRequestForm ? 'Cancel' : 'Request Time Off'}
                    </button>
                  </div>

                  {showRequestForm && (
                    <form onSubmit={handleRequestLeaveSubmit} className="detail-section" style={{ animation: 'fadeIn 0.2s', border: '1px solid var(--primary)' }}>
                      <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                        <PlusCircle size={14} /> Submit Time Off Request
                      </div>

                      <div className="form-group-row">
                        <div className="form-group">
                          <label className="form-label">Leave Category <span>*</span></label>
                          <select 
                            className="select-filter"
                            value={requestLeaveType}
                            onChange={(e) => setRequestLeaveType(e.target.value)}
                            style={{ width: '100%', padding: '10px' }}
                          >
                            <option value="annual">Annual Leave</option>
                            <option value="sick">Sick Leave</option>
                            <option value="unpaid">Unpaid Leave</option>
                            <option value="other">Compassionate / Other</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Total Work Days <span>*</span></label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="e.g. 5"
                            value={requestDays}
                            onChange={(e) => setRequestDays(e.target.value)}
                            required 
                          />
                        </div>
                      </div>

                      <div className="form-group-row">
                        <div className="form-group">
                          <label className="form-label">Start Date <span>*</span></label>
                          <input 
                            type="date" 
                            className="form-input"
                            value={requestStartDate}
                            onChange={(e) => setRequestStartDate(e.target.value)}
                            required 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">End Date <span>*</span></label>
                          <input 
                            type="date" 
                            className="form-input"
                            value={requestEndDate}
                            onChange={(e) => setRequestEndDate(e.target.value)}
                            required 
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Reason / Notes</label>
                        <textarea 
                          className="form-input" 
                          rows="2"
                          placeholder="Provide details about your time off request..."
                          value={requestNotes}
                          onChange={(e) => setRequestNotes(e.target.value)}
                          style={{ resize: 'vertical' }}
                        />
                      </div>

                      <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        Submit Application
                      </button>
                    </form>
                  )}

                  {staffLeaves.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px' }}>
                      <Calendar size={28} className="empty-state-icon" />
                      <div style={{ fontSize: '13px' }}>No leave applications filed.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {staffLeaves.map(req => {
                        const statusColors = {
                          approved: { text: 'Approved', color: 'var(--success)', icon: <CheckCircle2 size={12} /> },
                          pending: { text: 'Pending Approval', color: 'var(--warning)', icon: <Clock size={12} /> },
                          rejected: { text: 'Rejected', color: 'var(--danger)', icon: <XCircle size={12} /> }
                        };
                        const config = statusColors[req.status] || { text: req.status, color: 'var(--text-secondary)', icon: null };
                        
                        return (
                          <div key={req.id} className="doc-card" style={{ padding: '12px 16px', alignItems: 'center' }}>
                            <div className="doc-info" style={{ gap: '12px' }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%',
                                backgroundColor: req.leaveType === 'sick' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                                color: req.leaveType === 'sick' ? 'var(--warning)' : 'var(--accent)'
                              }}>
                                <Calendar size={14} />
                              </div>
                              <div className="doc-name-group">
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {req.leaveType.toUpperCase()} LEAVE ({req.totalDays} {req.totalDays === 1 ? 'day' : 'days'})
                                </span>
                                <span className="doc-meta" style={{ fontSize: '11px' }}>
                                  {req.startDate} to {req.endDate} {req.notes && `• "${req.notes}"`}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              fontSize: '12px', 
                              fontWeight: 600, 
                              color: config.color,
                              padding: '4px 8px',
                              backgroundColor: `${config.color}15`,
                              borderRadius: '6px'
                            }}>
                              {config.icon}
                              {config.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 4: Commission Plan */}
          {activeTab === 'commissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {!commPolicy ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '24px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No Commission Scheme Mapped</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Assign a commission structure to this recruiter to track incentive payroll structures. Edit their profile to map one.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detail-section" style={{ marginBottom: 0 }}>
                    <div className="section-title">
                      <TrendingUp size={16} /> Incentive Scheme: {commPolicy.name}
                    </div>
                    
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Scheme Type</span>
                        <span className="detail-value" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                          {commPolicy.type === 'manager' ? 'Manager Team-Billing Scheme' : 'Standard Recruiter Plan'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Start / Delay Rule</span>
                        <span className="detail-value">
                          {commPolicy.effectiveFrom === 'day_one' ? 'Starts Day One' : 'Starts after 1 year of service'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Monthly Threshold</span>
                        <span className="detail-value" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                          {currencyObj.symbol}{Number(commPolicy.monthlyThreshold).toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ mo</span>
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                      <span className="detail-label" style={{ display: 'block', marginBottom: '8px' }}>Commission Slabs (Tiers)</span>
                      <table className="entity-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Billing Bracket</th>
                            <th style={{ textAlign: 'right' }}>Commission Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(commPolicy.slabs || []).map((slab, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>
                                {currencyObj.symbol}{slab.minAmount.toLocaleString()} to {slab.maxAmount >= 999999 ? '∞' : `${currencyObj.symbol}${slab.maxAmount.toLocaleString()}`}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{slab.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>


                      {/* Actual Commission Payroll Statement */}
                      <div className="detail-section" style={{ border: '1px solid var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.01)', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                          <div className="section-title" style={{ color: 'var(--success)', margin: 0 }}>
                            <TrendingUp size={16} /> Commission Payroll Statement
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>Period:</span>
                            <input
                              type="month"
                              className="select-filter"
                              value={payrollMonth}
                              onChange={(e) => setPayrollMonth(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', fontStyle: 'italic' }}>
                          Placements starting in <strong>{getCycleMonthName(payrollMonth)}</strong> evaluated for disbursal on 25th of <strong>{payrollMonth}</strong>.
                        </div>

                        {/* Placements list */}
                        <div style={{ marginBottom: '16px' }}>
                          <span className="detail-label" style={{ display: 'block', marginBottom: '6px' }}>Current Month Starts ({actualPlacements.items.length})</span>
                          {actualPlacements.items.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '4px', fontStyle: 'italic' }}>
                              No candidate placements started in this cycle.
                            </div>
                          ) : (
                            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              <table className="entity-table" style={{ fontSize: '11px' }}>
                                <thead>
                                  <tr>
                                    <th>Candidate</th>
                                    <th>Client Company</th>
                                    <th>Start Date</th>
                                    <th style={{ textAlign: 'right' }}>Net Deal Fee</th>
                                    <th style={{ textAlign: 'right' }}>Split %</th>
                                    <th style={{ textAlign: 'right' }}>Your Share</th>
                                    <th>Invoice Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {actualPlacements.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 600 }}>{item.candidateName}</td>
                                      <td>{item.clientCompany}</td>
                                      <td>{item.scoredDate}</td>
                                      <td style={{ textAlign: 'right' }}>{currencyObj.symbol}{item.netScoreValue.toLocaleString()}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.percentage}%</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {currencyObj.symbol}{item.allocatedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td>
                                        {item.paymentStatus === 'paid' ? (
                                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Paid</span>
                                        ) : (
                                          <span style={{ color: 'var(--danger)', fontWeight: 600 }} title="Commission withheld until client settles invoice">Unpaid (Withheld)</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Released Prior Withholds list */}
                        {actualStatementResult.releasedPlacements.length > 0 && (
                          <div style={{ marginBottom: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                            <span className="detail-label" style={{ display: 'block', color: 'var(--success)', marginBottom: '6px' }}>
                              Released Prior Withholds ({actualStatementResult.releasedPlacements.length})
                            </span>
                            <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                              <table className="entity-table" style={{ fontSize: '11px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                <thead>
                                  <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
                                    <th>Candidate</th>
                                    <th>Client Company</th>
                                    <th>Start Date</th>
                                    <th>Date Client Paid</th>
                                    <th style={{ textAlign: 'right' }}>Released Commission</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {actualStatementResult.releasedPlacements.map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 600 }}>{item.candidateName}</td>
                                      <td>{item.clientCompany}</td>
                                      <td>{item.startDate}</td>
                                      <td>{item.clientPaidDate}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                        {currencyObj.symbol}{item.myCommShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Math breakdown */}
                        <div style={{ 
                          padding: '16px', 
                          backgroundColor: 'var(--bg-sidebar)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-md)' 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>Net Payout (Cash Basis):</span>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>
                              {currencyObj.symbol}{Math.round(actualStatementResult.totalPayout).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                              <span>Total Split Billings ({commPolicy.type === 'manager' ? 'Team' : 'Personal'}):</span>
                              <span style={{ fontWeight: 600 }}>{currencyObj.symbol}{actualStatementResult.billing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                              <span>Less Threshold Deduct:</span>
                              <span style={{ color: 'var(--danger)' }}>-{currencyObj.symbol}{commPolicy.monthlyThreshold.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                              <span>Base Commission Earned:</span>
                              <span>{currencyObj.symbol}{actualStatementResult.baseEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontSize: '12px' }}>
                              <span>Withheld (Unpaid Invoices):</span>
                              <span>-{currencyObj.symbol}{actualStatementResult.withheld.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                              <span>Released (Prior Withholds Settled):</span>
                              <span>+{currencyObj.symbol}{actualStatementResult.released.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div style={{ margin: '4px 0 0 0' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                Incentive Slab Calculation Breakdown
                              </span>
                              {actualStatementResult.slabBreakdown.map((breakdown, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid var(--border-color)' }}>
                                  <span>{breakdown.slabRange} ({breakdown.rate}%) on {currencyObj.symbol}{Math.round(breakdown.applicable).toLocaleString()}:</span>
                                  <span>{currencyObj.symbol}{Math.round(breakdown.earned).toLocaleString()}</span>
                                </div>
                              ))}
                              {actualStatementResult.slabBreakdown.length === 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '8px' }}>
                                  Billing did not exceed threshold. No base commissions accumulated.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                  {/* Toggleable Simulator */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={() => {
                        setShowSimulator(prev => !prev);
                        setSimulationResult(null);
                      }}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {showSimulator ? 'Close Manual Simulator' : 'Open Manual Calculator Simulator'}
                    </button>
                  </div>

                  {showSimulator && (
                    <div className="detail-section" style={{ border: '1px solid var(--primary)', backgroundColor: 'rgba(99, 102, 241, 0.02)', animation: 'fadeIn 0.2s' }}>
                      <div className="section-title" style={{ color: 'var(--primary)' }}>
                        <Percent size={16} /> Monthly Commission Calculator Simulator
                      </div>

                      <form onSubmit={handleCalculateSimulation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group-row">
                          {commPolicy.type === 'individual' ? (
                            <div className="form-group">
                              <label className="form-label">Personal Monthly Billing ({currencyObj.code}) <span>*</span></label>
                              <input 
                                type="number" 
                                className="form-input"
                                placeholder="e.g. 20000"
                                value={simulatedBilling}
                                onChange={(e) => setSimulatedBilling(e.target.value)}
                                required
                              />
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Personal threshold of {currencyObj.symbol}{commPolicy.monthlyThreshold.toLocaleString()} will be deducted.
                              </span>
                            </div>
                          ) : (
                            <div className="form-group">
                              <label className="form-label">Team Monthly Billing ({currencyObj.code}) <span>*</span></label>
                              <input 
                                type="number" 
                                className="form-input"
                                placeholder="e.g. 60000"
                                value={simulatedTeamBilling}
                                onChange={(e) => setSimulatedTeamBilling(e.target.value)}
                                required
                              />
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Team threshold (quota) of {currencyObj.symbol}{commPolicy.monthlyThreshold.toLocaleString()} will be deducted.
                              </span>
                            </div>
                          )}
                        </div>

                        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 20px' }}>
                          Calculate Estimated Commissions
                        </button>
                      </form>

                      {simulationResult && (
                        <div style={{ 
                          marginTop: '20px', 
                          padding: '16px', 
                          backgroundColor: 'var(--bg-sidebar)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-md)' 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>Simulated Monthly Earnings:</span>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>
                              {currencyObj.symbol}{Math.round(simulationResult.totalEarned).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                              <span>Total Simulated Billings ({commPolicy.type === 'manager' ? 'Team' : 'Personal'}):</span>
                              <span>{currencyObj.symbol}{simulationResult.inputBilling.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                              <span>Less Threshold Deduct:</span>
                              <span style={{ color: 'var(--danger)' }}>-{currencyObj.symbol}{commPolicy.monthlyThreshold.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                              <span>Commissionable Billings:</span>
                              <span>{currencyObj.symbol}{simulationResult.commissionableBilling.toLocaleString()}</span>
                            </div>

                            <div style={{ margin: '4px 0 8px 0' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                {commPolicy.type === 'manager' ? 'Team' : 'Personal'} Billings Slab Split
                              </span>
                              {simulationResult.slabBreakdown.map((breakdown, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid var(--border-color)' }}>
                                  <span>{breakdown.slabRange} ({breakdown.rate}%) on {currencyObj.symbol}{Math.round(breakdown.applicable).toLocaleString()}:</span>
                                  <span>{currencyObj.symbol}{Math.round(breakdown.earned).toLocaleString()}</span>
                                </div>
                              ))}
                              {simulationResult.slabBreakdown.length === 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '8px' }}>
                                  Billing did not exceed threshold. No commissions accumulated.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 5: Assets & Licenses */}
          {activeTab === 'assets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Assigned Licenses & Asset Seats ({myAssignments.length})</h3>
                
                {myAssignments.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <Laptop size={32} className="empty-state-icon" />
                    <div style={{ fontSize: '13px' }}>No active license seats provisioned to this employee.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {myAssignments.map(assign => {
                      const matchedContract = contracts.find(c => c.id === assign.contractId);
                      const assetName = matchedContract ? matchedContract.name : 'Unknown License';
                      const symbol = matchedContract ? (symbolMap[matchedContract.currency] || '£') : '£';
                      const unitCost = matchedContract ? matchedContract.unitCost : 0;
                      
                      return (
                        <div key={assign.id} className="doc-card" style={{ padding: '12px 16px', alignItems: 'center' }}>
                          <div className="doc-info" style={{ gap: '12px' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%',
                              backgroundColor: 'rgba(99, 102, 241, 0.1)',
                              color: 'var(--primary)'
                            }}>
                              <Laptop size={16} />
                            </div>
                            <div className="doc-name-group">
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {assetName}
                              </span>
                              <span className="doc-meta" style={{ fontSize: '11px' }}>
                                Cost: {symbol}{unitCost.toFixed(2)}/mo &bull; Assigned: {assign.assignedDate}
                              </span>
                            </div>
                          </div>
                          
                          <button 
                            className="btn-secondary" 
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '11px', 
                              color: 'var(--danger)', 
                              borderColor: 'var(--danger)' 
                            }}
                            onClick={() => handleReleaseAsset(assign.id, assetName)}
                          >
                            <Unlock size={11} style={{ marginRight: '4px' }} /> Release Seat
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Allocate seat form */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Provision New License Seat</h4>
                
                {availablePools.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No available license pools found for this company ({companyName}). Register vendor contracts to add capacity.
                  </p>
                ) : (
                  <form onSubmit={handleAssignAsset} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Available License Pools</label>
                      <select
                        className="select-filter"
                        value={newAssetContractId}
                        onChange={(e) => setNewAssetContractId(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                        required
                      >
                        <option value="">-- Choose License Pool --</option>
                        {availablePools.map(pool => {
                          const assignedCount = assetAssignments.filter(a => a.contractId === pool.id).length;
                          const left = pool.quantityPurchased - assignedCount;
                          return (
                            <option key={pool.id} value={pool.id}>
                              {pool.name} ({left} seats left of {pool.quantityPurchased})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                      Allocate Seat
                    </button>
                  </form>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
