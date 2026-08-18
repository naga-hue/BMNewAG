import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Info,
  Calendar,
  XCircle,
  FileText,
  Mail,
  Settings,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';

export default function LogsDashboard({
  auditLogs = [],
  onClearLogs,
  onShowToast,
  sentEmails = [],
  reminderSettings = {
    managementEmails: 'groupadmin@globalrecruiters.ae',
    alertManagers: true,
    alertCoworkers: false,
    sendToEmployee: true,
    alertManagementDayBefore: true,
    sendGreetingsDayOf: true
  },
  onSaveReminderSettings,
  staff = []
}) {
  const [activeSubTab, setActiveSubTab] = useState('change_logs'); // 'change_logs', 'sent_emails', 'settings'
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting state
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc

  // Email search/filter state
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');

  // Selected email for viewing details modal
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({ ...reminderSettings });

  // Sync settings state when prop updates
  React.useEffect(() => {
    setSettingsForm({ ...reminderSettings });
  }, [reminderSettings]);

  const handleHeaderClick = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  // Sort helper for audit logs
  const sortLogs = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';

      if (sortBy === 'timestamp') {
        valA = new Date(valA);
        valB = new Date(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;

    if (startDate) {
      const logTime = new Date(log.timestamp).getTime();
      const startLimit = new Date(`${startDate}T00:00:00`).getTime();
      if (logTime < startLimit) return false;
    }
    if (endDate) {
      const logTime = new Date(log.timestamp).getTime();
      const endLimit = new Date(`${endDate}T23:59:59`).getTime();
      if (logTime > endLimit) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (log.description || '').toLowerCase().includes(q);
      const matchUser = (log.user || '').toLowerCase().includes(q);
      return matchDesc || matchUser;
    }
    return true;
  });

  const sortedAndFiltered = sortLogs(filteredLogs);

  // Filter sent emails
  const filteredEmails = sentEmails.filter(email => {
    if (emailTypeFilter !== 'all' && email.triggerType !== emailTypeFilter) return false;

    if (emailSearchQuery.trim()) {
      const q = emailSearchQuery.toLowerCase();
      const matchSubj = (email.subject || '').toLowerCase().includes(q);
      const matchBody = (email.body || '').toLowerCase().includes(q);
      const matchTo = Array.isArray(email.to) 
        ? email.to.join(', ').toLowerCase().includes(q)
        : String(email.to || '').toLowerCase().includes(q);
      return matchSubj || matchBody || matchTo;
    }
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Render sorting indicators
  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    }
    return sortOrder === 'asc' 
      ? <ChevronUp size={12} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--accent)' }} />
      : <ChevronDown size={12} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--accent)' }} />;
  };

  const modulesList = ["Companies", "Staff", "Leaves", "Commissions", "Vendors", "Contracts", "Placements", "Expenses"];

  const handleSaveSettingsSubmit = (e) => {
    e.preventDefault();
    onSaveReminderSettings(settingsForm);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tabs header */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        borderBottom: '1px solid var(--border-color)', 
        paddingBottom: '2px',
        alignItems: 'center'
      }}>
        <button 
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeSubTab === 'change_logs' ? 'var(--accent)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'change_logs' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onClick={() => setActiveSubTab('change_logs')}
        >
          <History size={15} /> Audit Trail Logs
        </button>

        <button 
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeSubTab === 'sent_emails' ? 'var(--accent)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'sent_emails' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onClick={() => setActiveSubTab('sent_emails')}
        >
          <Mail size={15} /> Sent Emails Inbox
        </button>

        <button 
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: activeSubTab === 'settings' ? 'var(--accent)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'settings' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onClick={() => setActiveSubTab('settings')}
        >
          <Settings size={15} /> Email Reminder Rules
        </button>
      </div>

      {/* RENDER SUB-TAB 1: AUDIT TRAIL LOGS */}
      {activeSubTab === 'change_logs' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>System Change Logs & Audit Trail</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track entries, edits, and deletions across all business modules in real-time.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {sortedAndFiltered.length > 0 && (
                <button 
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  onClick={() => {
                    const headers = ["Timestamp", "User", "Module", "Action", "Description"];
                    const csvRowsContent = [headers.join(",")];
                    sortedAndFiltered.forEach(log => {
                      const row = [
                        `"${log.timestamp || ''}"`,
                        `"${(log.user || '').replace(/"/g, '""')}"`,
                        `"${log.module || ''}"`,
                        `"${log.action || ''}"`,
                        `"${(log.description || '').replace(/"/g, '""')}"`
                      ];
                      csvRowsContent.push(row.join(","));
                    });

                    const csvContent = "data:text/csv;charset=utf-8," + csvRowsContent.join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    onShowToast("📥 Audit logs exported successfully!", "success");
                  }}
                >
                  📥 Export CSV
                </button>
              )}

              {auditLogs.length > 0 && (
                <button 
                  className="btn-secondary delete" 
                  style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all history audit logs? This action is permanent.")) {
                      onClearLogs();
                      onShowToast("Cleared audit log history registry.", "info");
                    }
                  }}
                >
                  <Trash2 size={14} /> Clear Logs History
                </button>
              )}
            </div>
          </div>

          <div className="controls-row">
            <div className="search-filter-group">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search description or user..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select 
                className="select-filter"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="all">All Modules</option>
                {modulesList.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>

              <select 
                className="select-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">All Action Types</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-muted)' }}>From:</span>
                <input 
                  type="date" 
                  className="select-filter" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  style={{ padding: '6px', fontSize: '11px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>To:</span>
                <input 
                  type="date" 
                  className="select-filter" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  style={{ padding: '6px', fontSize: '11px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                {(startDate || endDate) && (
                  <button 
                    type="button" 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="entity-table" style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th onClick={() => handleHeaderClick('timestamp')} style={{ cursor: 'pointer', userSelect: 'none', width: '180px' }}>
                    Timestamp {renderSortIndicator('timestamp')}
                  </th>
                  <th onClick={() => handleHeaderClick('module')} style={{ cursor: 'pointer', userSelect: 'none', width: '140px' }}>
                    Module {renderSortIndicator('module')}
                  </th>
                  <th onClick={() => handleHeaderClick('action')} style={{ cursor: 'pointer', userSelect: 'none', width: '120px' }}>
                    Action {renderSortIndicator('action')}
                  </th>
                  <th>Description</th>
                  <th onClick={() => handleHeaderClick('user')} style={{ cursor: 'pointer', userSelect: 'none', width: '150px' }}>
                    User / Agent {renderSortIndicator('user')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFiltered.map(log => {
                  const dateStr = new Date(log.timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const actionColor = log.action === 'CREATE' 
                    ? 'var(--success)' 
                    : log.action === 'UPDATE' 
                    ? 'var(--primary)' 
                    : 'var(--danger)';
                  const actionBg = log.action === 'CREATE'
                    ? 'rgba(16, 185, 129, 0.08)'
                    : log.action === 'UPDATE'
                    ? 'rgba(59, 130, 246, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)';

                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{dateStr}</td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 600,
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>
                          {log.module}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          color: actionColor,
                          backgroundColor: actionBg,
                          border: `1px solid ${actionColor}33`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '13px' }}>{log.description}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.user || 'Admin'}</td>
                    </tr>
                  );
                })}
                {sortedAndFiltered.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No activity logs matched selected filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* RENDER SUB-TAB 2: SENT EMAILS LOG */}
      {activeSubTab === 'sent_emails' && (
        <>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Sent Emails Inbox</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>View history of all emails sent by the system (both manual templates and automated background triggers).</p>
          </div>

          <div className="controls-row">
            <div className="search-filter-group">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search subject, body, or recipient..." 
                  className="search-input"
                  value={emailSearchQuery}
                  onChange={(e) => setEmailSearchQuery(e.target.value)}
                />
              </div>

              <select 
                className="select-filter"
                value={emailTypeFilter}
                onChange={(e) => setEmailTypeFilter(e.target.value)}
              >
                <option value="all">All Email Types</option>
                <option value="manual">Manual Sent</option>
                <option value="cron-tomorrow-birthday">Management Birthday Alerts (1d before)</option>
                <option value="cron-tomorrow-anniversary">Management Anniversary Alerts (1d before)</option>
                <option value="cron-dayof-birthday">Direct Employee Birthday Wishes</option>
                <option value="cron-dayof-anniversary">Direct Employee Anniversary Wishes</option>
                <option value="cron-daily-absences-report">Daily Absences Table Report</option>
                <option value="cron-manager-leave-alert">Manager Leave Notification</option>
              </select>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="entity-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Date/Time</th>
                  <th style={{ width: '250px' }}>Recipient(s)</th>
                  <th>Subject</th>
                  <th style={{ width: '150px' }}>Trigger Type</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmails.map(email => {
                  const dateStr = new Date(email.timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  let triggerLabel = 'Manual';
                  let badgeBg = 'rgba(255,255,255,0.03)';
                  let badgeText = 'var(--text-primary)';

                  if (email.triggerType?.startsWith('cron-tomorrow')) {
                    triggerLabel = 'Alert (1d before)';
                    badgeBg = 'rgba(245, 158, 11, 0.08)';
                    badgeText = '#f59e0b';
                  } else if (email.triggerType?.startsWith('cron-dayof')) {
                    triggerLabel = 'AI Celebration';
                    badgeBg = 'rgba(16, 185, 129, 0.08)';
                    badgeText = '#10b981';
                  } else if (email.triggerType === 'cron-daily-absences-report') {
                    triggerLabel = 'Absence Summary';
                    badgeBg = 'rgba(14, 165, 233, 0.08)';
                    badgeText = '#0ea5e9';
                  } else if (email.triggerType === 'cron-manager-leave-alert') {
                    triggerLabel = 'Manager Leave Alert';
                    badgeBg = 'rgba(139, 92, 246, 0.08)';
                    badgeText = '#8b5cf6';
                  }

                  const toAddresses = Array.isArray(email.to) ? email.to.join(', ') : String(email.to || '');

                  return (
                    <tr key={email.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{dateStr}</td>
                      <td style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={toAddresses}>
                        {toAddresses}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '13px' }}>{email.subject}</td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 600,
                          backgroundColor: badgeBg,
                          color: badgeText,
                          border: `1px solid ${badgeText}33`,
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>
                          {triggerLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                          onClick={() => setSelectedEmail(email)}
                        >
                          <Eye size={12} /> View Content
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredEmails.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No sent emails found in logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* RENDER SUB-TAB 3: EMAIL CONFIGURATION SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettingsSubmit} style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-md)', 
          padding: '24px',
          maxWidth: '800px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Automated Greeting Reminders Setup</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Configure who receives email alerts and celebrations for birthdays and work anniversaries.</p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* Toggle 1: Enable Alerts a day before */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>1-Day-Before Prep Alerts</label>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Send management reminders a day in advance for birthdays and work anniversaries.</span>
              </div>
              <input 
                type="checkbox" 
                checked={settingsForm.alertManagementDayBefore !== false}
                onChange={e => setSettingsForm(prev => ({ ...prev, alertManagementDayBefore: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            
            {(settingsForm.alertManagementDayBefore !== false) && (
              <div style={{ marginTop: '16px', paddingLeft: '16px', borderLeft: '2px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Manager recipient toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Alert direct line manager</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Automatically trigger tomorrow's reminder email to the employee's assigned reporting manager(s).</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsForm.alertManagers !== false}
                    onChange={e => setSettingsForm(prev => ({ ...prev, alertManagers: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* Director alert emails */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Alert designated directors / management emails</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. director1@company.com, director2@company.com"
                    value={settingsForm.managementEmails || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, managementEmails: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Comma separated list of emails. These recipients will be alerted a day before every staff celebration.</span>
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* Toggle 2: Day-of greetings */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>Day-Of AI Celebration Greetings</label>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automatically dispatch AI-personalized greetings at 7:00 AM UK time on the event day.</span>
              </div>
              <input 
                type="checkbox" 
                checked={settingsForm.sendGreetingsDayOf !== false}
                onChange={e => setSettingsForm(prev => ({ ...prev, sendGreetingsDayOf: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {(settingsForm.sendGreetingsDayOf !== false) && (
              <div style={{ marginTop: '16px', paddingLeft: '16px', borderLeft: '2px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Send to Employee */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Email the celebrated employee</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Send the personalized AI greeting directly to the employee's inbox.</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsForm.sendToEmployee !== false}
                    onChange={e => setSettingsForm(prev => ({ ...prev, sendToEmployee: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* CC Coworkers / Company */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Notify the entire company (CC co-workers)</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CC all coworkers working at the same company tenant to encourage company-wide wishes.</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsForm.alertCoworkers === true}
                    onChange={e => setSettingsForm(prev => ({ ...prev, alertCoworkers: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          {/* Toggle 3: Daily leave reminders */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>Daily Absence & Leave Reports</label>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automatically email absence reports daily at 6:30 AM UK time showing who is currently on leave.</span>
              </div>
              <input 
                type="checkbox" 
                checked={settingsForm.alertLeaveStatus !== false}
                onChange={e => setSettingsForm(prev => ({ ...prev, alertLeaveStatus: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {(settingsForm.alertLeaveStatus !== false) && (
              <div style={{ marginTop: '16px', paddingLeft: '16px', borderLeft: '2px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Alert Leave Managers */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>Alert department/reporting managers</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Notify managers at 7:00 AM if any of their direct reports are on leave today.</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settingsForm.alertLeaveManagers !== false}
                    onChange={e => setSettingsForm(prev => ({ ...prev, alertLeaveManagers: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

                {/* Director leave emails */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Email complete daily absence table to designated directors/admins</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. director1@company.com, admin@company.com"
                    value={settingsForm.leaveManagementEmails || ''}
                    onChange={e => setSettingsForm(prev => ({ ...prev, leaveManagementEmails: e.target.value }))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Comma separated list of emails. These recipients will receive the daily table detailing on-leave staff, start/end dates, and remaining balances.</span>
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <CheckCircle2 size={16} /> Save Configuration Rules
            </button>
          </div>
        </form>
      )}

      {/* DETAIL VIEW MODAL OVERLAY FOR SENT EMAIL CONTENT */}
      {selectedEmail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '650px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Sent Email Details</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sent on: {new Date(selectedEmail.timestamp).toLocaleString()}</span>
              </div>
              <button 
                onClick={() => setSelectedEmail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '450px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sender (M365 Account)</span>
                <div style={{ fontSize: '13px', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.02)', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  {selectedEmail.sender || 'groupadmin@globalrecruiters.ae'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Recipient(s)</span>
                <div style={{ fontSize: '13px', fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.02)', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', wordBreak: 'break-all' }}>
                  {Array.isArray(selectedEmail.to) ? selectedEmail.to.join(', ') : selectedEmail.to}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Subject Line</span>
                <div style={{ fontSize: '13px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--accent)' }}>
                  {selectedEmail.subject}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Body Message</span>
                <div style={{ 
                  fontSize: '13px', 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  padding: '16px', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  lineHeight: '1.6', 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {selectedEmail.body}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'rgba(255,255,255,0.01)'
            }}>
              <button className="btn-secondary" onClick={() => setSelectedEmail(null)} style={{ cursor: 'pointer' }}>Close View</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
