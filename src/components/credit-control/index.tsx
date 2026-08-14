import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { Company, Staff, Placement } from '../../types';
import { PAYMENT_STATUSES, getCurrencySymbol, calculateDaysOverdue } from './shared';
import CreditControlKPIs from './CreditControlKPIs';
import SimplicityLedgerTable from './SimplicityLedgerTable';
import DirectLedgerTable from './DirectLedgerTable';
import InvoiceDetailDrawer from './InvoiceDetailDrawer';

interface CreditControlDashboardProps {
  placements?: Placement[];
  companies?: Company[];
  staff?: Staff[];
  currentUser?: any;
  onUpdatePlacement?: (placement: Placement) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  defaultSubTab?: 'direct' | 'simplicity';
  onChangeSubTab?: (tab: 'direct' | 'simplicity') => void;
}

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const addDays = (dateStr: string, days: number): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
};

const getFridayOfWeek = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDay();
    const daysToFriday = 5 - day;
    d.setDate(d.getDate() + daysToFriday);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
};

const EMPTY_USER = {};

export default function CreditControlDashboard({
  placements: propPlacements,
  companies: propCompanies,
  staff: propStaff,
  currentUser: propCurrentUser,
  onUpdatePlacement: propOnUpdatePlacement,
  onShowToast,
  defaultSubTab,
  onChangeSubTab
}: CreditControlDashboardProps) {
  const storePlacements = useBoundStore(state => state.placements);
  const storeCompanies = useBoundStore(state => state.companies);
  const storeStaff = useBoundStore(state => state.staff);
  const storeUpdatePlacement = useBoundStore(state => state.updatePlacement);

  const placements = propPlacements || storePlacements;
  const companies = propCompanies || storeCompanies;
  const staff = propStaff || storeStaff;
  const currentUser = propCurrentUser || EMPTY_USER;
  const onUpdatePlacement = propOnUpdatePlacement || storeUpdatePlacement;

  const isFinanceOrAdmin = currentUser?.permissions?.role === 'admin' || 
    currentUser?.permissions?.role === 'finance_admin';
  const readOnly = !isFinanceOrAdmin;

  const [activeSubTab, setActiveSubTab] = useState<'direct' | 'simplicity'>(defaultSubTab || 'direct');
  
  React.useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const [directCardFilter, setDirectCardFilter] = useState<'all-outstanding' | 'disputed' | 'legal' | 'due'>('all-outstanding');
  const [simplicityCardFilter, setSimplicityCardFilter] = useState<'all' | 'outstanding-overdue' | 'about-to-raise' | 'outstanding' | 'paid-unpaid'>('outstanding');

  const [showColConfig, setShowColConfig] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedPipelineWeeks, setSelectedPipelineWeeks] = useState<Set<string>>(new Set());
  const handleTogglePipelineWeek = (weekDate: string) => {
    const newSet = new Set(selectedPipelineWeeks);
    if (newSet.has(weekDate)) {
      newSet.delete(weekDate);
    } else {
      newSet.add(weekDate);
    }
    setSelectedPipelineWeeks(newSet);
  };
  const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>([
    { id: 'placementId', label: 'Placement ID', visible: true },
    { id: 'ems', label: 'EMS', visible: false },
    { id: 'clientCompany', label: 'Client Company', visible: true },
    { id: 'simplicityClientNo', label: 'Client No', visible: false },
    { id: 'simplicityCreditLimit', label: 'Credit Limit', visible: false },
    { id: 'noaRequired', label: 'NOA Required', visible: false },
    { id: 'consultantInvoiceReceived', label: 'Consultant Inv Recd', visible: false },
    { id: 'invoiceNumber', label: 'Invoice Number', visible: true },
    { id: 'candidateName', label: 'Candidate Name', visible: true },
    { id: 'recruiter', label: 'Recruiter', visible: true },
    { id: 'startDate', label: 'Start Date', visible: false },
    { id: 'scoredDate', label: 'Scored Date', visible: false },
    { id: 'invoiceRaisedDate', label: 'Invoice Raised Date', visible: false },
    { id: 'paymentTermsDays', label: 'Payment Terms (Days)', visible: false },
    { id: 'dueDate', label: 'Due Date', visible: true },
    { id: 'payoutDate', label: 'Expected Payout Date', visible: true },
    { id: 'riskTimeline', label: 'Simplicity Risk', visible: true },
    { id: 'netTotal', label: 'Net Total', visible: false },
    { id: 'factoredGross', label: 'Total to Humres', visible: true },
    { id: 'vat', label: 'VAT', visible: false },
    { id: 'totalInclVat', label: 'Total Incl. VAT', visible: false },
    { id: 'amount', label: 'Total Invoice', visible: true },
    { id: 'status', label: 'Status', visible: true },
    { id: 'outstanding', label: 'Outstanding', visible: true },
    { id: 'doc', label: 'Doc', visible: true }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, next-7, next-30, this-month, next-month, overdue
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandDebtors60, setExpandDebtors60] = useState(false);
  const [collapseAnalytics, setCollapseAnalytics] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showRescheduleDropzones, setShowRescheduleDropzones] = useState(false);

  // Simplicity importer states
  const [showSimplicityImporter, setShowSimplicityImporter] = useState(false);
  const [simplicityPastedData, setSimplicityPastedData] = useState('');

  const handleImportSimplicitySchedule = async () => {
    if (!simplicityPastedData.trim()) {
      onShowToast("Please paste Simplicity factoring schedule rows first.", "warning");
      return;
    }

    const lines = simplicityPastedData.split('\n').map(l => l.trim()).filter(Boolean);
    let matchCount = 0;
    
    for (const line of lines) {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      if (parts.length < 2) continue;
      
      const invNumber = parts[0];
      const amtPaid = parseFloat(parts[1].replace(/[^0-9.-]/g, '')) || 0;

      const matched = placements.find(p => p.invoiceNumber && p.invoiceNumber.toLowerCase() === invNumber.toLowerCase());
      if (matched && matched.clientPaymentStatus !== 'paid') {
        const currentBalance = matched.balanceOutstanding !== undefined ? Number(matched.balanceOutstanding) : (Number(matched.totalInvoiceAmount) || Number(matched.grossBillAmount) * 1.20);
        const isFullyPaid = amtPaid >= currentBalance;
        const updated = {
          ...matched,
          clientPaymentStatus: isFullyPaid ? 'paid' as const : 'unpaid' as const,
          balanceOutstanding: Math.max(0, currentBalance - amtPaid),
          clientPaidDate: new Date().toISOString().split('T')[0]
        };
        await onUpdatePlacement(updated);
        matchCount++;
      }
    }

    onShowToast(`⚡ Simplicity Importer: Successfully matched and updated ${matchCount} invoices.`, "success");
    setSimplicityPastedData('');
    setShowSimplicityImporter(false);
  };

  // Helper date conversions
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const invoices = useMemo(() => {
    return placements
      .filter(p => p.status !== 'dns')
      .map(p => {
        const gross = Number(p.grossBillAmount) || 0;
        let vat = (p.vatAmount !== undefined && p.vatAmount !== null && p.vatAmount !== '') 
          ? (Number(p.vatAmount) || 0) 
          : (Math.round(gross * 0.20 * 100) / 100);
        let total = (p.totalInvoiceAmount !== undefined && p.totalInvoiceAmount !== null && p.totalInvoiceAmount !== '') 
          ? (Number(p.totalInvoiceAmount) || 0) 
          : (gross + vat);

        if (p.invoiceType === 'simplicity' && (!p.vatAmount || !p.totalInvoiceAmount)) {
          // Fallback to 2.96% Simplicity factoring fee
          const factoredGross = Math.round(gross * 0.9704 * 100) / 100;
          vat = Math.round(factoredGross * 0.20 * 100) / 100;
          total = factoredGross + vat;
        }
        
        const raisedDate = p.invoiceRaisedDate || p.startDate || p.scoredDate || todayStr;
        const termsDays = (p.paymentTermsDays !== undefined && p.paymentTermsDays !== null && p.paymentTermsDays !== '') ? Number(p.paymentTermsDays) : 30;
        
        // Calculate due date
        let dueDate = p.invoiceDueDate;
        if (!dueDate && raisedDate) {
          try {
            const parts = raisedDate.split('-');
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            if (!isNaN(d.getTime())) {
              d.setDate(d.getDate() + termsDays);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dayVal = String(d.getDate()).padStart(2, '0');
              dueDate = `${y}-${m}-${dayVal}`;
            }
          } catch (e) {
            dueDate = raisedDate;
          }
        }

        const overdueDays = calculateDaysOverdue(dueDate, todayStr);
        const paid = Number(p.amountPaid) || 0;
        const outstanding = Math.max(0, total - paid);

        // Resolve final calculated status
        let finalStatus = p.paymentStatus || 'not-invoiced';
        if (p.clientPaymentStatus === 'paid' || outstanding === 0) {
          finalStatus = 'paid';
        } else if (p.invoiceType === 'simplicity' && p.simplicityPaid) {
          finalStatus = 'funded';
        } else if (
          finalStatus !== 'paid' && 
          finalStatus !== 'funded' && 
          finalStatus !== 'written-off' && 
          finalStatus !== 'dns-rebate' && 
          finalStatus !== 'legal' && 
          finalStatus !== 'disputed' && 
          (dueDate && dueDate < todayStr)
        ) {
          finalStatus = 'overdue';
        }

        // Resolve recruiter splits names
        const recruiterNames = (p.splits || []).map(sp => {
          const staffMember = staff.find(s => s.id === sp.staffId);
          return staffMember ? staffMember.fullName : 'Recruiter';
        }).join(', ');

        const mainRecruiterId = p.splits && p.splits.length > 0 ? p.splits[0].staffId : (p.recruiterId || '');
        const mainRecruiter = staff.find(s => s.id === mainRecruiterId);
        const deptName = mainRecruiter ? mainRecruiter.department : 'Recruitment';
        const recruiterCompanyId = mainRecruiter ? mainRecruiter.companyId : '';
        const finalCompanyId = p.companyId || recruiterCompanyId;

        // Calculate days since start date
        let daysSinceStart = 0;
        if (p.startDate) {
          try {
            const startD = new Date(p.startDate).getTime();
            const todayD = new Date(todayStr).getTime();
            const diffTime = todayD - startD;
            daysSinceStart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } catch(e) {}
        }

        // Calculate Simplicity Friday Payout Date
        let simplicityPayoutDate = '—';
        if (p.startDate) {
          try {
            const d = new Date(p.startDate);
            if (!isNaN(d.getTime())) {
              const day = d.getDay();
              let daysToAdd = 0;
              if (day === 1 || day === 2 || day === 3) {
                daysToAdd = 5 - day;
              } else {
                if (day === 0) {
                  daysToAdd = 5;
                } else {
                  daysToAdd = 5 + (7 - day);
                }
              }
              const payoutDate = new Date(d.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
              const y = payoutDate.getFullYear();
              const m = String(payoutDate.getMonth() + 1).padStart(2, '0');
              const dayVal = String(payoutDate.getDate()).padStart(2, '0');
              simplicityPayoutDate = `${y}-${m}-${dayVal}`;
            }
          } catch (e) {}
        }

        return {
          ...p,
          companyId: finalCompanyId,
          recruiterCompanyId,
          invoiceType: p.invoiceType || 'direct',
          invoiceRaisedDate: raisedDate,
          paymentTermsDays: termsDays,
          invoiceDueDate: dueDate || raisedDate,
          vatAmount: vat,
          totalInvoiceAmount: total,
          paymentStatus: finalStatus,
          amountPaid: paid,
          balanceOutstanding: outstanding,
          overdueDays,
          recruiterNames,
          mainRecruiterId,
          departmentName: deptName,
          daysSinceStart,
          simplicityPayoutDate,
          overridePayoutDate: p.overridePayoutDate || null,
          simplicityPaid: !!p.simplicityPaid,
          simplicityPaidDate: p.simplicityPaidDate || null,
          clientPaymentStatus: p.clientPaymentStatus || 'unpaid',
          clientPaidDate: p.clientPaidDate || null
        };
      });
  }, [placements, companies, staff, todayStr]);

  const activeColumns = useMemo(() => {
    return columnsConfig.filter(col => {
      if (!col.visible) return false;
      if (activeSubTab === 'direct') {
        return !['ems', 'noaRequired', 'consultantInvoiceReceived', 'simplicityClientNo', 'simplicityCreditLimit', 'riskTimeline', 'netTotal', 'factoredGross', 'vat', 'totalInclVat', 'payoutDate'].includes(col.id);
      } else {
        return !['amount'].includes(col.id);
      }
    });
  }, [columnsConfig, activeSubTab]);

  const handleToggleColVisible = (id: string) => {
    setColumnsConfig(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const handleMoveCol = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= columnsConfig.length) return;
    setColumnsConfig(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleToggleSelectRow = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (list: any[]) => {
    const listIds = list.map(inv => inv.id);
    const allSelected = listIds.every(id => selectedInvoiceIds.has(id));
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        listIds.forEach(id => next.delete(id));
      } else {
        listIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleTabChange = (tab: 'direct' | 'simplicity') => {
    setActiveSubTab(tab);
    setSelectedInvoiceIds(new Set());
    if (onChangeSubTab) {
      onChangeSubTab(tab);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>⇅</span>;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const handleOpenDetail = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  const handleMoveInvoiceToWeek = async (invoiceId: string, targetWeekDate: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    
    const originalPlacement = placements.find(p => p.id === invoiceId);
    if (!originalPlacement) return;

    const updatedPlacement = {
      ...originalPlacement,
      overridePayoutDate: targetWeekDate
    };

    try {
      await onUpdatePlacement(updatedPlacement);
      onShowToast(`Moved ${inv.candidateName} to week ending ${targetWeekDate}`, "success");
    } catch (e: any) {
      onShowToast(`Failed to move invoice: ${e.message}`, "warning");
    }
  };

  const handleExportCSV = () => {
    const headers = activeColumns.map(col => col.label);
    const rows = filteredInvoices.map(inv => {
      return activeColumns.map(col => {
        switch (col.id) {
          case 'placementId':
            return inv.placementId && inv.placementId !== 'NA' ? inv.placementId : (inv.id.startsWith('place-') ? inv.id.substring(6) : inv.id);
          case 'clientCompany':
            return inv.clientCompany;
          case 'internalCompany':
            const matchedCo = companies.find(c => c.id === inv.companyId);
            return matchedCo ? matchedCo.name : '—';
          case 'candidateName':
            return inv.candidateName;
          case 'recruiter':
            return inv.recruiterNames;
          case 'startDate':
            return inv.startDate || '';
          case 'scoredDate':
            return inv.scoredDate || '';
          case 'invoiceNumber':
            return inv.invoiceNumber || '';
          case 'invoiceRaisedDate':
            return inv.invoiceRaisedDate || '';
          case 'paymentTermsDays':
            return inv.paymentTermsDays || '';
          case 'dueDate':
            return inv.invoiceDueDate || '';
          case 'riskTimeline':
            return inv.balanceOutstanding > 0 ? `Day ${inv.daysSinceStart}` : 'Paid';
          case 'netTotal':
            return Number(inv.grossBillAmount) || 0;
          case 'factoredGross':
            return (Number(inv.grossBillAmount) || 0) * 0.9704;
          case 'vat':
            return (Number(inv.grossBillAmount) || 0) * 0.9704 * 0.20;
          case 'totalInclVat':
            return (Number(inv.grossBillAmount) || 0) * 0.9704 * 1.20;
          case 'amount':
            return inv.totalInvoiceAmount || 0;
          case 'status':
            return inv.paymentStatus;
          case 'outstanding':
            return inv.balanceOutstanding || 0;
          default:
            return '';
        }
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => {
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Humres_Ledger_Export_${activeSubTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Ledger exported to CSV successfully.", "success");
  };

  const handleExportSimplicity = () => {
    const headers = [
      'Invoice Number',
      'Invoice Date',
      'Client Company',
      'Candidate Name',
      'Gross Amount (£)',
      'VAT (£)',
      'Total Incl VAT (£)',
      'Due Date',
      'Factored Advance Value (£)',
      'Status'
    ];
    const rows = filteredInvoices.map(inv => {
      const gross = Number(inv.grossBillAmount) || 0;
      const vat = gross * 0.20;
      const total = gross * 1.20;
      const advance = gross * 0.9704;
      return [
        inv.invoiceNumber || '',
        inv.invoiceRaisedDate || '',
        inv.clientCompany || '',
        inv.candidateName || '',
        gross.toFixed(2),
        vat.toFixed(2),
        total.toFixed(2),
        inv.invoiceDueDate || '',
        advance.toFixed(2),
        inv.paymentStatus || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Simplicity_Factoring_Upload_${activeSubTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Simplicity factoring file exported successfully.", "success");
  };

  const selectedSums = useMemo(() => {
    if (selectedInvoiceIds.size === 0) return null;
    let net = 0;
    let factored = 0;
    let vat = 0;
    let total = 0;
    let outstanding = 0;
    let count = 0;

    invoices.forEach(inv => {
      if (selectedInvoiceIds.has(inv.id)) {
        count++;
        net += (Number(inv.grossBillAmount) || 0);
        if (inv.invoiceType === 'simplicity') {
          const fGross = (Number(inv.grossBillAmount) || 0) * 0.9704;
          factored += fGross;
          vat += fGross * 0.20;
          total += fGross * 1.20;
        } else {
          factored += (Number(inv.grossBillAmount) || 0);
          vat += (Number(inv.vatAmount) || 0);
          total += (Number(inv.totalInvoiceAmount) || 0);
        }
        outstanding += (Number(inv.balanceOutstanding) || 0);
      }
    });

    return { count, net, factored, vat, total, outstanding };
  }, [selectedInvoiceIds, invoices]);

  const dashboardStats = useMemo(() => {
    const overdueList = invoices.filter(inv => inv.paymentStatus === 'overdue' && inv.balanceOutstanding > 0);
    const legalList = invoices.filter(inv => inv.paymentStatus === 'legal' && inv.balanceOutstanding > 0);
    const disputedList = invoices.filter(inv => inv.paymentStatus === 'disputed' && inv.balanceOutstanding > 0);

    const totalOverdue = overdueList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    const overdueDirect = overdueList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    const overdueSimplicity = overdueList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0);
    
    let oldestOverdueDays = 0;
    overdueList.forEach(inv => {
      if (inv.overdueDays > oldestOverdueDays) oldestOverdueDays = inv.overdueDays;
    });

    const getExpectedInDays = (days: number) => {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() + days);
      const limitStr = limitDate.toISOString().split('T')[0];

      return invoices.filter(inv => 
        inv.invoiceDueDate >= todayStr && 
        inv.invoiceDueDate <= limitStr && 
        inv.balanceOutstanding > 0 &&
        !['paid', 'legal', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
      );
    };

    const next7Days = getExpectedInDays(7);
    const next30Days = getExpectedInDays(30);

    const getExpectedInMonth = (yearVal: number, monthVal: number) => {
      const prefix = `${yearVal}-${String(monthVal).padStart(2, '0')}`;
      return invoices.filter(inv => 
        inv.invoiceDueDate.startsWith(prefix) && 
        inv.balanceOutstanding > 0 && 
        !['paid', 'legal', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
      );
    };

    const tDate = new Date();
    const thisMonthList = getExpectedInMonth(tDate.getFullYear(), tDate.getMonth() + 1);
    
    tDate.setMonth(tDate.getMonth() + 1);
    const nextMonthList = getExpectedInMonth(tDate.getFullYear(), tDate.getMonth() + 1);

    return {
      overdueCount: overdueList.length,
      overdueTotal: totalOverdue,
      overdueOldestDays: oldestOverdueDays,
      overdueDirect,
      overdueSimplicity,
      
      legalList,
      legalTotal: legalList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      disputedList,
      disputedTotal: disputedList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      next7Days,
      next7DaysTotal: next7Days.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      next30Days,
      next30DaysTotal: next30Days.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      thisMonthList,
      thisMonthTotal: thisMonthList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      thisMonthDirect: thisMonthList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      thisMonthSimplicity: thisMonthList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),

      nextMonthList,
      nextMonthTotal: nextMonthList.reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      nextMonthDirect: nextMonthList.filter(inv => inv.invoiceType === 'direct').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      nextMonthSimplicity: nextMonthList.filter(inv => inv.invoiceType === 'simplicity').reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      simplicityClawbackList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 120),
      simplicityClawbackTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 120).reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      simplicityExpiryList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 90 && inv.daysSinceStart < 120),
simplicityExpiryTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 90 && inv.daysSinceStart < 120).reduce((sum, inv) => sum + inv.balanceOutstanding, 0),
      
      simplicityFollowupList: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 31 && inv.daysSinceStart < 90),
      simplicityFollowupTotal: invoices.filter(inv => inv.invoiceType === 'simplicity' && inv.balanceOutstanding > 0 && inv.daysSinceStart >= 31 && inv.daysSinceStart < 90).reduce((sum, inv) => sum + inv.balanceOutstanding, 0)
    };
  }, [invoices, todayStr]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const isSimplicity = inv.invoiceType === 'simplicity';
      const isTabDirect = activeSubTab === 'direct';
      if (isTabDirect && isSimplicity) return false;
      if (!isTabDirect && !isSimplicity) return false;

      // Card Filters Integration
      if (activeSubTab === 'direct') {
        if (directCardFilter === 'all-outstanding') {
          // Keep closed invoices in direct tab so the bottom closed table renders by default
        } else if (directCardFilter === 'disputed') {
          if (inv.paymentStatus !== 'disputed') return false;
        } else if (directCardFilter === 'legal') {
          if (inv.paymentStatus !== 'legal') return false;
        } else if (directCardFilter === 'due') {
          const isDue = inv.paymentStatus === 'overdue' || (inv.invoiceDueDate && inv.invoiceDueDate < todayStr && inv.clientPaymentStatus !== 'paid');
          if (!isDue) return false;
        }
      } else {
        if (simplicityCardFilter === 'outstanding') {
          // Keep closed invoices in simplicity tab so the bottom closed table renders by default
        } else if (simplicityCardFilter === 'outstanding-overdue') {
          if (inv.paymentStatus !== 'overdue') return false;
        } else if (simplicityCardFilter === 'about-to-raise') {
          const isAboutToRaise = !inv.invoiceNumber || inv.paymentStatus === 'not-invoiced';
          if (!isAboutToRaise) return false;
        } else if (simplicityCardFilter === 'paid-unpaid') {
          const isRecourse = inv.simplicityPaid && inv.clientPaymentStatus !== 'paid';
          if (!isRecourse) return false;
        }
        // 'all' filter shows all simplicity records
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const candidateMatch = (inv.candidateName || '').toLowerCase().includes(query);
        const clientMatch = (inv.clientCompany || '').toLowerCase().includes(query);
        const invNumMatch = (inv.invoiceNumber || '').toLowerCase().includes(query);
        const pidMatch = (inv.placementId || '').toLowerCase().includes(query);
        const recruiterMatch = (inv.recruiterNames || '').toLowerCase().includes(query);
        if (!candidateMatch && !clientMatch && !invNumMatch && !pidMatch && !recruiterMatch) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'unpaid' && (inv.paymentStatus === 'paid' || inv.balanceOutstanding <= 0)) return false;
        if (statusFilter !== 'unpaid' && inv.paymentStatus !== statusFilter) return false;
      }

      if (recruiterFilter !== 'all' && inv.mainRecruiterId !== recruiterFilter) return false;

      if (dateFilter !== 'all') {
        if (dateFilter === 'overdue') {
          if (inv.paymentStatus !== 'overdue') return false;
        } else if (dateFilter === 'next-7') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 7);
          const limitStr = limit.toISOString().split('T')[0];
          if (inv.invoiceDueDate < todayStr || inv.invoiceDueDate > limitStr) return false;
        } else if (dateFilter === 'next-30') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 30);
          const limitStr = limit.toISOString().split('T')[0];
          if (inv.invoiceDueDate < todayStr || inv.invoiceDueDate > limitStr) return false;
        } else if (dateFilter === 'this-month') {
          const now = new Date();
          const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (!inv.invoiceDueDate.startsWith(prefix)) return false;
        } else if (dateFilter === 'next-month') {
          const now = new Date();
          now.setMonth(now.getMonth() + 1);
          const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (!inv.invoiceDueDate.startsWith(prefix)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortBy as keyof typeof a];
      let valB: any = b[sortBy as keyof typeof b];

      if (sortBy === 'amount') {
        valA = a.totalInvoiceAmount;
        valB = b.totalInvoiceAmount;
      } else if (sortBy === 'internalCompany') {
        const matchedA = companies.find(c => c.id === a.companyId);
        const matchedB = companies.find(c => c.id === b.companyId);
        valA = matchedA ? matchedA.name : '';
        valB = matchedB ? matchedB.name : '';
      } else if (sortBy === 'recruiter') {
        valA = a.recruiterNames;
        valB = b.recruiterNames;
      } else if (sortBy === 'client') {
        valA = a.clientCompany;
        valB = b.clientCompany;
      } else if (sortBy === 'dueDate') {
        valA = a.invoiceDueDate;
        valB = b.invoiceDueDate;
      } else if (sortBy === 'status') {
        valA = a.paymentStatus;
        valB = b.paymentStatus;
      } else if (sortBy === 'placementId') {
        valA = a.placementId || a.id;
        valB = b.placementId || b.id;
      } else if (sortBy === 'candidateName') {
        valA = a.candidateName;
        valB = b.candidateName;
      } else if (sortBy === 'outstanding') {
        valA = a.balanceOutstanding;
        valB = b.balanceOutstanding;
      } else if (sortBy === 'startDate') {
        valA = a.startDate;
        valB = b.startDate;
      } else if (sortBy === 'scoredDate') {
        valA = a.scoredDate;
        valB = b.scoredDate;
      } else if (sortBy === 'invoiceNumber') {
        valA = a.invoiceNumber;
        valB = b.invoiceNumber;
      } else if (sortBy === 'invoiceRaisedDate') {
        valA = a.invoiceRaisedDate;
        valB = b.invoiceRaisedDate;
      } else if (sortBy === 'paymentTermsDays') {
        valA = Number(a.paymentTermsDays) || 0;
        valB = Number(b.paymentTermsDays) || 0;
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, activeSubTab, directCardFilter, simplicityCardFilter, searchQuery, statusFilter, recruiterFilter, dateFilter, sortBy, sortOrder, todayStr, companies]);

  const directMetrics = useMemo(() => {
    const list = invoices.filter(inv => inv.invoiceType !== 'simplicity');
    const outstandingList = list.filter(inv => inv.clientPaymentStatus !== 'paid' && inv.balanceOutstanding > 0);
    const disputedList = list.filter(inv => inv.paymentStatus === 'disputed');
    const legalList = list.filter(inv => inv.paymentStatus === 'legal');
    const dueList = list.filter(inv => inv.paymentStatus === 'overdue' || (inv.invoiceDueDate && inv.invoiceDueDate < todayStr && inv.clientPaymentStatus !== 'paid'));

    const sumList = (list: any[]) => list.reduce((sum, item) => sum + (Number(item.balanceOutstanding) || 0), 0);

    return {
      outstanding: { count: outstandingList.length, amount: sumList(outstandingList) },
      disputed: { count: disputedList.length, amount: sumList(disputedList) },
      legal: { count: legalList.length, amount: sumList(legalList) },
      due: { count: dueList.length, amount: sumList(dueList) }
    };
  }, [invoices, todayStr]);

  const simplicityMetrics = useMemo(() => {
    const list = invoices.filter(inv => inv.invoiceType === 'simplicity');
    const overdueList = list.filter(inv => inv.paymentStatus === 'overdue');
    const aboutToRaiseList = list.filter(inv => !inv.invoiceNumber || inv.paymentStatus === 'not-invoiced');
    const outstandingList = list.filter(inv => inv.clientPaymentStatus !== 'paid' && inv.balanceOutstanding > 0);
    const recourseList = list.filter(inv => inv.simplicityPaid && inv.clientPaymentStatus !== 'paid');
    const allList = list;

    const sumList = (list: any[]) => list.reduce((sum, item) => sum + (Number(item.balanceOutstanding) || 0), 0);

    return {
      overdue: { count: overdueList.length, amount: sumList(overdueList) },
      aboutToRaise: { count: aboutToRaiseList.length, amount: aboutToRaiseList.reduce((sum, item) => sum + (Number(item.grossBillAmount) * 1.2 || 0), 0) },
      outstanding: { count: outstandingList.length, amount: sumList(outstandingList) },
      recourse: { count: recourseList.length, amount: sumList(recourseList) },
      all: { count: allList.length, amount: sumList(allList) }
    };
  }, [invoices]);



  const partitionedInvoices = useMemo(() => {
    const disputedLegal = filteredInvoices.filter(inv => 
      ['legal', 'disputed'].includes(inv.paymentStatus)
    );

    const liveOutstanding = filteredInvoices.filter(inv => 
      !['paid', 'legal', 'disputed', 'written-off', 'dns-rebate'].includes(inv.paymentStatus) && 
      inv.balanceOutstanding > 0
    );

    const closed = filteredInvoices.filter(inv => 
      inv.paymentStatus === 'paid' || 
      inv.paymentStatus === 'written-off' || 
      inv.paymentStatus === 'dns-rebate' || 
      inv.balanceOutstanding <= 0
    );

    return { disputedLegal, liveOutstanding, closed };
  }, [filteredInvoices]);

  const simplicityActiveWeeks = useMemo(() => {
    const currentWeekFri = getFridayOfWeek(todayStr);
    const groups: Record<string, any[]> = {};
    const activeInvoices = filteredInvoices.filter(inv => 
      inv.invoiceType === 'simplicity' && 
      !['legal', 'disputed', 'paid', 'written-off', 'dns-rebate', 'overdue'].includes(inv.paymentStatus) &&
      inv.balanceOutstanding > 0 &&
      ((inv.simplicityPayoutDate && inv.simplicityPayoutDate >= currentWeekFri) || (inv.overridePayoutDate && inv.overridePayoutDate >= currentWeekFri))
    );

    const recourseClawbacks: any[] = [];
    filteredInvoices.forEach(inv => {
      if (
        inv.invoiceType === 'simplicity' &&
        inv.balanceOutstanding > 0 &&
        !['paid', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
      ) {
        const raisedDate = inv.invoiceRaisedDate || inv.startDate || inv.scoredDate || todayStr;
        const dueDate = inv.invoiceDueDate || raisedDate;
        const overdueDays = calculateDaysOverdue(dueDate, todayStr);

        if (overdueDays >= 60) {
          const clawbackA = addDays(raisedDate, 120);
          const clawbackB = addDays(dueDate, 90);
          const recourseDate = clawbackA < clawbackB ? clawbackA : clawbackB;
          const clawbackFriday = getFridayOfWeek(recourseDate);

          if (clawbackFriday >= todayStr) {
            recourseClawbacks.push({
              ...inv,
              isClawbackProjection: true,
              payoutFriday: clawbackFriday,
              projectedClawbackDate: recourseDate,
              originalAmount: inv.totalInvoiceAmount || 0,
              totalInvoiceAmount: -(inv.balanceOutstanding || 0),
              balanceOutstanding: -(inv.balanceOutstanding || 0),
              grossBillAmount: -((inv.balanceOutstanding || 0) / 1.2),
              amountPaid: 0,
              paymentStatus: 'recourse-clawback'
            });
          }
        }
      }
    });

    activeInvoices.forEach(inv => {
      const payoutFriday = inv.overridePayoutDate || inv.simplicityPayoutDate || '—';
      if (!groups[payoutFriday]) {
        groups[payoutFriday] = [];
      }
      groups[payoutFriday].push(inv);
    });

    recourseClawbacks.forEach(claw => {
      const payoutFriday = claw.payoutFriday;
      if (!groups[payoutFriday]) {
        groups[payoutFriday] = [];
      }
      groups[payoutFriday].push(claw);
    });

    return Object.keys(groups).sort().map(dateStr => {
      const list = groups[dateStr];
      const netTotalSum = list.reduce((sum, inv) => sum + (Number(inv.grossBillAmount) || 0), 0);
      const totalToHumresSum = list.reduce((sum, inv) => sum + ((Number(inv.grossBillAmount) || 0) * (inv.isClawbackProjection ? 1.0 : 0.9704)), 0);
      const vatSum = totalToHumresSum * 0.20;
      const totalInclVatSum = totalToHumresSum * 1.20;

      return {
        weekDate: dateStr,
        invoices: list,
        netTotalSum,
        totalToHumresSum,
        vatSum,
        totalInclVatSum
      };
    });
  }, [filteredInvoices, todayStr]);

  const simplicityWeeklyTotalProjections = useMemo(() => {
    return simplicityActiveWeeks.reduce((sum, week) => sum + (week.totalInclVatSum || 0), 0);
  }, [simplicityActiveWeeks]);

  const selectedPipelineTotal = useMemo(() => {
    let sum = 0;
    simplicityActiveWeeks.forEach(week => {
      if (selectedPipelineWeeks.has(week.weekDate)) {
        sum += (week.totalInclVatSum || 0);
      }
    });
    return sum;
  }, [selectedPipelineWeeks, simplicityActiveWeeks]);

  const simplicityPriorWeeks = useMemo(() => {
    const currentWeekFri = getFridayOfWeek(todayStr);
    return filteredInvoices.filter(inv => 
      inv.invoiceType === 'simplicity' && 
      !['legal', 'disputed', 'paid', 'written-off', 'dns-rebate', 'overdue'].includes(inv.paymentStatus) &&
      inv.balanceOutstanding > 0 &&
      (!inv.simplicityPayoutDate || inv.simplicityPayoutDate < currentWeekFri) &&
      (!inv.overridePayoutDate || inv.overridePayoutDate < currentWeekFri)
    );
  }, [filteredInvoices, todayStr]);

  const simplicityLegal = useMemo(() => {
    return filteredInvoices.filter(inv => 
      inv.invoiceType === 'simplicity' && 
      ['legal', 'disputed'].includes(inv.paymentStatus)
    );
  }, [filteredInvoices]);

  const simplicityOverdue = useMemo(() => {
    return filteredInvoices.filter(inv => 
      inv.invoiceType === 'simplicity' && 
      inv.paymentStatus === 'overdue' && 
      !['legal', 'disputed'].includes(inv.paymentStatus)
    );
  }, [filteredInvoices]);

  const simplicityPaid = useMemo(() => {
    return filteredInvoices.filter(inv => 
      inv.invoiceType === 'simplicity' && 
      ['paid', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
    );
  }, [filteredInvoices]);

  const debtorsOver60 = useMemo(() => {
    return filteredInvoices.filter(inv =>
      inv.balanceOutstanding > 0 &&
      inv.overdueDays > 60 &&
      !['paid', 'legal', 'written-off', 'dns-rebate'].includes(inv.paymentStatus)
    );
  }, [filteredInvoices]);

  const upcomingFridays = useMemo(() => {
    const fridays: string[] = [];
    try {
      const today = new Date(todayStr);
      let day = today.getDay();
      let daysToFriday = 5 - day;
      if (daysToFriday < 0) {
        daysToFriday += 7;
      }
      const nextFriday = new Date(today.getTime() + daysToFriday * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < 6; i++) {
        const fri = new Date(nextFriday.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const y = fri.getFullYear();
        const m = String(fri.getMonth() + 1).padStart(2, '0');
        const d = String(fri.getDate()).padStart(2, '0');
        fridays.push(`${y}-${m}-${d}`);
      }
    } catch(e) {}
    return fridays;
  }, [todayStr]);

  const directProjections = useMemo(() => {
    const list = invoices.filter(inv => inv.invoiceType !== 'simplicity' && inv.clientPaymentStatus !== 'paid' && inv.balanceOutstanding > 0);
    
    const resolvedInvoices = list.map(inv => {
      const expectedDate = inv.payoutDate || inv.invoiceDueDate || todayStr;
      return { ...inv, expectedDate };
    });

    const thisWeekFri = upcomingFridays[0] || todayStr;
    const nextWeekFri = upcomingFridays[1] || todayStr;

    const thisWeekList = resolvedInvoices.filter(inv => inv.expectedDate <= thisWeekFri);
    const nextWeekList = resolvedInvoices.filter(inv => inv.expectedDate > thisWeekFri && inv.expectedDate <= nextWeekFri);

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthPrefix = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    const thisMonthList = resolvedInvoices.filter(inv => inv.expectedDate.startsWith(currentMonthPrefix));
    const nextMonthList = resolvedInvoices.filter(inv => inv.expectedDate.startsWith(nextMonthPrefix));

    const sumList = (listList: any[]) => listList.reduce((sum, item) => sum + (Number(item.balanceOutstanding) || 0), 0);

    return {
      thisWeek: sumList(thisWeekList),
      nextWeek: sumList(nextWeekList),
      thisMonth: sumList(thisMonthList),
      nextMonth: sumList(nextMonthList)
    };
  }, [invoices, upcomingFridays, todayStr]);

  const renderMetricCard = (
    title: string,
    amount: number,
    count: number,
    isActive: boolean,
    onClick: () => void,
    accentColor: string
  ) => {
    return (
      <div 
        onClick={onClick}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: isActive ? `2px solid ${accentColor}` : '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px 14px',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          boxShadow: isActive ? `0 4px 10px ${accentColor}20` : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: '135px',
          position: 'relative'
        }}
      >
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px' }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            £{amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h3>
          <span style={{ fontSize: '10px', color: isActive ? '#fff' : accentColor, fontWeight: 700, backgroundColor: isActive ? accentColor : `${accentColor}15`, padding: '1px 5px', borderRadius: '8px' }}>
            {count}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* 0. Header Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{activeSubTab === 'direct' ? '📁 Direct Invoices Ledger' : '💼 Simplicity Factored Ledger'}</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>
            {activeSubTab === 'direct' ? 'Direct Client Ledger' : 'Factored / Recourse Ledger'}
          </span>
        </h2>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCollapseAnalytics(!collapseAnalytics)}
            className="btn-secondary dense"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '5px 10px', height: '28px' }}
          >
            <span>{collapseAnalytics ? '📊 Show KPI Analytics' : '📊 Hide KPI Analytics'}</span>
          </button>
        </div>
      </div>

      {!collapseAnalytics && (
        <CreditControlKPIs
          dashboardStats={dashboardStats}
          debtorsOver60={debtorsOver60}
          collapseAnalytics={collapseAnalytics}
          setCollapseAnalytics={setCollapseAnalytics}
          expandDebtors60={expandDebtors60}
          setExpandDebtors60={setExpandDebtors60}
          handleOpenDetail={handleOpenDetail}
        />
      )}

      {/* 1. Dynamic Metric Filter Cards (Top 20%) */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', marginBottom: '4px' }}>
        {activeSubTab === 'direct' ? (
          <>
            {renderMetricCard(
              "Outstanding Direct Invoices",
              directMetrics.outstanding.amount,
              directMetrics.outstanding.count,
              directCardFilter === 'all-outstanding',
              () => setDirectCardFilter('all-outstanding'),
              '#3b82f6'
            )}
            {renderMetricCard(
              "Direct Invoices Due",
              directMetrics.due.amount,
              directMetrics.due.count,
              directCardFilter === 'due',
              () => setDirectCardFilter('due'),
              '#eab308'
            )}
            {renderMetricCard(
              "Disputed Direct Invoices",
              directMetrics.disputed.amount,
              directMetrics.disputed.count,
              directCardFilter === 'disputed',
              () => setDirectCardFilter('disputed'),
              '#ef4444'
            )}
            {renderMetricCard(
              "Legal Proceedings",
              directMetrics.legal.amount,
              directMetrics.legal.count,
              directCardFilter === 'legal',
              () => setDirectCardFilter('legal'),
              '#ec4899'
            )}
          </>
        ) : (
          <>
            {renderMetricCard(
              "Outstanding Overdue",
              simplicityMetrics.overdue.amount,
              simplicityMetrics.overdue.count,
              simplicityCardFilter === 'outstanding-overdue',
              () => setSimplicityCardFilter('outstanding-overdue'),
              '#f97316'
            )}
            {renderMetricCard(
              "Invoices to be Raised",
              simplicityMetrics.aboutToRaise.amount,
              simplicityMetrics.aboutToRaise.count,
              simplicityCardFilter === 'about-to-raise',
              () => setSimplicityCardFilter('about-to-raise'),
              '#a855f7'
            )}
            {renderMetricCard(
              "Outstanding Simplicity",
              simplicityMetrics.outstanding.amount,
              simplicityMetrics.outstanding.count,
              simplicityCardFilter === 'outstanding',
              () => setSimplicityCardFilter('outstanding'),
              '#3b82f6'
            )}
            {renderMetricCard(
              "Recourse Risk (Paid/Unpaid)",
              simplicityMetrics.recourse.amount,
              simplicityMetrics.recourse.count,
              simplicityCardFilter === 'paid-unpaid',
              () => setSimplicityCardFilter('paid-unpaid'),
              '#ef4444'
            )}
            {renderMetricCard(
              "All Factored Invoices",
              simplicityMetrics.all.amount,
              simplicityMetrics.all.count,
              simplicityCardFilter === 'all',
              () => setSimplicityCardFilter('all'),
              '#6b7280'
            )}
          </>
        )}
      </div>

      {/* 2. Direct Invoices Likely Payment Projections Summary Bar */}
      {activeSubTab === 'direct' && (
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.03)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📈</span>
            <strong style={{ fontSize: '12px', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Direct Invoice Likely Receipt Projections
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>This Week</span>
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                £{directProjections.thisWeek.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Next Week</span>
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                £{directProjections.nextWeek.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>This Month</span>
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                £{directProjections.thisMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Next Month</span>
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                £{directProjections.nextMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Simplicity Expected Weekly Payout Pipeline Bar */}
      {activeSubTab === 'simplicity' && (
        <div style={{
          backgroundColor: 'rgba(99, 102, 241, 0.03)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: '8px',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📅</span>
            <strong style={{ fontSize: '12px', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Simplicity Expected Weekly Projections Pipeline
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            {simplicityActiveWeeks.map((week, widx) => {
              const netTotal = week.totalInclVatSum || 0;
              const isNegative = netTotal < 0;
              const isSelected = selectedPipelineWeeks.has(week.weekDate);
              return (
                <div 
                  key={widx} 
                  onClick={() => handleTogglePipelineWeek(week.weekDate)}
                  className="pipeline-week-item"
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    transition: 'all 0.15s ease-in-out'
                  }}
                  title="Click to toggle/select for pipeline sub-total"
                >
                  <span style={{ fontSize: '9.5px', color: isSelected ? '#6366f1' : 'var(--text-muted)', fontWeight: isSelected ? 700 : 500 }}>
                    W/E {week.weekDate} {isSelected ? '✓' : ''}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace', color: isNegative ? 'var(--danger)' : (isSelected ? '#6366f1' : 'var(--text-primary)') }}>
                    {isNegative ? '-' : ''}£{Math.abs(netTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
            {simplicityActiveWeeks.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No active weekly projections</span>
            )}
            
            {/* Net Total Pipeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', marginLeft: '4px' }}>
              <span style={{ fontSize: '9.5px', color: '#6366f1', fontWeight: 700 }}>NET TOTAL PIPELINE</span>
              <span style={{ fontSize: '14px', fontWeight: 850, fontFamily: 'monospace', color: simplicityWeeklyTotalProjections < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {simplicityWeeklyTotalProjections < 0 ? '-' : ''}£{Math.abs(simplicityWeeklyTotalProjections).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Selected Weeks Total Pipeline */}
            {selectedPipelineWeeks.size > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', marginLeft: '4px' }}>
                <span style={{ fontSize: '9.5px', color: '#6366f1', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>SELECTED ({selectedPipelineWeeks.size} WEEKS)</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPipelineWeeks(new Set());
                    }} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px', padding: 0 }}
                    title="Clear Selection"
                  >
                    ✕
                  </button>
                </span>
                <span style={{ fontSize: '14px', fontWeight: 850, fontFamily: 'monospace', color: selectedPipelineTotal < 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {selectedPipelineTotal < 0 ? '-' : ''}£{Math.abs(selectedPipelineTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {!collapseAnalytics && activeSubTab === 'simplicity' && (
        <div style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.03)', 
          border: '1px solid rgba(239, 68, 68, 0.15)', 
          borderRadius: '12px', 
          padding: '16px 20px', 
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <strong style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--danger)' }}>Simplicity Factoring & Recourse Risk Summary</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>🟥 Recourse Clawbacks (Day 120+)</span>
              <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: 'var(--danger)', fontFamily: 'monospace' }}>
                £{dashboardStats.simplicityClawbackTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Deducted off next payment. ({dashboardStats.simplicityClawbackList.length} cases)</span>
            </div>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>🟧 Credit Limit Expiry (Day 90-119)</span>
              <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'monospace' }}>
                £{dashboardStats.simplicityExpiryTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Client loses limit on Simplicity. ({dashboardStats.simplicityExpiryList.length} cases)</span>
            </div>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>🟨 Standard Chase Active (Day 31-89)</span>
              <h3 style={{ margin: '4px 0 2px 0', fontSize: '16px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                £{dashboardStats.simplicityFollowupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Followed up from Day 31. ({dashboardStats.simplicityFollowupList.length} cases)</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', width: '100%' }}>
          
          {/* Search Box */}
          <div className="search-box-container" style={{ flex: '1 1 300px', margin: 0, height: '34px' }}>
            <Search size={14} className="search-icon" style={{ top: '10px' }} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by client, candidate, invoice, recruiter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px', height: '34px', fontSize: '12.5px' }}
            />
          </div>

          {/* Controls & Actions Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            
            {/* Filter Toggle */}
            <button
              type="button"
              className={`btn-secondary ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px', border: showFilters ? '1px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: showFilters ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}
            >
              🔍 Filters
            </button>

            {/* Reschedule Zones */}
            {activeSubTab === 'simplicity' && !readOnly && (
              <button 
                type="button" 
                className={`btn-secondary ${showRescheduleDropzones ? 'active' : ''}`}
                onClick={() => setShowRescheduleDropzones(!showRescheduleDropzones)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px', border: showRescheduleDropzones ? '1px solid var(--primary)' : '1px solid var(--border-color)', backgroundColor: showRescheduleDropzones ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}
              >
                📅 Reschedule Zones
              </button>
            )}

            {/* Export CSV */}
            {!readOnly && (
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleExportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px' }}
              >
                📥 Export CSV
              </button>
            )}

            {/* Simplicity Factoring Export (Simplicity Only) */}
            {activeSubTab === 'simplicity' && !readOnly && (
              <>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleExportSimplicity}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px' }}
                >
                  ⚡ Factoring Export
                </button>

                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowSimplicityImporter(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px' }}
                >
                  ⚡ Importer
                </button>
              </>
            )}

            {/* Column Config */}
            <div style={{ position: 'relative', flex: '0 0 auto' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowColConfig(!showColConfig)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', height: '34px', border: showColConfig ? '1px solid var(--primary)' : '1px solid var(--border-color)' }}
              >
                ⚙️ Columns
              </button>
              {showColConfig && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '320px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-card)',
                  border: '2px solid var(--primary)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.3)',
                  zIndex: 1000,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <strong style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px', display: 'block', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    ⚙️ Choose & Order Columns
                  </strong>
                  {columnsConfig.map((col, index) => (
                    <div 
                      key={col.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '4px 6px', 
                        borderBottom: '1px solid var(--border-color)',
                        gap: '8px'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px', color: 'var(--text-primary)', margin: 0, userSelect: 'none', fontWeight: 500 }}>
                        <input 
                          type="checkbox" 
                          checked={col.visible} 
                          onChange={() => handleToggleColVisible(col.id)} 
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        {col.label}
                      </label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          type="button" 
                          onClick={() => handleMoveCol(index, -1)} 
                          disabled={index === 0}
                          style={{ padding: '3px 7px', fontSize: '9px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', opacity: index === 0 ? 0.3 : 1 }}
                        >
                          ▲
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleMoveCol(index, 1)} 
                          disabled={index === columnsConfig.length - 1}
                          style={{ padding: '3px 7px', fontSize: '9px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)', opacity: index === columnsConfig.length - 1 ? 0.3 : 1 }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Collapsible Dropdown Filters */}
        {showFilters && (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            width: '100%', 
            padding: '12px 16px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            animation: 'fadeIn 0.2s'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Payment Status</span>
              <select 
                className="select-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', height: '34px', fontSize: '12.5px' }}
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Outstanding Invoices</option>
                {PAYMENT_STATUSES.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Recruiter</span>
              <select 
                className="select-filter"
                value={recruiterFilter}
                onChange={(e) => setRecruiterFilter(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', height: '34px', fontSize: '12.5px' }}
              >
                <option value="all">All Recruiters</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Date Range</span>
              <select 
                className="select-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', height: '34px', fontSize: '12.5px' }}
              >
                <option value="all">All Date Ranges</option>
                <option value="overdue">Overdue Invoices</option>
                <option value="next-7">Expected Next 7 Days</option>
                <option value="next-30">Expected Next 30 Days</option>
                <option value="this-month">Expected This Month</option>
                <option value="next-month">Expected Next Month</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {activeSubTab === 'direct' ? (
        <DirectLedgerTable
          partitionedInvoices={partitionedInvoices}
          activeColumns={activeColumns}
          selectedInvoiceIds={selectedInvoiceIds}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectRow={handleToggleSelectRow}
          handleOpenDetail={handleOpenDetail}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          renderSortIndicator={renderSortIndicator}
          todayStr={todayStr}
          onShowToast={onShowToast}
          readOnly={readOnly}
        />
      ) : (
        <SimplicityLedgerTable
          list={filteredInvoices}
          partitionedInvoices={partitionedInvoices}
          activeColumns={activeColumns}
          selectedInvoiceIds={selectedInvoiceIds}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectRow={handleToggleSelectRow}
          handleOpenDetail={handleOpenDetail}
          handleMoveInvoiceToWeek={handleMoveInvoiceToWeek}
          upcomingFridays={upcomingFridays}
          simplicityPriorWeeks={simplicityPriorWeeks}
          simplicityActiveWeeks={simplicityActiveWeeks}
          simplicityPaid={simplicityPaid}
          simplicityLegal={simplicityLegal}
          simplicityOverdue={simplicityOverdue}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          renderSortIndicator={renderSortIndicator}
          todayStr={todayStr}
          onShowToast={onShowToast}
          showRescheduleDropzones={showRescheduleDropzones}
          simplicityCardFilter={simplicityCardFilter}
          readOnly={readOnly}
        />
      )}

      {selectedSums && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-secondary)',
          border: '2px solid var(--primary)',
          borderRadius: '12px',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 9999,
          borderLeftWidth: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <div>
              <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>{selectedSums.count} Rows Selected</strong>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Excel-style Aggregates</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontFamily: 'monospace' }}>
            {activeSubTab === 'direct' ? (
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Gross/Invoice Total:</span>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>£{selectedSums.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            ) : (
              <>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Net Fee Total:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>£{selectedSums.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Humres Friday (97.04%):</span>
                  <strong style={{ fontSize: '13px', color: 'var(--success)' }}>£{selectedSums.factored.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>VAT (20%):</span>
                  <strong style={{ fontSize: '13px', color: '#94a3b8' }}>£{selectedSums.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Total Friday Payout:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>£{selectedSums.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </>
            )}
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9px', textTransform: 'uppercase' }}>Outstanding Sum:</span>
              <strong style={{ fontSize: '13px', color: 'var(--warning)' }}>£{selectedSums.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>
      )}

      <InvoiceDetailDrawer
        selectedInvoice={selectedInvoice}
        isDetailOpen={isDetailOpen}
        setIsDetailOpen={setIsDetailOpen}
        setSelectedInvoice={setSelectedInvoice}
        todayStr={todayStr}
        currentUser={currentUser}
        onShowToast={onShowToast}
        readOnly={readOnly}
      />

      {/* Simplicity Importer Overlay Modal */}
      {showSimplicityImporter && (
        <div className="form-wizard-overlay" onClick={() => setShowSimplicityImporter(false)}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column' }}>
            <div className="wizard-header">
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>⚡ Simplicity Factoring Importer</h2>
              <button type="button" className="btn-close" onClick={() => setShowSimplicityImporter(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Paste columns from your Simplicity statement/remittance (Invoice Number in Column 1, Paid Cash Amount in Column 2). Comma or tab separated.
              </p>
              <textarea
                className="form-input"
                rows={8}
                placeholder="INV-001, 15000&#10;INV-002, 8500"
                value={simplicityPastedData}
                onChange={(e) => setSimplicityPastedData(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }}
              />
            </div>

            <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowSimplicityImporter(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleImportSimplicitySchedule}>Run Importer Matcher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
