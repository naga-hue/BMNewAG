import React, { useState, useMemo } from 'react';
import { Sparkles, Cake, Gift, Briefcase, Mail, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AiRemindersModal({
  isOpen,
  onClose,
  staff,
  companies,
  onShowToast
}) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [reminderType, setReminderType] = useState('birthday');
  
  // Recipients options
  const [sendToIndividual, setSendToIndividual] = useState(true);
  const [sendToManagement, setSendToManagement] = useState(true);
  const [sendToCoworkers, setSendToCoworkers] = useState(false);
  const [customManagementEmail, setCustomManagementEmail] = useState('groupadmin@globalrecruiters.ae');

  // Generator states
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Find celebrations for the current month
  const activeCelebrations = useMemo(() => {
    const currentMonthNum = new Date().getMonth(); // 0-indexed
    const list = [];

    staff.forEach(s => {
      // Birthdays this month
      if (s.dateOfBirth) {
        const dob = new Date(s.dateOfBirth);
        if (!isNaN(dob.getTime()) && dob.getMonth() === currentMonthNum) {
          list.push({
            staff: s,
            type: 'birthday',
            label: `🎂 ${s.fullName} - Birthday (${dob.getDate()} ${dob.toLocaleString('default', { month: 'short' })})`
          });
        }
      }
      // Anniversaries this month
      if (s.startDate) {
        const start = new Date(s.startDate);
        if (!isNaN(start.getTime()) && start.getMonth() === currentMonthNum) {
          const years = new Date().getFullYear() - start.getFullYear();
          list.push({
            staff: s,
            type: 'anniversary',
            label: `👔 ${s.fullName} - ${years} Year Anniversary (${start.getDate()} ${start.toLocaleString('default', { month: 'short' })})`
          });
        }
      }
    });

    return list;
  }, [staff]);

  const selectedStaffMember = useMemo(() => {
    return staff.find(s => s.id === selectedStaffId);
  }, [staff, selectedStaffId]);

  const selectedCompany = useMemo(() => {
    if (!selectedStaffMember) return null;
    return companies.find(c => c.id === selectedStaffMember.companyId);
  }, [companies, selectedStaffMember]);

  // Handle quick selection from birthday list
  const handleSelectCelebration = (item) => {
    setSelectedStaffId(item.staff.id);
    setReminderType(item.type);
    setGeneratedSubject('');
    setGeneratedBody('');
  };

  // Generate Message using backend API endpoint
  const handleGenerateMessage = async () => {
    if (!selectedStaffId || !selectedStaffMember) {
      onShowToast("Please select an employee first.", "warning");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-greeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeName: selectedStaffMember.fullName,
          jobTitle: selectedStaffMember.jobTitle || 'Team Member',
          companyName: selectedCompany?.name || 'Group Company',
          reminderType: reminderType,
          startDate: selectedStaffMember.startDate || ''
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || `API returned status ${response.status}`);
      }

      setGeneratedSubject(resData.subject || '');
      setGeneratedBody(resData.body || '');
      onShowToast("AI 2-Liner announcement generated successfully!", "success");
    } catch (err) {
      console.error(err);
      onShowToast(`Failed to generate message: ${err.message}`, "warning");
    } finally {
      setLoading(false);
    }
  };

  // Send Generated Email via MS365 Graph API
  const handleSendEmails = async () => {
    if (!generatedSubject || !generatedBody) {
      onShowToast("Please generate the email content before sending.", "warning");
      return;
    }
    if (!selectedStaffMember) return;

    // Collect all selected emails
    const recipients = [];

    // 1. Individual employee
    if (sendToIndividual) {
      const email = selectedStaffMember.businessEmail || selectedStaffMember.personalEmail;
      if (email) recipients.push(email);
    }

    // 2. Management
    if (sendToManagement) {
      // Find managers in the same company
      const managers = staff
        .filter(s => s.companyId === selectedStaffMember.companyId && 
          (s.department?.toLowerCase() === 'management' || 
           s.jobTitle?.toLowerCase().includes('manager') || 
           s.jobTitle?.toLowerCase().includes('director') || 
           s.jobTitle?.toLowerCase().includes('ceo'))
        )
        .map(s => s.businessEmail || s.personalEmail)
        .filter(Boolean);

      managers.forEach(m => {
        if (!recipients.includes(m)) recipients.push(m);
      });

      // Add custom manager email if configured
      if (customManagementEmail && !recipients.includes(customManagementEmail)) {
        recipients.push(customManagementEmail);
      }
    }

    // 3. Co-workers
    if (sendToCoworkers) {
      const coworkers = staff
        .filter(s => s.companyId === selectedStaffMember.companyId && s.id !== selectedStaffMember.id)
        .map(s => s.businessEmail || s.personalEmail)
        .filter(Boolean);

      coworkers.forEach(c => {
        if (!recipients.includes(c)) recipients.push(c);
      });
    }

    if (recipients.length === 0) {
      onShowToast("No recipients found or selected. Please select at least one recipient.", "warning");
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: recipients,
          subject: generatedSubject,
          body: generatedBody
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || `Server returned ${response.status}`);
      }

      onShowToast(`Successfully sent AI announcement to ${recipients.length} recipients!`, "success");
      onClose();
    } catch (err) {
      console.error(err);
      onShowToast(`Failed to send email: ${err.message}`, "warning");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div 
        className="form-wizard-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '750px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="wizard-title" style={{ color: '#fff', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: '#fbbf24' }} /> AI Birthday & Work Anniversary Reminders
            </h2>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Generate concise 2-liner staff celebration announcements using DeepSeek AI Secrets</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        {/* Content */}
        <div className="wizard-content" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* Celebrations this Month Scanner */}
          {activeCelebrations.length > 0 && (
            <div>
              <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎉 Celebrations this Month ({activeCelebrations.length})
              </label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 2px 10px 2px', scrollbarWidth: 'thin' }}>
                {activeCelebrations.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectCelebration(item)}
                    style={{
                      flex: '0 0 auto',
                      padding: '6px 12px',
                      backgroundColor: selectedStaffId === item.staff.id && reminderType === item.type ? 'var(--primary-light)' : 'var(--bg-secondary)',
                      border: `1px solid ${selectedStaffId === item.staff.id && reminderType === item.type ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: selectedStaffId === item.staff.id && reminderType === item.type ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Left: Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group">
                <label className="form-label">1. Target Employee <span>*</span></label>
                <select
                  className="select-filter"
                  value={selectedStaffId}
                  onChange={(e) => {
                    setSelectedStaffId(e.target.value);
                    setGeneratedSubject('');
                    setGeneratedBody('');
                  }}
                  style={{ width: '100%', padding: '8px 12px', marginTop: '4px' }}
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staff.map(s => {
                    const comp = companies.find(c => c.id === s.companyId);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.jobTitle || 'No Title'} - {comp?.name || 'Group'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">2. Announcement Type</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="reminderType" 
                      checked={reminderType === 'birthday'} 
                      onChange={() => setReminderType('birthday')} 
                    />
                    Birthday 🎂
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="reminderType" 
                      checked={reminderType === 'anniversary'} 
                      onChange={() => setReminderType('anniversary')} 
                    />
                    Work Anniversary 👔
                  </label>
                </div>
              </div>

              {/* Recipients Options */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label">3. Target Recipients</label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                  <input 
                    type="checkbox" 
                    checked={sendToIndividual} 
                    onChange={(e) => setSendToIndividual(e.target.checked)} 
                  />
                  <span>Send to Individual Employee {selectedStaffMember && `(${selectedStaffMember.businessEmail || selectedStaffMember.personalEmail || 'No Email'})`}</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={sendToManagement} 
                    onChange={(e) => setSendToManagement(e.target.checked)} 
                  />
                  <span>Send to Company Management (Auto-detects Managers + Custom CC)</span>
                </label>

                {sendToManagement && (
                  <div style={{ paddingLeft: '22px' }}>
                    <input
                      type="email"
                      className="form-input"
                      value={customManagementEmail}
                      onChange={(e) => setCustomManagementEmail(e.target.value)}
                      placeholder="e.g. manager@globalrecruiters.ae"
                      style={{ width: '100%', padding: '6px 10px', fontSize: '11px' }}
                    />
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={sendToCoworkers} 
                    onChange={(e) => setSendToCoworkers(e.target.checked)} 
                  />
                  <span>Send to all co-workers in the same company</span>
                </label>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerateMessage}
                disabled={loading || !selectedStaffId}
                style={{ marginTop: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {loading ? "Generating 2-Liner..." : (
                  <>
                    <Sparkles size={16} /> Generate AI 2-Liner
                  </>
                )}
              </button>

            </div>

            {/* Right: Message Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={14} /> AI Message Preview
              </label>

              {generatedSubject || generatedBody ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Subject</label>
                    <input
                      type="text"
                      className="form-input"
                      value={generatedSubject}
                      onChange={(e) => setGeneratedSubject(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '12px', fontWeight: 600 }}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Body</label>
                    <textarea
                      className="form-input"
                      value={generatedBody}
                      onChange={(e) => setGeneratedBody(e.target.value)}
                      rows={8}
                      style={{ width: '100%', padding: '10px', fontSize: '12px', resize: 'none', flex: 1 }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '6px',
                  padding: '24px',
                  color: 'var(--text-muted)',
                  textAlign: 'center'
                }}>
                  <Sparkles size={28} style={{ color: 'var(--border-color)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '12px' }}>Choose an employee, select options, and generate a message to preview it here.</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', padding: '12px 24px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSendEmails}
            disabled={sending || loading || !generatedSubject || !generatedBody}
            style={{ backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {sending ? "Sending Announcement..." : (
              <>
                <Mail size={16} /> Dispatch AI Announcement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
