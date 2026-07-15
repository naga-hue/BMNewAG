import React, { useState } from 'react';
import { Plus, Users, Building2, Trash2 } from 'lucide-react';
import { Company, Staff } from '../../types';

interface LeavePoliciesSetupProps {
  companies: Company[];
  staff: Staff[];
  leavePolicies: any[];
  onSavePolicy: (policy: any) => Promise<any>;
  onDeletePolicy?: (id: string) => Promise<any>;
  onUpdateStaff?: (s: Staff) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function LeavePoliciesSetup({
  companies,
  staff,
  leavePolicies,
  onSavePolicy,
  onDeletePolicy,
  onUpdateStaff,
  onShowToast
}: LeavePoliciesSetupProps) {
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyName, setPolicyName] = useState('');
  const [policyCompanyId, setPolicyCompanyId] = useState(companies[0]?.id || '');
  const [policyAnnual, setPolicyAnnual] = useState('25');
  const [policySick, setPolicySick] = useState('10');
  const [policyDesc, setPolicyDesc] = useState('');
  
  // Department overrides state
  const [deptOverrides, setDeptOverrides] = useState<{[key: string]: {annualAllowance: number, sickAllowance: number}}>({});
  const [overrideDept, setOverrideDept] = useState('');
  const [overrideAnnual, setOverrideAnnual] = useState('20');
  const [overrideSick, setOverrideSick] = useState('5');

  // Assign Users Modal states
  const [assigningPolicyId, setAssigningPolicyId] = useState<string | null>(null);
  const [assigningPolicyName, setAssigningPolicyName] = useState('');
  const [assigningStaffSearch, setAssigningStaffSearch] = useState('');
  const [assigningSelectedStaffIds, setAssigningSelectedStaffIds] = useState<string[]>([]);
  const [assignCompanyFilter, setAssignCompanyFilter] = useState('all');
  const [assignDeptFilter, setAssignDeptFilter] = useState('all');
  const [assignSortBy, setAssignSortBy] = useState('fullName');
  const [assignSortOrder, setAssignSortOrder] = useState<'asc' | 'desc'>('asc');

  const handlePolicySubmit = async (e: React.FormEvent) => {
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
      description: policyDesc.trim(),
      departmentOverrides: deptOverrides
    };

    try {
      await onSavePolicy(payload);
      onShowToast(editingPolicyId ? `Updated leave policy "${policyName}"` : `Created leave policy "${policyName}"`, "success");
      setPolicyName('');
      setPolicyDesc('');
      setDeptOverrides({});
      setEditingPolicyId(null);
      setShowPolicyForm(false);
    } catch (err: any) {
      onShowToast(`Error saving policy: ${err.message}`, "warning");
    }
  };

  const handleToggleSort = (field: string) => {
    if (assignSortBy === field) {
      setAssignSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setAssignSortBy(field);
      setAssignSortOrder('asc');
    }
  };

  return (
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
              rows={2}
              placeholder="Specific rollover rules, probation limits..."
              value={policyDesc}
              onChange={(e) => setPolicyDesc(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Department overrides setup panel */}
          <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--accent)' }}>🏢 Departmental Overrides</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <select
                className="select-filter"
                value={overrideDept}
                onChange={(e) => setOverrideDept(e.target.value)}
                style={{ flex: 1, padding: '6px' }}
              >
                <option value="">-- Choose Dept --</option>
                {["Recruitment", "Sales & Marketing", "Finance", "Operations", "Sourcing", "HR", "Admin"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Annual"
                className="form-input"
                value={overrideAnnual}
                onChange={(e) => setOverrideAnnual(e.target.value)}
                style={{ width: '70px', padding: '6px' }}
              />
              <input
                type="number"
                placeholder="Sick"
                className="form-input"
                value={overrideSick}
                onChange={(e) => setOverrideSick(e.target.value)}
                style={{ width: '70px', padding: '6px' }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!overrideDept) return;
                  setDeptOverrides(prev => ({
                    ...prev,
                    [overrideDept]: {
                      annualAllowance: Number(overrideAnnual),
                      sickAllowance: Number(overrideSick)
                    }
                  }));
                  setOverrideDept('');
                }}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                Add Override
              </button>
            </div>
            {Object.keys(deptOverrides).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {Object.entries(deptOverrides).map(([dept, data]: [string, any]) => (
                  <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <strong>{dept}</strong>: {data.annualAllowance}d Annual / {data.sickAllowance}d Sick
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...deptOverrides };
                        delete updated[dept];
                        setDeptOverrides(updated);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                setDeptOverrides({});
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
              </p>

              {p.departmentOverrides && Object.keys(p.departmentOverrides).length > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <strong>Department Overrides:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {Object.entries(p.departmentOverrides).map(([dept, data]: [string, any]) => (
                      <span key={dept} style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '3px' }}>
                        {dept}: {data.annualAllowance}a / {data.sickAllowance}s
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                    setDeptOverrides(p.departmentOverrides || {});
                    setShowPolicyForm(true);
                  }}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  Edit
                </button>

                {onDeletePolicy && (
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
                )}
              </div>
            </div>
          );
        })}
      </div>

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

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {(() => {
                const filtered = staff.filter(s => {
                  const term = assigningStaffSearch.toLowerCase();
                  const matchesSearch = s.fullName.toLowerCase().includes(term) || (s.department || '').toLowerCase().includes(term);
                  const matchesCompany = assignCompanyFilter === 'all' || s.companyId === assignCompanyFilter;
                  const matchesDept = assignDeptFilter === 'all' || s.department === assignDeptFilter;
                  return matchesSearch && matchesCompany && matchesDept;
                });

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
                        <th onClick={() => handleToggleSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Staff Name {assignSortBy === 'fullName' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => handleToggleSort('company')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Company {assignSortBy === 'company' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => handleToggleSort('department')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Department / Role {assignSortBy === 'department' ? (assignSortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                        </th>
                        <th onClick={() => handleToggleSort('policy')} style={{ cursor: 'pointer', userSelect: 'none' }}>
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
                          <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
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
                  if (onUpdateStaff) {
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
                          await onUpdateStaff({ ...member, leavePolicyId: assigningPolicyId || '' });
                        } else if (!shouldBeMapped && currentlyMapped) {
                          await onUpdateStaff({ ...member, leavePolicyId: '' });
                        }
                      }
                      onShowToast("Staff leave policy assignments updated successfully!", "success");
                      setAssigningPolicyId(null);
                    } catch (err: any) {
                      onShowToast(`Error updating assignments: ${err.message}`, "warning");
                    }
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
