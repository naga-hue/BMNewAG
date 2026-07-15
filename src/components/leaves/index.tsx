import React, { useState } from 'react';
import { Company, Staff } from '../../types';
import LeaveRequestsDesk from './LeaveRequestsDesk';
import LeavePoliciesSetup from './LeavePoliciesSetup';
import HolidaysConfig from './HolidaysConfig';
import AbsencesOverlapTimeline from './AbsencesOverlapTimeline';
import './leaves.css';

interface LeavesDashboardProps {
  companies: Company[];
  staff: Staff[];
  leavePolicies?: any[];
  leaveRequests?: any[];
  holidays?: any[];
  onSavePolicy: (policy: any) => Promise<any>;
  onDeletePolicy?: (id: string) => Promise<any>;
  onSaveHoliday: (holiday: any) => Promise<any>;
  onDeleteHoliday?: (id: string) => Promise<any>;
  onSaveLeaveRequest: (req: any) => Promise<any>;
  onUpdateLeaveRequestStatus?: (id: string, status: string) => Promise<any>;
  onUpdateStaff?: (s: Staff) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function LeavesDashboard({
  companies = [],
  staff = [],
  leavePolicies = [],
  leaveRequests = [],
  holidays = [],
  onSavePolicy,
  onDeletePolicy,
  onSaveHoliday,
  onDeleteHoliday,
  onSaveLeaveRequest,
  onUpdateLeaveRequestStatus,
  onUpdateStaff,
  onShowToast
}: LeavesDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'requests' | 'policies' | 'holidays' | 'overlap'>('requests');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="leaves-tab-nav">
        {[
          { key: 'requests', label: 'Leave Requests Desk' },
          { key: 'overlap', label: 'Absences Timeline' },
          { key: 'policies', label: 'Leave Policies' },
          { key: 'holidays', label: 'Public Holidays' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key as any)}
            className={`leaves-tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
          >
            {t.label}
            {t.key === 'requests' && leaveRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="leaves-badge">
                {leaveRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeSubTab === 'requests' && (
        <LeaveRequestsDesk
          companies={companies}
          staff={staff}
          leaveRequests={leaveRequests}
          onSaveLeaveRequest={onSaveLeaveRequest}
          onUpdateLeaveRequestStatus={onUpdateLeaveRequestStatus}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'overlap' && (
        <AbsencesOverlapTimeline
          staff={staff}
          leaveRequests={leaveRequests}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'policies' && (
        <LeavePoliciesSetup
          companies={companies}
          staff={staff}
          leavePolicies={leavePolicies}
          onSavePolicy={onSavePolicy}
          onDeletePolicy={onDeletePolicy}
          onUpdateStaff={onUpdateStaff}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'holidays' && (
        <HolidaysConfig
          companies={companies}
          holidays={holidays}
          onSaveHoliday={onSaveHoliday}
          onDeleteHoliday={onDeleteHoliday}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
export { LeavesDashboard };
