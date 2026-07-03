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
  onUpdateStaff,
  onShowToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('requests'); // requests, policies, holidays

  // Policy Edit & Assign modal states
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [assigningPolicyId, setAssigningPolicyId] = useState(null);
  const [assigningPolicyName, setAssigningPolicyName] = useState('');
  const [assigningStaffSearch, setAssigningStaffSearch] = useState('');
  const [assigningSelectedStaffIds, setAssigningSelectedStaffIds] = useState([]);
  const [assignCompanyFilter, setAssignCompanyFilter] = useState('all');
  const [assignDeptFilter, setAssignDeptFilter] = useState('all');
  const [assignSortBy, setAssignSortBy] = useState('fullName');
  const [assignSortOrder, setAssignSortOrder] = useState('asc');

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

  // Submit Policy Creation/Edit
  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    if (!policyName.trim() || !policyCompanyId || !policyAnnual || !policySick) {
      onShowToast("Please fill in all policy details.", "warning");
      return;
    }

    const payload = {
      id: editingPolicyId || `policy-${Date.now()}`,
      name: policyName.trim(),
      companyId: policyCompanyId,
      annualAllowance: Number(policyAnnual),
      sickAllowance: Number(policySick),
      description: policyDesc.trim()
    };

    try {
      await onSavePolicy(payload);
      onShowToast(editingPolicyId ? `Updated leave policy "${policyName}"` : `Created leave policy "${policyName}"`, "success");
      setPolicyName('');
      setPolicyDesc('');
      setEditingPolicyId(null);
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
                <Plus size={14} /> {editingPolicyId ? 'Edit Leave Allowance Policy' : 'Create Corporate Leave Policy'}
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => {
                    setEditingPolicyId(null);
                    setPolicyName('');
                    setPolicyDesc('');
                    setPolicyAnnual('25');
                    setPolicySick('10');
                    setShowPolicyForm(false);
                  }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editingPolicyId ? 'Save Changes' : 'Create Leave Policy'}
                </button>
              </div>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setAssigningPolicyId(p.id);
                        setAssigningPolicyName(p.name);
                        setAssigningStaffSearch('');
                        setAssignCompanyFilter('all');
                        setAssignDeptFilter('all');
                        setAssignSortBy('fullName');
                        setAssignSortOrder('asc');
                        const currentMappedIds = staff.filter(s => s.leavePolicyId === p.id).map(s => s.id);
                        setAssigningSelectedStaffIds(currentMappedIds);
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginRight: 'auto' }}
                    >
                      <Users size={12} /> Manage Assignments
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingPolicyId(p.id);
                        setPolicyName(p.name);
                        setPolicyCompanyId(p.companyId);
                        setPolicyAnnual(p.annualAllowance);
                        setPolicySick(p.sickAllowance);
                        setPolicyDesc(p.description || '');
                        setShowPolicyForm(true);
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Edit
                    </button>

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
                      style={{ height: '28px', width: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

      {/* Assign Users Modal */}
      {assigningPolicyId !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '650px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  👥 Assign Leave Allowance Policy to Staff
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Policy: <strong>{assigningPolicyName}</strong>
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setAssigningPolicyId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={assigningStaffSearch}
                  onChange={(e) => setAssigningStaffSearch(e.target.value)}
                  placeholder="Search by name or department..."
                  style={{ fontSize: '13px', padding: '8px 12px', height: '36px' }}
                />
              </div>
              <select
                className="select-filter"
                value={assignCompanyFilter}
                onChange={(e) => setAssignCompanyFilter(e.target.value)}
                style={{ fontSize: '12px', padding: '8px 12px', minWidth: '130px', height: '36px' }}
              >
                <option value="all">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                className="select-filter"
                value={assignDeptFilter}
                onChange={(e) => setAssignDeptFilter(e.target.value)}
                style={{ fontSize: '12px', padding: '8px 12px', minWidth: '130px', height: '36px' }}
              >
                <option value="all">All Departments</option>
                {Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {assigningSelectedStaffIds.length > 0 && (
              <div style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  Selected Staff: {assigningSelectedStaffIds.length} member(s)
                </span>
                <button
                  type="button"
                  onClick={() => setAssigningSelectedStaffIds([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: 0
                  }}
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Staff list with checkboxes */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {(() => {
                // Filter
                const filtered = staff.filter(s => {
                  const term = assigningStaffSearch.toLowerCase();
                  const matchesSearch = s.fullName.toLowerCase().includes(term) || (s.department || '').toLowerCase().includes(term);
                  const matchesCompany = assignCompanyFilter === 'all' || s.companyId === assignCompanyFilter;
                  const matchesDept = assignDeptFilter === 'all' || s.department === assignDeptFilter;
                  return matchesSearch && matchesCompany && matchesDept;
                });

                // Sort
                const sorted = [...filtered].sort((a, b) => {
                  let valA = '';
                  let valB = '';
                  if (assignSortBy === 'fullName') {
                    valA = a.fullName || '';
                    valB = b.fullName || '';
                  } else if (assignSortBy === 'company') {
                    valA = companies.find(c => c.id === a.companyId)?.name || '';
                    valB = companies.find(c => c.id === b.companyId)?.name || '';
                  } else if (assignSortBy === 'department') {
                    valA = a.department || '';
                    valB = b.department || '';
                  } else if (assignSortBy === 'policy') {
                    valA = leavePolicies.find(p => p.id === a.leavePolicyId)?.name || '';
                    valB = leavePolicies.find(p => p.id === b.leavePolicyId)?.name || '';
                  }
                  return assignSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                });

                const toggleSort = (field) => {
                  if (assignSortBy === field) {
                    setAssignSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setAssignSortBy(field);
                    setAssignSortOrder('asc');
                  }
                };

                return (
                  <table className="entity-table dense" style={{ fontSize: '11px', width: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={sorted.length > 0 && sorted.every(s => assigningSelectedStaffIds.includes(s.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssigningSelectedStaffIds(prev => Array.from(new Set([...prev, ...sorted.map(s => s.id)])));
                              } else {
                                setAssigningSelectedStaffIds(prev => prev.filter(id => !sorted.some(f => f.id === id)));
                              }
                            }}
                          />
                        </th>
                        <th onClick={() => toggleSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Staff Name {assignSortBy === 'fullName' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => toggleSort('company')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Company {assignSortBy === 'company' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => toggleSort('department')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Department / Role {assignSortBy === 'department' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => toggleSort('policy')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Current Policy Assignment {assignSortBy === 'policy' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(s => {
                        const isChecked = assigningSelectedStaffIds.includes(s.id);
                        const currentPolicy = leavePolicies.find(cp => cp.id === s.leavePolicyId);

                        return (
                          <tr 
                            key={s.id}
                            onClick={() => {
                              setAssigningSelectedStaffIds(prev => 
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }}
                            style={{ cursor: 'pointer', backgroundColor: isChecked ? 'rgba(99,102,241,0.04)' : 'transparent' }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setAssigningSelectedStaffIds(prev => 
                                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                  );
                                }}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                            <td>{companies.find(c => c.id === s.companyId)?.name || 'Employer'}</td>
                            <td>{s.department || 'N/A'} <span style={{ color: 'var(--text-muted)' }}>({s.jobTitle || 'N/A'})</span></td>
                            <td>
                              {currentPolicy ? (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: currentPolicy.id === assigningPolicyId ? 'var(--success-light)' : 'var(--border-color)',
                                  color: currentPolicy.id === assigningPolicyId ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                  {currentPolicy.name}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Unassigned</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {sorted.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                            No matching staff members found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => setAssigningPolicyId(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    const filtered = staff.filter(s => {
                      const term = assigningStaffSearch.toLowerCase();
                      const matchesSearch = s.fullName.toLowerCase().includes(term) || (s.department || '').toLowerCase().includes(term);
                      const matchesCompany = assignCompanyFilter === 'all' || s.companyId === assignCompanyFilter;
                      const matchesDept = assignDeptFilter === 'all' || s.department === assignDeptFilter;
                      return matchesSearch && matchesCompany && matchesDept;
                    });

                    for (const member of staff) {
                      const isVisible = filtered.some(f => f.id === member.id);
                      if (!isVisible) continue;

                      const shouldBeMapped = assigningSelectedStaffIds.includes(member.id);
                      const currentlyMapped = member.leavePolicyId === assigningPolicyId;

                      if (shouldBeMapped && !currentlyMapped) {
                        await onUpdateStaff({ ...member, leavePolicyId: assigningPolicyId });
                      } else if (!shouldBeMapped && currentlyMapped) {
                        await onUpdateStaff({ ...member, leavePolicyId: '' });
                      }
                    }
                    onShowToast("Staff leave policy assignments updated successfully!", "success");
                    setAssigningPolicyId(null);
                  } catch (err) {
                    onShowToast(`Error updating assignments: ${err.message}`, "warning");
                  }
                }}
              >
                Apply Assignments
              </button>
            </div>
          </div>
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
