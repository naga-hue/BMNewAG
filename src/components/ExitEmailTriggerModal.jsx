import React, { useState, useEffect } from 'react';
import { X, Send, Mail, AlertTriangle, Users, Laptop, Building2, ShieldAlert } from 'lucide-react';

export default function ExitEmailTriggerModal({ 
  isOpen, 
  onClose, 
  staffMember, 
  exitSettings = {}, 
  companies = [], 
  staff = [],
  assetAssignments = [],
  onSend 
}) {
  const [activeTab, setActiveTab] = useState('');
  const [emailContents, setEmailContents] = useState({});

  useEffect(() => {
    if (staffMember && isOpen) {
      const company = companies.find(c => c.id === staffMember.companyId) || { name: 'Humres Group' };
      
      // 1. Resolve Office Locations
      const officeLocations = company.addressOverride || company.address || 'Humres HQ Office';

      // 2. Resolve Assigned Assets (Hardware & Software Seats)
      const myAssignments = assetAssignments.filter(a => a.staffId === staffMember.id);
      const assetLines = myAssignments.map(a => {
        const detail = a.serialNumber ? `, S/N: ${a.serialNumber}` : '';
        const typeLabel = a.type ? ` (${a.type})` : ' (Asset)';
        return `• ${a.name || a.assetName || a.contractName || 'Unlabeled Asset'}${typeLabel}${detail}`;
      });
      const assetListText = assetLines.length > 0 ? assetLines.join('\n') : '• No company hardware or software seats currently assigned.';

      // Helper to replace common tokens
      const interpolate = (tpl) => {
        if (!tpl) return '';
        return tpl
          .replace(/\{\{staff_name\}\}/g, staffMember.fullName || '')
          .replace(/\{\{job_title\}\}/g, staffMember.jobTitle || '')
          .replace(/\{\{company_name\}\}/g, company.name || '')
          .replace(/\{\{last_working_date\}\}/g, staffMember.lastWorkingDate || 'N/A')
          .replace(/\{\{notice_period\}\}/g, staffMember.noticePeriod || 'N/A')
          .replace(/\{\{notice_pay_period\}\}/g, staffMember.noticePayPeriod || 'N/A')
          .replace(/\{\{salary_paid_until\}\}/g, staffMember.salaryPaidUntilDate || 'N/A')
          .replace(/\{\{severance_pay\}\}/g, staffMember.additionalExitPayment ? `£${Number(staffMember.additionalExitPayment).toLocaleString()}` : '£0')
          .replace(/\{\{office_locations\}\}/g, officeLocations)
          .replace(/\{\{asset_list\}\}/g, assetListText);
      };

      // 3. Resolve role details (Contact Staff email vs Global Fallback)
      const hrContact = staff.find(s => s.id === company.hrContactId);
      const hrEmail = hrContact?.businessEmail || hrContact?.personalEmail || exitSettings.hrEmail || 'hr@humres.co.uk';

      const itContact = staff.find(s => s.id === company.itContactId);
      const itEmail = itContact?.businessEmail || itContact?.personalEmail || exitSettings.itEmail || 'it@humres.co.uk';

      const opsContact = staff.find(s => s.id === company.opsContactId);
      const opsEmail = opsContact?.businessEmail || opsContact?.personalEmail || exitSettings.adminEmail || 'admin@humres.co.uk';

      const mdContact = staff.find(s => s.id === company.mdContactId);
      const mdEmail = mdContact?.businessEmail || mdContact?.personalEmail || exitSettings.directorEmail || 'director@humres.co.uk';

      // 4. Build contents dictionary
      const contents = {};
      const enabledTabs = [];

      if (exitSettings.sendToHr !== false) {
        contents.hr = {
          roleName: 'HR Contact',
          recipient: hrEmail,
          subject: `[OFFBOARDING NOTICE] HR File Closure - ${staffMember.fullName}`,
          body: interpolate(exitSettings.hrTemplate || `Dear HR Team,\n\nPlease note that {{staff_name}} will be leaving the company on {{last_working_date}}.\n\nWork Location Details:\n{{office_locations}}\n\nPlease schedule their exit interview and process local HR clearances.\n\nSincerely,\nOperations`)
        };
        enabledTabs.push('hr');
      }

      if (exitSettings.sendToIt !== false) {
        contents.it = {
          roleName: 'IT Support',
          recipient: itEmail,
          subject: `[IT ACTION REQUIRED] Account Deactivation & Asset Recovery - ${staffMember.fullName}`,
          body: interpolate(exitSettings.itTemplate || `Dear IT Helpdesk,\n\nPlease de-provision accounts and recover all assigned company assets for {{staff_name}} who is exiting on {{last_working_date}}.\n\nAssigned Assets on File:\n{{asset_list}}\n\nSincerely,\nOperations`)
        };
        enabledTabs.push('it');
      }

      if (exitSettings.sendToOps !== false) {
        contents.ops = {
          roleName: 'Operations',
          recipient: opsEmail,
          subject: `[OFFBOARDING NOTICE] Operations Checklist - ${staffMember.fullName}`,
          body: interpolate(exitSettings.opsTemplate || `Dear Operations Team,\n\nPlease process operational offboarding for {{staff_name}} ({{job_title}}). Last working date is {{last_working_date}}.\n\nSincerely,\nHR Department`)
        };
        enabledTabs.push('ops');
      }

      if (exitSettings.sendToMd !== false) {
        contents.md = {
          roleName: 'MD / Director',
          recipient: mdEmail,
          subject: `[EXECUTIVE SUMMARY] Exit Process Logged - ${staffMember.fullName}`,
          body: interpolate(exitSettings.mdTemplate || `Dear Managing Director,\n\nFor your information, {{staff_name}} ({{job_title}}) is leaving the company. Notice details: {{notice_period}} (Notice pay: {{notice_pay_period}}). Last day: {{last_working_date}}.\n\nSincerely,\nHR Department`)
        };
        enabledTabs.push('md');
      }

      setEmailContents(contents);
      if (enabledTabs.length > 0) {
        setActiveTab(enabledTabs[0]);
      }
    }
  }, [staffMember, exitSettings, companies, staff, assetAssignments, isOpen]);

  if (!isOpen || !staffMember) return null;

  const activeContent = emailContents[activeTab];

  const handleFieldChange = (field, val) => {
    setEmailContents(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: val
      }
    }));
  };

  const handleDispatch = () => {
    // Collect all active notification payloads
    const notifications = Object.keys(emailContents).map(key => ({
      id: `email-${key}-${Date.now()}`,
      role: key,
      roleName: emailContents[key].roleName,
      recipient: emailContents[key].recipient,
      subject: emailContents[key].subject,
      body: emailContents[key].body,
      sentAt: new Date().toISOString(),
      staffId: staffMember.id,
      staffName: staffMember.fullName
    }));

    onSend(notifications);
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>Confirm & Dispatch Exit Notifications</h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Review, edit, and queue role-specific offboarding notifications.</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Role Tab Selection Bar */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)', padding: '0 16px' }}>
          {Object.keys(emailContents).map(key => {
            const isActive = activeTab === key;
            const content = emailContents[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--danger)' : '3px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {content.roleName}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        {activeContent ? (
          <div className="wizard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            
            {/* Recipient Details Badge */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--danger)' }}>
                {activeTab === 'it' ? <Laptop size={14} /> : <Building2 size={14} />}
                <span>Target {activeContent.roleName}</span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input 
                  type="email" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={activeContent.recipient}
                  onChange={(e) => handleFieldChange('recipient', e.target.value)}
                  placeholder="Enter recipient email..."
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Subject Line</label>
              <input 
                type="text" 
                className="form-input" 
                value={activeContent.subject}
                onChange={(e) => handleFieldChange('subject', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Email Content Preview (Editable)</label>
              <textarea 
                className="form-input" 
                rows="10" 
                value={activeContent.body}
                onChange={(e) => handleFieldChange('body', e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '11px', flex: 1, minHeight: '180px' }}
              />
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No exit notification emails configured or enabled.
          </div>
        )}

        {/* Footer */}
        <div className="wizard-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-danger" 
            onClick={handleDispatch}
            disabled={Object.keys(emailContents).length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={14} /> Send {Object.keys(emailContents).length} Exit Emails
          </button>
        </div>

      </div>
    </div>
  );
}
