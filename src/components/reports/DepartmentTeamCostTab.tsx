import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Wrench, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Trash2, 
  FileSpreadsheet, 
  Printer, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight, 
  Building2, 
  DollarSign, 
  Calendar,
  Layers,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Company, Staff, Placement, PayrollRecord, DepartmentTool, NominalCode } from '../../types';
import { useBoundStore } from '../../store/useBoundStore';
import { getCellData } from '../payroll/utils';
import { toGBP } from '../../utils/currency';

interface DepartmentTeamCostTabProps {
  companies: Company[];
  staff: Staff[];
  payrollRecords: PayrollRecord[];
  payrollPolicies: any[];
  leaveRequests: any[];
  holidays: any[];
  placements: Placement[];
  commissionPolicies: any[];
  nominalCodes?: NominalCode[];
  companyFilter?: string[];
  deptFilter?: string[];
  startMonth?: string;
  endMonth?: string;
  monthsList?: string[];
  excludedNominalCodes?: string[];
  isNominalExcluded?: (code: string) => boolean;
  onToggleNominalInclusion?: (code: string) => void;
  getFilteredMonthlyData?: (monthKey: string) => any;
  reconciledCutoffMonth?: string;
  reconciledCutoffDate?: string;
  currentUser?: any;
  onShowToast?: (msg: string, type?: string) => void;
}

const formatGBP = (val: number): string => {
  return '£' + Math.round(val || 0).toLocaleString();
};

const formatGBPExact = (val: number): string => {
  return '£' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatMonthLabel = (mKey: string): string => {
  try {
    return new Date(mKey + '-02').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  } catch {
    return mKey;
  }
};

// Helper to determine if a staff member was active during a given month
const isStaffActiveInMonth = (s: Staff, monthKey: string, cellTotal: number): boolean => {
  if (cellTotal > 0) return true;
  if (!s.startDate) return false;
  const startMonth = s.startDate.substring(0, 7);
  if (startMonth > monthKey) return false;
  if (s.status === 'exited' && s.exitDate) {
    const exitMonth = s.exitDate.substring(0, 7);
    if (exitMonth < monthKey) return false;
  }
  return true;
};

export default function DepartmentTeamCostTab({
  companies = [],
  staff = [],
  payrollRecords = [],
  payrollPolicies = [],
  leaveRequests = [],
  holidays = [],
  placements = [],
  commissionPolicies = [],
  nominalCodes = [],
  companyFilter = ['all'],
  deptFilter = ['all'],
  startMonth = '2026-01',
  endMonth = '2026-12',
  monthsList = [
    '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08',
    '2026-09', '2026-10', '2026-11', '2026-12'
  ],
  excludedNominalCodes = [],
  isNominalExcluded = () => false,
  onToggleNominalInclusion,
  getFilteredMonthlyData,
  reconciledCutoffMonth = '2026-08',
  reconciledCutoffDate = '2026-08-31',
  currentUser,
  onShowToast
}: DepartmentTeamCostTabProps) {
  const { departmentTools, saveDepartmentTool, deleteDepartmentTool } = useBoundStore();

  const isManager = currentUser?.permissions?.role === 'manager';
  const managerDept = currentUser?.department || staff.find(s => s.id === currentUser?.id)?.department;

  // View state toggles (matching P&L UI)
  const [expandedTeam, setExpandedTeam] = useState<boolean>(true);
  const [expandedTools, setExpandedTools] = useState<boolean>(true);
  const [expandedNominals, setExpandedNominals] = useState<boolean>(true);
  const [hideZeroNominals, setHideZeroNominals] = useState<boolean>(true);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tool Modal state
  const [showToolModal, setShowToolModal] = useState<boolean>(false);
  const [editingTool, setEditingTool] = useState<DepartmentTool | null>(null);
  const [toolForm, setToolForm] = useState<{
    id?: string;
    name: string;
    department: string;
    departments: string[];
    companyId: string;
    companyIds: string[];
    licenseCostPerSeat: number;
    currency: string;
    billingFrequency: 'monthly' | 'annual';
    baselineCommittedSeats: number;
    contractStartDate: string;
    renewalDate: string;
    vendorName: string;
    notes: string;
  }>({
    name: '',
    department: (!deptFilter.includes('all') && deptFilter.length > 0) ? deptFilter.join(', ') : 'all',
    departments: (!deptFilter.includes('all') && deptFilter.length > 0) ? [...deptFilter] : ['all'],
    companyId: (!companyFilter.includes('all') && companyFilter.length > 0) ? companyFilter[0] : 'all',
    companyIds: (!companyFilter.includes('all') && companyFilter.length > 0) ? [...companyFilter] : ['all'],
    licenseCostPerSeat: 45,
    currency: 'GBP',
    billingFrequency: 'monthly',
    baselineCommittedSeats: 5,
    contractStartDate: `${startMonth}-01`,
    renewalDate: `${endMonth}-31`,
    vendorName: '',
    notes: ''
  });

  // Extract distinct departments from staff roster for tool assignments
  const allDepartments = useMemo(() => {
    const depts = new Set<string>();
    staff.forEach(s => {
      if (s.department && s.department.trim()) {
        depts.add(s.department.trim());
      }
    });
    return Array.from(depts).sort();
  }, [staff]);

  // Filter staff by company and department filters
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (!companyFilter.includes('all') && !companyFilter.includes(s.companyId)) return false;
      if (!deptFilter.includes('all') && !deptFilter.includes(s.department)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = (s.fullName || '').toLowerCase().includes(q);
        const matchesTitle = (s.jobTitle || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTitle) return false;
      }
      return true;
    });
  }, [staff, companyFilter, deptFilter, searchTerm]);

  // Calculate monthly staff remuneration cells (ex-reimbursements)
  // Maps staffId -> monthKey -> cellData
  const staffMonthlyData = useMemo(() => {
    const matrix: Record<string, Record<string, ReturnType<typeof getCellData>>> = {};

    filteredStaff.forEach(s => {
      matrix[s.id] = {};
      monthsList.forEach(m => {
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
        matrix[s.id][m] = cell;
      });
    });

    return matrix;
  }, [filteredStaff, monthsList, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies]);

  // Monthly active headcount for the department / filtered team
  const monthlyHeadcount = useMemo(() => {
    const counts: Record<string, number> = {};

    monthsList.forEach(m => {
      let count = 0;
      filteredStaff.forEach(s => {
        const cell = staffMonthlyData[s.id]?.[m];
        const total = cell?.total || 0;
        if (isStaffActiveInMonth(s, m, total)) {
          count++;
        }
      });
      counts[m] = count;
    });

    return counts;
  }, [monthsList, filteredStaff, staffMonthlyData]);

  // Filter tools applicable to current department and company selection
  const relevantTools = useMemo(() => {
    return departmentTools.filter(t => {
      // 1. Department match: check if tool applies to any filtered department
      const toolDepts = (t.departments && t.departments.length > 0) ? t.departments : [t.department || 'all'];
      const matchesDept = deptFilter.includes('all') || toolDepts.includes('all') || deptFilter.some(d => toolDepts.includes(d));
      if (!matchesDept) return false;

      // 2. Company match: check if tool applies to any filtered company
      const toolComps = (t.companyIds && t.companyIds.length > 0) ? t.companyIds : [t.companyId || 'all'];
      const matchesComp = companyFilter.includes('all') || toolComps.includes('all') || companyFilter.some(c => toolComps.includes(c));
      if (!matchesComp) return false;

      return true;
    });
  }, [departmentTools, deptFilter, companyFilter]);

  // High-Water Mark Ratchet Engine for Software Tools (Supporting Multi-Dept & Multi-Company)
  const toolRatchetData = useMemo(() => {
    return relevantTools.map(tool => {
      const baseline = Number(tool.baselineCommittedSeats) || 0;
      const unitCostGBP = toGBP(tool.licenseCostPerSeat || 0, tool.currency || 'GBP');
      const toolDepts = (tool.departments && tool.departments.length > 0) ? tool.departments : [tool.department || 'all'];
      const toolComps = (tool.companyIds && tool.companyIds.length > 0) ? tool.companyIds : [tool.companyId || 'all'];

      const monthlyDetails: Record<string, {
        activeSeats: number;
        committedSeats: number;
        unutilizedSeats: number;
        costGBP: number;
        isRatcheted: boolean;
      }> = {};

      let peakSoFar = baseline;
      let periodTotalCost = 0;
      let ytvCost = 0;

      monthsList.forEach((m) => {
        // Headcount for this tool's scope across its assigned departments and companies
        const activeHeadcountForTool = staff.filter(s => {
          const compMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
          const deptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
          if (!compMatch || !deptMatch) return false;

          const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
          return isStaffActiveInMonth(s, m, cell.total);
        }).length;

        // Ratchet up if active headcount exceeds prior peak
        if (activeHeadcountForTool > peakSoFar) {
          peakSoFar = activeHeadcountForTool;
        }

        // Check for manual override if user negotiated a change
        let committed = peakSoFar;
        if (tool.manualCommittedSeatsOverride && tool.manualCommittedSeatsOverride[m] !== undefined) {
          committed = Number(tool.manualCommittedSeatsOverride[m]);
        }

        const unutilized = Math.max(0, committed - activeHeadcountForTool);
        const cost = committed * unitCostGBP;
        periodTotalCost += cost;

        if (m <= reconciledCutoffMonth) {
          ytvCost += cost;
        }

        monthlyDetails[m] = {
          activeSeats: activeHeadcountForTool,
          committedSeats: committed,
          unutilizedSeats: unutilized,
          costGBP: cost,
          isRatcheted: committed > baseline
        };
      });

      return {
        tool,
        toolDepts,
        toolComps,
        unitCostGBP,
        monthlyDetails,
        periodTotalCost,
        ytvCost
      };
    });
  }, [relevantTools, monthsList, staff, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies, reconciledCutoffMonth]);

  // Aggregate Remuneration Totals across Months
  const staffRemunerationTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      let mSum = 0;
      filteredStaff.forEach(s => {
        const cell = staffMonthlyData[s.id]?.[m];
        // actual staff cost without reimbursements
        mSum += cell?.total || 0;
      });
      monthlySum[m] = mSum;
      grandTotal += mSum;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += mSum;
      }
    });

    return { monthlySum, grandTotal, ytvTotal };
  }, [monthsList, filteredStaff, staffMonthlyData, reconciledCutoffMonth]);

  // Aggregate Software Tools Totals across Months
  const toolTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      let mSum = 0;
      toolRatchetData.forEach(item => {
        mSum += item.monthlyDetails[m]?.costGBP || 0;
      });
      monthlySum[m] = mSum;
      grandTotal += mSum;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += mSum;
      }
    });

    return { monthlySum, grandTotal, ytvTotal };
  }, [monthsList, toolRatchetData, reconciledCutoffMonth]);

  // Fetch P&L monthly nominal data using getFilteredMonthlyData
  const pnlMonthlyData = useMemo(() => {
    if (!getFilteredMonthlyData) return [];
    return monthsList.map(m => getFilteredMonthlyData(m));
  }, [monthsList, getFilteredMonthlyData]);

  // Extract all distinct nominal codes matching filters
  const nominalCodeKeys = useMemo(() => {
    const allCodes = Array.from(new Set(
      pnlMonthlyData.flatMap(r => Object.keys(r.nominalBreakdown || {}))
    )).filter(c => !c.startsWith('__'));

    if (hideZeroNominals) {
      return allCodes.filter(c => {
        const total = pnlMonthlyData.reduce((acc, r) => acc + (r.nominalBreakdown?.[c] || 0), 0);
        return total !== 0;
      }).sort();
    }

    return allCodes.sort();
  }, [pnlMonthlyData, hideZeroNominals]);

  // Aggregate Department Overheads & Operational Nominals
  const nominalTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach((m, idx) => {
      const row = pnlMonthlyData[idx];
      let mSum = 0;

      nominalCodeKeys.forEach(code => {
        if (!isNominalExcluded(code)) {
          mSum += row?.nominalBreakdown?.[code] || 0;
        }
      });

      monthlySum[m] = mSum;
      grandTotal += mSum;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += mSum;
      }
    });

    return { monthlySum, grandTotal, ytvTotal };
  }, [monthsList, pnlMonthlyData, nominalCodeKeys, isNominalExcluded, reconciledCutoffMonth]);

  // Combined Department Operating Costs (Staff Remuneration + Tools + Nominals)
  const combinedDepartmentTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    const avgCostPerHead: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      const staffCost = staffRemunerationTotals.monthlySum[m] || 0;
      const toolCost = toolTotals.monthlySum[m] || 0;
      const nominalCost = nominalTotals.monthlySum[m] || 0;
      const total = staffCost + toolCost + nominalCost;

      monthlySum[m] = total;
      grandTotal += total;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += total;
      }

      const hc = monthlyHeadcount[m] || 0;
      avgCostPerHead[m] = hc > 0 ? total / hc : 0;
    });

    const avgHeadcount = Object.values(monthlyHeadcount).reduce((a, b) => a + b, 0) / (monthsList.length || 1);
    const overallAvgCostPerHead = avgHeadcount > 0 ? grandTotal / avgHeadcount : 0;

    return {
      monthlySum,
      avgCostPerHead,
      grandTotal,
      ytvTotal,
      avgHeadcount,
      overallAvgCostPerHead
    };
  }, [monthsList, staffRemunerationTotals, toolTotals, nominalTotals, monthlyHeadcount, reconciledCutoffMonth]);

  // Total unutilized seats across all department tools (latest cutoff month)
  const unutilizedStats = useMemo(() => {
    const targetMonth = reconciledCutoffMonth || monthsList[0];
    let totalCommitted = 0;
    let totalActive = 0;
    let totalWastedCost = 0;

    toolRatchetData.forEach(t => {
      const d = t.monthlyDetails[targetMonth];
      if (d) {
        totalCommitted += d.committedSeats;
        totalActive += d.activeSeats;
        totalWastedCost += d.unutilizedSeats * t.unitCostGBP;
      }
    });

    return {
      totalCommitted,
      totalActive,
      spareSeats: Math.max(0, totalCommitted - totalActive),
      totalWastedCost
    };
  }, [toolRatchetData, reconciledCutoffMonth, monthsList]);

  // Multi-select toggle helpers for Tool Modal
  const handleToggleCompany = (companyId: string) => {
    setToolForm(prev => {
      let current = [...prev.companyIds];
      if (companyId === 'all') {
        return { ...prev, companyIds: ['all'], companyId: 'all' };
      }
      current = current.filter(c => c !== 'all');
      if (current.includes(companyId)) {
        current = current.filter(c => c !== companyId);
      } else {
        current.push(companyId);
      }
      if (current.length === 0) {
        current = ['all'];
      }
      return {
        ...prev,
        companyIds: current,
        companyId: current.includes('all') ? 'all' : current[0]
      };
    });
  };

  const handleToggleDepartment = (dept: string) => {
    setToolForm(prev => {
      let current = [...prev.departments];
      if (dept === 'all') {
        return { ...prev, departments: ['all'], department: 'all' };
      }
      current = current.filter(d => d !== 'all');
      if (current.includes(dept)) {
        current = current.filter(d => d !== dept);
      } else {
        current.push(dept);
      }
      if (current.length === 0) {
        current = ['all'];
      }
      return {
        ...prev,
        departments: current,
        department: current.includes('all') ? 'all' : current.join(', ')
      };
    });
  };

  const handleSelectAllCompanies = () => {
    setToolForm(prev => ({
      ...prev,
      companyIds: companies.map(c => c.id),
      companyId: companies[0]?.id || 'all'
    }));
  };

  const handleSelectAllDepartments = () => {
    setToolForm(prev => ({
      ...prev,
      departments: [...allDepartments],
      department: allDepartments.join(', ')
    }));
  };

  // Handle Open Tool Modal
  const handleOpenAddTool = () => {
    setEditingTool(null);
    const initialDepts = (!deptFilter.includes('all') && deptFilter.length > 0)
      ? [...deptFilter]
      : (managerDept ? [managerDept] : ['all']);
    const initialComps = (!companyFilter.includes('all') && companyFilter.length > 0)
      ? [...companyFilter]
      : ['all'];

    setToolForm({
      name: '',
      department: initialDepts.includes('all') ? 'all' : initialDepts.join(', '),
      departments: initialDepts,
      companyId: initialComps.includes('all') ? 'all' : initialComps[0],
      companyIds: initialComps,
      licenseCostPerSeat: 45,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: monthlyHeadcount[monthsList[0]] || 5,
      contractStartDate: `${startMonth}-01`,
      renewalDate: `${endMonth}-31`,
      vendorName: '',
      notes: ''
    });
    setShowToolModal(true);
  };

  const handleOpenEditTool = (tool: DepartmentTool) => {
    setEditingTool(tool);
    const toolDepts = (tool.departments && tool.departments.length > 0)
      ? tool.departments
      : [tool.department || 'all'];
    const toolComps = (tool.companyIds && tool.companyIds.length > 0)
      ? tool.companyIds
      : [tool.companyId || 'all'];

    setToolForm({
      id: tool.id,
      name: tool.name,
      department: toolDepts.includes('all') ? 'all' : toolDepts.join(', '),
      departments: toolDepts,
      companyId: toolComps.includes('all') ? 'all' : toolComps[0],
      companyIds: toolComps,
      licenseCostPerSeat: tool.licenseCostPerSeat,
      currency: tool.currency || 'GBP',
      billingFrequency: tool.billingFrequency || 'monthly',
      baselineCommittedSeats: tool.baselineCommittedSeats || 1,
      contractStartDate: tool.contractStartDate || `${startMonth}-01`,
      renewalDate: tool.renewalDate || `${endMonth}-31`,
      vendorName: tool.vendorName || '',
      notes: tool.notes || ''
    });
    setShowToolModal(true);
  };

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolForm.name.trim()) {
      if (onShowToast) onShowToast('Please provide a tool name', 'error');
      return;
    }

    try {
      const depts = (toolForm.departments && toolForm.departments.length > 0)
        ? toolForm.departments
        : ['all'];
      const comps = (toolForm.companyIds && toolForm.companyIds.length > 0)
        ? toolForm.companyIds
        : ['all'];

      const toolToSave: DepartmentTool = {
        id: editingTool ? editingTool.id : `dept-tool-${Date.now()}`,
        name: toolForm.name.trim(),
        department: depts.includes('all') ? 'all' : depts.join(', '),
        departments: depts,
        companyId: comps.includes('all') ? 'all' : comps[0],
        companyIds: comps,
        licenseCostPerSeat: Number(toolForm.licenseCostPerSeat) || 0,
        currency: toolForm.currency || 'GBP',
        billingFrequency: toolForm.billingFrequency,
        baselineCommittedSeats: Number(toolForm.baselineCommittedSeats) || 1,
        contractStartDate: toolForm.contractStartDate,
        renewalDate: toolForm.renewalDate,
        vendorName: toolForm.vendorName?.trim(),
        notes: toolForm.notes?.trim(),
        manualCommittedSeatsOverride: editingTool?.manualCommittedSeatsOverride || {}
      };

      await saveDepartmentTool(toolToSave);
      setShowToolModal(false);
      if (onShowToast) {
        onShowToast(editingTool ? 'Tool updated successfully' : 'Tool added successfully', 'success');
      }
    } catch (err: any) {
      console.error('Error saving department tool:', err);
      if (onShowToast) onShowToast('Failed to save tool: ' + err.message, 'error');
    }
  };

  const handleDeleteTool = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from this department?`)) {
      return;
    }
    try {
      await deleteDepartmentTool(id);
      if (onShowToast) onShowToast(`Removed ${name}`, 'info');
    } catch (err: any) {
      console.error('Error deleting tool:', err);
      if (onShowToast) onShowToast('Failed to delete tool: ' + err.message, 'error');
    }
  };

  // Export Complete Report to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const deptLabel = deptFilter.includes('all') ? 'All Departments' : deptFilter.join(', ');
      const monthHeaders = monthsList.map(m => formatMonthLabel(m));

      // 1. Department Consolidated Summary Sheet
      const summaryRows = [
        ['HUMRES BUSINESS MANAGEMENT - DEPARTMENT TEAM & TOOL COSTS STATEMENT'],
        [`Department(s): ${deptLabel}`, `Period Range: ${startMonth} to ${endMonth}`, `Exported on: ${new Date().toLocaleDateString('en-GB')}`],
        [],
        ['Metric / Account Line Item (GBP)', ...monthHeaders, 'YTV (Reconciled)', 'Period Total'],
        [
          'Active Team Headcount',
          ...monthsList.map(m => monthlyHeadcount[m] || 0),
          '—',
          Math.round(combinedDepartmentTotals.avgHeadcount) + ' (Avg)'
        ],
        [
          '1. Staff Remuneration Paid (Ex-Reimbursements)',
          ...monthsList.map(m => Math.round(staffRemunerationTotals.monthlySum[m] || 0)),
          Math.round(staffRemunerationTotals.ytvTotal),
          Math.round(staffRemunerationTotals.grandTotal)
        ],
        [
          '2. Software & Tool Licenses (Contract Ratchet)',
          ...monthsList.map(m => Math.round(toolTotals.monthlySum[m] || 0)),
          Math.round(toolTotals.ytvTotal),
          Math.round(toolTotals.grandTotal)
        ],
        [
          '3. Department Overheads & Operational SaaS (Nominals)',
          ...monthsList.map(m => Math.round(nominalTotals.monthlySum[m] || 0)),
          Math.round(nominalTotals.ytvTotal),
          Math.round(nominalTotals.grandTotal)
        ],
        [
          'GRAND TOTAL DEPARTMENT OPERATING COST',
          ...monthsList.map(m => Math.round(combinedDepartmentTotals.monthlySum[m] || 0)),
          Math.round(combinedDepartmentTotals.ytvTotal),
          Math.round(combinedDepartmentTotals.grandTotal)
        ],
        [
          'Average Cost per Recruiter / Team Member',
          ...monthsList.map(m => Math.round(combinedDepartmentTotals.avgCostPerHead[m] || 0)),
          '—',
          Math.round(combinedDepartmentTotals.overallAvgCostPerHead)
        ]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Department Summary');

      // 2. Staff Remuneration Sheet
      const staffRows = [
        ['TEAM REMUNERATION MATRIX (ACTUAL STAFF REMUNERATION - EX-REIMBURSEMENTS)'],
        [`Department(s): ${deptLabel}`, `Period: ${startMonth} to ${endMonth}`],
        [],
        ['Staff Member', 'Job Title', 'Type', ...monthHeaders, 'YTV Paid (£)', 'Period Total (£)']
      ];

      filteredStaff.forEach(s => {
        let staffAnnualTotal = 0;
        let staffYtvTotal = 0;
        const monthCols = monthsList.map(m => {
          const val = staffMonthlyData[s.id]?.[m]?.total || 0;
          staffAnnualTotal += val;
          if (m <= reconciledCutoffMonth) staffYtvTotal += val;
          return Math.round(val);
        });

        staffRows.push([
          s.fullName || '',
          s.jobTitle || 'Recruiter',
          s.employmentType || 'Staff',
          ...monthCols,
          Math.round(staffYtvTotal),
          Math.round(staffAnnualTotal)
        ]);
      });

      staffRows.push([
        'TOTAL TEAM REMUNERATION',
        '',
        '',
        ...monthsList.map(m => Math.round(staffRemunerationTotals.monthlySum[m] || 0)),
        Math.round(staffRemunerationTotals.ytvTotal),
        Math.round(staffRemunerationTotals.grandTotal)
      ]);

      const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
      XLSX.utils.book_append_sheet(wb, wsStaff, 'Team Remuneration');

      // 3. Software Licenses Sheet
      const toolRows = [
        ['SOFTWARE & TOOL LICENSES (HIGH-WATER MARK CONTRACT RATIO)'],
        [`Department(s): ${deptLabel}`, `Period: ${startMonth} to ${endMonth}`],
        [],
        ['Tool Name', 'Vendor', 'Companies', 'Departments', 'Baseline Seats', 'Cost / Seat (£)', ...monthHeaders.map(m => `${m} Cost`), 'YTV Cost (£)', 'Period Total (£)']
      ];

      toolRatchetData.forEach(t => {
        const monthCosts = monthsList.map(m => Math.round(t.monthlyDetails[m]?.costGBP || 0));
        const deptStr = t.toolDepts.includes('all') ? 'All Departments' : t.toolDepts.join(', ');
        const compStr = t.toolComps.includes('all')
          ? 'All Companies'
          : t.toolComps.map(cId => companies.find(c => c.id === cId)?.name || cId).join(', ');

        toolRows.push([
          t.tool.name,
          t.tool.vendorName || '-',
          compStr,
          deptStr,
          t.tool.baselineCommittedSeats,
          Number(t.unitCostGBP.toFixed(2)),
          ...monthCosts,
          Math.round(t.ytvCost),
          Math.round(t.periodTotalCost)
        ]);
      });

      toolRows.push([
        'TOTAL SOFTWARE LICENSES',
        '',
        '',
        '',
        '',
        '',
        ...monthsList.map(m => Math.round(toolTotals.monthlySum[m] || 0)),
        Math.round(toolTotals.ytvTotal),
        Math.round(toolTotals.grandTotal)
      ]);

      const wsTools = XLSX.utils.aoa_to_sheet(toolRows);
      XLSX.utils.book_append_sheet(wb, wsTools, 'Software Licenses');

      // 4. All Nominals Sheet
      const nominalRows = [
        ['DEPARTMENT OVERHEADS & OPERATIONAL EXPENSES (ALL NOMINALS)'],
        [`Department(s): ${deptLabel}`, `Period: ${startMonth} to ${endMonth}`],
        [],
        ['Nominal Code / Line Item', 'Status', ...monthHeaders, 'YTV (£)', 'Period Total (£)']
      ];

      nominalCodeKeys.forEach(code => {
        const isExcluded = isNominalExcluded(code);
        const vals = monthsList.map((m, idx) => Math.round(pnlMonthlyData[idx]?.nominalBreakdown?.[code] || 0));
        const ytvNominal = Math.round(pnlMonthlyData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r?.nominalBreakdown?.[code] || 0), 0));
        const totalNominal = Math.round(pnlMonthlyData.reduce((acc, r) => acc + (r?.nominalBreakdown?.[code] || 0), 0));
        nominalRows.push([
          code,
          isExcluded ? 'Excluded' : 'Included',
          ...vals,
          ytvNominal,
          totalNominal
        ]);
      });

      nominalRows.push([
        'TOTAL DEPARTMENT OVERHEAD NOMINALS',
        '',
        ...monthsList.map(m => Math.round(nominalTotals.monthlySum[m] || 0)),
        Math.round(nominalTotals.ytvTotal),
        Math.round(nominalTotals.grandTotal)
      ]);

      const wsNominals = XLSX.utils.aoa_to_sheet(nominalRows);
      XLSX.utils.book_append_sheet(wb, wsNominals, 'All Nominals');

      // Write and download
      const filename = `Department_Cost_Statement_${deptFilter.join('_')}_${startMonth}_to_${endMonth}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (onShowToast) onShowToast(`Excel report exported: ${filename}`, 'success');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      if (onShowToast) onShowToast('Failed to export Excel: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* Top Header & P&L Performance Summary Panel */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'var(--bg-secondary)', 
        padding: '12px 18px', 
        borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
              Department Operating Cost & Team Statement
            </span>
            <span style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.15)', 
              color: 'var(--accent)', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '10px', 
              fontWeight: 700,
              marginLeft: '8px'
            }}>
              P&L Nominal Structure
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleOpenAddTool}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} /> Add Software Tool
          </button>

          <button
            type="button"
            onClick={() => setHideZeroNominals(!hideZeroNominals)}
            style={{
              background: 'none',
              border: 'none',
              color: hideZeroNominals ? '#10b981' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={hideZeroNominals ? "Nominals with £0 are hidden. Click to show all." : "Showing all nominals. Click to hide £0 nominals."}
          >
            {hideZeroNominals ? '🚫 £0 Hidden' : '👁️ Show All £0'}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Export complete department statement, team roster, tools, and nominal breakdown to Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export to Excel
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--success)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={14} /> Print PDF
          </button>

          <button 
            type="button"
            onClick={() => setShowDashboard(!showDashboard)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {showDashboard ? '🙈 Hide KPI Cards' : '👁️ Show KPI Cards'}
          </button>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      {showDashboard && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '14px' 
        }}>
          {/* Card 1: Total Department Operating Cost */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL DEPARTMENT COST</span>
              <DollarSign size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {formatGBP(combinedDepartmentTotals.grandTotal)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Remuneration + Tools + Nominals ({startMonth} - {endMonth})
            </div>
          </div>

          {/* Card 2: Staff Remuneration Paid */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>TEAM REMUNERATION PAID</span>
              <Users size={16} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
              {formatGBP(staffRemunerationTotals.grandTotal)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Actual pay disbursed (Excl. reimbursements)
            </div>
          </div>

          {/* Card 3: Software & Tool Licenses */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>SOFTWARE & TOOLS</span>
              <Wrench size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6', fontFamily: 'monospace' }}>
              {formatGBP(toolTotals.grandTotal)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {relevantTools.length} contracted tools with ratchet
            </div>
          </div>

          {/* Card 4: Department Overheads (Nominals) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>DEPARTMENT OVERHEAD NOMINALS</span>
              <Layers size={16} style={{ color: 'var(--warning)' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)', fontFamily: 'monospace' }}>
              {formatGBP(nominalTotals.grandTotal)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {nominalCodeKeys.length} nominal expense accounts
            </div>
          </div>

          {/* Card 5: Contract Commitment & Spare Seats */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>SEAT COMMITMENT RATIO</span>
              <AlertCircle size={16} style={{ color: unutilizedStats.spareSeats > 0 ? '#f59e0b' : 'var(--text-secondary)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {unutilizedStats.totalActive} / {unutilizedStats.totalCommitted}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>seats</span>
            </div>
            <div style={{ fontSize: '11px', color: unutilizedStats.spareSeats > 0 ? '#f59e0b' : 'var(--success)' }}>
              {unutilizedStats.spareSeats > 0 
                ? `${unutilizedStats.spareSeats} unutilized seats (${formatGBP(unutilizedStats.totalWastedCost)}/mo)`
                : '100% seat utilization'}
            </div>
          </div>
        </div>
      )}

      {/* Contract Ratchet Explanation Callout */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px'
      }}>
        <HelpCircle size={16} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <strong>Department P&L Alignment:</strong> This statement combines <em>Actual Team Remuneration</em> (strictly excluding reimbursable overheads), 
          <em>Software Tool Licenses</em> with automatic upward seat ratchets, and <em>All Department Nominal Codes</em> matching your entity, department, period, and nominal filters.
        </div>
      </div>

      {/* ==============================================================
          MAIN P&L MATRIX TABLE
          ============================================================== */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <table className="entity-table dense" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 3, minWidth: '320px' }}>
                Department Account Line Item (GBP)
              </th>
              {monthsList.map(m => (
                <th key={m} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px', minWidth: '95px' }}>
                  {formatMonthLabel(m)}
                </th>
              ))}
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '12px', backgroundColor: 'rgba(99, 102, 241, 0.08)', minWidth: '110px' }}>
                YTV (Reconciled)
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '12px', backgroundColor: 'var(--bg-secondary)', minWidth: '110px' }}>
                Period Total
              </th>
            </tr>
          </thead>
          <tbody>

            {/* ==========================================================
                SECTION 1: APPORTIONED TEAM REMUNERATION
                ========================================================== */}
            <tr className="section-header" style={{ backgroundColor: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
              <td 
                colSpan={monthsList.length + 3} 
                style={{ 
                  padding: '8px 14px', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                1. Team Remuneration (Salaries, Freelance & Commissions)
              </td>
            </tr>

            {/* Main Collapsible Remuneration Row */}
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <td 
                style={{ 
                  padding: '10px 14px', 
                  position: 'sticky', 
                  left: 0, 
                  backgroundColor: 'var(--bg-primary)', 
                  zIndex: 2, 
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setExpandedTeam(!expandedTeam)}
              >
                <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                  {expandedTeam ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Apportioned Team Remuneration
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  ({filteredStaff.length} team members • Ex-Reimbursements)
                </span>
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--success)' }}>
                  {formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.04)', color: 'var(--success)' }}>
                {formatGBP(staffRemunerationTotals.ytvTotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)', fontSize: '13px' }}>
                {formatGBP(staffRemunerationTotals.grandTotal)}
              </td>
            </tr>

            {/* Expanded Staff Members Sub-rows */}
            {expandedTeam && (
              <>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={monthsList.length + 3} style={{ padding: '12px 32px', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>
                      No team members found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(s => {
                    let staffRowTotal = 0;
                    let staffYtvTotal = 0;

                    return (
                      <tr 
                        key={s.id} 
                        style={{ 
                          fontSize: '11px', 
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: 'rgba(255, 255, 255, 0.01)'
                        }}
                      >
                        <td style={{ 
                          paddingLeft: '36px', 
                          position: 'sticky', 
                          left: 0, 
                          backgroundColor: 'var(--bg-primary)', 
                          zIndex: 1 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>↳</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>— {s.jobTitle || 'Recruiter'}</span>
                            {s.status === 'exited' && (
                              <span style={{ 
                                fontSize: '9px', 
                                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                                color: 'var(--danger)', 
                                padding: '1px 4px', 
                                borderRadius: '3px',
                                fontWeight: 700
                              }}>
                                Exited
                              </span>
                            )}
                          </div>
                        </td>
                        {monthsList.map(m => {
                          const cell = staffMonthlyData[s.id]?.[m];
                          const val = cell?.total || 0;
                          staffRowTotal += val;
                          if (m <= reconciledCutoffMonth) staffYtvTotal += val;

                          return (
                            <td 
                              key={m} 
                              style={{ 
                                textAlign: 'right', 
                                fontFamily: 'monospace', 
                                opacity: val > 0 ? 1 : 0.4 
                              }}
                              title={`Staff: ${s.fullName}\nMonth: ${m}\n• Basic: ${formatGBPExact(cell?.basic || 0)}\n• Commission: ${formatGBPExact(cell?.commission || 0)}\n• Bonus: ${formatGBPExact(cell?.bonus || 0)}\n• NI/Pension: ${formatGBPExact((cell?.employerNi || 0) + (cell?.employerPension || 0))}\n• Excluded Expenses Reimbursed: ${formatGBPExact(cell?.reimbursements || 0)}`}
                            >
                              {val > 0 ? formatGBP(val) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                          {staffYtvTotal > 0 ? formatGBP(staffYtvTotal) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatGBP(staffRowTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Active Headcount row */}
                <tr style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '11px', borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ paddingLeft: '36px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)' }}>
                    Active Team Headcount
                  </td>
                  {monthsList.map(m => (
                    <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {monthlyHeadcount[m] || 0} active
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.04)', color: 'var(--text-muted)' }}>
                    —
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                    {Math.round(combinedDepartmentTotals.avgHeadcount)} (Avg)
                  </td>
                </tr>
              </>
            )}

            {/* ==========================================================
                SECTION 2: CONTRACTED SOFTWARE & TOOLS (RATCHET)
                ========================================================== */}
            <tr className="section-header" style={{ backgroundColor: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
              <td 
                colSpan={monthsList.length + 3} 
                style={{ 
                  padding: '8px 14px', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                2. Software Licenses & CRM Systems (Contract Ratchet Engine)
              </td>
            </tr>

            {/* Main Collapsible Software Row */}
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <td 
                style={{ 
                  padding: '10px 14px', 
                  position: 'sticky', 
                  left: 0, 
                  backgroundColor: 'var(--bg-primary)', 
                  zIndex: 2, 
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setExpandedTools(!expandedTools)}
              >
                <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                  {expandedTools ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Contracted Software & Tool Licenses
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  ({relevantTools.length} tools • Ratchet rules active)
                </span>
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#8b5cf6' }}>
                  {formatGBP(toolTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.04)', color: '#8b5cf6' }}>
                {formatGBP(toolTotals.ytvTotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#8b5cf6', fontSize: '13px' }}>
                {formatGBP(toolTotals.grandTotal)}
              </td>
            </tr>

            {/* Expanded Tools Sub-rows */}
            {expandedTools && (
              <>
                {toolRatchetData.length === 0 ? (
                  <tr>
                    <td colSpan={monthsList.length + 3} style={{ padding: '12px 32px', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>
                      No software tools configured. Click "+ Add Software Tool" above to add Dialpad, CRM, or LinkedIn Recruiter.
                    </td>
                  </tr>
                ) : (
                  toolRatchetData.map(({ tool, toolDepts, toolComps, unitCostGBP, monthlyDetails, periodTotalCost, ytvCost }) => (
                    <tr 
                      key={tool.id} 
                      style={{ 
                        fontSize: '11px', 
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)'
                      }}
                    >
                      <td style={{ 
                        paddingLeft: '36px', 
                        position: 'sticky', 
                        left: 0, 
                        backgroundColor: 'var(--bg-primary)', 
                        zIndex: 1 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>↳</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tool.name}</span>

                            {/* Department Scope Badge */}
                            <span style={{
                              fontSize: '9px',
                              backgroundColor: 'rgba(99, 102, 241, 0.12)',
                              color: 'var(--accent)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {toolDepts.includes('all')
                                ? 'All Depts'
                                : (toolDepts.length === 1 ? toolDepts[0] : `${toolDepts[0]} +${toolDepts.length - 1} depts`)}
                            </span>

                            {/* Company Scope Badge */}
                            <span style={{
                              fontSize: '9px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: 'var(--success)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {toolComps.includes('all')
                                ? 'All Companies'
                                : (toolComps.length === 1
                                    ? (companies.find(c => c.id === toolComps[0])?.name || toolComps[0])
                                    : `${companies.find(c => c.id === toolComps[0])?.name || toolComps[0]} +${toolComps.length - 1}`)}
                            </span>

                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                              ({tool.baselineCommittedSeats} seats baseline @ {formatGBPExact(unitCostGBP)}/seat)
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenEditTool(tool)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                              title="Edit Tool"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTool(tool.id, tool.name)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                              title="Delete Tool"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      {monthsList.map(m => {
                        const d = monthlyDetails[m];
                        if (!d) return <td key={m} style={{ textAlign: 'right' }}>—</td>;

                        return (
                          <td 
                            key={m} 
                            style={{ 
                              textAlign: 'right', 
                              fontFamily: 'monospace',
                              padding: '8px 8px'
                            }}
                            title={`Tool: ${tool.name}\nMonth: ${m}\n• Committed: ${d.committedSeats} seats\n• Active: ${d.activeSeats}\n• Unutilized: ${d.unutilizedSeats} spare seats\n• Monthly Cost: ${formatGBPExact(d.costGBP)}`}
                          >
                            <div>{formatGBP(d.costGBP)}</div>
                            <div style={{ 
                              fontSize: '9px', 
                              color: d.unutilizedSeats > 0 ? '#f59e0b' : 'var(--text-muted)',
                              fontWeight: d.unutilizedSeats > 0 ? 600 : 400 
                            }}>
                              {d.committedSeats} seats {d.unutilizedSeats > 0 ? `(${d.unutilizedSeats} spare)` : ''}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                        {formatGBP(ytvCost)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#8b5cf6' }}>
                        {formatGBP(periodTotalCost)}
                      </td>
                    </tr>
                  ))
                )}
              </>
            )}

            {/* ==========================================================
                SECTION 3: DEPARTMENT OVERHEADS & EXPENSES (ALL NOMINALS)
                ========================================================== */}
            <tr className="section-header" style={{ backgroundColor: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
              <td 
                colSpan={monthsList.length + 3} 
                style={{ 
                  padding: '8px 14px', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                3. Department Overheads & Operational Expenses (All Nominals)
              </td>
            </tr>

            {/* Main Collapsible Nominals Row */}
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
              <td 
                style={{ 
                  padding: '10px 14px', 
                  position: 'sticky', 
                  left: 0, 
                  backgroundColor: 'var(--bg-primary)', 
                  zIndex: 2, 
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => setExpandedNominals(!expandedNominals)}
              >
                <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                  {expandedNominals ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Apportioned Overheads & Operational SaaS
                </span>
                {excludedNominalCodes.length > 0 ? (
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    color: '#ef4444', 
                    fontWeight: 600 
                  }}>
                    ⚠️ {excludedNominalCodes.length} Excluded
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    ({nominalCodeKeys.length} nominal codes included)
                  </span>
                )}
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--warning)' }}>
                  {formatGBP(nominalTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, backgroundColor: 'rgba(99, 102, 241, 0.04)', color: 'var(--warning)' }}>
                {formatGBP(nominalTotals.ytvTotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--warning)', fontSize: '13px' }}>
                {formatGBP(nominalTotals.grandTotal)}
              </td>
            </tr>

            {/* Expanded Nominals Sub-rows */}
            {expandedNominals && (
              <>
                {nominalCodeKeys.length === 0 ? (
                  <tr>
                    <td colSpan={monthsList.length + 3} style={{ padding: '12px 32px', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '11px' }}>
                      No nominal expense items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  nominalCodeKeys.map(code => {
                    const isExcluded = isNominalExcluded(code);
                    const totalNominal = pnlMonthlyData.reduce((acc, r) => acc + (r?.nominalBreakdown?.[code] || 0), 0);
                    const ytvNominal = pnlMonthlyData.filter((r, idx) => monthsList[idx] <= reconciledCutoffMonth).reduce((acc, r) => acc + (r?.nominalBreakdown?.[code] || 0), 0);

                    return (
                      <tr 
                        key={code} 
                        style={{ 
                          fontSize: '11px', 
                          borderBottom: '1px solid var(--border-color)',
                          color: isExcluded ? 'var(--text-muted)' : 'var(--text-secondary)',
                          backgroundColor: isExcluded ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                          opacity: isExcluded ? 0.5 : 1
                        }}
                      >
                        <td style={{ 
                          paddingLeft: '36px', 
                          position: 'sticky', 
                          left: 0, 
                          backgroundColor: 'var(--bg-primary)', 
                          zIndex: 1 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>↳</span>
                              <span style={{ 
                                fontWeight: isExcluded ? 400 : 500,
                                textDecoration: isExcluded ? 'line-through' : 'none',
                                color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)'
                              }}>
                                {code}
                              </span>
                            </div>

                            {onToggleNominalInclusion && (
                              <button
                                type="button"
                                onClick={() => onToggleNominalInclusion(code)}
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: isExcluded ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)',
                                  backgroundColor: isExcluded ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.06)',
                                  color: isExcluded ? '#22c55e' : '#ef4444',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {isExcluded ? '+ Include' : '✕ Exclude'}
                              </button>
                            )}
                          </div>
                        </td>
                        {monthsList.map((m, idx) => {
                          const val = pnlMonthlyData[idx]?.nominalBreakdown?.[code] || 0;
                          return (
                            <td 
                              key={m} 
                              style={{ 
                                textAlign: 'right', 
                                fontFamily: 'monospace', 
                                opacity: val > 0 ? 1 : 0.3,
                                textDecoration: isExcluded ? 'line-through' : 'none'
                              }}
                            >
                              {val > 0 ? formatGBP(val) : '—'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.04)', fontWeight: 600 }}>
                          {ytvNominal > 0 ? formatGBP(ytvNominal) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {formatGBP(totalNominal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </>
            )}

            {/* ==========================================================
                SECTION 4: CONSOLIDATED DEPARTMENT OPERATING SUMMARY
                ========================================================== */}
            <tr className="section-header" style={{ backgroundColor: 'var(--bg-card)', borderTop: '3px solid var(--border-color)' }}>
              <td 
                colSpan={monthsList.length + 3} 
                style={{ 
                  padding: '8px 14px', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                4. Consolidated Department Summary & P&L Totals
              </td>
            </tr>

            {/* Row: Team Remuneration Summary */}
            <tr style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, fontWeight: 600 }}>
                1. Team Remuneration (Salaries, Freelance & Commissions)
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.04)', fontWeight: 600 }}>
                {formatGBP(staffRemunerationTotals.ytvTotal)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                {formatGBP(staffRemunerationTotals.grandTotal)}
              </td>
            </tr>

            {/* Row: Software Tools Summary */}
            <tr style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, fontWeight: 600 }}>
                2. Contracted Software & Tool Licenses
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatGBP(toolTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.04)', fontWeight: 600 }}>
                {formatGBP(toolTotals.ytvTotal)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                {formatGBP(toolTotals.grandTotal)}
              </td>
            </tr>

            {/* Row: Operational Nominals Summary */}
            <tr style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, fontWeight: 600 }}>
                3. Department Overhead & Expense Nominals
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatGBP(nominalTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(99, 102, 241, 0.04)', fontWeight: 600 }}>
                {formatGBP(nominalTotals.ytvTotal)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                {formatGBP(nominalTotals.grandTotal)}
              </td>
            </tr>

            {/* Grand Total Row */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 800, borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)', fontSize: '13px' }}>
              <td style={{ padding: '12px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2, color: 'var(--accent)' }}>
                GRAND TOTAL DEPARTMENT OPERATING COST
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {formatGBP(combinedDepartmentTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                {formatGBP(combinedDepartmentTotals.ytvTotal)}
              </td>
              <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '14px' }}>
                {formatGBP(combinedDepartmentTotals.grandTotal)}
              </td>
            </tr>

            {/* Average Cost Per Head Row */}
            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)', fontSize: '11px' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)' }}>
                Average Operating Cost per Recruiter / Head
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {formatGBP(combinedDepartmentTotals.avgCostPerHead[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                —
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {formatGBP(combinedDepartmentTotals.overallAvgCostPerHead)}
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* ==============================================================
          MODAL: ADD / EDIT SOFTWARE TOOL
          ============================================================== */}
      {showToolModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingTool ? 'Edit Department Software Tool' : 'Add Department Software Tool'}
              </h3>
              <button
                onClick={() => setShowToolModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveTool} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              {/* Tool Name & Vendor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Tool / Software Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dialpad, Recruitly CRM, LinkedIn"
                    value={toolForm.name}
                    onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Vendor Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dialpad Inc., Cloudcall"
                    value={toolForm.vendorName}
                    onChange={(e) => setToolForm({ ...toolForm, vendorName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Multi-Company Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Company Scope *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setToolForm(prev => ({ ...prev, companyIds: ['all'], companyId: 'all' }))}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: toolForm.companyIds.includes('all') ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: toolForm.companyIds.includes('all') ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      All Companies
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllCompanies}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Select All
                    </button>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  maxHeight: '100px',
                  overflowY: 'auto'
                }}>
                  <button
                    type="button"
                    onClick={() => handleToggleCompany('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: toolForm.companyIds.includes('all') ? 700 : 500,
                      backgroundColor: toolForm.companyIds.includes('all') ? 'var(--accent)' : 'var(--bg-card)',
                      color: toolForm.companyIds.includes('all') ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${toolForm.companyIds.includes('all') ? 'var(--accent)' : 'var(--border-color)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {toolForm.companyIds.includes('all') ? '✓ ' : ''}All Companies
                  </button>
                  {companies.map(c => {
                    const isSelected = !toolForm.companyIds.includes('all') && toolForm.companyIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleCompany(c.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: isSelected ? 700 : 500,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {isSelected ? '✓ ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', display: 'block' }}>
                  {toolForm.companyIds.includes('all')
                    ? 'Shared across all registered companies'
                    : `Applies to ${toolForm.companyIds.length} selected compan${toolForm.companyIds.length === 1 ? 'y' : 'ies'}`}
                </span>
              </div>

              {/* Multi-Department Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Department Scope *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setToolForm(prev => ({ ...prev, departments: ['all'], department: 'all' }))}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: toolForm.departments.includes('all') ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: toolForm.departments.includes('all') ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      All Departments
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllDepartments}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Select All
                    </button>
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  maxHeight: '110px',
                  overflowY: 'auto'
                }}>
                  <button
                    type="button"
                    onClick={() => handleToggleDepartment('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: toolForm.departments.includes('all') ? 700 : 500,
                      backgroundColor: toolForm.departments.includes('all') ? 'var(--accent)' : 'var(--bg-card)',
                      color: toolForm.departments.includes('all') ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${toolForm.departments.includes('all') ? 'var(--accent)' : 'var(--border-color)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {toolForm.departments.includes('all') ? '✓ ' : ''}All Departments
                  </button>
                  {allDepartments.map(d => {
                    const isSelected = !toolForm.departments.includes('all') && toolForm.departments.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleToggleDepartment(d)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: isSelected ? 700 : 500,
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {isSelected ? '✓ ' : ''}{d}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px', display: 'block' }}>
                  {toolForm.departments.includes('all')
                    ? 'Shared across all departments in the business'
                    : `Applies to ${toolForm.departments.length} selected department${toolForm.departments.length === 1 ? '' : 's'}`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Cost Per Seat (Monthly) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="45.00"
                    value={toolForm.licenseCostPerSeat}
                    onChange={(e) => setToolForm({ ...toolForm, licenseCostPerSeat: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Currency
                  </label>
                  <select
                    value={toolForm.currency}
                    onChange={(e) => setToolForm({ ...toolForm, currency: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="ZAR">ZAR (R)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Baseline Contract Seats *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="10"
                    value={toolForm.baselineCommittedSeats}
                    onChange={(e) => setToolForm({ ...toolForm, baselineCommittedSeats: parseInt(e.target.value, 10) || 1 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Minimum committed seats in contract
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Contract Renewal Date
                  </label>
                  <input
                    type="date"
                    value={toolForm.renewalDate}
                    onChange={(e) => setToolForm({ ...toolForm, renewalDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                  Notes / Contract Terms (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 12-month annual commitment with quarterly add-ons."
                  value={toolForm.notes}
                  onChange={(e) => setToolForm({ ...toolForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowToolModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {editingTool ? 'Save Changes' : 'Create Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
