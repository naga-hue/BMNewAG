import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Wrench, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Layers, 
  Building2, 
  DollarSign, 
  ShieldAlert, 
  Calendar 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Company, Staff, Placement, PayrollRecord, DepartmentTool } from '../../types';
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
  currentUser?: any;
  onShowToast?: (msg: string, type?: string) => void;
}

const MONTH_KEYS_2026 = [
  '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08',
  '2026-09', '2026-10', '2026-11', '2026-12'
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const formatGBP = (val: number): string => {
  return '£' + Math.round(val || 0).toLocaleString();
};

const formatGBPExact = (val: number): string => {
  return '£' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  companies,
  staff,
  payrollRecords,
  payrollPolicies,
  leaveRequests,
  holidays,
  placements,
  commissionPolicies,
  currentUser,
  onShowToast
}: DepartmentTeamCostTabProps) {
  const { departmentTools, saveDepartmentTool, deleteDepartmentTool } = useBoundStore();

  const isManager = currentUser?.permissions?.role === 'manager';
  const managerDept = currentUser?.department || staff.find(s => s.id === currentUser?.id)?.department;

  // Extract distinct departments from staff roster
  const allDepartments = useMemo(() => {
    const depts = new Set<string>();
    staff.forEach(s => {
      if (s.department && s.department.trim()) {
        depts.add(s.department.trim());
      }
    });
    return Array.from(depts).sort();
  }, [staff]);

  // Selected Department Filter
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (isManager && managerDept) {
      return managerDept;
    }
    return allDepartments[0] || 'Civils';
  });

  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showToolModal, setShowToolModal] = useState<boolean>(false);
  const [editingTool, setEditingTool] = useState<DepartmentTool | null>(null);

  // Form State for Add / Edit Tool
  const [toolForm, setToolForm] = useState<{
    id?: string;
    name: string;
    department: string;
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
    department: selectedDept,
    licenseCostPerSeat: 0,
    currency: 'GBP',
    billingFrequency: 'monthly',
    baselineCommittedSeats: 1,
    contractStartDate: '2026-01-01',
    renewalDate: '2026-12-31',
    vendorName: '',
    notes: ''
  });

  const monthsList = useMemo(() => {
    return MONTH_KEYS_2026.map(m => m.replace('2026', selectedYear));
  }, [selectedYear]);

  // Filter staff by department
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (selectedDept !== 'all' && s.department !== selectedDept) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = (s.fullName || '').toLowerCase().includes(q);
        const matchesTitle = (s.jobTitle || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTitle) return false;
      }
      return true;
    });
  }, [staff, selectedDept, searchTerm]);

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

  // Monthly active headcount for the department
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

  // Filter tools applicable to this department
  const relevantTools = useMemo(() => {
    return departmentTools.filter(t => {
      if (selectedDept === 'all') return true;
      return t.department === selectedDept || t.department === 'all';
    });
  }, [departmentTools, selectedDept]);

  // High-Water Mark Ratchet Engine for Software Tools
  // For each tool and month:
  // committedSeats = Math.max(baselineCommittedSeats, peakHeadcountUpToMonth)
  const toolRatchetData = useMemo(() => {
    return relevantTools.map(tool => {
      const baseline = Number(tool.baselineCommittedSeats) || 0;
      const unitCostGBP = toGBP(tool.licenseCostPerSeat || 0, tool.currency || 'GBP');

      const monthlyDetails: Record<string, {
        activeSeats: number;
        committedSeats: number;
        unutilizedSeats: number;
        costGBP: number;
        isRatcheted: boolean;
      }> = {};

      let peakSoFar = baseline;
      let annualTotalCost = 0;

      monthsList.forEach((m, idx) => {
        // Headcount for this tool's scope
        let activeHeadcountForTool = 0;
        if (tool.department === 'all') {
          // If tool is company-wide/shared, calculate across all active staff
          activeHeadcountForTool = staff.filter(s => {
            const cell = getCellData(s, m, payrollRecords, payrollPolicies, leaveRequests, holidays, staff, companies, placements, commissionPolicies);
            return isStaffActiveInMonth(s, m, cell.total);
          }).length;
        } else {
          activeHeadcountForTool = monthlyHeadcount[m] || 0;
        }

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
        annualTotalCost += cost;

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
        unitCostGBP,
        monthlyDetails,
        annualTotalCost
      };
    });
  }, [relevantTools, monthsList, staff, monthlyHeadcount, payrollRecords, payrollPolicies, leaveRequests, holidays, companies, placements, commissionPolicies]);

  // Aggregate Remuneration Totals across Months
  const staffRemunerationTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;

    monthsList.forEach(m => {
      let mSum = 0;
      filteredStaff.forEach(s => {
        const cell = staffMonthlyData[s.id]?.[m];
        // actual staff cost without reimbursements
        mSum += cell?.total || 0;
      });
      monthlySum[m] = mSum;
      grandTotal += mSum;
    });

    return { monthlySum, grandTotal };
  }, [monthsList, filteredStaff, staffMonthlyData]);

  // Aggregate Software Tools Totals across Months
  const toolTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    let grandTotal = 0;

    monthsList.forEach(m => {
      let mSum = 0;
      toolRatchetData.forEach(item => {
        mSum += item.monthlyDetails[m]?.costGBP || 0;
      });
      monthlySum[m] = mSum;
      grandTotal += mSum;
    });

    return { monthlySum, grandTotal };
  }, [monthsList, toolRatchetData]);

  // Combined Department Costs (Staff Remuneration + Tools)
  const combinedDepartmentTotals = useMemo(() => {
    const monthlySum: Record<string, number> = {};
    const avgCostPerHead: Record<string, number> = {};
    let grandTotal = 0;

    monthsList.forEach(m => {
      const staffCost = staffRemunerationTotals.monthlySum[m] || 0;
      const toolCost = toolTotals.monthlySum[m] || 0;
      const total = staffCost + toolCost;
      monthlySum[m] = total;
      grandTotal += total;

      const hc = monthlyHeadcount[m] || 0;
      avgCostPerHead[m] = hc > 0 ? total / hc : 0;
    });

    const avgHeadcount = Object.values(monthlyHeadcount).reduce((a, b) => a + b, 0) / (monthsList.length || 1);
    const overallAvgCostPerHead = avgHeadcount > 0 ? grandTotal / avgHeadcount : 0;

    return {
      monthlySum,
      avgCostPerHead,
      grandTotal,
      avgHeadcount,
      overallAvgCostPerHead
    };
  }, [monthsList, staffRemunerationTotals, toolTotals, monthlyHeadcount]);

  // Total unutilized seats across all department tools right now (latest active month)
  const unutilizedStats = useMemo(() => {
    const latestMonth = '2026-09';
    let totalCommitted = 0;
    let totalActive = 0;
    let totalWastedCost = 0;

    toolRatchetData.forEach(t => {
      const d = t.monthlyDetails[latestMonth];
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
  }, [toolRatchetData]);

  // Handle Open Tool Modal
  const handleOpenAddTool = () => {
    setEditingTool(null);
    setToolForm({
      name: '',
      department: selectedDept === 'all' ? (allDepartments[0] || 'Civils') : selectedDept,
      licenseCostPerSeat: 45,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: monthlyHeadcount['2026-01'] || 5,
      contractStartDate: `${selectedYear}-01-01`,
      renewalDate: `${selectedYear}-12-31`,
      vendorName: '',
      notes: ''
    });
    setShowToolModal(true);
  };

  const handleOpenEditTool = (tool: DepartmentTool) => {
    setEditingTool(tool);
    setToolForm({
      id: tool.id,
      name: tool.name,
      department: tool.department,
      licenseCostPerSeat: tool.licenseCostPerSeat,
      currency: tool.currency || 'GBP',
      billingFrequency: tool.billingFrequency || 'monthly',
      baselineCommittedSeats: tool.baselineCommittedSeats || 1,
      contractStartDate: tool.contractStartDate || `${selectedYear}-01-01`,
      renewalDate: tool.renewalDate || `${selectedYear}-12-31`,
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
      const toolToSave: DepartmentTool = {
        id: editingTool ? editingTool.id : `dept-tool-${Date.now()}`,
        name: toolForm.name.trim(),
        department: toolForm.department,
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

      // 1. Department Consolidated Summary Sheet
      const summaryRows = [
        ['HUMRES BUSINESS MANAGEMENT - DEPARTMENT TEAM & TOOL COSTS'],
        [`Department: ${selectedDept.toUpperCase()}`, `Year: ${selectedYear}`, `Exported on: ${new Date().toLocaleDateString()}`],
        [],
        ['Metric', ...MONTH_NAMES, 'Full Year Total'],
        [
          'Active Team Headcount',
          ...monthsList.map(m => monthlyHeadcount[m] || 0),
          Math.round(combinedDepartmentTotals.avgHeadcount) + ' (Avg)'
        ],
        [
          'Staff Remuneration Paid (£)',
          ...monthsList.map(m => staffRemunerationTotals.monthlySum[m] || 0),
          staffRemunerationTotals.grandTotal
        ],
        [
          'Software & Tool Licenses (£)',
          ...monthsList.map(m => toolTotals.monthlySum[m] || 0),
          toolTotals.grandTotal
        ],
        [
          'Total Department Operating Cost (£)',
          ...monthsList.map(m => combinedDepartmentTotals.monthlySum[m] || 0),
          combinedDepartmentTotals.grandTotal
        ],
        [
          'Average Cost per Recruiter (£)',
          ...monthsList.map(m => Math.round(combinedDepartmentTotals.avgCostPerHead[m] || 0)),
          Math.round(combinedDepartmentTotals.overallAvgCostPerHead)
        ]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Department Summary');

      // 2. Staff Remuneration Sheet
      const staffRows = [
        ['TEAM REMUNERATION MATRIX (ACTUAL STAFF REMUNERATION - EX-REIMBURSEMENTS)'],
        [`Department: ${selectedDept.toUpperCase()}`, `Year: ${selectedYear}`],
        [],
        ['Staff Member', 'Job Title', 'Type', ...MONTH_NAMES, 'Total Paid (£)']
      ];

      filteredStaff.forEach(s => {
        let staffAnnualTotal = 0;
        const monthCols = monthsList.map(m => {
          const val = staffMonthlyData[s.id]?.[m]?.total || 0;
          staffAnnualTotal += val;
          return Math.round(val);
        });

        staffRows.push([
          s.fullName || '',
          s.jobTitle || 'Recruiter',
          s.employmentType || 'Staff',
          ...monthCols,
          Math.round(staffAnnualTotal)
        ]);
      });

      // Remuneration subtotal row
      staffRows.push([
        'TOTAL REMUNERATION',
        '',
        '',
        ...monthsList.map(m => Math.round(staffRemunerationTotals.monthlySum[m] || 0)),
        Math.round(staffRemunerationTotals.grandTotal)
      ]);

      const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
      XLSX.utils.book_append_sheet(wb, wsStaff, 'Team Remuneration');

      // 3. Software Licenses Sheet
      const toolRows = [
        ['SOFTWARE & TOOL LICENSES (HIGH-WATER MARK CONTRACT RATIO)'],
        [`Department: ${selectedDept.toUpperCase()}`, `Year: ${selectedYear}`],
        [],
        ['Tool Name', 'Vendor', 'Department', 'Baseline Seats', 'Cost / Seat (£)', ...MONTH_NAMES.map(m => `${m} Cost (£)`), 'Annual Cost (£)']
      ];

      toolRatchetData.forEach(t => {
        const monthCosts = monthsList.map(m => Math.round(t.monthlyDetails[m]?.costGBP || 0));
        toolRows.push([
          t.tool.name,
          t.tool.vendorName || '-',
          t.tool.department,
          t.tool.baselineCommittedSeats,
          Number(t.unitCostGBP.toFixed(2)),
          ...monthCosts,
          Math.round(t.annualTotalCost)
        ]);
      });

      toolRows.push([
        'TOTAL SOFTWARE LICENSES',
        '',
        '',
        '',
        '',
        ...monthsList.map(m => Math.round(toolTotals.monthlySum[m] || 0)),
        Math.round(toolTotals.grandTotal)
      ]);

      const wsTools = XLSX.utils.aoa_to_sheet(toolRows);
      XLSX.utils.book_append_sheet(wb, wsTools, 'Software Licenses');

      // Write and download
      const filename = `Team_and_Tool_Costs_${selectedDept}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (onShowToast) onShowToast(`Excel report exported: ${filename}`, 'success');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      if (onShowToast) onShowToast('Failed to export Excel: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* Top Header & Filter Controls Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Team & Tool Costs
            </h2>
            <span style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.15)', 
              color: 'var(--accent)', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '11px', 
              fontWeight: 700 
            }}>
              Manager & MD View
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Real-time departmental cost report tracking actual team remuneration and software license commitments with automatic contract seat ratchets.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Department Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={isManager && !!managerDept}
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isManager && !!managerDept ? 'not-allowed' : 'pointer'
              }}
            >
              {!isManager && <option value="all">All Departments</option>}
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Year Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Add Tool Button */}
          <button
            onClick={handleOpenAddTool}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            Add Software Tool
          </button>

          {/* Excel Export Button */}
          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            Export Excel
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '14px' 
      }}>
        {/* Card 1: Total Department Operating Cost */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL DEPARTMENT COST</span>
            <DollarSign size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {formatGBP(combinedDepartmentTotals.grandTotal)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Combined Remuneration + Tools ({selectedYear})
          </div>
        </div>

        {/* Card 2: Staff Remuneration Paid */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>STAFF REMUNERATION PAID</span>
            <Users size={16} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
            {formatGBP(staffRemunerationTotals.grandTotal)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Actual pay disbursed (Excl. reimbursements)
          </div>
        </div>

        {/* Card 3: Software & Tool Licenses */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>SOFTWARE & TOOLS</span>
            <Wrench size={16} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {formatGBP(toolTotals.grandTotal)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {relevantTools.length} contracted vendor tools
          </div>
        </div>

        {/* Card 4: Contract Commitment & Spare Seats */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>SEAT COMMITMENT RATIO</span>
            <AlertCircle size={16} style={{ color: unutilizedStats.spareSeats > 0 ? '#f59e0b' : 'var(--text-secondary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {unutilizedStats.totalActive} / {unutilizedStats.totalCommitted}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>seats</span>
          </div>
          <div style={{ fontSize: '12px', color: unutilizedStats.spareSeats > 0 ? '#f59e0b' : 'var(--success)', marginTop: '4px' }}>
            {unutilizedStats.spareSeats > 0 
              ? `${unutilizedStats.spareSeats} unutilized seats (${formatGBP(unutilizedStats.totalWastedCost)}/mo)`
              : '100% seat utilization'}
          </div>
        </div>
      </div>

      {/* Contract Ratchet Explanation Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px'
      }}>
        <HelpCircle size={18} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <strong>Contract Seat Commitment Rule:</strong> Software licenses honor baseline contract commitments. 
          When your team expands (e.g. from 7 to 10 recruiters), the seat count automatically ratchets up to 10. 
          If team headcount later decreases (e.g. from 10 to 7), the contract commitment remains locked at 10 seats carrying forward until renewal, 
          with unutilized seats highlighted in orange so managers have full cost transparency.
        </div>
      </div>

      {/* ==============================================================
          SECTION 1: TEAM REMUNERATION TABLE (ACTUAL STAFF REMUNERATION)
          ============================================================== */}
      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              1. Department Team Remuneration (Actual Staff Cost)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Basic Salary + Commission + Bonuses + Taxes. Expense reimbursements are strictly excluded.
            </span>
          </div>
          <input
            type="text"
            placeholder="Search team member..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: '12px',
              width: '200px'
            }}
          />
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <table className="entity-table dense" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                  Staff Member
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px' }}>Role</th>
                {MONTH_NAMES.map(m => (
                  <th key={m} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>
                    {m}
                  </th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12px', backgroundColor: 'var(--bg-secondary)' }}>
                  Total Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No staff members found matching criteria in {selectedDept}.
                  </td>
                </tr>
              ) : (
                filteredStaff.map(s => {
                  let staffRowSum = 0;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ 
                        padding: '10px 14px', 
                        fontWeight: 600, 
                        fontSize: '13px', 
                        position: 'sticky', 
                        left: 0, 
                        backgroundColor: 'var(--bg-primary)', 
                        zIndex: 1 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{s.fullName}</span>
                          {s.status === 'exited' && (
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                              color: 'var(--danger)', 
                              padding: '1px 5px', 
                              borderRadius: '4px' 
                            }}>
                              Exited
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {s.jobTitle || 'Recruiter'}
                      </td>
                      {monthsList.map(m => {
                        const cell = staffMonthlyData[s.id]?.[m];
                        const val = cell?.total || 0;
                        staffRowSum += val;

                        return (
                          <td 
                            key={m} 
                            style={{ 
                              padding: '10px 8px', 
                              textAlign: 'right', 
                              fontFamily: 'monospace', 
                              fontSize: '12px',
                              color: val > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                              fontWeight: val > 0 ? 500 : 400
                            }}
                            title={`Basic: ${formatGBPExact(cell?.basic || 0)}\nCommission: ${formatGBPExact(cell?.commission || 0)}\nBonus: ${formatGBPExact(cell?.bonus || 0)}\nNI/Pension: ${formatGBPExact((cell?.employerNi || 0) + (cell?.employerPension || 0))}\nReimbursements (Excluded): ${formatGBPExact(cell?.reimbursements || 0)}`}
                          >
                            {val > 0 ? formatGBP(val) : '-'}
                          </td>
                        );
                      })}
                      <td style={{ 
                        padding: '10px 14px', 
                        textAlign: 'right', 
                        fontFamily: 'monospace', 
                        fontWeight: 700, 
                        fontSize: '13px',
                        color: 'var(--accent)'
                      }}>
                        {formatGBP(staffRowSum)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Subtotal: Department Staff Remuneration */}
              <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td style={{ padding: '10px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                  Subtotal: Team Remuneration
                </td>
                <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {filteredStaff.length} team members
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)' }}>
                    {formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)', fontSize: '14px' }}>
                  {formatGBP(staffRemunerationTotals.grandTotal)}
                </td>
              </tr>

              {/* Active Headcount Row */}
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)' }}>
                  Active Team Headcount
                </td>
                <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                  Active recruiters
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                    {monthlyHeadcount[m] || 0}
                  </td>
                ))}
                <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                  {Math.round(combinedDepartmentTotals.avgHeadcount)} (Avg)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ==============================================================
          SECTION 2: SOFTWARE & TOOLS TABLE (WITH HIGH-WATER MARK RATCHET)
          ============================================================== */}
      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              2. Department Software & Tool Licenses (Contract Ratchet)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Software tools automatically scale up with peak headcount and hold minimum commitment until contract renewal.
            </span>
          </div>

          <button
            onClick={handleOpenAddTool}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--accent)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            Add Tool
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <table className="entity-table dense" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                  Tool & Vendor
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px' }}>Scope</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px' }}>Cost / Seat</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px' }}>Baseline</th>
                {MONTH_NAMES.map(m => (
                  <th key={m} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>
                    {m}
                  </th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12px', backgroundColor: 'var(--bg-secondary)' }}>
                  Annual Cost
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {toolRatchetData.length === 0 ? (
                <tr>
                  <td colSpan={18} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No software tools configured for {selectedDept}. Click "+ Add Software Tool" above to add tools like Dialpad, CRM, or LinkedIn Recruiter.
                  </td>
                </tr>
              ) : (
                toolRatchetData.map(({ tool, unitCostGBP, monthlyDetails, annualTotalCost }) => (
                  <tr key={tool.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ 
                      padding: '10px 14px', 
                      fontWeight: 600, 
                      fontSize: '13px', 
                      position: 'sticky', 
                      left: 0, 
                      backgroundColor: 'var(--bg-primary)', 
                      zIndex: 1 
                    }}>
                      <div>
                        <div>{tool.name}</div>
                        {tool.vendorName && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {tool.vendorName}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ 
                        backgroundColor: tool.department === 'all' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: tool.department === 'all' ? '#8b5cf6' : 'var(--accent)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {tool.department === 'all' ? 'Company' : tool.department}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace' }}>
                      {formatGBPExact(unitCostGBP)}/mo
                      {tool.currency && tool.currency !== 'GBP' && (
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                          ({tool.licenseCostPerSeat} {tool.currency})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace' }}>
                      {tool.baselineCommittedSeats} seats
                    </td>
                    {monthsList.map(m => {
                      const d = monthlyDetails[m];
                      if (!d) return <td key={m}>-</td>;

                      return (
                        <td 
                          key={m} 
                          style={{ 
                            padding: '10px 8px', 
                            textAlign: 'right', 
                            fontFamily: 'monospace', 
                            fontSize: '12px' 
                          }}
                          title={`Committed: ${d.committedSeats} seats\nActive Staff: ${d.activeSeats}\nUnutilized: ${d.unutilizedSeats} seats\nMonthly Cost: ${formatGBPExact(d.costGBP)}`}
                        >
                          <div>{formatGBP(d.costGBP)}</div>
                          <div style={{ 
                            fontSize: '10px', 
                            color: d.unutilizedSeats > 0 ? '#f59e0b' : 'var(--text-secondary)',
                            fontWeight: d.unutilizedSeats > 0 ? 600 : 400 
                          }}>
                            {d.committedSeats} seats {d.unutilizedSeats > 0 ? `(${d.unutilizedSeats} spare)` : ''}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ 
                      padding: '10px 14px', 
                      textAlign: 'right', 
                      fontFamily: 'monospace', 
                      fontWeight: 700, 
                      fontSize: '13px',
                      color: '#8b5cf6'
                    }}>
                      {formatGBP(annualTotalCost)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleOpenEditTool(tool)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          title="Edit Tool"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteTool(tool.id, tool.name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          title="Delete Tool"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {/* Subtotal: Software Tools */}
              <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td style={{ padding: '10px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                  Subtotal: Software Licenses
                </td>
                <td colSpan={3} style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {relevantTools.length} tools contracted
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#8b5cf6' }}>
                    {formatGBP(toolTotals.monthlySum[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#8b5cf6', fontSize: '14px' }}>
                  {formatGBP(toolTotals.grandTotal)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ==============================================================
          SECTION 3: COMBINED DEPARTMENT TOTAL MATRIX
          ============================================================== */}
      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          3. Consolidated Department Cost Summary
        </h3>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <table className="entity-table dense" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: '12px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 2 }}>
                  Department Line Item
                </th>
                {MONTH_NAMES.map(m => (
                  <th key={m} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>
                    {m}
                  </th>
                ))}
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '12px', backgroundColor: 'var(--bg-secondary)' }}>
                  Full Year
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 600, position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1 }}>
                  Staff Remuneration (Salaries & Commissions)
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatGBP(staffRemunerationTotals.monthlySum[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                  {formatGBP(staffRemunerationTotals.grandTotal)}
                </td>
              </tr>

              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 600, position: 'sticky', left: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1 }}>
                  Software & Vendor Licenses
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatGBP(toolTotals.monthlySum[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                  {formatGBP(toolTotals.grandTotal)}
                </td>
              </tr>

              {/* Grand Total Row */}
              <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                <td style={{ padding: '12px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, fontSize: '13px' }}>
                  GRAND TOTAL DEPARTMENT COST
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '13px' }}>
                    {formatGBP(combinedDepartmentTotals.monthlySum[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '15px' }}>
                  {formatGBP(combinedDepartmentTotals.grandTotal)}
                </td>
              </tr>

              {/* Average Cost Per Head */}
              <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)', fontSize: '12px' }}>
                <td style={{ padding: '8px 14px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1, color: 'var(--text-secondary)' }}>
                  Average Cost per Recruiter
                </td>
                {monthsList.map(m => (
                  <td key={m} style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {formatGBP(combinedDepartmentTotals.avgCostPerHead[m] || 0)}
                  </td>
                ))}
                <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {formatGBP(combinedDepartmentTotals.overallAvgCostPerHead)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
            maxWidth: '520px',
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
              backgroundColor: 'var(--bg-secondary)'
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
            <form onSubmit={handleSaveTool} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                  Tool / Software Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dialpad, Recruitly CRM, LinkedIn Recruiter"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Department *
                  </label>
                  <select
                    value={toolForm.department}
                    onChange={(e) => setToolForm({ ...toolForm, department: e.target.value })}
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
                    <option value="all">All / Shared across company</option>
                    {allDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Vendor Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dialpad Inc."
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
