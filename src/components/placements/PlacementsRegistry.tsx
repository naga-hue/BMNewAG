import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit3, X } from 'lucide-react';
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff } from '../../types';
import { ExtendedPlacement, SOURCES, FACTORING_PAYOUT_RATIO } from './shared';
import { calculateDueDate, calculateSimplicityBreakdown } from './utils';

interface PlacementsRegistryProps {
  companies: Company[];
  staff: Staff[];
  placements: ExtendedPlacement[];
  onSavePlacement: (placement: any) => Promise<any>;
  onDeletePlacement: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  viewingPlacement: ExtendedPlacement | null;
  setViewingPlacement: (placement: ExtendedPlacement | null) => void;
}

export default function PlacementsRegistry({
  companies,
  staff,
  placements,
  onSavePlacement,
  onDeletePlacement,
  onShowToast,
  viewingPlacement,
  setViewingPlacement
}: PlacementsRegistryProps) {
  // Local UI & form states
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [quickActionModal, setQuickActionModal] = useState<{
    type: 'dns' | 'rebate' | 'paid';
    placement: ExtendedPlacement;
  } | null>(null);
  const [quickActionInputVal, setQuickActionInputVal] = useState('');

  // Form input states
  const [pIdInput, setPIdInput] = useState('');
  const [invoiceInput, setInvoiceInput] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [candidateInput, setCandidateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [scoredDateInput, setScoredDateInput] = useState('');
  const [dnsDateInput, setDnsDateInput] = useState('');
  const [sourceInput, setSourceInput] = useState('LinkedIn');
  const [statusInput, setStatusInput] = useState('active');
  const [grossInput, setGrossInput] = useState('');
  const [deductionsInput, setDeductionsInput] = useState('0');
  const [splitsInput, setSplitsInput] = useState<{ staffId: string; percentage: number }[]>([
    { staffId: '', percentage: 100 }
  ]);

  // Client payment inputs
  const [clientPaymentStatusInput, setClientPaymentStatusInput] = useState('unpaid');
  const [clientPaidDateInput, setClientPaidDateInput] = useState('');
  const [commissionPaidMonthInput, setCommissionPaidMonthInput] = useState('');

  // Credit Control Invoice States
  const [invoiceTypeInput, setInvoiceTypeInput] = useState('direct');
  const [simplicityClientNoInput, setSimplicityClientNoInput] = useState('');
  const [simplicityCreditLimitInput, setSimplicityCreditLimitInput] = useState('');
  const [noaRequiredInput, setNoaRequiredInput] = useState(false);
  const [consultantInvoiceReceivedInput, setConsultantInvoiceReceivedInput] = useState(false);
  const [invoiceTriggerTypeInput, setInvoiceTriggerTypeInput] = useState('start-date');
  const [invoiceTriggerCustomDateInput, setInvoiceTriggerCustomDateInput] = useState('');
  const [paymentTermsInput, setPaymentTermsInput] = useState('30');
  const [paymentTermsCustomDaysInput, setPaymentTermsCustomDaysInput] = useState('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consultantFilter, setConsultantFilter] = useState<string[]>(['all']);
  const [startMonthFilter, setStartMonthFilter] = useState('all');
  const [internalCompanyFilter, setInternalCompanyFilter] = useState<string[]>(['all']);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>(['all']);

  // Sorting state
  const [sortBy, setSortBy] = useState('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, consultantFilter, startMonthFilter, internalCompanyFilter, departmentFilter]);

  // Compute unique departments
  const allAvailableDepts = (() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach((d: any) => {
        const name = typeof d === 'string' ? d : d.name;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  })();

  const companyOptions = [
    { value: 'all', label: 'All Internal Companies' },
    ...companies.map(c => ({ value: c.id, label: c.name }))
  ];

  const departmentOptionsList = [
    { value: 'all', label: 'All Departments' },
    ...allAvailableDepts.map(d => ({ value: d, label: d }))
  ];

  const consultantOptions = [
    { value: 'all', label: 'All Recruiters' },
    ...staff.map(s => ({ value: s.id, label: s.fullName }))
  ];

  // Helper to split matching weight
  const getPlacementSplitWeight = (p: ExtendedPlacement) => {
    if (consultantFilter.includes('all') && departmentFilter.includes('all') && internalCompanyFilter.includes('all')) {
      return 1.0;
    }
    if (!p.splits || p.splits.length === 0) {
      return 1.0;
    }
    let matchingPercentage = 0;
    p.splits.forEach(s => {
      let match = true;
      const rec = staff.find(st => st.id === s.staffId);
      if (!consultantFilter.includes('all') && (!s.staffId || !consultantFilter.includes(s.staffId))) match = false;
      if (!departmentFilter.includes('all') && (!rec || !rec.department || !departmentFilter.includes(rec.department))) match = false;
      if (!internalCompanyFilter.includes('all') && (!rec || !internalCompanyFilter.includes(rec.companyId))) match = false;
      if (match) {
        matchingPercentage += Number(s.percentage) || 0;
      }
    });
    return matchingPercentage / 100;
  };

  // Filter Placements
  const filteredPlacements = placements.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!consultantFilter.includes('all')) {
      const hasConsultant = p.splits?.some(s => s.staffId && consultantFilter.includes(s.staffId));
      if (!hasConsultant) return false;
    }
    if (startMonthFilter !== 'all') {
      if (!p.startDate) return false;
      const pStart = new Date(p.startDate);
      if (pStart.getMonth() !== Number(startMonthFilter)) return false;
    }
    if (!internalCompanyFilter.includes('all')) {
      const recs = p.splits?.map(s => staff.find(st => st.id === s.staffId)).filter(Boolean) || [];
      const matchComp = recs.some(r => r && internalCompanyFilter.includes(r.companyId));
      if (!matchComp) return false;
    }
    if (!departmentFilter.includes('all')) {
      const matchDept = p.splits?.some(s => {
        const staffObj = staff.find(member => member.id === s.staffId);
        return staffObj && staffObj.department && departmentFilter.includes(staffObj.department);
      });
      if (!matchDept) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPId = p.placementId.toLowerCase().includes(q);
      const matchClient = p.clientCompany.toLowerCase().includes(q);
      const matchCandidate = p.candidateName.toLowerCase().includes(q);
      const matchRecruiters = p.splits?.some(s => {
        const staffObj = staff.find(member => member.id === s.staffId);
        return staffObj?.fullName.toLowerCase().includes(q);
      });
      return matchPId || matchClient || matchCandidate || matchRecruiters;
    }
    return true;
  });

  // Sorting logic
  const sortedPlacements = [...filteredPlacements].sort((a: any, b: any) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (sortBy === 'netScoreValue' || sortBy === 'grossBillAmount') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else if (sortBy === 'startDate' || sortBy === 'scoredDate') {
      valA = new Date(valA || '1970-01-01');
      valB = new Date(valB || '1970-01-01');
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedPlacements = React.useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedPlacements.slice(startIdx, startIdx + pageSize);
  }, [sortedPlacements, currentPage, pageSize]);

  // Calculate totals
  const totalGross = filteredPlacements.reduce((acc, p) => acc + ((p.grossBillAmount || p.netScoreValue || 0) * getPlacementSplitWeight(p)), 0);
  const totalDns = filteredPlacements.reduce((acc, p) => {
    const w = getPlacementSplitWeight(p);
    if (p.status === 'dns') {
      return acc + ((p.grossBillAmount || p.netScoreValue || 0) * w);
    }
    return acc + ((p.dnsDate ? (p.grossBillAmount || p.netScoreValue) : 0) * w);
  }, 0);
  const totalRebate = filteredPlacements.reduce((acc, p) => {
    const w = getPlacementSplitWeight(p);
    if (p.status === 'rebate' || (p.status !== 'dns' && (p.dnsRebateAmount || 0) > 0)) {
      return acc + ((p.dnsRebateAmount || 0) * w);
    }
    return acc;
  }, 0);
  const totalNet = filteredPlacements.reduce((acc, p) => acc + ((p.netScoreValue || 0) * getPlacementSplitWeight(p)), 0);

  const handleHeaderClick = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    }
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const getHeaderStyle = (columnKey: string, alignRight = false) => {
    const isActive = sortBy === columnKey;
    return {
      cursor: 'pointer',
      userSelect: 'none' as const,
      color: isActive ? 'var(--primary)' : 'inherit',
      fontWeight: isActive ? 700 : 500,
      textAlign: alignRight ? ('right' as const) : ('left' as const),
      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
      transition: 'all 0.2s ease'
    };
  };

  // Splits management
  const handleAddSplitRow = () => {
    setSplitsInput(prev => {
      const nextList = [...prev, { staffId: '', percentage: 0 }];
      const count = nextList.length;
      const evenShare = Math.round((100 / count) * 100) / 100;
      return nextList.map((item, i) => ({
        ...item,
        percentage: i === count - 1 
          ? Math.round((100 - (evenShare * (count - 1))) * 100) / 100 
          : evenShare
      }));
    });
  };

  const handleRemoveSplitRow = (idx: number) => {
    setSplitsInput(prev => {
      const nextList = prev.filter((_, i) => i !== idx);
      const count = nextList.length;
      if (count === 0) return [];
      const evenShare = Math.round((100 / count) * 100) / 100;
      return nextList.map((item, i) => ({
        ...item,
        percentage: i === count - 1 
          ? Math.round((100 - (evenShare * (count - 1))) * 100) / 100 
          : evenShare
      }));
    });
  };

  const handleSplitChange = (idx: number, field: string, value: any) => {
    setSplitsInput(prev =>
      prev.map((s, i) => {
        if (i === idx) {
          return { ...s, [field]: field === 'percentage' ? Number(value) : value };
        }
        return s;
      })
    );
  };

  // Quick action Modal Trigger: Mark DNS
  const handleQuickDNS = (placement: ExtendedPlacement) => {
    setQuickActionModal({ type: 'dns', placement });
    setQuickActionInputVal(new Date().toISOString().split('T')[0]);
  };

  // Quick action Modal Trigger: Apply Rebate
  const handleQuickRebate = (placement: ExtendedPlacement) => {
    setQuickActionModal({ type: 'rebate', placement });
    setQuickActionInputVal('2000');
  };

  // Quick action Modal Trigger: Toggle Client Payment
  const handleToggleClientPayment = async (placement: ExtendedPlacement, status: string) => {
    if (status === 'unpaid') {
      await executeQuickAction('paid', placement, 'unpaid');
    } else {
      setQuickActionModal({ type: 'paid', placement });
      setQuickActionInputVal(new Date().toISOString().split('T')[0]);
    }
  };

  // Async executor for all quick actions
  const executeQuickAction = async (
    type: 'dns' | 'rebate' | 'paid',
    placement: ExtendedPlacement,
    val: string
  ) => {
    setIsSaving(true);
    try {
      let updated: any = null;
      if (type === 'dns') {
        const dnsDate = val || placement.startDate;
        updated = {
          ...placement,
          status: 'dns',
          dnsDate,
          dnsRebateAmount: placement.grossBillAmount || placement.netScoreValue,
          netScoreValue: 0,
          clientPaymentStatus: 'unpaid',
          clientPaidDate: null
        };
      } else if (type === 'rebate') {
        const amt = Number(val) || 0;
        updated = {
          ...placement,
          status: 'rebate',
          dnsRebateAmount: amt,
          netScoreValue: Math.max(0, (placement.grossBillAmount || placement.netScoreValue) - amt)
        };
      } else if (type === 'paid') {
        if (val === 'unpaid') {
          updated = {
            ...placement,
            clientPaymentStatus: 'unpaid',
            clientPaidDate: null
          };
        } else {
          updated = {
            ...placement,
            clientPaymentStatus: 'paid',
            clientPaidDate: val
          };
        }
      }

      await onSavePlacement(updated);
      onShowToast(
        type === 'dns'
          ? `Placement ${placement.placementId} marked as Did Not Start (DNS).`
          : type === 'rebate'
          ? `Applied £${(Number(val) || 0).toLocaleString()} rebate to placement ${placement.placementId}.`
          : val === 'unpaid'
          ? `Reset client invoice for ${placement.placementId} to Unpaid.`
          : `Marked client invoice for ${placement.placementId} as Paid.`,
        'success'
      );
      setQuickActionModal(null);
    } catch (err: any) {
      onShowToast(`Error updating placement: ${err.message}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Placement form activation
  const handleEditPlacement = (placement: ExtendedPlacement) => {
    setEditingPlacementId(placement.id);
    setPIdInput(placement.placementId);
    setInvoiceInput(placement.invoiceNumber || '');
    setClientInput(placement.clientCompany);
    setCandidateInput(placement.candidateName);
    setStartDateInput(placement.startDate || '');
    setScoredDateInput(placement.scoredDate || '');
    setDnsDateInput(placement.dnsDate || '');
    setSourceInput(placement.source || 'LinkedIn');
    setStatusInput(placement.status || 'active');
    setGrossInput(String(placement.grossBillAmount || placement.netScoreValue || ''));
    setDeductionsInput(String(placement.dnsRebateAmount || 0));
    setSplitsInput(
      placement.splits && placement.splits.length > 0
        ? placement.splits
        : [{ staffId: '', percentage: 100 }]
    );
    setClientPaymentStatusInput(placement.clientPaymentStatus || 'unpaid');
    setClientPaidDateInput(placement.clientPaidDate || '');
    setCommissionPaidMonthInput(placement.commissionPaidMonth || '');
    setInvoiceTypeInput(placement.invoiceType || 'direct');
    setSimplicityClientNoInput(placement.simplicityClientNo || '');
    setSimplicityCreditLimitInput(placement.simplicityCreditLimit || '');
    setNoaRequiredInput(!!placement.noaRequired);
    setConsultantInvoiceReceivedInput(!!placement.consultantInvoiceReceived);
    setInvoiceTriggerTypeInput(placement.invoiceTriggerType || 'start-date');
    setInvoiceTriggerCustomDateInput(placement.invoiceTriggerCustomDate || '');
    
    const terms = String(placement.paymentTermsDays || '30');
    if (['7', '10', '30', '31'].includes(terms)) {
      setPaymentTermsInput(terms);
      setPaymentTermsCustomDaysInput('');
    } else {
      setPaymentTermsInput('custom');
      setPaymentTermsCustomDaysInput(terms);
    }

    setShowLogForm(true);
  };

  // Submit placement form handler
  const handlePlacementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pIdInput.trim() || !clientInput.trim() || !candidateInput.trim() || !startDateInput || !scoredDateInput || !grossInput) {
      onShowToast("Please fill in all required fields.", "warning");
      return;
    }

    let totalSplit = 0;
    const cleanSplits = [];
    for (const s of splitsInput) {
      if (!s.staffId) {
        onShowToast("Please select a recruiter for all split allocations.", "warning");
        return;
      }
      const percentageVal = Number(s.percentage) || 0;
      if (percentageVal <= 0) {
        onShowToast("Split percentage must be greater than 0%.", "warning");
        return;
      }
      totalSplit += percentageVal;
      cleanSplits.push({ staffId: s.staffId, percentage: percentageVal });
    }

    if (totalSplit !== 100) {
      onShowToast(`Recruiter splits must equal exactly 100% (currently ${totalSplit}%).`, "warning");
      return;
    }

    const gross = Number(grossInput) || 0;
    const deductions = Number(deductionsInput) || 0;
    const netScore = Math.max(0, gross - deductions);

    const pType = invoiceTypeInput;
    const pTrigger = invoiceTriggerTypeInput;
    let raisedDate = '';
    if (pTrigger === 'start-date') {
      raisedDate = startDateInput;
    } else if (pTrigger === 'offer-accepted') {
      raisedDate = scoredDateInput;
    } else {
      raisedDate = invoiceTriggerCustomDateInput || new Date().toISOString().split('T')[0];
    }

    const termDays = paymentTermsInput === 'custom'
      ? (Number(paymentTermsCustomDaysInput) || 30)
      : Number(paymentTermsInput);

    const dueDate = calculateDueDate(raisedDate, termDays);

    let vatVal = Math.round(gross * 0.20 * 100) / 100;
    let totalVal = gross + vatVal;

    if (pType === 'simplicity') {
      const breakdown = calculateSimplicityBreakdown(gross);
      vatVal = breakdown.vatAmount;
      totalVal = breakdown.expectedPayout;
    }

    const existingPlacement = editingPlacementId ? placements.find(p => p.id === editingPlacementId) : null;
    const currentAmountPaid = existingPlacement ? ((existingPlacement as any).amountPaid || 0) : (clientPaymentStatusInput === 'paid' ? totalVal : 0);
    const currentBalance = Math.max(0, totalVal - currentAmountPaid);

    let initialPaymentStatus = 'not-invoiced';
    if (clientPaymentStatusInput === 'paid' || currentBalance === 0) {
      initialPaymentStatus = 'paid';
    } else if (existingPlacement && (existingPlacement as any).paymentStatus) {
      initialPaymentStatus = (existingPlacement as any).paymentStatus;
    } else if (invoiceInput.trim()) {
      initialPaymentStatus = 'sent-to-client';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (
      initialPaymentStatus !== 'paid' &&
      initialPaymentStatus !== 'written-off' &&
      initialPaymentStatus !== 'dns-rebate' &&
      initialPaymentStatus !== 'legal' &&
      initialPaymentStatus !== 'disputed' &&
      dueDate < todayStr
    ) {
      initialPaymentStatus = 'overdue';
    }

    const placementData = {
      id: editingPlacementId || `place-${Date.now()}`,
      placementId: pIdInput.trim(),
      invoiceNumber: invoiceInput.trim() || null,
      clientCompany: clientInput.trim(),
      candidateName: candidateInput.trim(),
      startDate: startDateInput,
      scoredDate: scoredDateInput,
      dnsDate: statusInput === 'dns' ? (dnsDateInput || scoredDateInput) : null,
      status: statusInput,
      source: sourceInput,
      grossBillAmount: gross,
      dnsRebateAmount: deductions,
      dnsAmount: statusInput === 'dns' ? gross : 0,
      rebateAmount: statusInput === 'rebate' || (statusInput !== 'dns' && deductions > 0) ? deductions : 0,
      netScoreValue: netScore,
      clientPaymentStatus: clientPaymentStatusInput,
      clientPaidDate: clientPaymentStatusInput === 'paid' ? (clientPaidDateInput || new Date().toISOString().split('T')[0]) : null,
      commissionPaidMonth: commissionPaidMonthInput || null,
      splits: cleanSplits,
      importKey: editingPlacementId ? (placements.find(p => p.id === editingPlacementId)?.importKey || null) : "manual",

      // Credit Control parameters
      invoiceType: pType,
      simplicityClientNo: pType === 'simplicity' ? simplicityClientNoInput.trim() : null,
      simplicityCreditLimit: pType === 'simplicity' ? simplicityCreditLimitInput.trim() : null,
      noaRequired: pType === 'simplicity' ? noaRequiredInput : false,
      consultantInvoiceReceived: pType === 'simplicity' ? consultantInvoiceReceivedInput : false,
      invoiceTriggerType: pTrigger,
      invoiceTriggerCustomDate: pTrigger === 'custom-date' ? invoiceTriggerCustomDateInput : '',
      invoiceRaisedDate: raisedDate,
      paymentTermsDays: termDays,
      invoiceDueDate: dueDate,
      vatAmount: vatVal,
      totalInvoiceAmount: totalVal,
      paymentStatus: initialPaymentStatus,
      amountPaid: currentAmountPaid,
      balanceOutstanding: currentBalance,
      paymentReceivedDate: clientPaymentStatusInput === 'paid' ? (clientPaidDateInput || todayStr) : (existingPlacement as any)?.paymentReceivedDate || null,
      invoiceFileUrl: (existingPlacement as any)?.invoiceFileUrl || '',
      invoiceFileName: (existingPlacement as any)?.invoiceFileName || '',
      chaseHistory: (existingPlacement as any)?.chaseHistory || [],
      lastChasedDate: (existingPlacement as any)?.lastChasedDate || '',
      nextChaseDate: (existingPlacement as any)?.nextChaseDate || '',
      disputeReason: (existingPlacement as any)?.disputeReason || '',
      disputeDate: (existingPlacement as any)?.disputeDate || '',
      disputeOwner: (existingPlacement as any)?.disputeOwner || ''
    };

    setIsSaving(true);
    try {
      await onSavePlacement(placementData);
      onShowToast(
        editingPlacementId
          ? `Updated placement details for "${candidateInput}"`
          : `Placement for "${candidateInput}" logged successfully!`,
        "success"
      );

      // Reset states
      setPIdInput('');
      setInvoiceInput('');
      setClientInput('');
      setCandidateInput('');
      setStartDateInput('');
      setScoredDateInput('');
      setDnsDateInput('');
      setStatusInput('active');
      setGrossInput('');
      setClientPaymentStatusInput('unpaid');
      setClientPaidDateInput('');
      setCommissionPaidMonthInput('');
      setSplitsInput([{ staffId: '', percentage: 100 }]);
      setInvoiceTypeInput('direct');
      setSimplicityClientNoInput('');
      setSimplicityCreditLimitInput('');
      setNoaRequiredInput(false);
      setConsultantInvoiceReceivedInput(false);
      setInvoiceTriggerTypeInput('start-date');
      setInvoiceTriggerCustomDateInput('');
      setPaymentTermsInput('30');
      setPaymentTermsCustomDaysInput('');
      setEditingPlacementId(null);
      setShowLogForm(false);
    } catch (err: any) {
      onShowToast(`Error saving placement: ${err.message}`, "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelForm = () => {
    // Check if form has any unsaved/dirty inputs
    const isDirty = 
      pIdInput.trim() !== '' ||
      invoiceInput.trim() !== '' ||
      clientInput.trim() !== '' ||
      candidateInput.trim() !== '' ||
      startDateInput !== '' ||
      scoredDateInput !== '' ||
      dnsDateInput !== '' ||
      grossInput !== '' ||
      splitsInput.some(s => s.staffId !== '') ||
      clientPaymentStatusInput !== 'unpaid' ||
      clientPaidDateInput !== '';

    if (isDirty) {
      if (!window.confirm("You have unsaved changes in the form. Are you sure you want to discard them?")) {
        return;
      }
    }

    // Reset states and close
    setPIdInput('');
    setInvoiceInput('');
    setClientInput('');
    setCandidateInput('');
    setStartDateInput('');
    setScoredDateInput('');
    setDnsDateInput('');
    setStatusInput('active');
    setGrossInput('');
    setClientPaymentStatusInput('unpaid');
    setClientPaidDateInput('');
    setCommissionPaidMonthInput('');
    setSplitsInput([{ staffId: '', percentage: 100 }]);
    setInvoiceTypeInput('direct');
    setSimplicityClientNoInput('');
    setSimplicityCreditLimitInput('');
    setNoaRequiredInput(false);
    setConsultantInvoiceReceivedInput(false);
    setInvoiceTriggerTypeInput('start-date');
    setInvoiceTriggerCustomDateInput('');
    setPaymentTermsInput('30');
    setPaymentTermsCustomDaysInput('');
    setEditingPlacementId(null);
    setShowLogForm(false);
  };

  const handleExportPlacements = () => {
    const headers = [
      "Placement ID",
      "Client",
      "Candidate",
      "Start Date",
      "Gross Billing",
      "Net Fee Score",
      "Status",
      "Payment Status",
      "Splits Allocation"
    ];

    const rows = sortedPlacements.map(p => {
      const splitsStr = p.splits
        ?.map(s => {
          const rec = staff.find(st => st.id === s.staffId);
          return `${rec ? rec.fullName : s.staffId} (${s.percentage}%)`;
        })
        .join("; ");

      return [
        p.placementId,
        p.clientCompany,
        p.candidateName,
        p.startDate || '',
        p.grossBillAmount || p.netScoreValue || 0,
        p.netScoreValue || 0,
        p.status || 'active',
        p.clientPaymentStatus || 'unpaid',
        splitsStr || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `placements_registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Placements registry exported to CSV successfully.", "success");
  };

  return (
    <div className="placements-container">
      
      <div className="placements-header-row">
        <div className="placements-header-info">
          <h2>Sales Placements & Billing Logs</h2>
          <p>Log candidates placements, splits allocation ratios, and adjust DNS/Rebates items.</p>
        </div>
        
        <button className="btn-primary" onClick={() => {
          if (showLogForm) {
            handleCancelForm();
          } else {
            setEditingPlacementId(null);
            setPIdInput('');
            setInvoiceInput('');
            setClientInput('');
            setCandidateInput('');
            setStartDateInput('');
            setScoredDateInput('');
            setDnsDateInput('');
            setStatusInput('active');
            setGrossInput('');
            setDeductionsInput('0');
            setClientPaymentStatusInput('unpaid');
            setClientPaidDateInput('');
            setSplitsInput([{ staffId: '', percentage: 100 }]);
            setShowLogForm(true);
          }
        }}>
          <Plus size={16} /> {showLogForm ? 'Close Log Form' : 'Log Placement'}
        </button>
      </div>

      {/* Metrics Summary Grid */}
      <div className="placements-metrics-grid">
        <div className="placements-metric-card">
          <div className="placements-metric-label">Gross Placed Volume</div>
          <div className="placements-metric-value">£{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="placements-metric-card">
          <div className="placements-metric-label">DNS Lost Volume</div>
          <div className="placements-metric-value danger">-£{totalDns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="placements-metric-card">
          <div className="placements-metric-label">Rebate Deductions</div>
          <div className="placements-metric-value warning">-£{totalRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="placements-metric-card">
          <div className="placements-metric-label">Net Fee Volume</div>
          <div className="placements-metric-value success">£{totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Log/Edit Placement Form Overlay */}
      {showLogForm && (
        <div className="placements-form-overlay" onClick={handleCancelForm}>
          <div className="placements-form-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="placements-form-header">
              <div className="placements-form-title-group">
                <div className="placements-form-icon-wrap">
                  <Plus size={20} />
                </div>
                <div>
                  <h2 className="placements-form-title">
                    {editingPlacementId ? 'Modify Placement Records' : 'Log Placed Candidate Sales'}
                  </h2>
                  <span className="placements-form-subtitle">Fill in placement details below</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={handleCancelForm} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handlePlacementSubmit} className="placements-form-content">
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">CRM Placement ID <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. PL-59283"
                    value={pIdInput}
                    onChange={(e) => setPIdInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Invoice Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. INV-2026-10"
                    value={invoiceInput}
                    onChange={(e) => setInvoiceInput(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Candidate Source</label>
                  <select 
                    className="select-filter"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {SOURCES.map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Client Company <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Start typing client company..."
                    value={clientInput}
                    onChange={(e) => {
                      setClientInput(e.target.value);
                      setShowCompanyDropdown(true);
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    onBlur={() => {
                      // Delay hiding dropdown to allow click events to register
                      setTimeout(() => setShowCompanyDropdown(false), 200);
                    }}
                    required
                  />
                  {showCompanyDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      zIndex: 1000,
                      marginTop: '4px',
                      boxShadow: 'var(--shadow-lg)'
                    }}>
                      {(() => {
                        const filtered = companies.filter(c => 
                          c.name.toLowerCase().includes(clientInput.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return (
                            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                              Create new company: "{clientInput}"
                            </div>
                          );
                        }
                        return filtered.map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setClientInput(c.name);
                              setShowCompanyDropdown(false);
                            }}
                            className="placements-dropdown-item"
                          >
                            {c.name}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Candidate Full Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Placed candidate name"
                    value={candidateInput}
                    onChange={(e) => setCandidateInput(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Work Start Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={startDateInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDateInput(val);
                      if (!scoredDateInput || scoredDateInput === startDateInput) {
                        setScoredDateInput(val);
                      }
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scored Confirmation Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={scoredDateInput}
                    onChange={(e) => setScoredDateInput(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Defines the commission calendar month this deal lands in.
                  </span>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Gross Fee Amount <span>*</span></span>
                    <button 
                      type="button" 
                      onClick={() => {
                        const salary = prompt("Enter Candidate's Annual Base Salary (£) to calculate standard 20% fee:", "50000");
                        if (salary) {
                          const base = parseFloat(salary);
                          if (!isNaN(base)) {
                            const fee = Math.round(base * 0.20);
                            setGrossInput(String(fee));
                            onShowToast(`⚡ AI Fee Recommender: Placed standard 20% fee (£${fee.toLocaleString()}) for candidate.`, "success");
                          }
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      ⚡ AI Fee Recommender
                    </button>
                  </label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 15000"
                    value={grossInput}
                    onChange={(e) => setGrossInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Placement status <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={statusInput}
                    onChange={(e) => {
                      setStatusInput(e.target.value);
                      if (e.target.value === 'dns') {
                        setDeductionsInput(grossInput);
                      } else if (e.target.value === 'active') {
                        setDeductionsInput('0');
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="active">Active Placement</option>
                    <option value="dns">Did Not Start (DNS)</option>
                    <option value="rebate">Rebated Placement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Deductions (DNS / Rebate Amount)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={deductionsInput}
                    onChange={(e) => setDeductionsInput(e.target.value)}
                    disabled={statusInput === 'dns'}
                  />
                </div>
              </div>

              {statusInput === 'dns' && (
                <div className="form-group">
                  <label className="form-label">DNS Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={dnsDateInput}
                    onChange={(e) => setDnsDateInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Credit Control Settings */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', margin: '0 0 4px 0' }}>Credit Control & Billing Setup</h4>
                
                <div className="form-group-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice Type <span>*</span></label>
                    <select
                      className="select-filter"
                      value={invoiceTypeInput}
                      onChange={(e) => setInvoiceTypeInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="direct">Direct Invoice</option>
                      <option value="simplicity">Simplicity Invoice</option>
                    </select>
                  </div>

                  {invoiceTypeInput === 'simplicity' && (
                    <div style={{ 
                      gridColumn: '1 / -1',
                      backgroundColor: 'rgba(99, 102, 241, 0.03)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      padding: '16px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      marginTop: '8px'
                    }}>
                      <h5 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🛡️ Simplicity Factoring Details
                      </h5>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Simplicity Client Number</label>
                          <input
                            type="text"
                            className="form-input"
                            value={simplicityClientNoInput}
                            onChange={(e) => setSimplicityClientNoInput(e.target.value)}
                            placeholder="e.g. 4037676"
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Available Credit Limit</label>
                          <input
                            type="text"
                            className="form-input"
                            value={simplicityCreditLimitInput}
                            onChange={(e) => setSimplicityCreditLimitInput(e.target.value)}
                            placeholder="e.g. £30,000.00 or Cr. Req sent"
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={noaRequiredInput}
                            onChange={(e) => setNoaRequiredInput(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          NOA Required?
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={consultantInvoiceReceivedInput}
                            onChange={(e) => setConsultantInvoiceReceivedInput(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Consultant Invoice Received?
                        </label>
                      </div>

                      {grossInput && !isNaN(Number(grossInput)) && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '12px', 
                          backgroundColor: 'var(--bg-secondary)', 
                          borderRadius: '6px', 
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>Estimated Factoring Breakdown (2.96% Fee):</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '4px', fontFamily: 'monospace' }}>
                            <div>Net Fee Value:</div>
                            <div style={{ textAlign: 'right' }}>£{Number(grossInput).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div>Total to Humres (97.04%):</div>
                            <div style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }}>£{(Number(grossInput) * 0.9704).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div>VAT on factored total (20%):</div>
                            <div style={{ textAlign: 'right' }}>£{(Number(grossInput) * 0.9704 * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 'bold' }}>Expected Friday Payout:</div>
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '4px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                              £{(Number(grossInput) * 0.9704 * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice to be Raised On <span>*</span></label>
                    <select
                      className="select-filter"
                      value={invoiceTriggerTypeInput}
                      onChange={(e) => setInvoiceTriggerTypeInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="start-date">Candidate Start Date</option>
                      <option value="offer-accepted">Date Offer Accepted</option>
                      <option value="custom-date">Custom Date...</option>
                    </select>
                  </div>

                  {invoiceTriggerTypeInput === 'custom-date' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Custom Invoice Date <span>*</span></label>
                      <input
                        type="date"
                        className="form-input"
                        value={invoiceTriggerCustomDateInput}
                        onChange={(e) => setInvoiceTriggerCustomDateInput(e.target.value)}
                        required={invoiceTriggerTypeInput === 'custom-date'}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Invoice Due In <span>*</span></label>
                    <select
                      className="select-filter"
                      value={paymentTermsInput}
                      onChange={(e) => setPaymentTermsInput(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                      required
                    >
                      <option value="7">7 Days</option>
                      <option value="10">10 Days</option>
                      <option value="30">30 Days</option>
                      <option value="31">31 Days</option>
                      <option value="custom">Custom Days...</option>
                    </select>
                  </div>

                  {paymentTermsInput === 'custom' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Custom Terms (Days) <span>*</span></label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 45"
                        value={paymentTermsCustomDaysInput}
                        onChange={(e) => setPaymentTermsCustomDaysInput(e.target.value)}
                        required={paymentTermsInput === 'custom'}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Client Invoice Payment settings */}
              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Client Invoice Payment Status</label>
                  <select 
                    className="select-filter"
                    value={clientPaymentStatusInput}
                    onChange={(e) => {
                      setClientPaymentStatusInput(e.target.value);
                      if (e.target.value === 'unpaid') {
                        setClientPaidDateInput('');
                      } else {
                        setClientPaidDateInput(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="unpaid">Unpaid / Pending Client Settlement</option>
                    <option value="paid">Paid by Client</option>
                  </select>
                </div>

                {clientPaymentStatusInput === 'paid' && (
                  <div className="form-group">
                    <label className="form-label">Date Client Settled Invoice <span>*</span></label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={clientPaidDateInput}
                      onChange={(e) => setClientPaidDateInput(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Override Commission Month */}
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Override Commission Payout Month</label>
                <input 
                  type="month" 
                  className="form-input"
                  placeholder="e.g. 2026-08"
                  value={commissionPaidMonthInput}
                  onChange={(e) => setCommissionPaidMonthInput(e.target.value)}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  Optional. Defaults to the month following placement start date. Override to force payment in a specific month (format: YYYY-MM).
                </span>
              </div>

              {/* Splits setup */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Recruiter Splits Allocation</label>
                  <button type="button" className="btn-secondary" onClick={handleAddSplitRow} style={{ padding: '4px 10px', fontSize: '11px' }}>
                    + Add Recruiter Split
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {splitsInput.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select
                        className="select-filter"
                        value={row.staffId}
                        onChange={(e) => handleSplitChange(idx, 'staffId', e.target.value)}
                        style={{ flex: 2, padding: '8px' }}
                        required
                      >
                        <option value="">-- Choose Recruiter --</option>
                        {staff.filter(member => member.status !== 'exited' || member.id === row.staffId).map(member => (
                          <option key={member.id} value={member.id}>{member.fullName} ({member.jobTitle})</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="%"
                          value={row.percentage}
                          onChange={(e) => handleSplitChange(idx, 'percentage', e.target.value)}
                          style={{ padding: '6px' }}
                          required
                        />
                        <span style={{ fontSize: '13px' }}>%</span>
                      </div>

                      {splitsInput.length > 1 && (
                        <button type="button" className="btn-icon delete" onClick={() => handleRemoveSplitRow(idx)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="placements-form-footer">
                <button type="button" className="btn-secondary" disabled={isSaving} onClick={handleCancelForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving Record...' : editingPlacementId ? 'Update Placement' : 'Save Placement Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters controls */}
      <div className="placements-controls-row">
        <div className="placements-search-filter-group">
          <div className="placements-search-wrapper">
            <Search size={16} className="placements-search-icon" />
            <input 
              type="text" 
              placeholder="Search placement id, client, candidate, or recruiter..." 
              className="placements-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Placement Statuses</option>
            <option value="active">Active Placements Only</option>
            <option value="dns">Did Not Start (DNS)</option>
            <option value="rebate">Rebated Placements</option>
          </select>

          {/* Consultant/Recruiter Filter */}
          <MultiSelectFilter
            options={consultantOptions}
            selectedValues={consultantFilter}
            onChange={(vals) => setConsultantFilter(vals)}
            placeholder="Select Recruiters"
          />

          {/* Start Month Filter */}
          <select 
            className="select-filter"
            value={startMonthFilter}
            onChange={(e) => setStartMonthFilter(e.target.value)}
          >
            <option value="all">All Start Months</option>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
              <option key={idx} value={String(idx)}>{m}</option>
            ))}
          </select>

          <MultiSelectFilter
            options={companyOptions}
            selectedValues={internalCompanyFilter}
            onChange={(vals) => setInternalCompanyFilter(vals)}
            placeholder="Select Companies"
          />

          <MultiSelectFilter
            options={departmentOptionsList}
            selectedValues={departmentFilter}
            onChange={(vals) => setDepartmentFilter(vals)}
            placeholder="Select Departments"
          />
        </div>

        <button 
          type="button" 
          className="btn-secondary" 
          onClick={handleExportPlacements}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Registry Table */}
      <div className="table-container">
        <table className="entity-table dense">
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick('placementId')} style={getHeaderStyle('placementId')}>
                Placement ID {renderSortIndicator('placementId')}
              </th>
              <th onClick={() => handleHeaderClick('clientCompany')} style={getHeaderStyle('clientCompany')}>
                Client Company {renderSortIndicator('clientCompany')}
              </th>
              <th onClick={() => handleHeaderClick('candidateName')} style={getHeaderStyle('candidateName')}>
                Candidate {renderSortIndicator('candidateName')}
              </th>
              <th onClick={() => handleHeaderClick('startDate')} style={getHeaderStyle('startDate')}>
                Dates (Start / Scored) {renderSortIndicator('startDate')}
              </th>
              <th onClick={() => handleHeaderClick('status')} style={getHeaderStyle('status')}>
                Status {renderSortIndicator('status')}
              </th>
              <th onClick={() => handleHeaderClick('clientPaymentStatus')} style={getHeaderStyle('clientPaymentStatus')}>
                Client Payment Status {renderSortIndicator('clientPaymentStatus')}
              </th>
              <th onClick={() => handleHeaderClick('grossBillAmount')} style={getHeaderStyle('grossBillAmount', true)}>
                Gross fee {renderSortIndicator('grossBillAmount')}
              </th>
              <th style={{ textAlign: 'right' }}>Deductions</th>
              <th onClick={() => handleHeaderClick('netScoreValue')} style={getHeaderStyle('netScoreValue', true)}>
                Net Fee Score {renderSortIndicator('netScoreValue')}
              </th>
              <th>Recruiters Splits Allocation</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPlacements.map(p => {
              const statusColors: any = {
                active: { label: 'Active', color: 'var(--success)' },
                dns: { label: 'DNS', color: 'var(--danger)' },
                rebate: { label: 'Rebated', color: 'var(--warning)' }
              };
              const config = statusColors[p.status || ''] || { label: p.status, color: 'var(--text-secondary)' };

              const grossAmount = p.grossBillAmount || p.netScoreValue || 0;
              const rebateAmount = p.status === 'dns' ? grossAmount : (p.dnsRebateAmount || 0);

              return (
                <tr 
                  key={p.id}
                  onClick={() => setViewingPlacement(p)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                  className="placement-row-hover"
                >
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    <div>{p.placementId}</div>
                    {p.invoiceNumber && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Invoice: {p.invoiceNumber}</div>}
                  </td>
                  <td>{p.clientCompany}</td>
                  <td>{p.candidateName}</td>
                  <td style={{ fontSize: '11px' }}>
                    <div>Start: <strong>{p.startDate}</strong></div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Scored: {p.scoredDate}</div>
                    {p.dnsDate && <div style={{ color: 'var(--danger)', marginTop: '2px' }}>DNS: {p.dnsDate}</div>}
                  </td>
                  <td>
                    <span className={`placements-badge ${
                      p.status === 'active' ? 'placements-badge-success' : p.status === 'dns' ? 'placements-badge-danger' : 'placements-badge-warning'
                    }`}>
                      {config.label}
                    </span>
                  </td>
                  
                  <td>
                    {p.clientPaymentStatus === 'paid' ? (
                      <div>
                        <span className="placements-badge placements-badge-success">
                          Client Paid
                        </span>
                        <div className="placements-text-muted">Paid: {p.clientPaidDate}</div>
                      </div>
                    ) : (
                      <div>
                        <span className="placements-badge placements-badge-danger">
                          Invoice Unpaid
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="placements-text-right placements-font-mono" style={{ fontWeight: 600 }}>£{grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="placements-text-right placements-font-mono" style={{ color: p.status === 'dns' || rebateAmount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {p.status === 'dns' ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>-£{grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '9px', color: 'var(--danger)' }}>DNS Full Loss</div>
                      </div>
                    ) : rebateAmount > 0 ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>-£{rebateAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '9px', color: 'var(--warning)' }}>Rebate Adjustment</div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="placements-text-right placements-font-mono" style={{ fontWeight: 700, color: 'var(--success)' }}>
                    <div>£{(p.netScoreValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    {getPlacementSplitWeight(p) < 1.0 && (
                      <div className="placements-text-muted" style={{ fontWeight: 600 }}>
                        Share: £{((p.netScoreValue || 0) * getPlacementSplitWeight(p)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {p.splits?.map((s, i) => {
                      const matchedStaff = staff.find(member => member.id === s.staffId);
                      return (
                        <div key={i} style={{ marginBottom: '2px' }}>
                          &bull; {matchedStaff ? matchedStaff.fullName : 'Unknown'} (<strong>{s.percentage}%</strong>)
                        </div>
                      );
                    })}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {p.status === 'active' && (
                        <>
                          <button 
                            className="btn-secondary" 
                            title="Mark Did Not Start"
                            onClick={() => handleQuickDNS(p)}
                            style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          >
                            DNS
                          </button>
                          <button 
                            className="btn-secondary" 
                            title="Apply Rebate"
                            onClick={() => handleQuickRebate(p)}
                            style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                          >
                            Rebate
                          </button>
                        </>
                      )}
                      
                      {p.clientPaymentStatus === 'paid' ? (
                        <button
                          className="btn-secondary"
                          onClick={() => handleToggleClientPayment(p, 'unpaid')}
                          style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          Reset Unpaid
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => handleToggleClientPayment(p, 'paid')}
                          style={{ padding: '4px 8px', fontSize: '10px', borderColor: 'var(--success)', color: 'var(--success)' }}
                        >
                          Client Paid
                        </button>
                      )}

                      <button className="btn-icon" onClick={() => handleEditPlacement(p)} title="Edit details">
                        <Edit3 size={11} />
                      </button>
                      <button 
                        className="btn-icon delete" 
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete placement record "${p.placementId}"?`)) {
                            onDeletePlacement(p.id);
                            onShowToast(`Deleted placement "${p.placementId}"`, "info");
                          }
                        }} 
                        title="Delete record"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedPlacements.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No placement logs found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {sortedPlacements.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong>{Math.min(sortedPlacements.length, (currentPage - 1) * pageSize + 1)}</strong> to{' '}
            <strong>{Math.min(sortedPlacements.length, currentPage * pageSize)}</strong> of{' '}
            <strong>{sortedPlacements.length}</strong> records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Show:</span>
              <select
                className="select-filter"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                {[10, 25, 50, 100].map(sz => (
                  <option key={sz} value={sz}>{sz} rows</option>
                ))}
              </select>
            </div>

            <div className="placements-matrix-toggle-group">
              <button
                type="button"
                className="placements-matrix-toggle-btn inactive"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                &laquo; First
              </button>
              <button
                type="button"
                className="placements-matrix-toggle-btn inactive"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Prev
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>
                Page {currentPage} of {Math.ceil(sortedPlacements.length / pageSize)}
              </span>
              <button
                type="button"
                className="placements-matrix-toggle-btn inactive"
                disabled={currentPage >= Math.ceil(sortedPlacements.length / pageSize)}
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedPlacements.length / pageSize), prev + 1))}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Next
              </button>
              <button
                type="button"
                className="placements-matrix-toggle-btn inactive"
                disabled={currentPage >= Math.ceil(sortedPlacements.length / pageSize)}
                onClick={() => setCurrentPage(Math.ceil(sortedPlacements.length / pageSize))}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                Last &raquo;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Placement Detail Card Modal */}
      {viewingPlacement && (
        <div className="form-wizard-overlay" onClick={() => setViewingPlacement(null)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                    Placement Record Details
                  </h2>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>CRM Registry Profile: {viewingPlacement.placementId}</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setViewingPlacement(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Profile Overview */}
              <div className="placements-detail-grid-2 placements-detail-box">
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Candidate Name</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{viewingPlacement.candidateName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Client Company</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{viewingPlacement.clientCompany}</div>
                </div>
              </div>

              {/* Placement Dates */}
              <div className="placements-detail-grid-3">
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Start Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.startDate}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Scored Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.scoredDate}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>DNS Date</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--danger)' }}>{viewingPlacement.dnsDate || '—'}</div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                  Financial Metrics
                </span>
                <div className="placements-detail-financials">
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Gross Placement Fee</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>
                      £{Number(viewingPlacement.grossBillAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>DNS / Rebate Loss</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--danger)', fontFamily: 'monospace' }}>
                      -£{Number(viewingPlacement.dnsRebateAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Net Placement Value</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--success)', fontFamily: 'monospace' }}>
                      £{Number(viewingPlacement.netScoreValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing Parameters */}
              <div className="placements-detail-grid-2" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Invoice Number</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{viewingPlacement.invoiceNumber || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Invoice Type</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', textTransform: 'capitalize' }}>
                    {viewingPlacement.invoiceType || 'direct'} Invoice
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Client Payment Status</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', textTransform: 'capitalize', color: viewingPlacement.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
                    {viewingPlacement.clientPaymentStatus || 'unpaid'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Payment Terms</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
                    {viewingPlacement.paymentTermsDays || 30} Days
                  </div>
                </div>
              </div>

              {/* Simplicity Specific Parameters Details */}
              {viewingPlacement.invoiceType === 'simplicity' && (
                <div className="placements-detail-simplicity-box">
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block' }}>
                    🛡️ Simplicity Factoring Audit
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                    <div>Client Number: <strong>{viewingPlacement.simplicityClientNo || '—'}</strong></div>
                    <div>Credit Limit: <strong>{viewingPlacement.simplicityCreditLimit || '—'}</strong></div>
                    <div>NOA Required: <strong>{viewingPlacement.noaRequired ? 'Yes' : 'No'}</strong></div>
                    <div>Invoice Received: <strong>{viewingPlacement.consultantInvoiceReceived ? 'Yes' : 'No'}</strong></div>
                  </div>

                  {/* Factoring details breakdown */}
                  <div className="placements-detail-mono-list">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Net Fee Total:</span>
                      <span>£{Number(viewingPlacement.grossBillAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                      <span>Total to Humres ({(FACTORING_PAYOUT_RATIO * 100).toFixed(2)}%):</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * FACTORING_PAYOUT_RATIO).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>VAT (20% of factored):</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * FACTORING_PAYOUT_RATIO * 0.20).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 'bold', color: 'var(--primary)' }}>
                      <span>Expected Payout:</span>
                      <span>£{(Number(viewingPlacement.grossBillAmount || 0) * FACTORING_PAYOUT_RATIO * 1.20).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recruiter Splits */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>
                  Recruiter Commission Splits
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {viewingPlacement.splits?.map((split, index) => {
                    const matchedStaff = staff.find(s => s.id === split.staffId);
                    return (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                        <span>{matchedStaff ? matchedStaff.fullName : 'Unknown Recruiter'}</span>
                        <strong style={{ color: 'var(--primary)' }}>{split.percentage}% Split</strong>
                      </div>
                    );
                  })}
                  {(!viewingPlacement.splits || viewingPlacement.splits.length === 0) && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No splits configured. (100% house placement)</span>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setViewingPlacement(null)}>
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => {
                    handleEditPlacement(viewingPlacement);
                    setViewingPlacement(null);
                  }}
                >
                  Edit Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Confirmation Modal */}
      {quickActionModal && (
        <div className="placements-form-overlay" onClick={() => !isSaving && setQuickActionModal(null)}>
          <div className="placements-form-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="placements-form-header">
              <div className="placements-form-title-group">
                <h2 className="placements-form-title">
                  {quickActionModal.type === 'dns'
                    ? 'Candidate Did Not Start (DNS)'
                    : quickActionModal.type === 'rebate'
                    ? 'Apply Rebate Deduction'
                    : 'Set Client Paid Date'}
                </h2>
              </div>
              <button
                type="button"
                className="btn-close"
                disabled={isSaving}
                onClick={() => setQuickActionModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="placements-form-content" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {quickActionModal.type === 'dns'
                  ? `Please confirm the date that candidate "${quickActionModal.placement.candidateName}" failed to start. This will set the net placement value to £0.`
                  : quickActionModal.type === 'rebate'
                  ? `Enter the rebate deduction amount to apply for "${quickActionModal.placement.candidateName}".`
                  : `Please enter the payment confirmation date for candidate "${quickActionModal.placement.candidateName}"'s invoice.`}
              </p>

              <div className="placements-form-group">
                <label className="placements-form-label">
                  {quickActionModal.type === 'dns'
                    ? 'DNS Confirmation Date'
                    : quickActionModal.type === 'rebate'
                    ? 'Rebate Amount (£)'
                    : 'Invoice Paid Date'}
                </label>
                <input
                  type={quickActionModal.type === 'rebate' ? 'number' : 'date'}
                  className="placements-form-input"
                  value={quickActionInputVal}
                  onChange={(e) => setQuickActionInputVal(e.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              </div>
            </div>

            <div className="placements-form-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={isSaving}
                onClick={() => setQuickActionModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={isSaving || !quickActionInputVal}
                onClick={() => executeQuickAction(quickActionModal.type, quickActionModal.placement, quickActionInputVal)}
              >
                {isSaving ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
