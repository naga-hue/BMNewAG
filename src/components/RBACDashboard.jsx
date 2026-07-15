import React, { useState } from 'react';
import { Shield, CheckSquare, Square, Save, Users, Key, FileText, Settings, Edit3, Trash2, Plus, AlertTriangle, Upload } from 'lucide-react';
import { firebaseService } from '../services/firebase';

const MODULES_LIST = [
  { key: 'directory', label: 'Company Directory' },
  { key: 'staff', label: 'Staff & Consultants' },
  { key: 'leaves', label: 'Leaves & Holidays' },
  { key: 'commissions', label: 'Commission Plans' },
  { key: 'placements', label: 'Sales & Placements' },
  { key: 'expenses', label: 'Expense Ledger' },
  { key: 'vendors', label: 'Vendors & Assets' },
  { key: 'credit_control', label: 'Credit Control Invoices' },
  { key: 'cashflow', label: 'Cashflow Projections' },
  { key: 'logs', label: 'Audit Trail Logs' },
  { key: 'reports', label: 'Profit & Loss / Reports' }
];

export default function RBACDashboard({
  staff = [],
  companies = [],
  onUpdateStaff,
  onShowToast,
  letterTemplates = [],
  onSaveLetterTemplate,
  onDeleteLetterTemplate,
  onUpdateCompany,
  exitSettings = {},
  onSaveExitSettings
}) {
  const [activeSubTab, setActiveSubTab] = useState('permissions'); // permissions, letterheads, custom-roles
  const [editingStaffId, setEditingStaffId] = useState(null);

  // Custom Roles state
  const [customRoles, setCustomRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-custom-roles');
      return saved ? JSON.parse(saved) : {
        'Finance Auditor': ['directory', 'expenses', 'credit_control', 'reports'],
        'HR Specialist': ['directory', 'staff', 'leaves']
      };
    } catch {
      return {};
    }
  });
  const [newRoleBuilderName, setNewRoleBuilderName] = useState('');
  const [newRoleBuilderModules, setNewRoleBuilderModules] = useState([]);

  // Letterhead editing states
  const [selectedLhCompanyId, setSelectedLhCompanyId] = useState(companies[0] ? companies[0].id : '');
  const [lhLogoUrl, setLhLogoUrl] = useState('');
  const [lhAddressOverride, setLhAddressOverride] = useState('');
  const [lhSignatureText, setLhSignatureText] = useState('');
  const [lhAccentColor, setLhAccentColor] = useState('#3b82f6');
  const [lhLetterheadBgUrl, setLhLetterheadBgUrl] = useState('');
  const [isUploadingLh, setIsUploadingLh] = useState(false);

  // Template editing states
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState('offer-letter');
  const [tempBody, setTempBody] = useState('');

  const [editingTemplateRole, setEditingTemplateRole] = useState('hr');

  // Exit settings states
  const [hrEmail, setHrEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [itEmail, setItEmail] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [exitEmailTemplate, setExitEmailTemplate] = useState('');

  // Role templates and flags
  const [hrTemplate, setHrTemplate] = useState('');
  const [itTemplate, setItTemplate] = useState('');
  const [opsTemplate, setOpsTemplate] = useState('');
  const [mdTemplate, setMdTemplate] = useState('');
  const [sendToHr, setSendToHr] = useState(true);
  const [sendToIt, setSendToIt] = useState(true);
  const [sendToOps, setSendToOps] = useState(true);
  const [sendToMd, setSendToMd] = useState(true);

  // Bulk Company Contacts selection states
  const [selectedContactCompanyIds, setSelectedContactCompanyIds] = useState([]);
  const [matrixHrStaffId, setMatrixHrStaffId] = useState('');
  const [matrixItStaffId, setMatrixItStaffId] = useState('');
  const [matrixOpsStaffId, setMatrixOpsStaffId] = useState('');
  const [matrixMdStaffId, setMatrixMdStaffId] = useState('');

  React.useEffect(() => {
    setHrEmail(exitSettings.hrEmail || 'hr@humres.co.uk');
    setAdminEmail(exitSettings.adminEmail || 'admin@humres.co.uk');
    setItEmail(exitSettings.itEmail || 'it@humres.co.uk');
    setDirectorEmail(exitSettings.directorEmail || 'director@humres.co.uk');
    setExitEmailTemplate(exitSettings.exitEmailTemplate || `Dear Team,\n\nPlease be informed that {{staff_name}} will be leaving {{company_name}}. Their actual last working date will be {{last_working_date}}.\n\nNotice Details:\n- Notice Period: {{notice_period}}\n- Notice Pay Period: {{notice_pay_period}}\n- Salary Paid Until: {{salary_paid_until}}\n- Severance Payment: {{severance_pay}}\n\nPlease configure account deactivation clearances and asset recovery clear-offs.\n\nSincerely,\nHR Operations`);
    
    setHrTemplate(exitSettings.hrTemplate || `Dear HR Team,\n\nPlease note that {{staff_name}} will be leaving the company on {{last_working_date}}.\n\nWork Location Details:\n{{office_locations}}\n\nPlease schedule their exit interview and process local HR clearances.\n\nSincerely,\nOperations`);
    setItTemplate(exitSettings.itTemplate || `Dear IT Helpdesk,\n\nPlease de-provision accounts and recover all assigned company assets for {{staff_name}} who is exiting on {{last_working_date}}.\n\nAssigned Assets on File:\n{{asset_list}}\n\nSincerely,\nOperations`);
    setOpsTemplate(exitSettings.opsTemplate || `Dear Operations Team,\n\nPlease process operational offboarding for {{staff_name}} ({{job_title}}). Last working date is {{last_working_date}}.\n\nSincerely,\nHR Department`);
    setMdTemplate(exitSettings.mdTemplate || `Dear Managing Director,\n\nFor your information, {{staff_name}} ({{job_title}}) is leaving the company. Notice details: {{notice_period}} (Notice pay: {{notice_pay_period}}). Last day: {{last_working_date}}.\n\nSincerely,\nHR Department`);
    
    setSendToHr(exitSettings.sendToHr !== false);
    setSendToIt(exitSettings.sendToIt !== false);
    setSendToOps(exitSettings.sendToOps !== false);
    setSendToMd(exitSettings.sendToMd !== false);
  }, [exitSettings]);

  const handleSaveExits = async () => {
    const settings = {
      hrEmail,
      adminEmail,
      itEmail,
      directorEmail,
      exitEmailTemplate,
      hrTemplate,
      itTemplate,
      opsTemplate,
      mdTemplate,
      sendToHr,
      sendToIt,
      sendToOps,
      sendToMd
    };
    try {
      await onSaveExitSettings(settings);
      onShowToast("Exit settings saved successfully!", "success");
    } catch (e) {
      onShowToast("Error saving exit settings: " + e.message, "danger");
    }
  };

  const handleBulkAssignContacts = async () => {
    if (selectedContactCompanyIds.length === 0) {
      onShowToast("Please select at least one company to assign contacts.", "warning");
      return;
    }
    let count = 0;
    try {
      for (const compId of selectedContactCompanyIds) {
        const company = companies.find(c => c.id === compId);
        if (company) {
          const updated = {
            ...company,
            hrContactId: matrixHrStaffId || company.hrContactId || '',
            itContactId: matrixItStaffId || company.itContactId || '',
            opsContactId: matrixOpsStaffId || company.opsContactId || '',
            mdContactId: matrixMdStaffId || company.mdContactId || ''
          };
          await onUpdateCompany(updated);
          count++;
        }
      }
      onShowToast(`Successfully assigned contacts for ${count} companies!`, "success");
      setSelectedContactCompanyIds([]);
      setMatrixHrStaffId('');
      setMatrixItStaffId('');
      setMatrixOpsStaffId('');
      setMatrixMdStaffId('');
    } catch (err) {
      onShowToast("Error updating company contacts: " + err.message, "danger");
    }
  };

  // Sync letterhead form when chosen company changes
  React.useEffect(() => {
    const comp = companies.find(c => c.id === selectedLhCompanyId);
    if (comp) {
      setLhLogoUrl(comp.logoUrl || '');
      setLhAddressOverride(comp.addressOverride || '');
      setLhSignatureText(comp.signatureText || 'Authorized Signatory');
      setLhAccentColor(comp.accentColor || '#3b82f6');
      setLhLetterheadBgUrl(comp.letterheadBgUrl || '');
    }
  }, [selectedLhCompanyId, companies]);

  const handleUploadLetterheadBg = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedLhCompanyId) return;
    setIsUploadingLh(true);
    try {
      const url = await firebaseService.uploadLetterheadBg(selectedLhCompanyId, file);
      setLhLetterheadBgUrl(url);
      onShowToast("Letterhead background uploaded successfully!", "success");
    } catch (err) {
      console.error("Upload letterhead background error:", err);
      onShowToast("Upload failed: " + err.message, "danger");
    } finally {
      setIsUploadingLh(false);
    }
  };

  // Handle Save Letterhead
  const handleSaveLetterhead = async () => {
    const comp = companies.find(c => c.id === selectedLhCompanyId);
    if (!comp) return;

    const updated = {
      ...comp,
      logoUrl: lhLogoUrl,
      addressOverride: lhAddressOverride,
      signatureText: lhSignatureText,
      accentColor: lhAccentColor,
      letterheadBgUrl: lhLetterheadBgUrl
    };

    try {
      await onUpdateCompany(updated);
      onShowToast("Letterhead branding saved successfully!", "success");
    } catch (e) {
      onShowToast("Error saving letterhead: " + e.message, "danger");
    }
  };

  // Handle Save Template
  const handleSaveTemplate = async () => {
    if (!tempName.trim()) {
      onShowToast("Template Name is required.", "warning");
      return;
    }

    const t = {
      id: editingTemplateId || 'temp-' + Date.now(),
      name: tempName.trim(),
      type: tempType,
      body: tempBody
    };

    try {
      await onSaveLetterTemplate(t);
      setEditingTemplateId(null);
      setTempName('');
      setTempBody('');
    } catch (e) {
      onShowToast("Failed to save template: " + e.message, "danger");
    }
  };

  const handleEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    setTempName(t.name);
    setTempType(t.type);
    setTempBody(t.body);
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplateId('new');
    setTempName('New Letter Template');
    setTempType('general');
    setTempBody(`Date: {{current_date}}

To: {{staff_name}}

Dear {{staff_name}},

[Write letter body...]

Yours sincerely,

{{signature}}
{{company_name}}`);
  };
  
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
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '16px' }}>
        <button 
          onClick={() => setActiveSubTab('permissions')}
          style={{ 
            padding: '10px 16px', 
            border: 'none', 
            background: 'none', 
            fontSize: '14px', 
            fontWeight: 600, 
            cursor: 'pointer',
            borderBottom: activeSubTab === 'permissions' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'permissions' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <Shield size={14} style={{ marginRight: '6px' }} /> User Permissions & Access
        </button>
        <button 
          onClick={() => setActiveSubTab('letterheads')}
          style={{ 
            padding: '10px 16px', 
            border: 'none', 
            background: 'none', 
            fontSize: '14px', 
            fontWeight: 600, 
            cursor: 'pointer',
            borderBottom: activeSubTab === 'letterheads' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'letterheads' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <FileText size={14} style={{ marginRight: '6px' }} /> Letterheads & Templates
        </button>
        <button 
          onClick={() => setActiveSubTab('exits')}
          style={{ 
            padding: '10px 16px', 
            border: 'none', 
            background: 'none', 
            fontSize: '14px', 
            fontWeight: 600, 
            cursor: 'pointer',
            borderBottom: activeSubTab === 'exits' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'exits' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <AlertTriangle size={14} style={{ marginRight: '6px' }} /> Exit Settings & Emails
        </button>
        <button 
          onClick={() => setActiveSubTab('custom-roles')}
          style={{ 
            padding: '10px 16px', 
            border: 'none', 
            background: 'none', 
            fontSize: '14px', 
            fontWeight: 600, 
            cursor: 'pointer',
            borderBottom: activeSubTab === 'custom-roles' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'custom-roles' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <Shield size={14} style={{ marginRight: '6px' }} /> Custom Roles Builder
        </button>
      </div>

      {activeSubTab === 'permissions' ? (
        <>
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
                          const val = e.target.value;
                          setEditRole(val);
                          if (val === 'admin') {
                            setEditScope('all');
                          } else if (val === 'manager') {
                            setEditScope('department');
                          } else if (customRoles[val]) {
                            setEditScope('department');
                            setEditModules(customRoles[val]);
                          } else {
                            setEditScope('self');
                          }
                        }}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        <option value="recruiter">Recruiter / Consultant</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Super Admin</option>
                        {Object.keys(customRoles).map(rName => (
                          <option key={rName} value={rName}>{rName}</option>
                        ))}
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditRole('admin');
                              setEditScope('all');
                              setEditModules(MODULES_LIST.map(m => m.key));
                            }}
                            style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--accent)', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
                          >
                            ⭐ Super Admin Blueprint
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditRole('recruiter');
                              setEditScope('self');
                              setEditModules(['directory', 'staff', 'leaves', 'commissions', 'placements', 'expenses', 'vendors']);
                            }}
                            style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
                          >
                            💼 Recruiter Blueprint
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditRole('manager');
                              setEditScope('all');
                              setEditModules(['directory', 'staff', 'leaves', 'commissions', 'placements', 'expenses', 'vendors', 'credit_control', 'cashflow', 'reports']);
                            }}
                            style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--warning)', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
                          >
                            📊 Finance Blueprint
                          </button>
                        </div>
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
    </>
  ) : activeSubTab === 'letterheads' ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
      
      {/* 1. Letterhead configuration override */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}><Settings size={16} style={{ marginRight: '6px' }} /> Company Letterhead Manager</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configure headers, branding color, and signatures per legal entity.</p>
        </div>

        <div className="form-group">
          <label className="form-label">Select Company</label>
          <select 
            className="select-filter" 
            value={selectedLhCompanyId}
            onChange={(e) => setSelectedLhCompanyId(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Official Header Logo URL</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. https://domain.com/logo.png"
            value={lhLogoUrl}
            onChange={(e) => setLhLogoUrl(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Or Upload Custom Letterhead Background Image (Optional)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleUploadLetterheadBg}
              style={{ display: 'none' }}
              id="lh-bg-upload-file"
            />
            <label htmlFor="lh-bg-upload-file" className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Upload size={14} style={{ marginRight: '4px' }} /> {isUploadingLh ? 'Uploading...' : 'Choose Letterhead Image'}
            </label>
            {lhLetterheadBgUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--success)' }}>✓ Letterhead Loaded</span>
                <button type="button" className="btn-secondary" onClick={() => setLhLetterheadBgUrl('')} style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            If uploaded, letters will print text directly on top of this background (hiding the generated text logo/address headers).
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Official Registry Office Address</label>
          <textarea 
            className="form-input" 
            rows="3" 
            placeholder="Address showing at top-left corner"
            value={lhAddressOverride}
            onChange={(e) => setLhAddressOverride(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Authorized Signatory Label</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="CEO / Managing Director Name"
            value={lhSignatureText}
            onChange={(e) => setLhSignatureText(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Accent Color Hex</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="color" 
              value={lhAccentColor}
              onChange={(e) => setLhAccentColor(e.target.value)}
              style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
            <input 
              type="text" 
              className="form-input" 
              value={lhAccentColor}
              onChange={(e) => setLhAccentColor(e.target.value)}
              style={{ width: '100px' }}
            />
          </div>
        </div>

        <button className="btn-primary" onClick={handleSaveLetterhead} style={{ marginTop: '8px' }}>
          Save Letterhead Branding
        </button>
      </div>

      {/* 2. Prefilled Document Templates manager */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}><FileText size={16} style={{ marginRight: '6px' }} /> Document Templates Library</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage prefilled letters, employment contracts, and exit agreements with dynamic tokens.</p>
          </div>
          {!editingTemplateId && (
            <button className="btn-primary" onClick={handleCreateNewTemplate} style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={12} /> Add Template
            </button>
          )}
        </div>

        {editingTemplateId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
              {editingTemplateId === 'new' ? 'Create New Template' : 'Edit Template'}
            </h4>
            
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>Template Title / Name</label>
              <input 
                type="text" 
                className="form-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>Document Category / Form Type</label>
              <select 
                className="select-filter" 
                value={tempType}
                onChange={(e) => setTempType(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="offer-letter">Offer Letter</option>
                <option value="service-agreement">Contract for Services</option>
                <option value="exit-letter">Exit / Termination Mutual Agreement</option>
                <option value="general">General Letter</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px' }}>Template Body Copy (Placeholders are auto-replaced)</label>
              <textarea 
                className="form-input" 
                rows="12"
                value={tempBody}
                onChange={(e) => setTempBody(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Use tokens: {"{{staff_name}}, {{staff_address}}, {{job_title}}, {{start_date}}, {{department}}, {{company_name}}, {{salary}}, {{last_working_date}}, {{notice_period}}, {{notice_pay_period}}, {{notice_pay_terms}}, {{additional_payment}}, {{signature}}"}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn-primary" onClick={handleSaveTemplate}>Save Template</button>
              <button className="btn-secondary" onClick={() => setEditingTemplateId(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {letterTemplates.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Category: {t.type.replace('-', ' ')}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-icon" title="Edit Template" onClick={() => handleEditTemplate(t)}>
                    <Edit3 size={12} />
                  </button>
                  <button className="btn-icon delete" title="Delete Template" onClick={() => onDeleteLetterTemplate(t.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {letterTemplates.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                No templates saved yet. Click 'Add Template' to begin.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  ) : activeSubTab === 'exits' ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start', animation: 'fadeIn 0.2s', width: '100%' }}>
      {/* LEFT COLUMN: Corporate Role Contacts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Contact Matrix Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Users size={16} /> Corporate Contacts Assignment Matrix
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Bulk assign key contacts to multiple entities simultaneously.</p>
          </div>

          {/* Company Multi-select list */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Select Target Companies</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button type="button" className="btn-secondary" style={{ padding: '2px 6px', fontSize: '10px', minHeight: 'auto' }} onClick={() => setSelectedContactCompanyIds(companies.map(c => c.id))}>Select All</button>
              <button type="button" className="btn-secondary" style={{ padding: '2px 6px', fontSize: '10px', minHeight: 'auto' }} onClick={() => setSelectedContactCompanyIds([])}>Deselect All</button>
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-secondary)' }}>
              {companies.map(c => {
                const isChecked = selectedContactCompanyIds.includes(c.id);
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {
                        setSelectedContactCompanyIds(prev => 
                          prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        );
                      }}
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>HR Contact</label>
              <select className="form-input" value={matrixHrStaffId} onChange={e => setMatrixHrStaffId(e.target.value)}>
                <option value="">-- No Change / Clear --</option>
                {staff.filter(s => s.status !== 'exited').map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>IT Contact</label>
              <select className="form-input" value={matrixItStaffId} onChange={e => setMatrixItStaffId(e.target.value)}>
                <option value="">-- No Change / Clear --</option>
                {staff.filter(s => s.status !== 'exited').map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Head of Operations</label>
              <select className="form-input" value={matrixOpsStaffId} onChange={e => setMatrixOpsStaffId(e.target.value)}>
                <option value="">-- No Change / Clear --</option>
                {staff.filter(s => s.status !== 'exited').map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Managing Director (MD)</label>
              <select className="form-input" value={matrixMdStaffId} onChange={e => setMatrixMdStaffId(e.target.value)}>
                <option value="">-- No Change / Clear --</option>
                {staff.filter(s => s.status !== 'exited').map(s => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={handleBulkAssignContacts} style={{ alignSelf: 'flex-start' }}>
            Assign Contacts
          </button>
        </div>

        {/* Mappings Summary Table */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)', overflowX: 'auto' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Current Contacts Summary</h4>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px' }}>Entity</th>
                <th style={{ padding: '6px' }}>HR Contact</th>
                <th style={{ padding: '6px' }}>IT Contact</th>
                <th style={{ padding: '6px' }}>Operations</th>
                <th style={{ padding: '6px' }}>MD</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => {
                const hr = staff.find(s => s.id === c.hrContactId);
                const it = staff.find(s => s.id === c.itContactId);
                const ops = staff.find(s => s.id === c.opsContactId);
                const md = staff.find(s => s.id === c.mdContactId);
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '6px', color: hr ? 'var(--text-primary)' : 'var(--text-muted)' }}>{hr ? hr.fullName : 'Not set'}</td>
                    <td style={{ padding: '6px', color: it ? 'var(--text-primary)' : 'var(--text-muted)' }}>{it ? it.fullName : 'Not set'}</td>
                    <td style={{ padding: '6px', color: ops ? 'var(--text-primary)' : 'var(--text-muted)' }}>{ops ? ops.fullName : 'Not set'}</td>
                    <td style={{ padding: '6px', color: md ? 'var(--text-primary)' : 'var(--text-muted)' }}>{md ? md.fullName : 'Not set'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* RIGHT COLUMN: Offboarding Templates & Rules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <Settings size={16} /> Notification Templates & Rules
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Toggle recipients and customize exit email copies.</p>
        </div>

        {/* Global Fallback Emails */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Global Fallback Recipients (if entity contact is missing)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '10px' }}>Global HR Email</label>
              <input type="email" className="form-input" style={{ padding: '6px', fontSize: '11px' }} value={hrEmail} onChange={e => setHrEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '10px' }}>Global IT Email</label>
              <input type="email" className="form-input" style={{ padding: '6px', fontSize: '11px' }} value={itEmail} onChange={e => setItEmail(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '10px' }}>Global Ops/Admin Email</label>
              <input type="email" className="form-input" style={{ padding: '6px', fontSize: '11px' }} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '10px' }}>Global MD/Director Email</label>
              <input type="email" className="form-input" style={{ padding: '6px', fontSize: '11px' }} value={directorEmail} onChange={e => setDirectorEmail(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Active Dispatch Rules checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Active Role Recipients (Select to Notify)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendToHr} onChange={e => setSendToHr(e.target.checked)} />
              <span>Notify HR Contact</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendToIt} onChange={e => setSendToIt(e.target.checked)} />
              <span>Notify IT Contact</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendToOps} onChange={e => setSendToOps(e.target.checked)} />
              <span>Notify Ops Contact</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendToMd} onChange={e => setSendToMd(e.target.checked)} />
              <span>Notify MD Contact</span>
            </label>
          </div>
        </div>

        {/* Template Select & Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Configure Role Email Templates</label>
            <select 
              className="form-input" 
              style={{ marginBottom: '10px' }}
              value={editingTemplateRole} 
              onChange={e => setEditingTemplateRole(e.target.value)}
            >
              <option value="hr">HR Offboarding Notice Template</option>
              <option value="it">IT Systems Deactivation Template</option>
              <option value="ops">Operations Offboarding Notice Template</option>
              <option value="md">Managing Director Offboarding Notice Template</option>
            </select>

            {editingTemplateRole === 'hr' && (
              <>
                <textarea 
                  className="form-input" 
                  rows="8" 
                  value={hrTemplate} 
                  onChange={e => setHrTemplate(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '11px' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported tokens: {"{{staff_name}}, {{job_title}}, {{company_name}}, {{last_working_date}}, {{office_locations}}"}
                </div>
              </>
            )}

            {editingTemplateRole === 'it' && (
              <>
                <textarea 
                  className="form-input" 
                  rows="8" 
                  value={itTemplate} 
                  onChange={e => setItTemplate(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '11px' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported tokens: {"{{staff_name}}, {{job_title}}, {{company_name}}, {{last_working_date}}, {{asset_list}}"}
                </div>
              </>
            )}

            {editingTemplateRole === 'ops' && (
              <>
                <textarea 
                  className="form-input" 
                  rows="8" 
                  value={opsTemplate} 
                  onChange={e => setOpsTemplate(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '11px' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported tokens: {"{{staff_name}}, {{job_title}}, {{company_name}}, {{last_working_date}}, {{notice_period}}, {{notice_pay_period}}, {{salary_paid_until}}, {{severance_pay}}"}
                </div>
              </>
            )}

            {editingTemplateRole === 'md' && (
              <>
                <textarea 
                  className="form-input" 
                  rows="8" 
                  value={mdTemplate} 
                  onChange={e => setMdTemplate(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '11px' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supported tokens: {"{{staff_name}}, {{job_title}}, {{company_name}}, {{last_working_date}}, {{notice_period}}, {{notice_pay_period}}, {{salary_paid_until}}, {{severance_pay}}"}
                </div>
              </>
            )}

          </div>
        </div>

        <button type="button" className="btn-primary" onClick={handleSaveExits} style={{ alignSelf: 'flex-start', marginTop: '12px' }}>
          Save Email Config & Rules
        </button>

      </div>
    </div>
  ) : activeSubTab === 'custom-roles' ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start', animation: 'fadeIn 0.2s', width: '100%' }}>
      {/* Create Custom Role panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)' }}><Plus size={16} style={{ marginRight: '6px' }} /> Create Custom Role</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assign a unique role title and set allowed module access.</p>
        </div>
        
        <div className="form-group">
          <label className="form-label">Role Name</label>
          <input
            type="text"
            placeholder="e.g. HR Specialist"
            className="form-input"
            value={newRoleBuilderName}
            onChange={(e) => setNewRoleBuilderName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Permitted Modules</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            {MODULES_LIST.map(m => {
              const checked = newRoleBuilderModules.includes(m.key);
              return (
                <div
                  key={m.key}
                  onClick={() => {
                    setNewRoleBuilderModules(prev => 
                      prev.includes(m.key) ? prev.filter(item => item !== m.key) : [...prev, m.key]
                    );
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: checked ? 'var(--accent)' : 'var(--text-secondary)', userSelect: 'none' }}
                >
                  {checked ? <CheckSquare size={14} style={{ color: 'var(--accent)' }} /> : <Square size={14} />}
                  <span>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!newRoleBuilderName.trim()) {
              onShowToast("Please enter a name for the custom role.", "warning");
              return;
            }
            const updated = { ...customRoles, [newRoleBuilderName.trim()]: newRoleBuilderModules };
            setCustomRoles(updated);
            localStorage.setItem('bm-custom-roles', JSON.stringify(updated));
            onShowToast(`Saved custom role: ${newRoleBuilderName.trim()}`, "success");
            setNewRoleBuilderName('');
            setNewRoleBuilderModules([]);
          }}
        >
          Save Custom Role
        </button>
      </div>

      {/* List of Custom Roles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Active Custom Roles Registry</h3>
        {Object.keys(customRoles).length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No custom roles created yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(customRoles).map(([rName, modules]) => (
              <div key={rName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>{rName}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {modules.map(mKey => {
                      const label = MODULES_LIST.find(ml => ml.key === mKey)?.label || mKey;
                      return (
                        <span key={mKey} style={{ fontSize: '9px', backgroundColor: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary delete"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                  onClick={() => {
                    const updated = { ...customRoles };
                    delete updated[rName];
                    setCustomRoles(updated);
                    localStorage.setItem('bm-custom-roles', JSON.stringify(updated));
                    onShowToast(`Deleted custom role: ${rName}`, "info");
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null}
</div>
);
}
