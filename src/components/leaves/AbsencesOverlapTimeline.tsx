import React, { useState, useMemo } from 'react';
import { Company, Staff } from '../../types';
import { Building2, Filter } from 'lucide-react';

interface TimelineProps {
  companies: Company[];
  staff: Staff[];
  leaveRequests?: any[];
  leavePolicies?: any[];
  onShowToast?: (msg: string, type?: string) => void;
}

export default function AbsencesOverlapTimeline({
  companies = [],
  staff = [],
  leaveRequests = [],
  leavePolicies = []
}: TimelineProps) {
  // Center around July 2026
  const YEAR = 2026;
  const MONTH = 6; // July is index 6
  const DAYS_IN_MONTH = 31;
  const MONTH_NAME = "July 2026";

  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');

  // Resolve departments list dynamically based on company selection
  const allDepartments = useMemo(() => {
    const depts: string[] = [];
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        if (selectedCompanyId === 'all' || s.companyId === selectedCompanyId) {
          depts.push(s.department);
        }
      }
    });
    return depts.sort();
  }, [staff, selectedCompanyId]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      if (s.status === 'exited') return false;
      const matchesCompany = selectedCompanyId === 'all' || s.companyId === selectedCompanyId;
      const matchesDept = selectedDept === 'all' || s.department === selectedDept;
      return matchesCompany && matchesDept;
    });
  }, [staff, selectedCompanyId, selectedDept]);

  const approvedLeaves = useMemo(() => {
    return leaveRequests.filter(req => req.status === 'approved');
  }, [leaveRequests]);

  // Helper to compute dynamic annual leave allowance based on service years
  const resolveAnnualAllowance = (member: Staff, policy: any) => {
    if (!policy) return 20;
    if (policy.name.toLowerCase().includes('global recruiters')) {
      if (!member.startDate) return 20;
      const start = new Date(member.startDate);
      if (isNaN(start.getTime())) return 20;

      const today = new Date();
      let years = today.getFullYear() - start.getFullYear();
      const m = today.getMonth() - start.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
        years--;
      }
      const calculated = 20 + Math.max(0, years);
      return Math.min(25, calculated);
    }
    return policy.annualAllowance || 20;
  };

  // Dimensions
  const rowHeight = 40;
  const nameWidth = 200; // expanded name block for leave balance display
  const dayWidth = 24;
  const width = nameWidth + dayWidth * DAYS_IN_MONTH;
  const height = 50 + filteredStaff.length * rowHeight;

  // Check if a staff member is on leave on a specific day of July 2026
  const getLeaveOnDay = (staffId: string, day: number) => {
    const checkDate = new Date(YEAR, MONTH, day);
    checkDate.setHours(12, 0, 0, 0); // avoid timezone shifts

    return approvedLeaves.find(req => {
      if (req.staffId !== staffId) return false;
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return checkDate >= start && checkDate <= end;
    });
  };

  return (
    <div className="detail-section" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Title & Filters Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>📅 Overlapping Absences & Leaves Gantt Timeline</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Visual overlay of approved team absences in <strong>{MONTH_NAME}</strong> with live balances.
          </p>
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Company Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="select-filter"
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setSelectedDept('all');
              }}
              style={{ padding: '6px 10px', minWidth: '150px' }}
            >
              <option value="all">All Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="select-filter"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ padding: '6px 10px', minWidth: '150px' }}
            >
              <option value="all">All Departments</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legend Row */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }} /> Annual Leave
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--warning)' }} /> Sickness / Other
        </span>
      </div>

      {/* SVG Gantt Chart */}
      {filteredStaff.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No staff members match the selected filters.
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '920px' }}>
            {/* Header Row */}
            <g>
              <rect x={0} y={0} width={width} height={40} fill="var(--bg-secondary)" />
              <text x={10} y={24} fill="var(--text-primary)" fontSize={11} fontWeight={700}>Staff Member (Balances)</text>
              
              {Array.from({ length: DAYS_IN_MONTH }).map((_, idx) => {
                const day = idx + 1;
                const isWeekend = new Date(YEAR, MONTH, day).getDay() === 0 || new Date(YEAR, MONTH, day).getDay() === 6;
                return (
                  <g key={day}>
                    <rect 
                      x={nameWidth + idx * dayWidth} 
                      y={0} 
                      width={dayWidth} 
                      height={height} 
                      fill={isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent'} 
                    />
                    <text 
                      x={nameWidth + idx * dayWidth + dayWidth / 2} 
                      y={24} 
                      fill={isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)'} 
                      fontSize={10} 
                      fontWeight={700} 
                      textAnchor="middle"
                    >
                      {day}
                    </text>
                  </g>
                );
              })}
            </g>

            <line x1={0} y1={40} x2={width} y2={40} stroke="var(--border-color)" strokeWidth={1} />

            {/* Grid Rows */}
            {filteredStaff.map((s, staffIdx) => {
              const y = 40 + staffIdx * rowHeight;
              
              // Calculate leave balance for display
              const policy = leavePolicies.find(p => p.id === s.leavePolicyId);
              const annualTaken = approvedLeaves.filter(r => r.staffId === s.id && r.leaveType === 'annual').reduce((sum, r) => sum + r.totalDays, 0);
              const allowed = resolveAnnualAllowance(s, policy);
              const remaining = Math.max(0, allowed - annualTaken);
              const balanceText = `${remaining}/${allowed}d left`;

              return (
                <g key={s.id}>
                  {/* Background Row Line */}
                  <line x1={0} y1={y + rowHeight} x2={width} y2={y + rowHeight} stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="3 3" />
                  <line x1={nameWidth} y1={40} x2={nameWidth} y2={height} stroke="var(--border-color)" strokeWidth={1} />

                  {/* Name Label & Balance Display */}
                  <text x={10} y={y + 18} fill="var(--text-primary)" fontSize={11} fontWeight={600}>{s.fullName}</text>
                  <text x={10} y={y + 30} fill="var(--text-muted)" fontSize={8.5}>
                    {s.department || 'Recruitment'} • <tspan fill="var(--primary)" fontWeight={700}>{balanceText}</tspan>
                  </text>

                  {/* Days cells */}
                  {Array.from({ length: DAYS_IN_MONTH }).map((_, idx) => {
                    const day = idx + 1;
                    const leave = getLeaveOnDay(s.id, day);
                    if (!leave) return null;

                    const isSickness = leave.leaveType === 'sick' || leave.leaveType === 'unpaid';
                    const color = isSickness ? 'var(--warning)' : 'var(--primary)';
                    const opacity = 0.85;

                    return (
                      <g key={day} className="timeline-block">
                        <rect 
                          x={nameWidth + idx * dayWidth + 1} 
                          y={y + 8} 
                          width={dayWidth - 2} 
                          height={24} 
                          fill={color} 
                          fillOpacity={opacity}
                          rx={3}
                        />
                        <title>{`${s.fullName}\nLeave: ${leave.startDate} to ${leave.endDate}\nReason: ${leave.leaveType || 'Annual Leave'}`}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
