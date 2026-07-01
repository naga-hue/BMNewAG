import React, { useState } from 'react';
import { Shield, CheckSquare, Square, Save, Users, Key } from 'lucide-react';

const MODULES_LIST = [
  { key: 'directory', label: 'Company Directory' },
  { key: 'staff', label: 'Staff & Consultants' },
  { key: 'leaves', label: 'Leaves & Holidays' },
  { key: 'commissions', label: 'Commission Plans' },
  { key: 'placements', label: 'Sales & Placements' },
  { key: 'expenses', label: 'Expense Ledger' },
  { key: 'vendors', label: 'Vendors & Assets' },
  { key: 'logs', label: 'Audit Trail Logs' },
  { key: 'reports', label: 'Profit & Loss / Reports' }
];

export default function RBACDashboard({
  staff = [],
  companies = [],
  onUpdateStaff,
  onShowToast
}) {
  const [editingStaffId, setEditingStaffId] = useState(null);
  
  // Editing state variables
  const [editRole, setEditRole] = useState('recruiter');
  const [editScope, setEditScope] = useState('self');
  const [editModules, setEditModules] = useState([]);
  const [editPassword, setEditPassword] = useState('');

  const handleEditClick = (s) => {
    setEditingStaffId(s.id);
    
    // Normalize permissions object if missing
    const perm = s.permissions || {
      role: s.department === 'Finance' || s.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter',
      dataScope: s.department === 'Finance' || s.jobTitle?.toLowerCase().includes('manager') ? 'department' : 'self',
      allowedModules: ['directory', 'staff', 'leaves', 'commissions', 'placements', 'expenses', 'vendors']
    };

    setEditRole(perm.role || 'recruiter');
    setEditScope(perm.dataScope || 'self');
    setEditModules(perm.allowedModules || []);
    setEditPassword(s.password || '');
  };

  const handleToggleModule = (modKey) => {
    setEditModules(prev => 
      prev.includes(modKey) ? prev.filter(m => m !== modKey) : [...prev, modKey]
    );
  };

  const handleSavePermissions = async (s) => {
    try {
      const updatedStaff = {
        ...s,
        password: editPassword.trim(),
        permissions: {
          role: editRole,
          dataScope: editScope,
          allowedModules: editModules
        }
      };

      await onUpdateStaff(updatedStaff);
      setEditingStaffId(null);
      if (onShowToast) onShowToast("Permissions updated successfully!", "success");
    } catch (error) {
      console.error(error);
      if (onShowToast) onShowToast("Failed to save permissions", "error");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>User Roles & Access Control</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure system access, dashboard modules, and data visibility permissions for your staff.</p>
      </div>

      <div className="table-container">
        <table className="entity-table dense">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <th>Staff Member</th>
              <th>Department / Company</th>
              <th>Access Role</th>
              <th>Sign-in Password</th>
              <th>Data Visibility Scope</th>
              <th>Allowed Modules</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => {
              const employer = companies.find(c => c.id === s.companyId);
              
              // Normalize displayed permission details
              const perm = s.permissions || {
                role: s.department === 'Finance' || s.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter',
                dataScope: s.department === 'Finance' || s.jobTitle?.toLowerCase().includes('manager') ? 'department' : 'self',
                allowedModules: ['directory', 'staff', 'leaves', 'commissions', 'placements', 'expenses', 'vendors']
              };

              const isEditing = editingStaffId === s.id;

              return (
                <tr key={s.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.fullName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.jobTitle}</div>
                  </td>
                  <td>{s.department || '—'} &bull; {employer ? employer.name : 'Group'}</td>
                  
                  {/* Role column */}
                  <td>
                    {isEditing ? (
                      <select 
                        className="select-filter" 
                        value={editRole} 
                        onChange={(e) => {
                          setEditRole(e.target.value);
                          // Auto set scope guidelines
                          if (e.target.value === 'admin') setEditScope('all');
                          else if (e.target.value === 'manager') setEditScope('department');
                          else setEditScope('self');
                        }}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        <option value="recruiter">Recruiter / Consultant</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Super Admin</option>
                      </select>
                    ) : (
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: perm.role === 'admin' ? 'var(--accent)' : perm.role === 'manager' ? 'var(--warning)' : 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'capitalize'
                      }}>
                        {perm.role}
                      </span>
                    )}
                  </td>

                  {/* Password column */}
                  <td>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Welcome123"
                        style={{ padding: '4px 8px', fontSize: '12px', width: '130px' }}
                      />
                    ) : (
                      <span style={{ fontSize: '12px', color: s.password ? 'var(--text-secondary)' : 'var(--danger)', fontFamily: s.password ? 'monospace' : 'inherit' }}>
                        {s.password ? '••••••••' : '⚠️ No password set'}
                      </span>
                    )}
                  </td>

                  {/* Scope column */}
                  <td>
                    {isEditing ? (
                      <select 
                        className="select-filter" 
                        value={editScope} 
                        onChange={(e) => setEditScope(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        <option value="self">Self Records Only</option>
                        <option value="department">Departmental Records</option>
                        <option value="all">All Group Records</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {perm.dataScope === 'all' ? 'All Group Records' :
                         perm.dataScope === 'department' ? 'Departmental Records' : 'Self Records Only'}
                      </span>
                    )}
                  </td>

                  {/* Allowed Modules column */}
                  <td style={{ maxWidth: '350px' }}>
                    {isEditing ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', padding: '6px 0' }}>
                        {MODULES_LIST.map(m => {
                          const checked = editModules.includes(m.key);
                          return (
                            <div 
                              key={m.key} 
                              onClick={() => handleToggleModule(m.key)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '11px', 
                                cursor: 'pointer',
                                userSelect: 'none',
                                color: checked ? 'var(--accent)' : 'var(--text-muted)'
                              }}
                            >
                              {checked ? <CheckSquare size={13} style={{ color: 'var(--accent)' }} /> : <Square size={13} />}
                              <span>{m.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(perm.allowedModules || []).map(mKey => {
                          const mLabel = MODULES_LIST.find(ml => ml.key === mKey)?.label || mKey;
                          return (
                            <span 
                              key={mKey} 
                              style={{ 
                                fontSize: '9px', 
                                backgroundColor: 'rgba(99, 102, 241, 0.08)', 
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                color: 'var(--accent)',
                                padding: '1px 6px',
                                borderRadius: '3px'
                              }}
                            >
                              {mLabel}
                            </span>
                          );
                        })}
                        {(perm.allowedModules || []).length === 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No modules permitted</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions column */}
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {isEditing ? (
                        <>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleSavePermissions(s)}
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '11px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              backgroundColor: 'var(--success)',
                              borderColor: 'var(--success)'
                            }}
                          >
                            <Save size={12} /> Save
                          </button>
                          <button 
                            className="btn-secondary" 
                            onClick={() => setEditingStaffId(null)}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleEditClick(s)}
                          style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Shield size={12} /> Configure
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {staff.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No staff members registered. Please create staff records in the Directory first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
