import React, { useState, useEffect } from 'react';
import { X, Send, Mail, AlertTriangle, Users } from 'lucide-react';

export default function ExitEmailTriggerModal({ 
  isOpen, 
  onClose, 
  staffMember, 
  exitSettings = {}, 
  companies = [], 
  onSend 
}) {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const hrEmail = exitSettings.hrEmail || 'hr@humres.co.uk';
  const adminEmail = exitSettings.adminEmail || 'admin@humres.co.uk';
  const itEmail = exitSettings.itEmail || 'it@humres.co.uk';
  const directorEmail = exitSettings.directorEmail || 'director@humres.co.uk';

  useEffect(() => {
    if (staffMember) {
      const company = companies.find(c => c.id === staffMember.companyId) || { name: 'Humres Group' };
      
      const subject = `[OFFBOARDING NOTICE] Employee Exit Process Initiated - ${staffMember.fullName}`;
      setEmailSubject(subject);

      let template = exitSettings.exitEmailTemplate || 
        `Dear Team,\n\nPlease be informed that {{staff_name}} will be leaving {{company_name}}. Their actual last working date will be {{last_working_date}}.\n\nNotice Details:\n- Notice Period: {{notice_period}}\n- Notice Pay Period: {{notice_pay_period}}\n- Salary Paid Until: {{salary_paid_until}}\n- Severance Payment: {{severance_pay}}\n\nPlease configure account deactivation clearances and asset recovery clear-offs.\n\nSincerely,\nHR Operations`;

      // Interpolate tokens
      template = template
        .replace(/\{\{staff_name\}\}/g, staffMember.fullName || '')
        .replace(/\{\{job_title\}\}/g, staffMember.jobTitle || '')
        .replace(/\{\{company_name\}\}/g, company.name || '')
        .replace(/\{\{last_working_date\}\}/g, staffMember.lastWorkingDate || 'N/A')
        .replace(/\{\{notice_period\}\}/g, staffMember.noticePeriod || 'N/A')
        .replace(/\{\{notice_pay_period\}\}/g, staffMember.noticePayPeriod || 'N/A')
        .replace(/\{\{salary_paid_until\}\}/g, staffMember.salaryPaidUntilDate || 'N/A')
        .replace(/\{\{severance_pay\}\}/g, staffMember.additionalExitPayment ? `${Number(staffMember.additionalExitPayment).toLocaleString()}` : '0');

      setEmailBody(template);
    }
  }, [staffMember, exitSettings, companies, isOpen]);

  if (!isOpen || !staffMember) return null;

  const handleDispatch = () => {
    const notification = {
      id: 'email-' + Date.now(),
      recipients: { hrEmail, adminEmail, itEmail, directorEmail },
      subject: emailSubject,
      body: emailBody,
      sentAt: new Date().toISOString(),
      staffId: staffMember.id,
      staffName: staffMember.fullName
    };
    onSend(notification);
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '85vh' }}>
        
        {/* Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Mail size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>Confirm & Dispatch Exit Notification</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Review offboarding notice coordinates before broadcast.</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="wizard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          
          {/* Recipient Details list */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
              Dispatch Recipient Matrix
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div>📨 <strong>HR Dept:</strong> <span style={{ color: 'var(--text-secondary)' }}>{hrEmail}</span></div>
              <div>📨 <strong>Admin Ops:</strong> <span style={{ color: 'var(--text-secondary)' }}>{adminEmail}</span></div>
              <div>📨 <strong>IT Support:</strong> <span style={{ color: 'var(--text-secondary)' }}>{itEmail}</span></div>
              <div>Director Board: <span style={{ color: 'var(--text-secondary)' }}>{directorEmail}</span></div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Subject</label>
            <input 
              type="text" 
              className="form-input" 
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Message Copy (Editable Preview)</label>
            <textarea 
              className="form-input" 
              rows="10" 
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="wizard-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Back
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleDispatch}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={14} /> Send Email & Open Checklist
          </button>
        </div>

      </div>
    </div>
  );
}
