import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Search 
} from 'lucide-react';
import { Company, Staff } from '../../types';

interface LeaveRequestsDeskProps {
  companies: Company[];
  staff: Staff[];
  leaveRequests: any[];
  onSaveLeaveRequest: (req: any) => Promise<any>;
  onUpdateLeaveRequestStatus?: (id: string, status: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function LeaveRequestsDesk({
  companies,
  staff,
  leaveRequests,
  onSaveLeaveRequest,
  onUpdateLeaveRequestStatus,
  onShowToast
}: LeaveRequestsDeskProps) {
  const [showReqForm, setShowReqForm] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [reqType, setReqType] = useState('annual');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqDays, setReqDays] = useState('');
  const [reqNotes, setReqNotes] = useState('');

  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending');

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0 || !reqStartDate || !reqEndDate || !reqDays || Number(reqDays) <= 0) {
      onShowToast("Please select at least one staff member and fill in all leave request details.", "warning");
      return;
    }

    try {
      for (let i = 0; i < selectedStaffIds.length; i++) {
        const sId = selectedStaffIds[i];
        const newRequest = {
          id: `req-${Date.now()}-${i}`,
          staffId: sId,
          leaveType: reqType,
          startDate: reqStartDate,
          endDate: reqEndDate,
          totalDays: Number(reqDays),
          status: "approved", // auto-approve admin bookings
          notes: reqNotes.trim() ? `${reqNotes.trim()} (Admin Booked)` : "(Admin Booked)"
        };
        await onSaveLeaveRequest(newRequest);
      }

      onShowToast(`Successfully booked ${reqDays} days of ${reqType} leave for ${selectedStaffIds.length} employees.`, "success");
      
      // Reset form
      setSelectedStaffIds([]);
      setReqStartDate('');
      setReqEndDate('');
      setReqDays('');
      setReqNotes('');
      setShowReqForm(false);
    } catch (err: any) {
      onShowToast(`Error saving leave booking: ${err.message}`, "warning");
    }
  };

  const handleApprove = async (requestId: string, staffName: string, days: number) => {
    if (onUpdateLeaveRequestStatus) {
      try {
        await onUpdateLeaveRequestStatus(requestId, 'approved');
        onShowToast(`Approved leave request for ${staffName} (${days} days)`, 'success');
      } catch (err: any) {
        onShowToast(`Error updating request: ${err.message}`, 'warning');
      }
    }
  };

  const handleReject = async (requestId: string, staffName: string) => {
    if (onUpdateLeaveRequestStatus) {
      if (window.confirm(`Are you sure you want to reject the leave request for ${staffName}?`)) {
        try {
          await onUpdateLeaveRequestStatus(requestId, 'rejected');
          onShowToast(`Rejected leave request for ${staffName}`, 'info');
        } catch (err: any) {
          onShowToast(`Error updating request: ${err.message}`, 'warning');
        }
      }
    }
  };

  const filteredRequests = leaveRequests.filter(req => {
    const employee = staff.find(s => s.id === req.staffId);
    if (!employee) return false;

    const matchesSearch = employee.fullName.toLowerCase().includes(requestSearch.toLowerCase()) ||
                          employee.jobTitle.toLowerCase().includes(requestSearch.toLowerCase()) ||
                          (req.notes && req.notes.toLowerCase().includes(requestSearch.toLowerCase()));

    const matchesStatus = requestStatusFilter === 'All' || req.status === requestStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Employee Leave Desk</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Review pending leave requests or book time off for staff.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowReqForm(prev => !prev)}>
          <Plus size={16} /> Book Time Off
        </button>
      </div>

      {showReqForm && (
        <form onSubmit={handleRequestSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
          <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
            <Plus size={14} /> Book Leave on Behalf of Employee
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Select Staff Members (Check all that apply) <span>*</span></label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                maxHeight: '130px',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                width: '100%'
              }}>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedStaffIds(staff.map(s => s.id))}
                    style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedStaffIds([])}
                    style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    Deselect All
                  </button>
                </div>
                {staff.map(s => {
                  const isChecked = selectedStaffIds.includes(s.id);
                  const employer = companies.find(c => c.id === s.companyId);
                  return (
                    <label 
                      key={s.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        fontSize: '12px', 
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        backgroundColor: isChecked ? 'rgba(99,102,241,0.05)' : 'transparent',
                        userSelect: 'none'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedStaffIds(prev => 
                            prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          );
                        }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                        {s.fullName} <span style={{ color: 'var(--text-muted)' }}>({s.jobTitle} - {employer ? employer.name : 'Group'})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Leave Type <span>*</span></label>
              <select 
                className="select-filter"
                value={reqType}
                onChange={(e) => setReqType(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="annual">Annual Leave (Vacation)</option>
                <option value="sick">Sick Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="other">Compassionate / Other</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Start Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={reqStartDate}
                onChange={(e) => setReqStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={reqEndDate}
                onChange={(e) => setReqEndDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Days <span>*</span></label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Days deducted"
                value={reqDays}
                onChange={(e) => setReqDays(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Admin Notes</label>
            <textarea 
              className="form-input" 
              rows={2}
              placeholder="Reason for manual override/booking..."
              value={reqNotes}
              onChange={(e) => setReqNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Book Approved Leave
          </button>
        </form>
      )}

      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group" style={{ flex: 1 }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search requests by employee name, notes..." 
              className="search-input"
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={requestStatusFilter}
            onChange={(e) => setRequestStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} className="empty-state-icon" />
          <h2>No Leave Records Found</h2>
          <p>Try resetting filters or submit a new time off request.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredRequests.map(req => {
            const employee = staff.find(s => s.id === req.staffId);
            const employerCompany = companies.find(c => c.id === employee?.companyId);
            
            const statusColors: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
              approved: { text: 'Approved', color: 'var(--success)', icon: <CheckCircle2 size={12} /> },
              pending: { text: 'Pending Review', color: 'var(--warning)', icon: <Clock size={12} /> },
              rejected: { text: 'Rejected', color: 'var(--danger)', icon: <XCircle size={12} /> }
            };
            const config = statusColors[req.status] || { text: req.status, color: 'var(--text-secondary)', icon: null };
            
            return (
              <div 
                key={req.id} 
                className="doc-card"
                style={{ 
                  alignItems: 'flex-start',
                  padding: '16px',
                  borderLeft: `4px solid ${req.status === 'pending' ? 'var(--warning)' : config.color}`,
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%',
                    backgroundColor: req.leaveType === 'sick' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                    color: req.leaveType === 'sick' ? 'var(--warning)' : 'var(--accent)',
                    marginTop: '2px',
                    flexShrink: 0
                  }}>
                    <Calendar size={18} />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {employee ? employee.fullName : 'Unknown Employee'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                          ({employee ? employee.jobTitle : ''} &bull; {employerCompany ? employerCompany.name : ''})
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        color: config.color,
                        backgroundColor: `${config.color}15`,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {config.icon}
                        {config.text}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Type: <strong style={{ textTransform: 'capitalize' }}>{req.leaveType} Leave</strong> &bull; 
                      Duration: <strong>{req.startDate}</strong> to <strong>{req.endDate}</strong> (<strong>{req.totalDays} {req.totalDays === 1 ? 'working day' : 'working days'}</strong>)
                    </div>

                    {req.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                        "{req.notes}"
                      </div>
                    )}

                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button 
                          className="btn-primary" 
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px',
                            backgroundColor: 'var(--success)',
                            borderColor: 'var(--success)',
                            color: '#000'
                          }}
                          onClick={() => handleApprove(req.id, employee?.fullName || 'Unknown', req.totalDays)}
                        >
                          <Check size={14} /> Approve Request
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px',
                            borderColor: 'var(--danger)',
                            color: 'var(--danger)'
                          }}
                          onClick={() => handleReject(req.id, employee?.fullName || 'Unknown')}
                        >
                          <X size={14} /> Reject Request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
