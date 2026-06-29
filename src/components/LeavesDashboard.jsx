import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  FileText
} from 'lucide-react';

export default function LeavesDashboard({ 
  companies, 
  staff, 
  leavePolicies, 
  leaveRequests, 
  holidays,
  onSavePolicy,
  onDeletePolicy,
  onSaveHoliday,
  onDeleteHoliday,
  onSaveLeaveRequest,
  onUpdateLeaveRequestStatus,
  onShowToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('requests'); // requests, policies, holidays

  // Form states - Request Leave
  const [reqStaffId, setReqStaffId] = useState('');
  const [reqType, setReqType] = useState('annual');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqDays, setReqDays] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [showReqForm, setShowReqForm] = useState(false);

  // Form states - Policy
  const [policyName, setPolicyName] = useState('');
  const [policyCompanyId, setPolicyCompanyId] = useState(companies[0]?.id || '');
  const [policyAnnual, setPolicyAnnual] = useState('25');
  const [policySick, setPolicySick] = useState('10');
  const [policyDesc, setPolicyDesc] = useState('');
  const [showPolicyForm, setShowPolicyForm] = useState(false);

  // Form states - Holiday
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayCompanyId, setHolidayCompanyId] = useState('All');
  const [holidayAddCompanyId, setHolidayAddCompanyId] = useState(companies[0]?.id || '');
  const [showHolidayForm, setShowHolidayForm] = useState(false);

  // Search & Filter states
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending');

  // Submit Leave Request (Admin booking on behalf of staff)
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqStaffId || !reqStartDate || !reqEndDate || !reqDays || Number(reqDays) <= 0) {
      onShowToast("Please enter all required leave request details.", "warning");
      return;
    }

    const selectedEmployee = staff.find(s => s.id === reqStaffId);
    if (!selectedEmployee) return;

    const newRequest = {
      id: `req-${Date.now()}`,
      staffId: reqStaffId,
      leaveType: reqType,
      startDate: reqStartDate,
      endDate: reqEndDate,
      totalDays: Number(reqDays),
      status: "approved", // auto-approve admin bookings
      notes: `${reqNotes.trim()} (Admin Booked)`
    };

    try {
      await onSaveLeaveRequest(newRequest);
      onShowToast(`Successfully booked ${reqDays} days of ${reqType} leave for ${selectedEmployee.fullName}`, "success");
      
      // Reset form
      setReqStaffId('');
      setReqStartDate('');
      setReqEndDate('');
      setReqDays('');
      setReqNotes('');
      setShowReqForm(false);
    } catch (err) {
      onShowToast(`Error saving leave booking: ${err.message}`, "warning");
    }
  };

  // Submit Policy Creation
  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    if (!policyName.trim() || !policyCompanyId || !policyAnnual || !policySick) {
      onShowToast("Please fill in all policy details.", "warning");
      return;
    }

    const newPolicy = {
      id: `policy-${Date.now()}`,
      name: policyName.trim(),
      companyId: policyCompanyId,
      annualAllowance: Number(policyAnnual),
      sickAllowance: Number(policySick),
      description: policyDesc.trim()
    };

    try {
      await onSavePolicy(newPolicy);
      onShowToast(`Created leave policy "${policyName}"`, "success");
      setPolicyName('');
      setPolicyDesc('');
      setShowPolicyForm(false);
    } catch (err) {
      onShowToast(`Error saving policy: ${err.message}`, "warning");
    }
  };

  // Submit Public Holiday
  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate || !holidayAddCompanyId) {
      onShowToast("Please fill in all holiday details.", "warning");
      return;
    }

    const newHoliday = {
      id: `hol-${Date.now()}`,
      companyId: holidayAddCompanyId,
      name: holidayName.trim(),
      date: holidayDate
    };

    try {
      await onSaveHoliday(newHoliday);
      onShowToast(`Created public holiday "${holidayName}"`, "success");
      setHolidayName('');
      setHolidayDate('');
      setShowHolidayForm(false);
    } catch (err) {
      onShowToast(`Error saving holiday: ${err.message}`, "warning");
    }
  };

  // Handle approvals
  const handleApprove = async (requestId, staffName, days) => {
    try {
      await onUpdateLeaveRequestStatus(requestId, 'approved');
      onShowToast(`Approved leave request for ${staffName} (${days} days)`, 'success');
    } catch (err) {
      onShowToast(`Error updating request: ${err.message}`, 'warning');
    }
  };

  const handleReject = async (requestId, staffName) => {
    if (window.confirm(`Are you sure you want to reject the leave request for ${staffName}?`)) {
      try {
        await onUpdateLeaveRequestStatus(requestId, 'rejected');
        onShowToast(`Rejected leave request for ${staffName}`, 'info');
      } catch (err) {
        onShowToast(`Error updating request: ${err.message}`, 'warning');
      }
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (window.confirm("Are you sure you want to delete this leave request record?")) {
      // delete
      onShowToast("Deleted leave record", "info");
    }
  };

  // Filter requests
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
      
      {/* Sub-tab Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        width: 'fit-content',
        gap: '4px'
      }}>
        {[
          { key: 'requests', label: 'Leave Requests Desk' },
          { key: 'policies', label: 'Leave Policies' },
          { key: 'holidays', label: 'Public Holidays' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              color: activeSubTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.label}
            {t.key === 'requests' && leaveRequests.filter(r => r.status === 'pending').length > 0 && (
              <span style={{ 
                marginLeft: '6px', 
                background: 'var(--warning)', 
                color: '#000', 
                fontSize: '10px', 
                padding: '2px 6px', 
                borderRadius: '8px',
                fontWeight: 700
              }}>
                {leaveRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==============================================================
          SUB-TAB 1: LEAVE REQUESTS DESK
          ============================================================== */}
      {activeSubTab === 'requests' && (
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

          {/* Admin Booking Form */}
          {showReqForm && (
            <form onSubmit={handleRequestSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> Book Leave on Behalf of Employee
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Select Employee <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={reqStaffId}
                    onChange={(e) => setReqStaffId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {staff.map(s => {
                      const employer = companies.find(c => c.id === s.companyId);
                      return (
                        <option key={s.id} value={s.id}>{s.fullName} ({s.jobTitle} - {employer ? employer.name : 'Group'})</option>
                      );
                    })}
                  </select>
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
                  rows="2"
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

          {/* Search and Filters */}
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

          {/* Requests List */}
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
                
                const statusColors = {
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

                        {/* Approval Actions Panel (Only visible for pending requests) */}
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
                              onClick={() => handleApprove(req.id, employee?.fullName, req.totalDays)}
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
                              onClick={() => handleReject(req.id, employee?.fullName)}
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
      )}

      {/* ==============================================================
          SUB-TAB 2: LEAVE POLICIES
          ============================================================== */}
      {activeSubTab === 'policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Group Leave Policies</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Define leave frameworks and maps for each of the group entities.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowPolicyForm(prev => !prev)}>
              <Plus size={16} /> Create Leave Policy
            </button>
          </div>

          {/* Create Policy Form */}
          {showPolicyForm && (
            <form onSubmit={handlePolicySubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> Create Corporate Leave Policy
              </div>

              <div className="form-group">
                <label className="form-label">Policy Name <span>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. UK Full-time 25-Day Roster"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Applicable Company <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={policyCompanyId}
                    onChange={(e) => setPolicyCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Annual Allowance (Days) <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={policyAnnual}
                    onChange={(e) => setPolicyAnnual(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sick Allowance (Days) <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={policySick}
                    onChange={(e) => setPolicySick(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Internal Rules</label>
                <textarea 
                  className="form-input" 
                  rows="2"
                  placeholder="Specific rollover rules, probation limits..."
                  value={policyDesc}
                  onChange={(e) => setPolicyDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Save Leave Policy
              </button>
            </form>
          )}

          {/* Policies Grid */}
          <div className="entities-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {leavePolicies.map(p => {
              const matchedComp = companies.find(c => c.id === p.companyId);
              const mappedStaffCount = staff.filter(s => s.leavePolicyId === p.id).length;
              
              return (
                <div key={p.id} className="entity-card" style={{ height: 'auto', padding: '16px' }}>
                  <div className="entity-card-header" style={{ marginBottom: '8px' }}>
                    <div className="entity-title-group">
                      <span className="entity-name" style={{ fontSize: '15px' }}>{p.name}</span>
                      <span className="entity-legal-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={12} />
                        {matchedComp ? matchedComp.name : 'Unknown Employer'}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.description || "No description provided."}
                  </p>

                  <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Annual</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>{p.annualAllowance}d</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sick</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--warning)' }}>{p.sickAllowance}d</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Users size={12} /> {mappedStaffCount}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-icon delete" 
                      onClick={() => {
                        if (mappedStaffCount > 0) {
                          onShowToast("Cannot delete policy. Employee profiles are currently mapped to this policy.", "warning");
                          return;
                        }
                        if (window.confirm(`Are you sure you want to delete policy "${p.name}"?`)) {
                          onDeletePolicy(p.id);
                          onShowToast(`Deleted policy "${p.name}"`, "info");
                        }
                      }}
                      title="Delete Policy"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: PUBLIC HOLIDAYS
          ============================================================== */}
      {activeSubTab === 'holidays' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Company Public Holidays</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Set holidays for each country and company. These are excluded from leave calculations.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowHolidayForm(prev => !prev)}>
              <Plus size={16} /> Add Holiday
            </button>
          </div>

          {/* Add Holiday Form */}
          {showHolidayForm && (
            <form onSubmit={handleHolidaySubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> Add Public Holiday Calendar Event
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Holiday Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Good Friday"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Event Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company Group Roster <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={holidayAddCompanyId}
                    onChange={(e) => setHolidayAddCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Save Holiday Event
              </button>
            </form>
          )}

          {/* Filter dropdown */}
          <div className="controls-row" style={{ marginTop: 0 }}>
            <div className="search-filter-group">
              <span className="form-label" style={{ margin: 0, alignSelf: 'center' }}>Filter Roster:</span>
              <select 
                className="select-filter"
                value={holidayCompanyId}
                onChange={(e) => setHolidayCompanyId(e.target.value)}
              >
                <option value="All">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Holidays List */}
          {holidays.length === 0 ? (
            <div className="empty-state">
              <Calendar size={64} className="empty-state-icon" />
              <h2>No Public Holidays Defined</h2>
            </div>
          ) : (
            <div className="table-container">
              <table className="entity-table">
                <thead>
                  <tr>
                    <th>Holiday Title</th>
                    <th>Date Scheduled</th>
                    <th>Applicable Company</th>
                    <th>Region / Country</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays
                    .filter(h => holidayCompanyId === 'All' || h.companyId === holidayCompanyId)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map(h => {
                      const matComp = companies.find(c => c.id === h.companyId);
                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>{h.name}</td>
                          <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                            {h.date}
                          </td>
                          <td>{matComp ? matComp.name : 'Unknown Group'}</td>
                          <td>
                            <span className={`country-badge country-${matComp ? matComp.country.toLowerCase().replace(/[^a-z]/g, '') : 'uk'}`}>
                              {matComp ? matComp.country : 'Unknown'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn-icon delete" 
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete holiday "${h.name}"?`)) {
                                    onDeleteHoliday(h.id);
                                    onShowToast(`Deleted holiday "${h.name}"`, "info");
                                  }
                                }}
                                title="Remove Holiday"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

// Simple search icon component mockup
function Search({ size = 16, className = "" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
