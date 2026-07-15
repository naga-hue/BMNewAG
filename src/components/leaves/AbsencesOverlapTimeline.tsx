import React, { useMemo } from 'react';
import { Staff } from '../../types';

interface TimelineProps {
  staff: Staff[];
  leaveRequests?: any[];
  onShowToast?: (msg: string, type?: string) => void;
}

export default function AbsencesOverlapTimeline({
  staff = [],
  leaveRequests = []
}: TimelineProps) {
  // Center around July 2026
  const YEAR = 2026;
  const MONTH = 6; // July is index 6
  const DAYS_IN_MONTH = 31;
  const MONTH_NAME = "July 2026";

  const activeStaff = useMemo(() => {
    return staff.filter(s => s.status !== 'exited');
  }, [staff]);

  const approvedLeaves = useMemo(() => {
    return leaveRequests.filter(req => req.status === 'approved');
  }, [leaveRequests]);

  // Dimensions
  const rowHeight = 40;
  const nameWidth = 180;
  const dayWidth = 24;
  const width = nameWidth + dayWidth * DAYS_IN_MONTH;
  const height = 50 + activeStaff.length * rowHeight;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>📅 Overlapping Absences & Leaves Gantt Timeline</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Visual overlay of approved team absences in <strong>{MONTH_NAME}</strong>. Hover to view details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }} /> Annual Leave
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--warning)' }} /> Sickness / Other
          </span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '920px' }}>
          {/* Header Row */}
          <g>
            <rect x={0} y={0} width={width} height={40} fill="var(--bg-secondary)" />
            <text x={10} y={24} fill="var(--text-primary)" fontSize={11} fontWeight={700}>Staff Member</text>
            
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
          {activeStaff.map((s, staffIdx) => {
            const y = 40 + staffIdx * rowHeight;
            return (
              <g key={s.id}>
                {/* Background Row Line */}
                <line x1={0} y1={y + rowHeight} x2={width} y2={y + rowHeight} stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="3 3" />
                <line x1={nameWidth} y1={40} x2={nameWidth} y2={height} stroke="var(--border-color)" strokeWidth={1} />

                {/* Name Label */}
                <text x={10} y={y + 20} fill="var(--text-primary)" fontSize={11} fontWeight={600}>{s.fullName}</text>
                <text x={10} y={y + 32} fill="var(--text-muted)" fontSize={8}>{s.department || 'Recruitment'}</text>

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
    </div>
  );
}
