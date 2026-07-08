import React, { useState } from 'react';
import { Shield, CheckSquare, Square, Save, Users, Key, FileText, Settings, Edit3, Trash2, Plus } from 'lucide-react';

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
  onShowToast,
  letterTemplates = [],
  onSaveLetterTemplate,
  onDeleteLetterTemplate,
  onUpdateCompany,
  exitSettings = {},
  onSaveExitSettings
}) {
  const [activeSubTab, setActiveSubTab] = useState('permissions'); // permissions, letterheads
  const [editingStaffId, setEditingStaffId] = useState(null);

  // Letterhead editing states
  const [selectedLhCompanyId, setSelectedLhCompanyId] = useState(companies[0] ? companies[0].id : '');
  const [lhLogoUrl, setLhLogoUrl] = useState('');
  const [lhAddressOverride, setLhAddressOverride] = useState('');
  const [lhSignatureText, setLhSignatureText] = useState('');
  const [lhAccentColor, setLhAccentColor] = useState('#3b82f6');

  // Template editing states
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState('offer-letter');
  const [tempBody, setTempBody] = useState('');

  // Exit settings states
  const [hrEmail, setHrEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [itEmail, setItEmail] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [exitEmailTemplate, setExitEmailTemplate] = useState('');

  React.useEffect(() => {
    setHrEmail(exitSettings.hrEmail || 'hr@humres.co.uk');
    setAdminEmail(exitSettings.adminEmail || 'admin@humres.co.uk');
    setItEmail(exitSettings.itEmail || 'it@humres.co.uk');
    setDirectorEmail(exitSettings.directorEmail || 'director@humres.co.uk');
    setExitEmailTemplate(exitSettings.exitEmailTemplate || `Dear Team,\n\nPlease be informed that {{staff_name}} will be leaving {{company_name}}. Their actual last working date will be {{last_working_date}}.\n\nNotice Details:\n- Notice Period: {{notice_period}}\n- Notice Pay Period: {{notice_pay_period}}\n- Salary Paid Until: {{salary_paid_until}}\n- Severance Payment: {{severance_pay}}\n\nPlease configure account deactivation clearances and asset recovery clear-offs.\n\nSincerely,\nHR Operations`);
  }, [exitSettings]);

  const handleSaveExits = async () => {
    const settings = {
      hrEmail,
      adminEmail,
      itEmail,
      directorEmail,
      exitEmailTemplate
    };
    try {
      await onSaveExitSettings(settings);
      onShowToast("Exit settings saved successfully!", "success");
    } catch (e) {
      onShowToast("Error saving exit settings: " + e.message, "danger");
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
    }
  }, [selectedLhCompanyId, companies]);

  // Handle Save Letterhead
  const handleSaveLetterhead = async () => {
    const comp = companies.find(c => c.id === selectedLhCompanyId);
    if (!comp) return;

    const updated = {
      ...comp,
      logoUrl: lhLogoUrl,
      addressOverride: lhAddressOverride,
      signatureText: lhSignatureText,
      accentColor: lhAccentColor
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
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', backgroundColor: 'var(--bg-card)', maxWidth: '700px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)' }}><AlertTriangle size={16} style={{ marginRight: '6px' }} /> Offboarding Exit Notification Settings</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configure recipient email endpoints and the dynamic email broadcast template triggered when marking a consultant as exited.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">HR Notification Email</label>
          <input type="email" className="form-input" value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Admin Notification Email</label>
          <input type="email" className="form-input" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">IT / Systems Support Email</label>
          <input type="email" className="form-input" value={itEmail} onChange={(e) => setItEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Director / Management Email</label>
          <input type="email" className="form-input" value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Exit Notification Email Body (Supports Tokens)</label>
        <textarea 
          className="form-input" 
          rows="8" 
          value={exitEmailTemplate} 
          onChange={(e) => setExitEmailTemplate(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
        />
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Supported tokens: {"{{staff_name}}, {{job_title}}, {{company_name}}, {{last_working_date}}, {{notice_period}}, {{notice_pay_period}}, {{salary_paid_until}}, {{severance_pay}}"}
        </div>
      </div>

      <button className="btn-primary" onClick={handleSaveExits} style={{ alignSelf: 'flex-start' }}>
        Save Exit Configuration
      </button>
    </div>
  )}
</div>
);
}
