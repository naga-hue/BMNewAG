import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Company, Staff, Placement, PayrollRecord, DepartmentTool, NominalCode, ToolCostBasis, ToolSplitMethod } from '../../types';
import { useBoundStore } from '../../store/useBoundStore';
import { getCellData } from '../payroll/utils';
import { toGBP } from '../../utils/currency';
import CompanyDeptTreeFilter from '../CompanyDeptTreeFilter';

interface DepartmentTeamCostTabProps {
  companies: Company[];
  staff: Staff[];
  payrollRecords: PayrollRecord[];
  payrollPolicies: any[];
  expenses?: any[];
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

// Helper to parse a YYYY-MM month string from various date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
export const parseMonthFromDateStr = (dateStr?: string | null): string | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // YYYY-MM or YYYY-MM-DD
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 7);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ukMatch) {
    const [, , mm, yyyy] = ukMatch;
    return `${yyyy}-${mm.padStart(2, '0')}`;
  }

  // Fallback to Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  return null;
};

// Helper to determine if a staff member was active during a given month
const isStaffActiveInMonth = (s: Staff, monthKey: string, cellTotal: number): boolean => {
  // 1. If staff member has exited, they cannot be active in months after their exit/cutoff date
  if (s.status === 'exited' || !!s.exitDate) {
    const cutoffStr = s.salaryPaidUntilDate || s.exitDate || '';
    if (cutoffStr) {
      const exitMonth = cutoffStr.substring(0, 7);
      if (exitMonth < monthKey) return false;
    }
  }

  // 2. If before start date, they cannot be active
  if (s.startDate) {
    const startMonth = s.startDate.substring(0, 7);
    if (startMonth > monthKey) return false;
  } else {
    return false;
  }

  if (cellTotal > 0) return true;
  return true;
};

export default function DepartmentTeamCostTab({
  companies = [],
  staff = [],
  payrollRecords = [],
  payrollPolicies = [],
  expenses = [],
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
  const [expandedSales, setExpandedSales] = useState<boolean>(true);
  const [expandedTeam, setExpandedTeam] = useState<boolean>(true);
  const [expandedTools, setExpandedTools] = useState<boolean>(true);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [toolSortOrder, setToolSortOrder] = useState<'asc' | 'desc'>('asc');

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

  // Helper to compute active staff count for a set of companies and departments at a given date/month
  const calculateStaffCountAtDate = useCallback((dateStr: string, compIds: string[], deptNames: string[]) => {
    const parsedM = parseMonthFromDateStr(dateStr);
    const monthKey = parsedM || (startMonth || '2026-01');
    return staff.filter(s => {
      const compMatch = compIds.includes('all') || compIds.includes(s.companyId);
      const deptMatch = deptNames.includes('all') || deptNames.includes(s.department);
      if (!compMatch || !deptMatch) return false;

      const cell = getCellData(s, monthKey, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
      return isStaffActiveInMonth(s, monthKey, cell.total);
    }).length;
  }, [staff, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies, startMonth]);

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
    costBasis: ToolCostBasis;
    splitMethod: ToolSplitMethod;
    licenseCostPerSeat: number;
    currency: string;
    billingFrequency: 'monthly' | 'annual';
    baselineCommittedSeats: number;
    isBaselineOverridden: boolean;
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
    costBasis: 'per_seat',
    splitMethod: 'equal',
    licenseCostPerSeat: 45,
    currency: 'GBP',
    billingFrequency: 'monthly',
    baselineCommittedSeats: 5,
    isBaselineOverridden: false,
    contractStartDate: `${startMonth}-01`,
    renewalDate: `${endMonth}-31`,
    vendorName: '',
    notes: ''
  });

  // Calculate active staff count on the contract start date for the currently selected companies and departments
  const staffCountAtStartDate = useMemo(() => {
    return calculateStaffCountAtDate(toolForm.contractStartDate, toolForm.companyIds, toolForm.departments);
  }, [calculateStaffCountAtDate, toolForm.contractStartDate, toolForm.companyIds, toolForm.departments]);

  // State for filtering department pills by company in the tool modal
  const [deptScopeCompanyFilter, setDeptScopeCompanyFilter] = useState<string>('all');

  // Mapping of companyId to unique departments found in staff and company records
  const companyDepartmentsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    companies.forEach(c => {
      const deptSet = new Set<string>();
      if (Array.isArray((c as any).departments)) {
        (c as any).departments.forEach((d: any) => {
          if (!d) return;
          const name = typeof d === 'object' ? d.name : d;
          if (name && typeof name === 'string') deptSet.add(name.trim());
        });
      }
      staff.forEach(s => {
        if (s.companyId === c.id && s.department && s.department.trim()) {
          deptSet.add(s.department.trim());
        }
      });
      map[c.id] = Array.from(deptSet).sort();
    });
    return map;
  }, [companies, staff]);

  // Calculate total department desks across currently selected companies and departments in toolForm
  const toolFormDeptCount = useMemo(() => {
    const activeComps = toolForm.companyIds.includes('all')
      ? companies
      : companies.filter(c => toolForm.companyIds.includes(c.id));

    let count = 0;
    if (toolForm.departments.includes('all')) {
      activeComps.forEach(c => {
        const compDepts = companyDepartmentsMap[c.id] || [];
        count += compDepts.length > 0 ? compDepts.length : 1;
      });
    } else {
      activeComps.forEach(c => {
        const compDepts = companyDepartmentsMap[c.id] || [];
        compDepts.forEach(d => {
          if (toolForm.departments.includes(d)) {
            count++;
          }
        });
      });
    }
    return count > 0 ? count : (toolForm.departments.includes('all') ? allDepartments.length : toolForm.departments.length);
  }, [toolForm.companyIds, toolForm.departments, companies, companyDepartmentsMap, allDepartments]);

  // Departments to display in the department pills section (supports company filter)
  const displayedDepartments = useMemo(() => {
    if (deptScopeCompanyFilter === 'all') {
      return allDepartments;
    }
    const companyDepts = companyDepartmentsMap[deptScopeCompanyFilter] || [];
    return companyDepts.length > 0 ? companyDepts : allDepartments;
  }, [deptScopeCompanyFilter, allDepartments, companyDepartmentsMap]);

  // Filter staff by company and department filters
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      // Exclude central corporate owner / Managing Director (Paul Seth) from departmental team costs
      const fn = (s.fullName || '').toLowerCase().trim();
      if (fn === 'paul seth' || fn.includes('paul seth')) return false;

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

        // If the cell already has a verified reconciled payroll record, use it directly!
        // Otherwise, auto-align with actual bank disbursements from expenses (matching Group P&L 100%)
        // for staff/directors receiving direct consulting, freelance, or contractor payments
        if (!cell.isReconciled || cell.basic === 0) {
          const staffDirectExpenses = (expenses || []).filter(e => {
            if (e.status === 'dns' || e.status === 'cancelled') return false;
            // Exclude synthetic system-generated mirror expenses to prevent duplication
            if (e.id && (e.id.startsWith('payroll-') || e.id.startsWith('exp-overhead-'))) return false;

            const nom = (e.nominalCode || '').toLowerCase();
            // Strictly exclude 1003.1 (Director) and 1003.2 (House) from Team & Tool costs
            if (nom.includes('1003.1') || nom.includes('1003.2') || nom.includes('house')) return false;

            const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
            if (eMonth !== m) return false;

            const targets = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
            const isTargetStaff = targets.includes(s.id);
            const p = (e.payee || '').toLowerCase().trim();
            const fn = (s.fullName || '').toLowerCase().trim();
            const isPayeeMatch = fn && (p === fn || p.includes(fn) || fn.includes(p));

            const isRemunNominal = (nom.includes('1003') && !nom.includes('1003.1') && !nom.includes('1003.2')) ||
                                   nom.includes('consulting') ||
                                   nom.includes('1001') ||
                                   nom.includes('freelanc') ||
                                   nom.includes('salary');

            return (isTargetStaff || isPayeeMatch) && isRemunNominal;
          });

          if (staffDirectExpenses.length > 0) {
            const bankPaidTotal = staffDirectExpenses.reduce((sum, e) => sum + toGBP(Number(e.amount || 0), e.currency || 'GBP'), 0);
            if (bankPaidTotal > 0) {
              matrix[s.id][m] = {
                ...cell,
                basic: bankPaidTotal,
                total: bankPaidTotal + (cell.commission || 0),
                totalWithReimbursements: bankPaidTotal + (cell.commission || 0) + (cell.reimbursements || 0),
                isReconciled: true,
                notes: `Bank Statement Paid (Group P&L Aligned): £${bankPaidTotal.toLocaleString()} across ${staffDirectExpenses.length} transactions`
              };
              return;
            }
          }
        }

        matrix[s.id][m] = cell;
      });
    });

    return matrix;
  }, [filteredStaff, monthsList, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies, expenses]);

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

  // 1. Identify shared staff members:
  // - SA Shared staff (Global Recruiters SA comp-1782789370085 with nominal 1004 / SA-Shared costs, e.g. Danielle)
  // - Staff with explicit allocatedCompanyIds (Shared Cost Company Allocation)
  // Note: Operating directors (like Spencer Wicks in Huntek Construction, Charlie Davies in Sterling,
  // Sebastian Bacon in Totaco) belong directly to their own company & department and stay there.
  // Their costs are direct team remuneration in their own department, NOT apportioned to other departments like Civils.
  const sharedStaffList = useMemo(() => {
    return staff.filter(s => {
      // Exclude Paul Seth (Managing Director / Corporate Owner)
      const fn = (s.fullName || '').toLowerCase().trim();
      if (fn === 'paul seth' || fn.includes('paul seth')) return false;

      // Exclude if already in filteredStaff (already shown as a direct team member)
      if (filteredStaff.some(fs => fs.id === s.id)) return false;

      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
      const policyNom = (policy?.nominalCode || '').toLowerCase();
      const jobLower = (s.jobTitle || '').toLowerCase();

      // Only staff whose nominal is specifically 1004 (SA Shared) or who belong to SA Shared operations
      const isSaShared = (s.companyId === 'comp-1782789370085' && (policyNom.includes('1004') || policyNom.includes('sa-shared') || policyNom.includes('sa shared') || jobLower.includes('sa shared'))) ||
                         policyNom.includes('1004') ||
                         policyNom.includes('sa-shared');

      // Staff explicitly configured with cross-company allocation targets
      const hasCompanyAllocations = Array.isArray(s.allocatedCompanyIds) && s.allocatedCompanyIds.length > 0;
      const isSharedMode = s.allocationMode === 'shared';

      return isSaShared || hasCompanyAllocations || isSharedMode;
    });
  }, [staff, filteredStaff, payrollPolicies]);

  // Calculate monthly apportioned share for each shared staff member based on active team headcount
  const sharedStaffMonthlyData = useMemo(() => {
    const matrix: Record<string, Record<string, {
      fullCost: number;
      shareRatio: number;
      apportionedCost: number;
      viewStaffCount: number;
      totalStaffCount: number;
      subtext: string;
      roleBadge: string;
    }>> = {};

    sharedStaffList.forEach(s => {
      matrix[s.id] = {};
      const targetCompanyIds = (s.allocatedCompanyIds && s.allocatedCompanyIds.length > 0) ? s.allocatedCompanyIds : null;

      const policy = payrollPolicies.find(p => p.id === s.payrollPolicyId);
      const policyNom = (policy?.nominalCode || '').toLowerCase();
      const jobLower = (s.jobTitle || '').toLowerCase();

      const isSaShared = s.companyId === 'comp-1782789370085' || policyNom.includes('1004') || jobLower.includes('sa shared');
      const isDirector = jobLower.includes('director') || jobLower.includes('consulting') || policyNom.includes('1003');
      const roleBadge = isSaShared ? '🌍 SA Shared' : isDirector ? '👑 Consulting Director' : '🤝 Shared Salary';

      monthsList.forEach(m => {
        // Calculate full monthly remuneration of the shared staff/director
        let cell = getCellData(
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

        if (!cell.isReconciled || cell.basic === 0) {
          const staffDirectExpenses = (expenses || []).filter(e => {
            if (e.status === 'dns' || e.status === 'cancelled') return false;
            if (e.id && (e.id.startsWith('payroll-') || e.id.startsWith('exp-overhead-'))) return false;
            const nom = (e.nominalCode || '').toLowerCase();
            // Strictly exclude 1003.1 (Director) and 1003.2 (House) from Team & Tool costs
            if (nom.includes('1003.1') || nom.includes('1003.2') || nom.includes('house')) return false;

            const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
            if (eMonth !== m) return false;

            const targets = Array.isArray(e.allocationTarget) ? e.allocationTarget : [e.allocationTarget].filter(Boolean);
            const isTargetStaff = targets.includes(s.id);
            const p = (e.payee || '').toLowerCase().trim();
            const fn = (s.fullName || '').toLowerCase().trim();
            const isPayeeMatch = fn && (p === fn || p.includes(fn) || fn.includes(p));

            const isRemunNominal = (nom.includes('1003') && !nom.includes('1003.1') && !nom.includes('1003.2')) ||
                                   nom.includes('consulting') ||
                                   nom.includes('1001') ||
                                   nom.includes('freelanc') ||
                                   nom.includes('salary');

            return (isTargetStaff || isPayeeMatch) && isRemunNominal;
          });

          if (staffDirectExpenses.length > 0) {
            const bankPaidTotal = staffDirectExpenses.reduce((sum, e) => sum + toGBP(Number(e.amount || 0), e.currency || 'GBP'), 0);
            if (bankPaidTotal > 0) {
              cell = {
                ...cell,
                basic: bankPaidTotal,
                total: bankPaidTotal + (cell.commission || 0),
                totalWithReimbursements: bankPaidTotal + (cell.commission || 0) + (cell.reimbursements || 0),
                isReconciled: true,
                notes: `Bank Statement Paid (Group P&L Aligned): £${bankPaidTotal.toLocaleString()}`
              };
            }
          }
        }

        const fullCost = cell.total;

        // Group active staff across target companies
        const eligibleGroupStaff = staff.filter(os => {
          const comp = companies.find(c => c.id === os.companyId);
          if (!comp || comp.includeInConsolidation === false) return false;
          if (targetCompanyIds) {
            if (!targetCompanyIds.includes(os.companyId)) return false;
          } else {
            if (os.companyId === s.companyId) return false;
          }
          const c = getCellData(os, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
          return isStaffActiveInMonth(os, m, c.total);
        });

        // Staff in current filtered view (matching companyFilter and deptFilter)
        const viewStaff = eligibleGroupStaff.filter(os => {
          const compMatch = companyFilter.includes('all') || companyFilter.includes(os.companyId);
          const deptMatch = deptFilter.includes('all') || deptFilter.includes(os.department);
          return compMatch && deptMatch;
        });

        let shareRatio = 0;
        let apportionedCost = 0;
        let subtext = '';

        if (eligibleGroupStaff.length > 0 && viewStaff.length > 0) {
          shareRatio = viewStaff.length / eligibleGroupStaff.length;
          apportionedCost = fullCost * shareRatio;
          subtext = `${viewStaff.length}/${eligibleGroupStaff.length} staff (${(shareRatio * 100).toFixed(1)}%)`;
        }

        matrix[s.id][m] = {
          fullCost,
          shareRatio,
          apportionedCost,
          viewStaffCount: viewStaff.length,
          totalStaffCount: eligibleGroupStaff.length,
          subtext,
          roleBadge
        };
      });
    });

    return matrix;
  }, [sharedStaffList, monthsList, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies, companyFilter, deptFilter, expenses]);

  // Relevant shared staff who have apportioned cost > 0 in the period
  const relevantSharedStaff = useMemo(() => {
    return sharedStaffList.filter(s => {
      const monthData = sharedStaffMonthlyData[s.id];
      if (!monthData) return false;
      return monthsList.some(m => (monthData[m]?.apportionedCost || 0) > 0);
    });
  }, [sharedStaffList, sharedStaffMonthlyData, monthsList]);

  // Filter and sort tools applicable to current department and company selection (Alphabetical A-Z / Z-A)
  const relevantTools = useMemo(() => {
    return departmentTools
      .filter(t => {
        // 1. Department match: check if tool applies to any filtered department
        const toolDepts = (t.departments && t.departments.length > 0) ? t.departments : [t.department || 'all'];
        const matchesDept = deptFilter.includes('all') || toolDepts.includes('all') || deptFilter.some(d => toolDepts.includes(d));
        if (!matchesDept) return false;

        // 2. Company match: check if tool applies to any filtered company
        const toolComps = (t.companyIds && t.companyIds.length > 0) ? t.companyIds : [t.companyId || 'all'];
        const matchesComp = companyFilter.includes('all') || toolComps.includes('all') || companyFilter.some(c => toolComps.includes(c));
        if (!matchesComp) return false;

        return true;
      })
      .sort((a, b) => {
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return toolSortOrder === 'asc'
          ? nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true })
          : nameB.localeCompare(nameA, undefined, { sensitivity: 'base', numeric: true });
      });
  }, [departmentTools, deptFilter, companyFilter, toolSortOrder]);

  // High-Water Mark Ratchet Engine for Software Tools (Supporting Multi-Dept, Multi-Company & Multiple Cost Bases)
  const toolRatchetData = useMemo(() => {
    return relevantTools.map(tool => {
      const costBasis: ToolCostBasis = tool.costBasis || 'per_seat';
      const splitMethod: ToolSplitMethod = tool.splitMethod || 'equal';
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
        subtext: string;
      }> = {};

      let periodTotalCost = 0;
      let ytvCost = 0;

      // Effective companies and departments
      const effectiveComps = toolComps.includes('all') ? companies.map(c => c.id) : toolComps;
      const matchingComps = companyFilter.includes('all') ? effectiveComps : effectiveComps.filter(c => companyFilter.includes(c));

      const effectiveDepts = toolDepts.includes('all') ? allDepartments : toolDepts;
      const matchingDepts = deptFilter.includes('all') ? effectiveDepts : effectiveDepts.filter(d => deptFilter.includes(d));

      const isFullScope = companyFilter.includes('all') && deptFilter.includes('all');

      // Check if tool is dedicated strictly to the filtered view
      const isToolDedicatedToView = 
        (toolDepts.includes('all') ? deptFilter.includes('all') : toolDepts.every(d => deptFilter.includes(d))) &&
        (toolComps.includes('all') ? companyFilter.includes('all') : toolComps.every(c => companyFilter.includes(c)));

      // Calculate initial active headcount in the viewed scope at the start of the period
      const initialMonth = monthsList[0] || '2026-01';
      const initialScopeActive = staff.filter(s => {
        const inViewComp = companyFilter.includes('all') || companyFilter.includes(s.companyId);
        const inViewDept = deptFilter.includes('all') || deptFilter.includes(s.department);
        const toolCompMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
        const toolDeptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
        if (!inViewComp || !inViewDept || !toolCompMatch || !toolDeptMatch) return false;

        const cell = getCellData(s, initialMonth, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
        return isStaffActiveInMonth(s, initialMonth, cell.total);
      }).length;

      // If viewing full scope or tool is dedicated to this view, use configured baseline;
      // otherwise, for a shared tool, department baseline starts at the department's initial active headcount
      const scopeBaseline = (isFullScope || isToolDedicatedToView)
        ? (Number(tool.baselineCommittedSeats) || initialScopeActive)
        : initialScopeActive;

      let scopePeakSoFar = scopeBaseline;
      let contractPeakSoFar = baseline;

      const toolStartMonth = parseMonthFromDateStr(tool.contractStartDate);
      const toolEndMonth = parseMonthFromDateStr(tool.renewalDate);

      monthsList.forEach((m) => {
        // Contract Term / Active Period Check
        const isBeforeStart = toolStartMonth ? (m < toolStartMonth) : false;
        const isAfterEnd = toolEndMonth ? (m > toolEndMonth) : false;
        const isContractActiveInMonth = !isBeforeStart && !isAfterEnd;

        if (!isContractActiveInMonth) {
          monthlyDetails[m] = {
            activeSeats: 0,
            committedSeats: 0,
            unutilizedSeats: 0,
            costGBP: 0,
            isRatcheted: false,
            subtext: isBeforeStart ? 'Not started' : 'Contract ended'
          };
          return;
        }

        let cost = 0;
        let activeHeadcountForTool = 0;
        let committed = 0;
        let unutilized = 0;
        let isRatcheted = false;
        let subtext = '';

        if (costBasis === 'per_company') {
          // If viewing all departments, each matching company is charged unitCostGBP
          // If filtering by department, each matching company's fee is split across its departments
          let totalCompCost = 0;

          matchingComps.forEach(compId => {
            const compDepts = companyDepartmentsMap[compId] || allDepartments;
            const compEffectiveDepts = toolDepts.includes('all') 
              ? compDepts 
              : compDepts.filter(d => toolDepts.includes(d));

            const compMatchingDepts = deptFilter.includes('all')
              ? compEffectiveDepts
              : compEffectiveDepts.filter(d => deptFilter.includes(d));

            if (compMatchingDepts.length === 0) return;

            const isAllDepts = deptFilter.includes('all') || compMatchingDepts.length === compEffectiveDepts.length;

            if (isAllDepts) {
              totalCompCost += unitCostGBP;
            } else if (splitMethod === 'pro_rata_headcount') {
              const compTotalStaff = staff.filter(s => {
                if (s.companyId !== compId) return false;
                if (!toolDepts.includes('all') && !toolDepts.includes(s.department)) return false;
                const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
                return isStaffActiveInMonth(s, m, cell.total);
              }).length;

              const compDeptStaff = staff.filter(s => {
                if (s.companyId !== compId) return false;
                if (!compMatchingDepts.includes(s.department)) return false;
                const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
                return isStaffActiveInMonth(s, m, cell.total);
              }).length;

              const ratio = compTotalStaff > 0 ? (compDeptStaff / compTotalStaff) : (compMatchingDepts.length / Math.max(1, compEffectiveDepts.length));
              totalCompCost += unitCostGBP * ratio;
            } else {
              // Equal split across departments in this company
              const ratio = compMatchingDepts.length / Math.max(1, compEffectiveDepts.length);
              totalCompCost += unitCostGBP * ratio;
            }
          });

          cost = totalCompCost;
          if (deptFilter.includes('all')) {
            subtext = `${matchingComps.length} ${matchingComps.length === 1 ? 'comp' : 'comps'}`;
          } else {
            subtext = splitMethod === 'pro_rata_headcount' ? 'Dept pro-rata' : 'Dept split';
          }
        } else if (costBasis === 'per_department') {
          // Count assigned department desks across matching companies
          let deptCount = 0;
          matchingComps.forEach(compId => {
            const compDepts = companyDepartmentsMap[compId] || [];
            const compEffectiveDepts = toolDepts.includes('all')
              ? compDepts
              : compDepts.filter(d => toolDepts.includes(d));

            const compMatchingDepts = deptFilter.includes('all')
              ? compEffectiveDepts
              : compEffectiveDepts.filter(d => deptFilter.includes(d));

            deptCount += compMatchingDepts.length;
          });

          if (deptCount === 0 && matchingComps.length > 0) {
            deptCount = matchingDepts.length;
          }

          cost = deptCount * unitCostGBP;
          subtext = `${deptCount} ${deptCount === 1 ? 'dept' : 'depts'}`;
        } else if (costBasis === 'fixed_total') {
          const isFullScope = companyFilter.includes('all') && deptFilter.includes('all');
          if (isFullScope) {
            cost = unitCostGBP;
            subtext = 'Fixed total';
          } else if (splitMethod === 'pro_rata_headcount') {
            const totalStaffAllAssigned = staff.filter(s => {
              const compMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
              const deptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
              if (!compMatch || !deptMatch) return false;
              const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
              return isStaffActiveInMonth(s, m, cell.total);
            }).length;

            const staffInFilteredView = staff.filter(s => {
              const inViewComp = companyFilter.includes('all') || companyFilter.includes(s.companyId);
              const inViewDept = deptFilter.includes('all') || deptFilter.includes(s.department);
              const toolCompMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
              const toolDeptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
              if (!inViewComp || !inViewDept || !toolCompMatch || !toolDeptMatch) return false;
              const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
              return isStaffActiveInMonth(s, m, cell.total);
            }).length;

            const ratio = totalStaffAllAssigned > 0 ? (staffInFilteredView / totalStaffAllAssigned) : (matchingDepts.length / Math.max(1, effectiveDepts.length));
            cost = unitCostGBP * ratio;
            subtext = `Pro-rata (${staffInFilteredView}/${totalStaffAllAssigned} staff)`;
          } else {
            // Count total assigned department desks across all effective companies for this tool
            let totalAssignedDepts = 0;
            effectiveComps.forEach(compId => {
              const compDepts = companyDepartmentsMap[compId] || [];
              const compEff = toolDepts.includes('all') ? compDepts : compDepts.filter(d => toolDepts.includes(d));
              totalAssignedDepts += compEff.length;
            });
            if (totalAssignedDepts === 0) totalAssignedDepts = Math.max(1, effectiveDepts.length);

            // Count assigned department desks within the current view filter
            let viewMatchingDepts = 0;
            matchingComps.forEach(compId => {
              const compDepts = companyDepartmentsMap[compId] || [];
              const compEff = toolDepts.includes('all') ? compDepts : compDepts.filter(d => toolDepts.includes(d));
              const compMatch = deptFilter.includes('all') ? compEff : compEff.filter(d => deptFilter.includes(d));
              viewMatchingDepts += compMatch.length;
            });

            const ratio = viewMatchingDepts / Math.max(1, totalAssignedDepts);
            cost = unitCostGBP * ratio;
            subtext = `Split (${viewMatchingDepts}/${totalAssignedDepts} depts)`;
          }
        } else {
          // Standard Per Seat Ratchet Engine
          if (isFullScope) {
            // Full group scope: track company-wide active headcount and contract baseline
            const totalActiveStaffForTool = staff.filter(s => {
              const compMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
              const deptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
              if (!compMatch || !deptMatch) return false;

              const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
              return isStaffActiveInMonth(s, m, cell.total);
            }).length;

            if (totalActiveStaffForTool > contractPeakSoFar) {
              contractPeakSoFar = totalActiveStaffForTool;
            }

            committed = contractPeakSoFar;
            if (tool.manualCommittedSeatsOverride && tool.manualCommittedSeatsOverride[m] !== undefined) {
              committed = Number(tool.manualCommittedSeatsOverride[m]);
            }

            activeHeadcountForTool = totalActiveStaffForTool;
            unutilized = Math.max(0, committed - activeHeadcountForTool);
            cost = committed * unitCostGBP;
            isRatcheted = committed > baseline;
            subtext = unutilized > 0 ? `${committed} seats (${unutilized} spare)` : `${committed} seats`;
          } else {
            // Filtered department / company scope (e.g. Civils department selected)
            const viewActiveStaffForTool = staff.filter(s => {
              const inViewComp = companyFilter.includes('all') || companyFilter.includes(s.companyId);
              const inViewDept = deptFilter.includes('all') || deptFilter.includes(s.department);
              const toolCompMatch = toolComps.includes('all') || toolComps.includes(s.companyId);
              const toolDeptMatch = toolDepts.includes('all') || toolDepts.includes(s.department);
              if (!inViewComp || !inViewDept || !toolCompMatch || !toolDeptMatch) return false;

              const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
              return isStaffActiveInMonth(s, m, cell.total);
            }).length;

            activeHeadcountForTool = viewActiveStaffForTool;

            // Department High-Water Mark Ratchet Engine:
            // When headcount expands in a month (e.g. 6 -> 7 in March), the peak ratchets up
            // and PERMANENTLY carries forward to all subsequent months (e.g. holds at 7 in April, May...)
            if (activeHeadcountForTool > scopePeakSoFar) {
              scopePeakSoFar = activeHeadcountForTool;
            }

            committed = scopePeakSoFar;
            if (isToolDedicatedToView && tool.manualCommittedSeatsOverride && tool.manualCommittedSeatsOverride[m] !== undefined) {
              committed = Number(tool.manualCommittedSeatsOverride[m]);
            }

            unutilized = Math.max(0, committed - activeHeadcountForTool);
            cost = committed * unitCostGBP;
            isRatcheted = committed > scopeBaseline;
            subtext = unutilized > 0 ? `${committed} seats (${unutilized} spare)` : `${committed} seats`;
          }
        }

        periodTotalCost += cost;
        if (m <= reconciledCutoffMonth) {
          ytvCost += cost;
        }

        monthlyDetails[m] = {
          activeSeats: activeHeadcountForTool,
          committedSeats: committed,
          unutilizedSeats: unutilized,
          costGBP: cost,
          isRatcheted,
          subtext
        };
      });

      return {
        tool,
        costBasis,
        splitMethod,
        toolDepts,
        toolComps,
        unitCostGBP,
        monthlyDetails,
        periodTotalCost,
        ytvCost
      };
    });
  }, [relevantTools, monthsList, staff, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies, reconciledCutoffMonth, allDepartments, companyFilter, deptFilter]);

  // Aggregate Remuneration Totals across Months (Direct Team + Apportioned Shared Roles, Directors & SA Shared)
  const staffRemunerationTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      let mSum = 0;
      // 1. Direct team members
      filteredStaff.forEach(s => {
        const cell = staffMonthlyData[s.id]?.[m];
        mSum += cell?.total || 0;
      });
      // 2. Apportioned shared staff (SA Shared, Consulting Director, Shared Salaries)
      relevantSharedStaff.forEach(s => {
        const d = sharedStaffMonthlyData[s.id]?.[m];
        mSum += d?.apportionedCost || 0;
      });

      monthlySum[m] = mSum;
      grandTotal += mSum;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += mSum;
      }
    });

    return { monthlySum, grandTotal, ytvTotal };
  }, [monthsList, filteredStaff, staffMonthlyData, relevantSharedStaff, sharedStaffMonthlyData, reconciledCutoffMonth]);

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



  // Consultant-level and monthly Sales / Placements billings
  const consultantSalesData = useMemo(() => {
    const matrix: Record<string, {
      consultant: Staff;
      monthlySales: Record<string, number>;
      grandTotal: number;
      ytvTotal: number;
      placementCount: number;
    }> = {};

    filteredStaff.forEach(s => {
      matrix[s.id] = {
        consultant: s,
        monthlySales: {},
        grandTotal: 0,
        ytvTotal: 0,
        placementCount: 0
      };
      monthsList.forEach(m => {
        matrix[s.id].monthlySales[m] = 0;
      });
    });

    placements.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pMonth = p.startDate.substring(0, 7);
      if (!monthsList.includes(pMonth)) return;

      const pVal = Number(p.netScoreValue) || 0;
      const pCurr = p.currency || 'GBP';

      if (p.splits && p.splits.length > 0) {
        p.splits.forEach(sp => {
          if (matrix[sp.staffId]) {
            const splitVal = toGBP((pVal * (Number(sp.percentage) || 0)) / 100, pCurr);
            matrix[sp.staffId].monthlySales[pMonth] += splitVal;
            matrix[sp.staffId].grandTotal += splitVal;
            if (pMonth <= reconciledCutoffMonth) {
              matrix[sp.staffId].ytvTotal += splitVal;
            }
            matrix[sp.staffId].placementCount += 1;
          }
        });
      } else if (p.recruiterId && matrix[p.recruiterId]) {
        const fullVal = toGBP(pVal, pCurr);
        matrix[p.recruiterId].monthlySales[pMonth] += fullVal;
        matrix[p.recruiterId].grandTotal += fullVal;
        if (pMonth <= reconciledCutoffMonth) {
          matrix[p.recruiterId].ytvTotal += fullVal;
        }
        matrix[p.recruiterId].placementCount += 1;
      }
    });

    return matrix;
  }, [filteredStaff, placements, monthsList, reconciledCutoffMonth]);

  // Aggregate Team Sales Totals
  const teamSalesTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      let sum = 0;
      filteredStaff.forEach(s => {
        sum += consultantSalesData[s.id]?.monthlySales[m] || 0;
      });
      monthlySum[m] = sum;
      grandTotal += sum;
      if (m <= reconciledCutoffMonth) {
        ytvTotal += sum;
      }
    });

    return { monthlySum, grandTotal, ytvTotal };
  }, [monthsList, filteredStaff, consultantSalesData, reconciledCutoffMonth]);

  // Combined Department Operating Costs (Staff Remuneration + Software Tools)
  const combinedDepartmentTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    const avgCostPerHead: Record<string, number> = {};
    let grandTotal = 0;
    let ytvTotal = 0;

    monthsList.forEach(m => {
      const staffCost = staffRemunerationTotals.monthlySum[m] || 0;
      const toolCost = toolTotals.monthlySum[m] || 0;
      const total = staffCost + toolCost;

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
  }, [monthsList, staffRemunerationTotals, toolTotals, monthlyHeadcount, reconciledCutoffMonth]);

  // Department Net Contribution / P&L Totals (Sales - Operating Costs) & Cumulative Running Balance
  const departmentPnlTotals = useMemo(() => {
    const monthlyNetProfit: Record<string, number> = {};
    const monthlyMarginPct: Record<string, number> = {};
    const monthlyNetContributionPerHead: Record<string, number> = {};
    const monthlyRunningBalance: Record<string, number> = {};
    let grandNetProfit = 0;
    let ytvNetProfit = 0;
    let runningCum = 0;

    monthsList.forEach(m => {
      const sales = teamSalesTotals.monthlySum[m] || 0;
      const costs = combinedDepartmentTotals.monthlySum[m] || 0;
      const profit = sales - costs;

      monthlyNetProfit[m] = profit;
      monthlyMarginPct[m] = sales > 0 ? (profit / sales) * 100 : 0;

      const hc = monthlyHeadcount[m] || 0;
      monthlyNetContributionPerHead[m] = hc > 0 ? profit / hc : 0;

      runningCum += profit;
      monthlyRunningBalance[m] = runningCum;

      grandNetProfit += profit;
      if (m <= reconciledCutoffMonth) {
        ytvNetProfit += profit;
      }
    });

    const overallMarginPct = teamSalesTotals.grandTotal > 0 
      ? (grandNetProfit / teamSalesTotals.grandTotal) * 100 
      : 0;

    const overallContributionPerHead = combinedDepartmentTotals.avgHeadcount > 0
      ? grandNetProfit / combinedDepartmentTotals.avgHeadcount
      : 0;

    return {
      monthlyNetProfit,
      monthlyMarginPct,
      monthlyNetContributionPerHead,
      monthlyRunningBalance,
      grandNetProfit,
      ytvNetProfit,
      overallMarginPct,
      overallContributionPerHead
    };
  }, [monthsList, teamSalesTotals, combinedDepartmentTotals, monthlyHeadcount, reconciledCutoffMonth]);

  // Total unutilized seats across all department tools (latest cutoff month)
  const unutilizedStats = useMemo(() => {
    const targetMonth = reconciledCutoffMonth || monthsList[0];
    let totalCommitted = 0;
    let totalActive = 0;
    let totalWastedCost = 0;

    toolRatchetData.forEach(t => {
      if (t.costBasis === 'per_seat') {
        const d = t.monthlyDetails[targetMonth];
        if (d) {
          totalCommitted += d.committedSeats;
          totalActive += d.activeSeats;
          totalWastedCost += d.unutilizedSeats * t.unitCostGBP;
        }
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

  // Keep baseline seats synced with start date staff count if not manually overridden
  useEffect(() => {
    if (showToolModal && !toolForm.isBaselineOverridden && toolForm.costBasis === 'per_seat') {
      setToolForm(prev => {
        if (prev.isBaselineOverridden) return prev;
        const count = calculateStaffCountAtDate(prev.contractStartDate, prev.companyIds, prev.departments);
        if (prev.baselineCommittedSeats === count) return prev;
        return {
          ...prev,
          baselineCommittedSeats: count
        };
      });
    }
  }, [showToolModal, toolForm.contractStartDate, toolForm.companyIds, toolForm.departments, toolForm.isBaselineOverridden, toolForm.costBasis, calculateStaffCountAtDate]);

  // Handle Open Tool Modal
  const handleOpenAddTool = () => {
    setEditingTool(null);
    const initialDepts = (!deptFilter.includes('all') && deptFilter.length > 0)
      ? [...deptFilter]
      : (managerDept ? [managerDept] : ['all']);
    const initialComps = (!companyFilter.includes('all') && companyFilter.length > 0)
      ? [...companyFilter]
      : ['all'];
    const startDate = `${startMonth}-01`;
    const initialStaffCount = calculateStaffCountAtDate(startDate, initialComps, initialDepts);

    setToolForm({
      name: '',
      department: initialDepts.includes('all') ? 'all' : initialDepts.join(', '),
      departments: initialDepts,
      companyId: initialComps.includes('all') ? 'all' : initialComps[0],
      companyIds: initialComps,
      costBasis: 'per_seat',
      splitMethod: 'equal',
      licenseCostPerSeat: 45,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: initialStaffCount,
      isBaselineOverridden: false,
      contractStartDate: startDate,
      renewalDate: '',
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
    const startDate = tool.contractStartDate || `${startMonth}-01`;
    const staffAtStart = calculateStaffCountAtDate(startDate, toolComps, toolDepts);
    const isOverridden = tool.isBaselineOverridden !== undefined
      ? !!tool.isBaselineOverridden
      : (tool.baselineCommittedSeats !== staffAtStart);

    setToolForm({
      id: tool.id,
      name: tool.name,
      department: toolDepts.includes('all') ? 'all' : toolDepts.join(', '),
      departments: toolDepts,
      companyId: toolComps.includes('all') ? 'all' : toolComps[0],
      companyIds: toolComps,
      costBasis: tool.costBasis || 'per_seat',
      splitMethod: tool.splitMethod || 'equal',
      licenseCostPerSeat: tool.licenseCostPerSeat,
      currency: tool.currency || 'GBP',
      billingFrequency: tool.billingFrequency || 'monthly',
      baselineCommittedSeats: tool.baselineCommittedSeats !== undefined ? tool.baselineCommittedSeats : staffAtStart,
      isBaselineOverridden: isOverridden,
      contractStartDate: startDate,
      renewalDate: tool.renewalDate || '',
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
        costBasis: toolForm.costBasis,
        splitMethod: toolForm.splitMethod,
        licenseCostPerSeat: Number(toolForm.licenseCostPerSeat) || 0,
        currency: toolForm.currency || 'GBP',
        billingFrequency: toolForm.billingFrequency,
        baselineCommittedSeats: toolForm.costBasis === 'per_seat' ? (Number(toolForm.baselineCommittedSeats) || 0) : 0,
        isBaselineOverridden: !!toolForm.isBaselineOverridden,
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

      // 1. Department Consolidated Summary & P&L Sheet
      const summaryRows = [
        ['HUMRES BUSINESS MANAGEMENT - DEPARTMENT TEAM & TOOL COSTS STATEMENT (P&L)'],
        [`Department(s): ${deptLabel}`, `Period Range: ${startMonth} to ${endMonth}`, `Exported on: ${new Date().toLocaleDateString('en-GB')}`],
        ['Direct Sales, Team Remuneration & Software Tools P&L Statement'],
        [],
        ['Metric / Account Line Item (GBP)', ...monthHeaders, 'YTV (Reconciled)', 'Period Total'],
        [
          'Active Team Headcount',
          ...monthsList.map(m => monthlyHeadcount[m] || 0),
          '—',
          Math.round(combinedDepartmentTotals.avgHeadcount) + ' (Avg)'
        ],
        [
          '➕ Team Sales & Placements Billings (Revenue)',
          ...monthsList.map(m => Math.round(teamSalesTotals.monthlySum[m] || 0)),
          Math.round(teamSalesTotals.ytvTotal),
          Math.round(teamSalesTotals.grandTotal)
        ],
        [
          '➖ 1. Staff Remuneration Paid (Ex-Reimbursements)',
          ...monthsList.map(m => Math.round(staffRemunerationTotals.monthlySum[m] || 0)),
          Math.round(staffRemunerationTotals.ytvTotal),
          Math.round(staffRemunerationTotals.grandTotal)
        ],
        [
          '➖ 2. Software & Tool Licenses (Contract Ratchet)',
          ...monthsList.map(m => Math.round(toolTotals.monthlySum[m] || 0)),
          Math.round(toolTotals.ytvTotal),
          Math.round(toolTotals.grandTotal)
        ],
        [
          'TOTAL DEPARTMENT OPERATING COSTS',
          ...monthsList.map(m => Math.round(combinedDepartmentTotals.monthlySum[m] || 0)),
          Math.round(combinedDepartmentTotals.ytvTotal),
          Math.round(combinedDepartmentTotals.grandTotal)
        ],
        [
          '🏆 DEPARTMENT NET PROFIT / CONTRIBUTION (P&L)',
          ...monthsList.map(m => Math.round(departmentPnlTotals.monthlyNetProfit[m] || 0)),
          Math.round(departmentPnlTotals.ytvNetProfit),
          Math.round(departmentPnlTotals.grandNetProfit)
        ],
        [
          'Net Margin % (Profit ÷ Sales)',
          ...monthsList.map(m => (departmentPnlTotals.monthlyMarginPct[m] || 0).toFixed(1) + '%'),
          '—',
          departmentPnlTotals.overallMarginPct.toFixed(1) + '%'
        ],
        [
          'Average Net Contribution per Consultant',
          ...monthsList.map(m => Math.round(departmentPnlTotals.monthlyNetContributionPerHead[m] || 0)),
          '—',
          Math.round(departmentPnlTotals.overallContributionPerHead)
        ],
        [
          'Average Operating Cost per Recruiter / Team Member',
          ...monthsList.map(m => Math.round(combinedDepartmentTotals.avgCostPerHead[m] || 0)),
          '—',
          Math.round(combinedDepartmentTotals.overallAvgCostPerHead)
        ],
        [
          '📈 CUMULATIVE RUNNING BALANCE (P&L)',
          ...monthsList.map(m => Math.round(departmentPnlTotals.monthlyRunningBalance[m] || 0)),
          Math.round(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit),
          Math.round(departmentPnlTotals.grandNetProfit)
        ]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Department P&L Summary');

      // 1B. Team Sales & Placements Billings Sheet
      const salesRows = [
        ['TEAM SALES & PLACEMENTS BILLINGS (CONSULTANT BREAKDOWN)'],
        [`Department(s): ${deptLabel}`, `Period: ${startMonth} to ${endMonth}`],
        [],
        ['Consultant / Recruiter', 'Job Title', 'Deals', ...monthHeaders, 'YTV Sales (£)', 'Total Sales (£)']
      ];

      filteredStaff.forEach(s => {
        const sSales = consultantSalesData[s.id] || { monthlySales: {}, grandTotal: 0, ytvTotal: 0, placementCount: 0 };
        const monthCols = monthsList.map(m => Math.round(sSales.monthlySales[m] || 0));
        salesRows.push([
          s.fullName || '',
          s.jobTitle || 'Recruiter',
          sSales.placementCount,
          ...monthCols,
          Math.round(sSales.ytvTotal),
          Math.round(sSales.grandTotal)
        ]);
      });

      const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Team Sales');

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

      if (relevantSharedStaff.length > 0) {
        staffRows.push([]);
        staffRows.push(['APPORTIONED SA SHARED COSTS & SHARED ROLES (HEADCOUNT PRO-RATA)']);
        relevantSharedStaff.forEach(s => {
          let sharedAnnualTotal = 0;
          let sharedYtvTotal = 0;
          const monthData = sharedStaffMonthlyData[s.id] || {};
          const monthCols = monthsList.map(m => {
            const val = monthData[m]?.apportionedCost || 0;
            sharedAnnualTotal += val;
            if (m <= reconciledCutoffMonth) sharedYtvTotal += val;
            return Math.round(val);
          });

          staffRows.push([
            s.fullName || '',
            s.jobTitle || 'Shared Cost',
            s.companyId === 'comp-1782789370085' ? 'SA Shared (Apportioned)' : 'Shared / Director (Apportioned)',
            ...monthCols,
            Math.round(sharedYtvTotal),
            Math.round(sharedAnnualTotal)
          ]);
        });
      }

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
        ['SOFTWARE & TOOL LICENSES (MULTI-TIER COST BASIS & RATCHET MATRIX)'],
        [`Department(s): ${deptLabel}`, `Period: ${startMonth} to ${endMonth}`],
        [],
        ['Tool Name', 'Vendor', 'Cost Basis', 'Split Method', 'Companies', 'Departments', 'Baseline Seats', 'Unit Cost (£)', ...monthHeaders.map(m => `${m} Cost`), 'YTV Cost (£)', 'Period Total (£)']
      ];

      toolRatchetData.forEach(t => {
        const monthCosts = monthsList.map(m => Math.round(t.monthlyDetails[m]?.costGBP || 0));
        const deptStr = t.toolDepts.includes('all') ? 'All Departments' : t.toolDepts.join(', ');
        const compStr = t.toolComps.includes('all')
          ? 'All Companies'
          : t.toolComps.map(cId => companies.find(c => c.id === cId)?.name || cId).join(', ');

        const costBasisLabel = t.costBasis === 'per_company' ? 'Per Company'
          : t.costBasis === 'per_department' ? 'Per Department'
          : t.costBasis === 'fixed_total' ? 'Fixed Total'
          : 'Per Seat';

        const splitMethodLabel = t.costBasis === 'fixed_total'
          ? (t.splitMethod === 'pro_rata_headcount' ? 'Pro-Rata Headcount' : 'Equal Split')
          : '—';

        toolRows.push([
          t.tool.name,
          t.tool.vendorName || '-',
          costBasisLabel,
          splitMethodLabel,
          compStr,
          deptStr,
          t.costBasis === 'per_seat' ? (t.tool.baselineCommittedSeats || 0) : '—',
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

      // Write and download
      const filename = `Department_Cost_Statement_${deptFilter.join('_')}_${startMonth}_to_${endMonth}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (onShowToast) onShowToast(`Excel report exported: ${filename}`, 'success');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      if (onShowToast) onShowToast('Failed to export Excel: ' + err.message, 'error');
    }
  };

  // Export Clean Landscape PDF Statement (Targeted Table Print)
  const handlePrintPDF = () => {
    try {
      const printWin = window.open('', '_blank');
      if (!printWin) {
        if (onShowToast) onShowToast('Please allow popups to open the PDF print preview', 'warning');
        return;
      }

      const deptLabel = deptFilter.includes('all') ? 'All Departments' : deptFilter.join(', ');
      const activeCompanyNames = companyFilter.includes('all') 
        ? 'All Companies' 
        : companyFilter.map(id => companies.find(c => c.id === id)?.name || id).join(', ');
      
      const monthHeaders = monthsList.map(m => formatMonthLabel(m));

      // Build Consultant Sales rows
      let salesRowsHtml = '';
      filteredStaff.forEach(s => {
        const sSales = consultantSalesData[s.id] || { monthlySales: {}, grandTotal: 0, ytvTotal: 0, placementCount: 0 };
        salesRowsHtml += `
          <tr class="sub-row">
            <td>${s.fullName} <span style="color:#64748b; font-size:7pt;">(${s.jobTitle || 'Recruiter'}${sSales.placementCount > 0 ? ` • ${sSales.placementCount} deals` : ''})</span></td>
            ${monthsList.map(m => `<td>${formatGBP(sSales.monthlySales[m] || 0)}</td>`).join('')}
            <td style="font-weight:600; background:#f0fdf4;">${formatGBP(sSales.ytvTotal)}</td>
            <td style="font-weight:700; color:#059669;">${formatGBP(sSales.grandTotal)}</td>
          </tr>
        `;
      });

      // Build Direct Team Remuneration rows
      let teamRowsHtml = '';
      filteredStaff.forEach(s => {
        const staffCost = staffMonthlyData[s.id] || {};
        let sTotal = 0;
        let sYtv = 0;
        const cols = monthsList.map(m => {
          const val = staffCost[m]?.total || 0;
          sTotal += val;
          if (m <= reconciledCutoffMonth) sYtv += val;
          return `<td>${formatGBP(val)}</td>`;
        }).join('');

        teamRowsHtml += `
          <tr class="sub-row">
            <td>${s.fullName} <span style="color:#64748b; font-size:7pt;">(${s.jobTitle || 'Recruiter'})</span></td>
            ${cols}
            <td style="font-weight:600; background:#f8fafc;">${formatGBP(sYtv)}</td>
            <td style="font-weight:700;">${formatGBP(sTotal)}</td>
          </tr>
        `;
      });

      // Build Shared Staff rows
      let sharedRowsHtml = '';
      if (relevantSharedStaff.length > 0) {
        sharedRowsHtml += `
          <tr class="sub-hdr">
            <td colspan="${monthsList.length + 3}" style="padding-left:14px; font-weight:700; color:#475569; font-size:7.5pt; background:#f1f5f9;">
              ↳ Apportioned SA Shared Roles & Shared Direction (Headcount Pro-Rata)
            </td>
          </tr>
        `;
        relevantSharedStaff.forEach(s => {
          const sData = sharedStaffMonthlyData[s.id] || {};
          let sTotal = 0;
          let sYtv = 0;
          const cols = monthsList.map(m => {
            const val = sData[m]?.apportionedCost || 0;
            sTotal += val;
            if (m <= reconciledCutoffMonth) sYtv += val;
            return `<td>${formatGBP(val)}</td>`;
          }).join('');

          sharedRowsHtml += `
            <tr class="sub-row" style="color:#4338ca;">
              <td>${s.fullName} <span style="font-size:7pt;">(${sData[reconciledCutoffMonth || monthsList[0]]?.roleBadge || 'Shared'})</span></td>
              ${cols}
              <td style="font-weight:600; background:#f8fafc;">${formatGBP(sYtv)}</td>
              <td style="font-weight:700;">${formatGBP(sTotal)}</td>
            </tr>
          `;
        });
      }

      // Build Tool rows
      let toolRowsHtml = '';
      toolRatchetData.forEach(({ tool: t, costBasis, monthlyDetails, ytvCost, periodTotalCost }) => {
        const cols = monthsList.map(m => {
          const val = monthlyDetails[m]?.costGBP || 0;
          return `<td>${formatGBP(val)}</td>`;
        }).join('');

        const basisLabel = costBasis === 'per_seat' ? 'Per-Seat'
          : costBasis === 'per_company' ? 'Per Company'
          : costBasis === 'per_department' ? 'Per Dept'
          : 'Fixed';

        toolRowsHtml += `
          <tr class="sub-row">
            <td>${t.name} <span style="color:#64748b; font-size:7pt;">(${basisLabel})</span></td>
            ${cols}
            <td style="font-weight:600; background:#f8fafc;">${formatGBP(ytvCost)}</td>
            <td style="font-weight:700;">${formatGBP(periodTotalCost)}</td>
          </tr>
        `;
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Department P&L Statement - ${deptLabel}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 6mm 6mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              padding: 10px;
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              background: #f8fafc;
              padding: 8px 12px;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .print-btn {
              background-color: #059669;
              color: white;
              border: none;
              padding: 8px 18px;
              font-size: 13px;
              font-weight: 700;
              border-radius: 6px;
              cursor: pointer;
            }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; margin: 0 !important; }
            }
            .pnl-header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .pnl-title h1 {
              margin: 0 0 4px 0;
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
            }
            .pnl-title .meta {
              font-size: 9.5px;
              color: #475569;
              display: flex;
              gap: 12px;
            }
            .pnl-kpi-ribbon {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 6px;
              margin-bottom: 8px;
            }
            .kpi-box {
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 5px 8px;
              background-color: #f8fafc;
            }
            .kpi-box .lbl {
              font-size: 7.5pt;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .kpi-box .val {
              font-size: 11pt;
              font-weight: 800;
              font-family: monospace;
              color: #0f172a;
              margin-top: 1px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 7.5pt;
              table-layout: fixed;
            }
            th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: 700;
              padding: 4px 2px;
              border: 1px solid #cbd5e1;
              text-align: right;
              font-size: 7.5pt;
            }
            th:first-child {
              text-align: left;
              width: 25%;
              padding-left: 6px;
            }
            td {
              padding: 3px 2px;
              border: 1px solid #e2e8f0;
              font-size: 7.5pt;
              text-align: right;
              font-family: monospace;
            }
            td:first-child {
              text-align: left;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding-left: 6px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .section-hdr {
              background-color: #f8fafc;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-size: 7pt;
              border-top: 1.5px solid #0f172a;
            }
            .row-summary {
              font-weight: 700;
              background-color: #f8fafc;
            }
            .row-pnl {
              background-color: ${departmentPnlTotals.grandNetProfit >= 0 ? '#ecfdf5' : '#fef2f2'};
              font-weight: 800;
              font-size: 8.5pt;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
            }
            .sub-row {
              font-size: 7pt;
              color: #334155;
            }
            .sub-row td:first-child {
              padding-left: 14px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <span style="font-size:12px; font-weight:600; color:#334155;">
              🖨️ PDF Print Preview: Department Team & Tool Costs P&L (${deptLabel})
            </span>
            <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
          </div>

          <div class="pnl-header">
            <div class="pnl-title">
              <h1>${activeCompanyNames} • ${deptLabel} P&L Statement</h1>
              <div class="meta">
                <span><strong>Period:</strong> ${startMonth} to ${endMonth}</span>
                <span><strong>Reconciled Cutoff:</strong> ${reconciledCutoffMonth}</span>
                <span><strong>Statement Type:</strong> Direct Team & Tools P&L</span>
                <span><strong>Exported:</strong> ${new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </div>

          <div class="pnl-kpi-ribbon">
            <div class="kpi-box">
              <div class="lbl">Active Team Headcount</div>
              <div class="val">${Math.round(combinedDepartmentTotals.avgHeadcount)} avg</div>
            </div>
            <div class="kpi-box" style="border-color:#10b981; background:#f0fdf4;">
              <div class="lbl" style="color:#059669;">Team Sales (Billings)</div>
              <div class="val" style="color:#059669;">${formatGBP(teamSalesTotals.grandTotal)}</div>
            </div>
            <div class="kpi-box">
              <div class="lbl">Total Operating Costs</div>
              <div class="val">${formatGBP(combinedDepartmentTotals.grandTotal)}</div>
            </div>
            <div class="kpi-box" style="border-color:${departmentPnlTotals.grandNetProfit >= 0 ? '#10b981' : '#ef4444'}; background:${departmentPnlTotals.grandNetProfit >= 0 ? '#f0fdf4' : '#fef2f2'};">
              <div class="lbl" style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'};">Net Profit / Contribution</div>
              <div class="val" style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'};">
                ${departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}${formatGBP(departmentPnlTotals.grandNetProfit)}
              </div>
            </div>
            <div class="kpi-box">
              <div class="lbl">Net Margin %</div>
              <div class="val" style="color:${departmentPnlTotals.overallMarginPct >= 0 ? '#059669' : '#dc2626'};">
                ${departmentPnlTotals.overallMarginPct.toFixed(1)}%
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Account Line Item (GBP)</th>
                ${monthHeaders.map(mh => `<th>${mh}</th>`).join('')}
                <th style="background:#e0e7ff;">YTV</th>
                <th style="background:#f1f5f9;">Period Total</th>
              </tr>
            </thead>
            <tbody>
              <!-- Section 0: Team Sales -->
              <tr class="section-hdr" style="color:#059669; background:#f0fdf4;">
                <td colspan="${monthsList.length + 3}">0. Team Sales & Placements Billings (Revenue)</td>
              </tr>
              <tr class="row-summary" style="color:#059669; background:#f0fdf4;">
                <td>Team Placements Billings</td>
                ${monthsList.map(m => `<td>${formatGBP(teamSalesTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td style="font-weight:700;">${formatGBP(teamSalesTotals.ytvTotal)}</td>
                <td style="font-weight:800;">${formatGBP(teamSalesTotals.grandTotal)}</td>
              </tr>
              ${salesRowsHtml}

              <!-- Section 1: Team Remuneration -->
              <tr class="section-hdr">
                <td colspan="${monthsList.length + 3}">1. Team Remuneration (Salaries, Freelance & Commissions)</td>
              </tr>
              <tr class="row-summary">
                <td>Apportioned Team Remuneration</td>
                ${monthsList.map(m => `<td>${formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td style="font-weight:700;">${formatGBP(staffRemunerationTotals.ytvTotal)}</td>
                <td style="font-weight:800;">${formatGBP(staffRemunerationTotals.grandTotal)}</td>
              </tr>
              ${teamRowsHtml}
              ${sharedRowsHtml}

              <!-- Section 2: Software Tools -->
              <tr class="section-hdr">
                <td colspan="${monthsList.length + 3}">2. Software Licenses & CRM Systems (Ratchet Engine)</td>
              </tr>
              <tr class="row-summary">
                <td>Contracted Software & Tool Licenses</td>
                ${monthsList.map(m => `<td>${formatGBP(toolTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td style="font-weight:700;">${formatGBP(toolTotals.ytvTotal)}</td>
                <td style="font-weight:800;">${formatGBP(toolTotals.grandTotal)}</td>
              </tr>
              ${toolRowsHtml}

              <!-- Section 3: Consolidated Summary & P&L Statement -->
              <tr class="section-hdr" style="border-top:2px solid #0f172a; font-size:7.5pt;">
                <td colspan="${monthsList.length + 3}">3. Consolidated Department Summary & Team P&L Statement</td>
              </tr>
              <tr style="font-weight:700; color:#059669; background:#f0fdf4;">
                <td>➕ Team Sales & Placements Billings</td>
                ${monthsList.map(m => `<td>${formatGBP(teamSalesTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td>${formatGBP(teamSalesTotals.ytvTotal)}</td>
                <td>${formatGBP(teamSalesTotals.grandTotal)}</td>
              </tr>
              <tr style="font-weight:600;">
                <td>➖ 1. Team Remuneration (Salaries & Commissions)</td>
                ${monthsList.map(m => `<td>${formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td>${formatGBP(staffRemunerationTotals.ytvTotal)}</td>
                <td>${formatGBP(staffRemunerationTotals.grandTotal)}</td>
              </tr>
              <tr style="font-weight:600;">
                <td>➖ 2. Contracted Software & Tool Licenses</td>
                ${monthsList.map(m => `<td>${formatGBP(toolTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td>${formatGBP(toolTotals.ytvTotal)}</td>
                <td>${formatGBP(toolTotals.grandTotal)}</td>
              </tr>
              <tr style="font-weight:800; background:#f8fafc; border-top:1.5px solid #0f172a;">
                <td>TOTAL DEPARTMENT OPERATING COSTS</td>
                ${monthsList.map(m => `<td>${formatGBP(combinedDepartmentTotals.monthlySum[m] || 0)}</td>`).join('')}
                <td>${formatGBP(combinedDepartmentTotals.ytvTotal)}</td>
                <td style="font-size:8.5pt;">${formatGBP(combinedDepartmentTotals.grandTotal)}</td>
              </tr>
              <tr class="row-pnl">
                <td style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'};">
                  🏆 DEPARTMENT NET PROFIT / CONTRIBUTION (P&L)
                </td>
                ${monthsList.map(m => {
                  const p = departmentPnlTotals.monthlyNetProfit[m] || 0;
                  return `<td style="color:${p >= 0 ? '#059669' : '#dc2626'};">${p >= 0 ? '+' : ''}${formatGBP(p)}</td>`;
                }).join('')}
                <td style="color:${departmentPnlTotals.ytvNetProfit >= 0 ? '#059669' : '#dc2626'};">
                  ${departmentPnlTotals.ytvNetProfit >= 0 ? '+' : ''}${formatGBP(departmentPnlTotals.ytvNetProfit)}
                </td>
                <td style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'}; font-size:9.5pt;">
                  ${departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}${formatGBP(departmentPnlTotals.grandNetProfit)}
                </td>
              </tr>
              <tr style="font-weight:600; font-size:7pt; color:#475569;">
                <td>Net Margin % (Profit ÷ Sales)</td>
                ${monthsList.map(m => `<td>${(departmentPnlTotals.monthlyMarginPct[m] || 0).toFixed(1)}%</td>`).join('')}
                <td>—</td>
                <td style="font-weight:700;">${departmentPnlTotals.overallMarginPct.toFixed(1)}%</td>
              </tr>
              <tr style="font-size:7pt; color:#475569;">
                <td>Average Net Contribution per Consultant</td>
                ${monthsList.map(m => `<td>${formatGBP(departmentPnlTotals.monthlyNetContributionPerHead[m] || 0)}</td>`).join('')}
                <td>—</td>
                <td style="font-weight:700;">${formatGBP(departmentPnlTotals.overallContributionPerHead)}</td>
              </tr>
              <tr style="font-size:7pt; color:#64748b;">
                <td>Average Operating Cost per Recruiter / Head</td>
                ${monthsList.map(m => `<td>${formatGBP(combinedDepartmentTotals.avgCostPerHead[m] || 0)}</td>`).join('')}
                <td>—</td>
                <td>${formatGBP(combinedDepartmentTotals.overallAvgCostPerHead)}</td>
              </tr>
              <!-- Concluding Row: Cumulative Running Balance of P&L -->
              <tr style="background:#f1f5f9; font-weight:800; font-size:8pt; border-top:1.5px solid #0f172a; border-bottom:2px solid #0f172a;">
                <td style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'};">
                  📈 CUMULATIVE RUNNING BALANCE (P&L)
                </td>
                ${monthsList.map(m => {
                  const cum = departmentPnlTotals.monthlyRunningBalance[m] || 0;
                  return `<td style="color:${cum >= 0 ? '#059669' : '#dc2626'};">${cum >= 0 ? '+' : ''}${formatGBP(cum)}</td>`;
                }).join('')}
                <td style="color:${(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit) >= 0 ? '#059669' : '#dc2626'}; font-weight:800;">
                  ${(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit) >= 0 ? '+' : ''}${formatGBP(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit)}
                </td>
                <td style="color:${departmentPnlTotals.grandNetProfit >= 0 ? '#059669' : '#dc2626'}; font-weight:900; font-size:9.5pt;">
                  ${departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}${formatGBP(departmentPnlTotals.grandNetProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 400);
    } catch (err: any) {
      console.error('Error generating PDF print preview:', err);
      if (onShowToast) onShowToast('Failed to generate PDF: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Print-specific stylesheet for browser Cmd+P fallback */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm 6mm;
          }
          nav, header, .app-sidebar, .sidebar, .header-actions, .filter-toolbar, button {
            display: none !important;
          }
          body, #root, main, .main-content {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .table-container {
            overflow: visible !important;
            border: none !important;
          }
          table {
            width: 100% !important;
            min-width: 100% !important;
            font-size: 8pt !important;
          }
          th, td {
            padding: 3px 2px !important;
          }
        }
      `}</style>

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
              Direct Team & Tools P&L
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
            title="Export department statement, team roster, and software tools to Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} /> Export to Excel
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
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
            title="Export clean, publication-ready landscape PDF statement of this department table"
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
          gap: '14px' 
        }}>
          {/* Card 0A: Team Sales / Placements Billings */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>TEAM SALES (BILLINGS)</span>
              <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', fontFamily: 'monospace' }}>
              {formatGBP(teamSalesTotals.grandTotal)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Direct deals by {filteredStaff.length} consultants ({startMonth} - {endMonth})
            </div>
          </div>

          {/* Card 0B: Department Net Contribution / Profit (P&L) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid ${departmentPnlTotals.grandNetProfit >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444' }}>
                NET CONTRIBUTION (P&L)
              </span>
              <DollarSign size={16} style={{ color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444' }} />
            </div>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 800, 
              color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444', 
              fontFamily: 'monospace' 
            }}>
              {departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.grandNetProfit)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Net margin: {departmentPnlTotals.overallMarginPct.toFixed(1)}%
            </div>
          </div>

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
              Remuneration + Software Tools
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

          {/* Card 4: Cumulative Running Balance (P&L) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid ${departmentPnlTotals.grandNetProfit >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444' }}>
                RUNNING BALANCE (P&L)
              </span>
              <TrendingUp size={16} style={{ color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444' }} />
            </div>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 800, 
              color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444', 
              fontFamily: 'monospace' 
            }}>
              {departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.grandNetProfit)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              YTV Reconciled: {departmentPnlTotals.ytvNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.ytvNetProfit)}
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
          <strong>Department P&L Alignment:</strong> This statement tracks <em>Team Sales & Placements Billings</em> against direct operating costs (<em>Actual Team Remuneration</em> excluding reimbursable overheads and <em>Software Tool Licenses</em> with upward seat ratchets), providing a clear monthly running balance of departmental P&L.
        </div>
      </div>

      {/* ==============================================================
          MAIN P&L MATRIX TABLE
          ============================================================== */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <table className="entity-table dense" style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11.5px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 3, minWidth: '220px', width: '22%' }}>
                Department Account Line Item (GBP)
              </th>
              {monthsList.map(m => (
                <th key={m} style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, fontSize: '11px', minWidth: '65px' }}>
                  {formatMonthLabel(m)}
                </th>
              ))}
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, fontSize: '11px', backgroundColor: 'rgba(99, 102, 241, 0.08)', minWidth: '85px' }}>
                YTV
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, fontSize: '11px', backgroundColor: 'var(--bg-secondary)', minWidth: '88px' }}>
                Period Total
              </th>
            </tr>
          </thead>
          <tbody>

            {/* ==========================================================
                SECTION 0: TEAM SALES & PLACEMENTS BILLINGS (REVENUE)
                ========================================================== */}
            <tr className="section-header" style={{ backgroundColor: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
              <td 
                colSpan={monthsList.length + 3} 
                style={{ 
                  padding: '8px 14px', 
                  fontWeight: 800, 
                  fontSize: '12px', 
                  color: 'var(--success)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)'
                }}
              >
                0. Team Sales & Placements Billings (Revenue)
              </td>
            </tr>

            {/* Main Collapsible Sales Row */}
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
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
                onClick={() => setExpandedSales(!expandedSales)}
              >
                <span style={{ fontSize: '11px', color: 'var(--success)' }}>
                  {expandedSales ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--success)' }}>
                  Team Placements Billings (Sales Revenue)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  ({filteredStaff.length} consultants • Click to {expandedSales ? 'collapse' : 'expand'})
                </span>
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>
                  {formatGBP(teamSalesTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                {formatGBP(teamSalesTotals.ytvTotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--success)', fontSize: '13px' }}>
                {formatGBP(teamSalesTotals.grandTotal)}
              </td>
            </tr>

            {/* Consultant Sales Breakdown Rows */}
            {expandedSales && (
              <>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={monthsList.length + 3} style={{ padding: '12px 24px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      No consultants found for the selected department filter.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(s => {
                    const sSales = consultantSalesData[s.id] || { monthlySales: {}, grandTotal: 0, ytvTotal: 0, placementCount: 0 };
                    return (
                      <tr key={`sales-${s.id}`} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)', opacity: sSales.grandTotal === 0 ? 0.6 : 1 }}>
                        <td style={{ padding: '8px 14px 8px 32px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>({s.jobTitle || 'Recruiter'})</span>
                            {sSales.placementCount > 0 && (
                              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', fontWeight: 600 }}>
                                {sSales.placementCount} deals
                              </span>
                            )}
                          </div>
                        </td>
                        {monthsList.map(m => (
                          <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace', color: (sSales.monthlySales[m] || 0) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {formatGBP(sSales.monthlySales[m] || 0)}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(16, 185, 129, 0.05)', fontWeight: 600 }}>
                          {formatGBP(sSales.ytvTotal)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: sSales.grandTotal > 0 ? 'var(--success)' : 'inherit' }}>
                          {formatGBP(sSales.grandTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </>
            )}

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
                  ({filteredStaff.length} direct team members{relevantSharedStaff.length > 0 ? ` + ${relevantSharedStaff.length} apportioned shared roles` : ''} • Ex-Reimbursements)
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
                {filteredStaff.length === 0 && relevantSharedStaff.length === 0 ? (
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

                {/* Apportioned Shared Roles & Directors Subsection */}
                {relevantSharedStaff.length > 0 && (
                  <>
                    <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}>
                      <td colSpan={monthsList.length + 3} style={{ padding: '6px 20px', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Apportioned SA Shared Costs &amp; Shared Roles (Headcount Split)
                      </td>
                    </tr>

                    {relevantSharedStaff.map(s => {
                      let sharedRowTotal = 0;
                      let sharedYtvTotal = 0;
                      const monthData = sharedStaffMonthlyData[s.id] || {};

                      return (
                        <tr 
                          key={s.id} 
                          style={{ 
                            fontSize: '11px', 
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(99, 102, 241, 0.015)'
                          }}
                        >
                          <td style={{ 
                            paddingLeft: '36px', 
                            position: 'sticky', 
                            left: 0, 
                            backgroundColor: 'var(--bg-primary)', 
                            zIndex: 1 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--accent)' }}>↳</span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</span>
                              <span style={{
                                fontSize: '9px',
                                backgroundColor: s.companyId === 'comp-1782789370085' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                                color: s.companyId === 'comp-1782789370085' ? 'var(--success)' : 'var(--accent)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                {s.companyId === 'comp-1782789370085' ? '🌍 SA Shared' : (s.jobTitle?.toLowerCase().includes('director') || s.jobTitle?.toLowerCase().includes('consulting')) ? '👑 Consulting Director' : '🤝 Shared Salary'}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                                — {s.jobTitle || 'Shared Cost'}
                              </span>
                            </div>
                          </td>
                          {monthsList.map(m => {
                            const d = monthData[m];
                            const val = d?.apportionedCost || 0;
                            sharedRowTotal += val;
                            if (m <= reconciledCutoffMonth) sharedYtvTotal += val;

                            return (
                              <td 
                                key={m} 
                                style={{ 
                                  textAlign: 'right', 
                                  fontFamily: 'monospace', 
                                  opacity: val > 0 ? 1 : 0.4 
                                }}
                                title={`Shared Role: ${s.fullName}\nMonth: ${m}\n• Full Monthly Cost: ${formatGBPExact(d?.fullCost || 0)}\n• Team Apportionment: ${d?.subtext || '—'}\n• Apportioned Cost to Dept: ${formatGBPExact(val)}`}
                              >
                                <div>{val > 0 ? formatGBP(val) : '—'}</div>
                                {val > 0 && (
                                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                    {d?.subtext}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
                            {sharedYtvTotal > 0 ? formatGBP(sharedYtvTotal) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatGBP(sharedRowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToolSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  }}
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600
                  }}
                  title="Click to toggle alphabetical sort order (A-Z / Z-A)"
                >
                  🔤 {toolSortOrder === 'asc' ? 'Sort: A → Z' : 'Sort: Z → A'}
                </button>
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
                  toolRatchetData.map(({ tool, costBasis, splitMethod, toolDepts, toolComps, unitCostGBP, monthlyDetails, periodTotalCost, ytvCost }) => {
                    const effectiveBasis = costBasis || 'per_seat';
                    return (
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

                            {/* Cost Basis Badge */}
                            {effectiveBasis === 'per_seat' && (
                              <span style={{
                                fontSize: '9px',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: 'var(--accent)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                👤 Per Seat
                              </span>
                            )}
                            {effectiveBasis === 'per_company' && (
                              <span style={{
                                fontSize: '9px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: 'var(--success)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                🏢 Per Company
                              </span>
                            )}
                            {effectiveBasis === 'per_department' && (
                              <span style={{
                                fontSize: '9px',
                                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                                color: '#4f46e5',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                📁 Per Dept
                              </span>
                            )}
                            {effectiveBasis === 'fixed_total' && (
                              <span style={{
                                fontSize: '9px',
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#d97706',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                ⚖️ Fixed Total ({splitMethod === 'pro_rata_headcount' ? 'Headcount Pro-Rata' : 'Equal Split'})
                              </span>
                            )}

                            {/* Department Scope Badge */}
                            <span style={{
                              fontSize: '9px',
                              backgroundColor: 'rgba(107, 114, 128, 0.12)',
                              color: 'var(--text-secondary)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {toolDepts.includes('all')
                                ? 'All Depts'
                                : (() => {
                                    let totalDepts = 0;
                                    const targetComps = toolComps.includes('all') ? companies.map(c => c.id) : toolComps;
                                    targetComps.forEach(compId => {
                                      const compDepts = companyDepartmentsMap[compId] || [];
                                      const compEff = toolDepts.includes('all') ? compDepts : compDepts.filter(d => toolDepts.includes(d));
                                      totalDepts += compEff.length;
                                    });
                                    const count = totalDepts || toolDepts.length;
                                    return count === 1 ? toolDepts[0] : `${count} depts (${toolDepts.join(', ')})`;
                                  })()}
                            </span>

                            {/* Company Scope Badge */}
                            <span style={{
                              fontSize: '9px',
                              backgroundColor: 'rgba(107, 114, 128, 0.12)',
                              color: 'var(--text-secondary)',
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

                            {/* Rate Subtitle */}
                            <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                              {effectiveBasis === 'per_seat' && `(${tool.baselineCommittedSeats || 0} seats baseline @ ${formatGBPExact(unitCostGBP)}/seat)`}
                              {effectiveBasis === 'per_company' && `(${formatGBPExact(unitCostGBP)}/company/mo)`}
                              {effectiveBasis === 'per_department' && `(${formatGBPExact(unitCostGBP)}/dept/mo)`}
                              {effectiveBasis === 'fixed_total' && `(${formatGBPExact(unitCostGBP)}/mo fixed)`}
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

                        const hasUnutilized = effectiveBasis === 'per_seat' && d.unutilizedSeats > 0;
                        return (
                          <td 
                            key={m} 
                            style={{ 
                              textAlign: 'right', 
                              fontFamily: 'monospace',
                              padding: '8px 8px'
                            }}
                            title={`Tool: ${tool.name}\nMonth: ${m}\n• Pricing Basis: ${effectiveBasis}\n• Monthly Cost: ${formatGBPExact(d.costGBP)}${effectiveBasis === 'per_seat' ? `\n• Committed: ${d.committedSeats} seats\n• Active: ${d.activeSeats}\n• Unutilized: ${d.unutilizedSeats} spare seats` : ''}`}
                          >
                            <div>{formatGBP(d.costGBP)}</div>
                            <div style={{ 
                              fontSize: '9px', 
                              color: hasUnutilized ? '#f59e0b' : 'var(--text-muted)',
                              fontWeight: hasUnutilized ? 600 : 400 
                            }}>
                              {d.subtext || (effectiveBasis === 'per_seat' ? `${d.committedSeats} seats` : '')}
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
                  );
                })
                )}
              </>
            )}

            {/* ==========================================================
                SECTION 3: CONSOLIDATED DEPARTMENT SUMMARY & TEAM P&L
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
                3. Consolidated Department Summary & Team P&L Statement
              </td>
            </tr>

            {/* Row: Team Sales / Billings Revenue */}
            <tr style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, fontWeight: 700, color: 'var(--success)' }}>
                ➕ Team Sales & Placements Billings (Revenue)
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--success)' }}>
                  {formatGBP(teamSalesTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', backgroundColor: 'rgba(16, 185, 129, 0.1)', fontWeight: 700, color: 'var(--success)' }}>
                {formatGBP(teamSalesTotals.ytvTotal)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--success)' }}>
                {formatGBP(teamSalesTotals.grandTotal)}
              </td>
            </tr>

            {/* Row: Team Remuneration Summary */}
            <tr style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, fontWeight: 600 }}>
                ➖ 1. Team Remuneration (Salaries, Freelance & Commissions)
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
                ➖ 2. Contracted Software & Tool Licenses
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

            {/* Grand Total Operating Cost Row */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 800, borderTop: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
              <td style={{ padding: '10px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2, color: 'var(--text-primary)' }}>
                TOTAL DEPARTMENT OPERATING COSTS (Team + Tools)
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {formatGBP(combinedDepartmentTotals.monthlySum[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                {formatGBP(combinedDepartmentTotals.ytvTotal)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '14px' }}>
                {formatGBP(combinedDepartmentTotals.grandTotal)}
              </td>
            </tr>

            {/* Department Net Profit / Contribution Row (P&L) */}
            <tr style={{ 
              backgroundColor: departmentPnlTotals.grandNetProfit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              fontWeight: 800, 
              borderBottom: '1px solid var(--border-color)', 
              fontSize: '13px' 
            }}>
              <td style={{ 
                padding: '12px 14px', 
                position: 'sticky', 
                left: 0, 
                backgroundColor: departmentPnlTotals.grandNetProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                zIndex: 2, 
                color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏆 DEPARTMENT NET PROFIT / CONTRIBUTION (P&L)</span>
                </div>
              </td>
              {monthsList.map(m => {
                const profit = departmentPnlTotals.monthlyNetProfit[m] || 0;
                return (
                  <td key={m} style={{ 
                    padding: '12px 8px', 
                    textAlign: 'right', 
                    fontFamily: 'monospace', 
                    color: profit >= 0 ? 'var(--success)' : '#ef4444',
                    fontWeight: 800 
                  }}>
                    {profit >= 0 ? '+' : ''}{formatGBP(profit)}
                  </td>
                );
              })}
              <td style={{ 
                padding: '12px 12px', 
                textAlign: 'right', 
                fontFamily: 'monospace', 
                color: departmentPnlTotals.ytvNetProfit >= 0 ? 'var(--success)' : '#ef4444', 
                fontWeight: 800,
                backgroundColor: departmentPnlTotals.ytvNetProfit >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' 
              }}>
                {departmentPnlTotals.ytvNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.ytvNetProfit)}
              </td>
              <td style={{ 
                padding: '12px 12px', 
                textAlign: 'right', 
                fontFamily: 'monospace', 
                color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444', 
                fontSize: '15px',
                fontWeight: 900 
              }}>
                {departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.grandNetProfit)}
              </td>
            </tr>

            {/* Net Margin % Row */}
            <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)', fontSize: '11px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Net Margin % (Profit ÷ Sales)
              </td>
              {monthsList.map(m => {
                const margin = departmentPnlTotals.monthlyMarginPct[m] || 0;
                return (
                  <td key={m} style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: margin >= 0 ? 'var(--success)' : '#ef4444', fontWeight: 600 }}>
                    {margin !== 0 ? `${margin.toFixed(1)}%` : '—'}
                  </td>
                );
              })}
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                —
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: departmentPnlTotals.overallMarginPct >= 0 ? 'var(--success)' : '#ef4444', fontWeight: 700 }}>
                {departmentPnlTotals.overallMarginPct.toFixed(1)}%
              </td>
            </tr>

            {/* Average Net Contribution Per Head Row */}
            <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.04)', fontSize: '11px', borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Average Net Contribution per Consultant
              </td>
              {monthsList.map(m => (
                <td key={m} style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: (departmentPnlTotals.monthlyNetContributionPerHead[m] || 0) >= 0 ? 'var(--success)' : '#ef4444' }}>
                  {formatGBP(departmentPnlTotals.monthlyNetContributionPerHead[m] || 0)}
                </td>
              ))}
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                —
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: departmentPnlTotals.overallContributionPerHead >= 0 ? 'var(--success)' : '#ef4444', fontWeight: 700 }}>
                {formatGBP(departmentPnlTotals.overallContributionPerHead)}
              </td>
            </tr>

            {/* Average Cost Per Head Row */}
            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)', fontSize: '11px', borderBottom: '1px solid var(--border-color)' }}>
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

            {/* Cumulative Running Balance (P&L) Row - Concluding Bottom Row */}
            <tr style={{ 
              backgroundColor: 'rgba(99, 102, 241, 0.12)', 
              fontWeight: 800, 
              borderTop: '2px solid var(--border-color)',
              borderBottom: '2px solid var(--border-color)', 
              fontSize: '13px' 
            }}>
              <td style={{ 
                padding: '12px 14px', 
                position: 'sticky', 
                left: 0, 
                backgroundColor: 'rgba(99, 102, 241, 0.18)', 
                zIndex: 2, 
                color: 'var(--accent)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📈 CUMULATIVE RUNNING BALANCE (P&L)</span>
                </div>
              </td>
              {monthsList.map(m => {
                const bal = departmentPnlTotals.monthlyRunningBalance[m] || 0;
                return (
                  <td key={m} style={{ 
                    padding: '12px 8px', 
                    textAlign: 'right', 
                    fontFamily: 'monospace', 
                    color: bal >= 0 ? 'var(--success)' : '#ef4444',
                    fontWeight: 800 
                  }}>
                    {bal >= 0 ? '+' : ''}{formatGBP(bal)}
                  </td>
                );
              })}
              <td style={{ 
                padding: '12px 12px', 
                textAlign: 'right', 
                fontFamily: 'monospace', 
                color: (departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit) >= 0 ? 'var(--success)' : '#ef4444', 
                fontWeight: 800,
                backgroundColor: 'rgba(99, 102, 241, 0.22)' 
              }}>
                {(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit) >= 0 ? '+' : ''}
                {formatGBP(departmentPnlTotals.monthlyRunningBalance[reconciledCutoffMonth] ?? departmentPnlTotals.ytvNetProfit)}
              </td>
              <td style={{ 
                padding: '12px 12px', 
                textAlign: 'right', 
                fontFamily: 'monospace', 
                color: departmentPnlTotals.grandNetProfit >= 0 ? 'var(--success)' : '#ef4444', 
                fontSize: '15px',
                fontWeight: 900 
              }}>
                {departmentPnlTotals.grandNetProfit >= 0 ? '+' : ''}{formatGBP(departmentPnlTotals.grandNetProfit)}
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

              {/* Billing & Cost Basis Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Billing &amp; Cost Basis *
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                  gap: '8px'
                }}>
                  {[
                    {
                      id: 'per_seat' as ToolCostBasis,
                      icon: '👤',
                      title: 'Per Seat / User',
                      desc: 'Scales with active headcount ratchet & committed baseline'
                    },
                    {
                      id: 'per_company' as ToolCostBasis,
                      icon: '🏢',
                      title: 'Per Company',
                      desc: 'Fixed monthly fee per assigned company entity'
                    },
                    {
                      id: 'per_department' as ToolCostBasis,
                      icon: '📁',
                      title: 'Per Department',
                      desc: 'Fixed monthly fee per assigned department'
                    },
                    {
                      id: 'fixed_total' as ToolCostBasis,
                      icon: '⚖️',
                      title: 'Shared Total Fee',
                      desc: 'Single lump-sum fee apportioned across teams'
                    }
                  ].map(option => {
                    const isSelected = toolForm.costBasis === option.id;
                    return (
                      <div
                        key={option.id}
                        onClick={() => setToolForm(prev => ({ ...prev, costBasis: option.id }))}
                        style={{
                          border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '14px' }}>{option.icon}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {option.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                          {option.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shared Total Split Method (when fixed_total is selected) */}
              {toolForm.costBasis === 'fixed_total' && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚖️ Allocation / Split Method *</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="splitMethod"
                        value="equal"
                        checked={toolForm.splitMethod === 'equal'}
                        onChange={() => setToolForm(prev => ({ ...prev, splitMethod: 'equal' }))}
                      />
                      <span>Equal Split across Assigned Departments</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="splitMethod"
                        value="pro_rata_headcount"
                        checked={toolForm.splitMethod === 'pro_rata_headcount'}
                        onChange={() => setToolForm(prev => ({ ...prev, splitMethod: 'pro_rata_headcount' }))}
                      />
                      <span>Pro-Rata by Active Team Headcount</span>
                    </label>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    When filtering report views by specific companies or departments, the fixed fee will be apportioned accordingly.
                  </span>
                </div>
              )}

              {/* Hierarchical Company & Department Tree Dropdown */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={13} style={{ color: 'var(--accent)' }} />
                    <span>Company &amp; Department Scope Dropdown *</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    (Dropdown with companies &amp; departments under each company)
                  </span>
                </div>
                <CompanyDeptTreeFilter
                  companies={companies}
                  staff={staff}
                  selectedCompanyIds={toolForm.companyIds}
                  selectedDepartments={toolForm.departments}
                  onChange={({ companyIds, departments }: { companyIds: string[]; departments: string[] }) => {
                    setToolForm(prev => {
                      const count = calculateStaffCountAtDate(prev.contractStartDate, companyIds, departments);
                      return {
                        ...prev,
                        companyIds,
                        departments,
                        companyId: companyIds.includes('all') ? 'all' : (companyIds[0] || 'all'),
                        department: departments.includes('all') ? 'all' : departments.join(', '),
                        baselineCommittedSeats: prev.isBaselineOverridden ? prev.baselineCommittedSeats : count
                      };
                    });
                  }}
                  style={{ width: '100%' }}
                  dropdownWidth="100%"
                  placeholder="Select Companies & Departments from Dropdown"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Click the dropdown above to expand any company with the arrow and select the exact departments under that company.
                </span>
              </div>

              {/* Multi-Company Selector Pills */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Company Scope Pills
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

              {/* Multi-Department Selector with Company Dropdown Filter */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Department Scope Pills
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Dropdown to filter departments under a specific company */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Under Company:</span>
                      <select
                        value={deptScopeCompanyFilter}
                        onChange={(e) => setDeptScopeCompanyFilter(e.target.value)}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="all">All Companies</option>
                        {companies.map(c => {
                          const cDepts = companyDepartmentsMap[c.id] || [];
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} ({cDepts.length} depts)
                            </option>
                          );
                        })}
                      </select>
                    </div>

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
                  {displayedDepartments.map(d => {
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
                    : `Applies to ${toolFormDeptCount} selected department${toolFormDeptCount === 1 ? '' : 's'}`}
                  {deptScopeCompanyFilter !== 'all' && (
                    <span style={{ marginLeft: '6px', color: 'var(--accent)', fontWeight: 600 }}>
                      (Filtered to {companies.find(c => c.id === deptScopeCompanyFilter)?.name})
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {toolForm.costBasis === 'per_seat' && 'Cost Per Seat (Monthly) *'}
                    {toolForm.costBasis === 'per_company' && 'Monthly Rate per Company *'}
                    {toolForm.costBasis === 'per_department' && 'Monthly Rate per Department *'}
                    {toolForm.costBasis === 'fixed_total' && 'Total Fixed Monthly Fee *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={
                      toolForm.costBasis === 'per_seat' ? '45.00'
                      : toolForm.costBasis === 'per_company' ? '250.00'
                      : toolForm.costBasis === 'per_department' ? '150.00'
                      : '500.00'
                    }
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
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    {toolForm.costBasis === 'per_seat' && 'Billed per allocated/ratcheted user seat per month'}
                    {toolForm.costBasis === 'per_company' && 'Recurring subscription fee billed for each active company entity'}
                    {toolForm.costBasis === 'per_department' && 'Recurring subscription fee billed for each active department'}
                    {toolForm.costBasis === 'fixed_total' && 'Single recurring invoice amount apportioned across assigned teams'}
                  </span>
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

              {/* Contract Term Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {toolForm.costBasis === 'per_seat' ? 'Contract Start Date *' : 'Contract Start Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    required={toolForm.costBasis === 'per_seat'}
                    value={toolForm.contractStartDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setToolForm(prev => {
                        const count = calculateStaffCountAtDate(newStartDate, prev.companyIds, prev.departments);
                        return {
                          ...prev,
                          contractStartDate: newStartDate,
                          baselineCommittedSeats: prev.isBaselineOverridden ? prev.baselineCommittedSeats : count
                        };
                      });
                    }}
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
                    {toolForm.costBasis === 'per_seat' 
                      ? 'Baseline seats are auto-calculated from staff active on this date'
                      : 'Initial start or agreement date of the software subscription'}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Contract End / Renewal Date (Optional)
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
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Contract end or renewal date. Cost projections automatically cease after this date.
                  </span>
                </div>
              </div>

              {/* Conditional: Per Seat Baseline Box vs Fixed/Company/Dept Live Summary Preview */}
              {toolForm.costBasis === 'per_seat' ? (
                /* Baseline Committed Seats with Auto-Calculation & Manual Override */
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: `1px solid ${toolForm.isBaselineOverridden ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Baseline Contract Seats *</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: toolForm.isBaselineOverridden ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: toolForm.isBaselineOverridden ? '#f59e0b' : 'var(--success)'
                      }}>
                        {toolForm.isBaselineOverridden ? 'Manual Override Active' : 'Auto-Calculated from Start Date'}
                      </span>
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={toolForm.isBaselineOverridden}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setToolForm(prev => ({
                            ...prev,
                            isBaselineOverridden: checked,
                            baselineCommittedSeats: !checked ? staffCountAtStartDate : prev.baselineCommittedSeats
                          }));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, color: toolForm.isBaselineOverridden ? '#f59e0b' : 'var(--text-secondary)' }}>
                        Override staff count
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 10"
                      value={toolForm.baselineCommittedSeats}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setToolForm(prev => ({
                          ...prev,
                          baselineCommittedSeats: isNaN(val) ? 0 : val,
                          isBaselineOverridden: true
                        }));
                      }}
                      style={{
                        width: '130px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${toolForm.isBaselineOverridden ? '#f59e0b' : 'var(--border-color)'}`,
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: 700
                      }}
                    />

                    {toolForm.isBaselineOverridden && (
                      <button
                        type="button"
                        onClick={() => {
                          setToolForm(prev => ({
                            ...prev,
                            isBaselineOverridden: false,
                            baselineCommittedSeats: staffCountAtStartDate
                          }));
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--accent)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ↺ Reset to Staff Count ({staffCountAtStartDate})
                      </button>
                    )}
                  </div>

                  <div style={{ marginTop: '6px', fontSize: '11px', lineHeight: '1.4' }}>
                    {toolForm.isBaselineOverridden ? (
                      <span style={{ color: '#f59e0b' }}>
                        ⚠️ Manually overridden to {toolForm.baselineCommittedSeats} seats. Active staff across selected scope on {toolForm.contractStartDate || 'contract start date'} was <strong>{staffCountAtStartDate} staff</strong>.
                      </span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>
                        ✓ Auto-calculated: Exactly <strong>{staffCountAtStartDate} active staff</strong> were in the selected companies &amp; departments on {toolForm.contractStartDate || 'contract start date'}.
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Live Total Summary Card for Per Company, Per Department, and Fixed Total */
                (() => {
                  const effectiveCompCount = toolForm.companyIds.includes('all') ? companies.length : toolForm.companyIds.length;
                  const effectiveDeptCount = toolFormDeptCount;
                  const unitRate = Number(toolForm.licenseCostPerSeat) || 0;
                  const totalMonthlyCost = toolForm.costBasis === 'per_company'
                    ? effectiveCompCount * unitRate
                    : toolForm.costBasis === 'per_department'
                      ? effectiveDeptCount * unitRate
                      : unitRate;

                  return (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(99, 102, 241, 0.05)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                          📊 Live Monthly Cost Summary
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatGBPExact(totalMonthlyCost)} / mo
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {toolForm.costBasis === 'per_company' && (
                          <span>
                            {effectiveCompCount} assigned {effectiveCompCount === 1 ? 'company' : 'companies'} × {formatGBPExact(unitRate)} = <strong>{formatGBPExact(totalMonthlyCost)}/month</strong>
                          </span>
                        )}
                        {toolForm.costBasis === 'per_department' && (
                          <span>
                            {effectiveDeptCount} assigned {effectiveDeptCount === 1 ? 'department' : 'departments'} × {formatGBPExact(unitRate)} = <strong>{formatGBPExact(totalMonthlyCost)}/month</strong>
                          </span>
                        )}
                        {toolForm.costBasis === 'fixed_total' && (
                          <span>
                            Fixed total fee of <strong>{formatGBPExact(totalMonthlyCost)}/month</strong> split via <strong>{toolForm.splitMethod === 'pro_rata_headcount' ? 'headcount pro-rata' : 'equal split'}</strong> across {effectiveDeptCount} assigned departments.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}

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
