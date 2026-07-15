import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  User, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  Trash2, 
  UploadCloud, 
  Mail, 
  Phone, 
  Calendar, 
  Eye, 
  BadgeAlert,
  ClipboardList,
  CheckSquare,
  Square,
  PlusCircle,
  Clock,
  Wallet
} from 'lucide-react';
import { firebaseService } from '../services/firebase';

export default function CompanyDetail({ company, isOpen, onClose, onUpdateCompany, onShowToast, staff = [] }) {
  const [activeTab, setActiveTab] = useState('profile'); // profile or compliance
  const [uploadDocType, setUploadDocType] = useState('registration');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // New compliance task form state
  const [taskName, setTaskName] = useState('');
  const [taskCategory, setTaskCategory] = useState('VAT');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskRecurrence, setTaskRecurrence] = useState('one-time');
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // New bank account form state
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankSortCode, setBankSortCode] = useState('');
  const [bankCurrency, setBankCurrency] = useState('GBP');
  const [bankNotes, setBankNotes] = useState('');
  const [showAddBankForm, setShowAddBankForm] = useState(false);

  if (!company || !isOpen) return null;

  // Format currency symbols
  const getCurrencySymbol = (country) => {
    switch (country) {
      case 'United Kingdom': return '£';
      case 'United States': return '$';
      case 'United Arab Emirates': return 'AED ';
      case 'India': return '₹';
      case 'South Africa': return 'R';
      default: return '';
    }
  };

  // Get tax label depending on country
  const getTaxLabel = (country) => {
    switch (country) {
      case 'United Kingdom': return 'VAT Registration Number';
      case 'United States': return 'EIN (Employer ID Number)';
      case 'United Arab Emirates': return 'TRN (Tax Registration Number)';
      case 'India': return 'GSTIN';
      default: return 'Tax Reference';
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Upload file using Firebase service (with LocalStorage fallback)
  const handleFileUpload = async (file) => {
    setIsUploading(true);
    onShowToast(`Uploading file "${file.name}"...`, 'info');
    try {
      const docMetadata = await firebaseService.uploadFile(company.id, file, uploadDocType);
      
      const updatedDocuments = [...(company.documents || []), docMetadata];
      const updatedCompany = { ...company, documents: updatedDocuments };
      
      await onUpdateCompany(updatedCompany);
      onShowToast(`Uploaded "${file.name}" successfully!`, 'success');
    } catch (err) {
      console.error("Upload error:", err);
      onShowToast(`Failed to upload file: ${err.message}`, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docObj) => {
    if (window.confirm(`Are you sure you want to delete "${docObj.name}"?`)) {
      try {
        await firebaseService.deleteFile(docObj);
        const updatedDocuments = company.documents.filter(d => d.id !== docObj.id);
        const updatedCompany = { ...company, documents: updatedDocuments };
        
        await onUpdateCompany(updatedCompany);
        onShowToast(`Deleted document "${docObj.name}"`, 'info');
      } catch (err) {
        console.error("Delete doc error:", err);
        onShowToast(`Error deleting file: ${err.message}`, 'danger');
      }
    }
  };

  // Preview file (Simulated)
  const handlePreviewDoc = (doc) => {
    if (doc.url && doc.url !== '#') {
      window.open(doc.url, '_blank');
    } else {
      alert(`[SIMULATED FILE VIEWER]\nViewing file: ${doc.name}\nType: ${doc.type.toUpperCase()}\nUploaded: ${doc.uploadDate}\nSize: ${doc.fileSize}`);
    }
  };

  // Calculate days remaining on insurance
  const getInsuranceStatus = () => {
    if (!company.hasInsurance || !company.insurance) {
      return { label: 'No Active Policy', color: 'var(--danger)', isExpired: true, daysLeft: null };
    }
    
    const CURRENT_DATE = new Date(); CURRENT_DATE.setHours(0, 0, 0, 0);
    const expiry = new Date(company.insurance.expiryDate);
    const diffTime = expiry - CURRENT_DATE;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        label: `Expired (on ${company.insurance.expiryDate})`, 
        color: 'var(--danger)', 
        isExpired: true, 
        daysLeft: diffDays 
      };
    } else if (diffDays <= 90) {
      return { 
        label: `Expiring soon (${diffDays} days left)`, 
        color: 'var(--warning)', 
        isExpired: false, 
        daysLeft: diffDays 
      };
    } else {
      return { 
        label: `Active (Expires ${company.insurance.expiryDate})`, 
        color: 'var(--success)', 
        isExpired: false, 
        daysLeft: diffDays 
      };
    }
  };

  const insStatus = getInsuranceStatus();

  // Add a new department
  const handleNewDepartmentSubmit = async (e) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;
    
    const currentDepts = company.departments || [];
    if (currentDepts.some(d => d.name === name)) {
      onShowToast(`Department "${name}" already exists for this company.`, 'warning');
      return;
    }

    const updatedDepts = [...currentDepts, { name, managerId: '' }];
    const updatedCompany = { ...company, departments: updatedDepts };
    
    await onUpdateCompany(updatedCompany);
    onShowToast(`Added department "${name}" to ${company.name}`, 'success');
    setNewDeptName('');
  };

  // Delete a department
  const handleDeleteDepartment = async (deptName) => {
    if (window.confirm(`Are you sure you want to remove the "${deptName}" department?`)) {
      const currentDepts = company.departments || [];
      const updatedDepts = currentDepts.filter(d => d.name !== deptName);
      const updatedCompany = { ...company, departments: updatedDepts };
      
      await onUpdateCompany(updatedCompany);
      onShowToast(`Removed department "${deptName}"`, 'info');
    }
  };

  // Assign a department manager
  const handleSetDeptManager = async (deptName, managerId) => {
    const currentDepts = company.departments || [];
    const updatedDepts = currentDepts.map(d => {
      if (d.name === deptName) {
        return { ...d, managerId };
      }
      return d;
    });
    const updatedCompany = { ...company, departments: updatedDepts };
    await onUpdateCompany(updatedCompany);
    
    const managerName = staff.find(s => s.id === managerId)?.fullName || 'Unassigned';
    onShowToast(`Assigned ${managerName} as head of ${deptName}`, 'success');
  };

  const calculateNextDueDate = (currentDueDateStr, recurrence) => {
    const date = new Date(currentDueDateStr);
    if (isNaN(date.getTime())) return null;

    switch (recurrence) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }
    return date.toISOString().split('T')[0];
  };

  // Compliance task toggling
  const handleToggleTaskStatus = async (taskId) => {
    let newTasks = [...(company.complianceTasks || [])];
    const taskIndex = newTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return;
    
    const task = newTasks[taskIndex];
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    newTasks[taskIndex] = { ...task, status: nextStatus };
    onShowToast(`Marked "${task.name}" as ${nextStatus.toUpperCase()}`, 'info');

    // Dynamic date rollover if marked COMPLETED and it is a RECURRING task
    if (nextStatus === 'completed' && task.recurrence && task.recurrence !== 'one-time') {
      const nextDueDate = calculateNextDueDate(task.dueDate, task.recurrence);
      if (nextDueDate) {
        // Check if there is already a future pending task of the same category/name
        const alreadyExists = newTasks.some(t => 
          t.status === 'pending' && 
          t.name === task.name && 
          t.dueDate === nextDueDate
        );
        
        if (!alreadyExists) {
          const nextTask = {
            id: `task-${Date.now()}`,
            name: task.name,
            category: task.category,
            dueDate: nextDueDate,
            recurrence: task.recurrence,
            status: 'pending',
            notes: `Auto-generated rollover from completed task due on ${task.dueDate}.`
          };
          newTasks.push(nextTask);
          onShowToast(`Auto-scheduled next ${task.recurrence} filing for ${nextDueDate}`, 'success');
        }
      }
    }

    const updatedCompany = { ...company, complianceTasks: newTasks };
    await onUpdateCompany(updatedCompany);
  };

  // Add a bank account
  const handleAddBankAccount = async (e) => {
    e.preventDefault();
    if (!bankName.trim() || !bankAccountName.trim() || !bankAccountNumber.trim() || !bankSortCode.trim()) {
      onShowToast("Please fill in all required bank details.", "warning");
      return;
    }

    const newAccount = {
      id: `bank-${Date.now()}`,
      bankName: bankName.trim(),
      accountName: bankAccountName.trim(),
      accountNumber: bankAccountNumber.trim(),
      sortCode: bankSortCode.trim(),
      currency: bankCurrency,
      notes: bankNotes.trim()
    };

    const updatedAccounts = [...(company.bankAccounts || []), newAccount];
    const updatedCompany = { ...company, bankAccounts: updatedAccounts };

    await onUpdateCompany(updatedCompany);
    onShowToast(`Added bank account "${bankName}" successfully!`, 'success');

    // Reset state
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setBankSortCode('');
    setBankCurrency('GBP');
    setBankNotes('');
    setShowAddBankForm(false);
  };

  // Delete a bank account
  const handleDeleteBankAccount = async (accountId, name) => {
    if (window.confirm(`Are you sure you want to remove bank account "${name}"?`)) {
      const updatedAccounts = (company.bankAccounts || []).filter(a => a.id !== accountId);
      const updatedCompany = { ...company, bankAccounts: updatedAccounts };
      await onUpdateCompany(updatedCompany);
      onShowToast(`Removed bank account "${name}"`, 'info');
    }
  };

  // Add a compliance task
  const handleAddComplianceTask = async (e) => {
    e.preventDefault();
    if (!taskName.trim() || !taskDueDate) {
      onShowToast("Task Name and Due Date are required.", "warning");
      return;
    }

    const newTask = {
      id: `task-${Date.now()}`,
      name: taskName,
      category: taskCategory,
      dueDate: taskDueDate,
      recurrence: taskRecurrence,
      status: 'pending',
      notes: taskNotes
    };

    const updatedTasks = [...(company.complianceTasks || []), newTask];
    const updatedCompany = { ...company, complianceTasks: updatedTasks };

    await onUpdateCompany(updatedCompany);
    onShowToast(`Added statutory compliance: "${taskName}"`, 'success');

    // Reset task form
    setTaskName('');
    setTaskDueDate('');
    setTaskNotes('');
    setTaskRecurrence('one-time');
    setShowAddTaskForm(false);
  };

  // Delete a compliance task
  const handleDeleteComplianceTask = async (taskId, name) => {
    if (window.confirm(`Are you sure you want to remove compliance task "${name}"?`)) {
      const updatedTasks = (company.complianceTasks || []).filter(t => t.id !== taskId);
      const updatedCompany = { ...company, complianceTasks: updatedTasks };
      await onUpdateCompany(updatedCompany);
      onShowToast(`Removed compliance task "${name}"`, 'info');
    }
  };

  // Sort compliance tasks: pending first (by due date ascending), completed last (by due date descending)
  const sortedTasks = [...(company.complianceTasks || [])].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const getTaskDaysLeftStr = (task) => {
    if (task.status === 'completed') return 'Completed';
    const CURRENT_DATE = new Date(); CURRENT_DATE.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    const diff = Math.ceil((due - CURRENT_DATE) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return `Overdue by ${Math.abs(diff)} days`;
    if (diff === 0) return 'DUE TODAY';
    return `${diff} days remaining`;
  };

  const getTaskStatusColor = (task) => {
    if (task.status === 'completed') return 'var(--success)';
    const CURRENT_DATE = new Date(); CURRENT_DATE.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    const diff = Math.ceil((due - CURRENT_DATE) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return 'var(--danger)';
    if (diff <= 30) return 'var(--warning)';
    return 'var(--text-secondary)';
  };

  return (
    <div className={`slide-over-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className="slide-over-panel" onClick={(e) => e.stopPropagation()}>
        
        {/* Panel Header */}
        <div className="panel-header" style={{ paddingBottom: '12px' }}>
          <div className="panel-title">
            <span className={`country-badge country-${company.country.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ width: 'fit-content', marginBottom: '8px' }}>
              {company.country}
            </span>
            <h2>{company.name}</h2>
            <span className="entity-legal-name">{company.legalName}</span>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--bg-sidebar)', 
          padding: '0 24px', 
          borderBottom: '1px solid var(--border-color)',
          gap: '16px' 
        }}>
          <button 
            onClick={() => setActiveTab('profile')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'profile' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Profile Info
          </button>
          <button 
            onClick={() => setActiveTab('compliance')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'compliance' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'compliance' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Statutory Compliances
            <span style={{ 
              fontSize: '11px', 
              background: (company.complianceTasks || []).filter(t => t.status === 'pending').length > 0 ? 'rgba(14, 165, 233, 0.15)' : 'rgba(255,255,255,0.05)',
              color: (company.complianceTasks || []).filter(t => t.status === 'pending').length > 0 ? 'var(--accent)' : 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              {(company.complianceTasks || []).filter(t => t.status === 'pending').length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('banks')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: activeTab === 'banks' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'banks' ? '2px solid var(--accent)' : '2px solid transparent',
              padding: '12px 8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Bank Accounts
            <span style={{ 
              fontSize: '11px', 
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '10px',
              marginLeft: '6px'
            }}>
              {(company.bankAccounts || []).length}
            </span>
          </button>
        </div>

        {/* Panel Content */}
        <div className="panel-content">
          
          {/* TAB 1: Profile Info */}
          {activeTab === 'profile' && (
            <>
              {/* General Entity Information */}
              <div className="detail-section">
                <div className="section-title">
                  <Building2 size={16} /> Legal & Incorporation Details
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Legal Name</span>
                    <span className="detail-value">{company.legalName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Incorporation Country</span>
                    <span className="detail-value">{company.country}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Registration Number</span>
                    <span className="detail-value">{company.registrationNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{getTaxLabel(company.country)}</span>
                    <span className="detail-value">{company.vatNumber || <em style={{ color: 'var(--text-muted)' }}>Not Registered / Missing</em>}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Registration Date</span>
                    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      {company.registrationDate || 'N/A'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Consolidation Status</span>
                    <span className="detail-value" style={{ 
                      fontWeight: 600, 
                      color: company.includeInConsolidation !== false ? 'var(--success)' : 'var(--warning)' 
                    }}>
                      {company.includeInConsolidation !== false ? 'Included in Group Reports' : 'Excluded from Group Reports'}
                    </span>
                  </div>
                </div>
                {company.notes && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <span className="detail-label" style={{ display: 'block', marginBottom: '4px' }}>Business Notes</span>
                    <span className="detail-value" style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{company.notes}"
                    </span>
                  </div>
                )}
              </div>

              {/* Primary Point of Contact */}
              <div className="detail-section">
                <div className="section-title">
                  <User size={16} /> Primary Point of Contact (POC)
                </div>
                {company.pointOfContact ? (
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Full Name</span>
                      <span className="detail-value" style={{ fontWeight: 600 }}>{company.pointOfContact.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Job Title / Role</span>
                      <span className="detail-value">{company.pointOfContact.role}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email Address</span>
                      <a href={`mailto:${company.pointOfContact.email}`} className="detail-value" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} />
                        {company.pointOfContact.email}
                      </a>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Direct Phone</span>
                      <a href={`tel:${company.pointOfContact.phone}`} className="detail-value" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} />
                        {company.pointOfContact.phone}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '16px' }}>
                    No Point of Contact listed. Click edit in directory list to supply contact details.
                  </div>
                )}
              </div>

              {/* Departments Management */}
              <div className="detail-section">
                <div className="section-title">
                  <ClipboardList size={16} /> Business Units (Departments)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(company.departments || []).map((dept, index) => {
                      const companyStaff = staff.filter(s => s.companyId === company.id);
                      return (
                        <div 
                          key={index} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-color)', 
                            padding: '8px 12px', 
                            borderRadius: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name || dept}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manager:</span>
                              <select
                                value={dept.managerId || ''}
                                onChange={(e) => handleSetDeptManager(dept.name || dept, e.target.value)}
                                style={{ 
                                  fontSize: '11px', 
                                  padding: '2px 6px', 
                                  backgroundColor: 'var(--bg-sidebar)', 
                                  border: '1px solid var(--border-color)', 
                                  color: 'var(--text-secondary)',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="">-- Unassigned --</option>
                                {companyStaff.map(s => (
                                  <option key={s.id} value={s.id}>{s.fullName} ({s.jobTitle})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDeleteDepartment(dept.name || dept)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: 'var(--danger)', 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '6px'
                            }}
                            title={`Remove ${dept.name || dept}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {(company.departments || []).length === 0 && (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No departments defined. Add one below.</span>
                    )}
                  </div>
                  
                  <form onSubmit={handleNewDepartmentSubmit} style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Add new department (e.g. Sales, Sourcing)..." 
                      className="form-input"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                    />
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', fontSize: '13px', flexShrink: 0 }}
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Insurance Portfolio */}
              <div className="detail-section">
                <div className="section-title">
                  {company.hasInsurance ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />} 
                  Insurance Portfolio & Coverage
                </div>

                {company.hasInsurance && company.insurance ? (
                  <div className="detail-grid" style={{ position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute', 
                      top: '-32px', 
                      right: '0', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: insStatus.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: insStatus.color }} />
                      {insStatus.label}
                    </div>
                    
                    <div className="detail-item">
                      <span className="detail-label">Insurance Provider</span>
                      <span className="detail-value">{company.insurance.provider}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Policy Number</span>
                      <span className="detail-value" style={{ fontFamily: 'monospace' }}>{company.insurance.policyNumber}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Coverage Valuation Limit</span>
                      <span className="detail-value" style={{ fontWeight: 600 }}>{company.insurance.coverageAmount}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Policy Validity</span>
                      <span className="detail-value">
                        {company.insurance.startDate} to {company.insurance.expiryDate}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="alert-item critical" style={{ margin: 0 }}>
                      <BadgeAlert size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      <div className="alert-content">
                        <div className="alert-title">No Active Insurance Policy Recorded</div>
                        <div className="alert-desc">Operating without commercial liability insurance poses massive corporate risks. Please edit this company from directory list.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Management Library */}
              <div className="detail-section">
                <div className="section-title">
                  <ClipboardList size={16} /> Document Library ({company.documents ? company.documents.length : 0})
                </div>

                {/* Document List */}
                {!company.documents || company.documents.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <FileText size={32} className="empty-state-icon" />
                    <div style={{ fontSize: '13px' }}>No documents uploaded for this company.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const categories = {
                        registration: { title: 'Incorporation & Registration', docs: [] },
                        vat: { title: 'Tax & VAT Registrations', docs: [] },
                        license: { title: 'Operating Licenses', docs: [] },
                        insurance: { title: 'Insurance Policies & Coverages', docs: [] },
                        other: { title: 'Miscellaneous Filings', docs: [] }
                      };
                      
                      (company.documents || []).forEach(doc => {
                        const type = doc.type || 'other';
                        if (categories[type]) {
                          categories[type].docs.push(doc);
                        } else {
                          categories['other'].docs.push(doc);
                        }
                      });

                      return Object.entries(categories).map(([catKey, cat]) => {
                        if (cat.docs.length === 0) return null;
                        return (
                          <details key={catKey} open style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <summary style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)', outline: 'none', userSelect: 'none' }}>
                              📁 {cat.title} ({cat.docs.length})
                            </summary>
                            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                              {cat.docs.map(doc => {
                                const isExpiring = doc.name.toLowerCase().includes('expire') || doc.type === 'insurance';
                                return (
                                  <div className="doc-card" key={doc.id} style={{ margin: 0, padding: '8px 12px' }}>
                                    <div className="doc-info">
                                      <div className="doc-icon">
                                        <FileText size={16} />
                                      </div>
                                      <div className="doc-name-group">
                                        <span className="doc-name" title={doc.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                          {doc.name}
                                          {isExpiring && (
                                            <span style={{ fontSize: '9px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                                              ⚠️ Expiry Warning
                                            </span>
                                          )}
                                        </span>
                                        <span className="doc-meta" style={{ fontSize: '10px' }}>
                                          {doc.fileSize} &bull; Uploaded {doc.uploadDate}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="doc-actions">
                                      <button type="button" className="btn-icon" title="View Document" onClick={() => handlePreviewDoc(doc)}>
                                        <Eye size={12} />
                                      </button>
                                      <button type="button" className="btn-icon delete" title="Delete Document" onClick={() => handleDeleteDoc(doc)}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Interactive Upload Box */}
                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="form-label">Upload New Document</span>
                    <select 
                      className="select-filter" 
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      style={{ padding: '6px 28px 6px 10px', fontSize: '12px', width: '200px' }}
                    >
                      <option value="registration">Registration Document</option>
                      <option value="vat">VAT / GST / Tax Cert</option>
                      <option value="license">License Certificate</option>
                      <option value="insurance">Insurance Certificate</option>
                      <option value="other">Other Document</option>
                    </select>
                  </div>

                  <div 
                    className={`upload-zone ${isDragging ? 'active' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && document.getElementById('file-upload-input').click()}
                    style={{ opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                  >
                    <input 
                      type="file" 
                      id="file-upload-input" 
                      style={{ display: 'none' }} 
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                    <UploadCloud size={32} className="upload-icon" />
                    <span className="upload-text">
                      {isUploading ? "Uploading file..." : "Drag and drop file here or Browse"}
                    </span>
                    <span className="upload-subtext">PDF, PNG, JPG or DOCX up to 10MB</span>
                  </div>
                </div>

              </div>
            </>
          )}

          {/* TAB 2: Statutory Compliances */}
          {activeTab === 'compliance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label" style={{ fontSize: '14px', fontWeight: 600 }}>Compliance Obligations Calendar</span>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowAddTaskForm(prev => !prev)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {showAddTaskForm ? 'Cancel' : 'Add Compliance Item'}
                </button>
              </div>

              {/* Add Obligation Form */}
              {showAddTaskForm && (
                <form onSubmit={handleAddComplianceTask} className="detail-section" style={{ animation: 'fadeIn 0.2s', border: '1px solid var(--primary)' }}>
                  <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                    <PlusCircle size={14} /> New Statutory Compliance Task
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Compliance / Filing Name <span>*</span></label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. HMRC Corporation Tax 2026"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="form-group-row">
                    <div className="form-group">
                      <label className="form-label">Compliance Category</label>
                      <select 
                        className="select-filter"
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        <option value="VAT">VAT / GST Filing</option>
                        <option value="HMRC">HMRC / IRS Tax Filing</option>
                        <option value="annual-accounts">Annual Accounts Filing</option>
                        <option value="license">License & Permits Renewal</option>
                        <option value="other">Other Compliance</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Due Date <span>*</span></label>
                      <input 
                        type="date" 
                        className="form-input"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Recurrence / Filing Frequency</label>
                      <select 
                        className="select-filter"
                        value={taskRecurrence}
                        onChange={(e) => setTaskRecurrence(e.target.value)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        <option value="one-time">One-time Obligation</option>
                        <option value="monthly">Monthly Recurring</option>
                        <option value="quarterly">Quarterly Recurring</option>
                        <option value="annually">Annually Recurring</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Task Notes / Description</label>
                    <textarea 
                      className="form-input"
                      rows="2"
                      placeholder="Notes regarding documents needed, accounts progress, etc."
                      value={taskNotes}
                      onChange={(e) => setTaskNotes(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Save Compliance Task
                  </button>
                </form>
              )}

              {/* Compliance Obligations List */}
              {!company.complianceTasks || company.complianceTasks.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <ClipboardList size={40} className="empty-state-icon" />
                  <div>No statutory compliance tasks created yet.</div>
                  <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowAddTaskForm(true)}>
                    Add First Task
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sortedTasks.map(task => {
                    const statusColor = getTaskStatusColor(task);
                    const daysLeftStr = getTaskDaysLeftStr(task);
                    
                    return (
                      <div 
                        key={task.id} 
                        className="doc-card"
                        style={{ 
                          alignItems: 'flex-start',
                          padding: '16px',
                          borderLeft: `4px solid ${statusColor}`,
                          backgroundColor: task.status === 'completed' ? 'rgba(255, 255, 255, 0.01)' : 'var(--bg-card)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                          
                          {/* Toggle Completion */}
                          <button 
                            className="btn-icon" 
                            style={{ 
                              border: 'none', 
                              padding: 0, 
                              width: '24px', 
                              height: '24px', 
                              backgroundColor: 'transparent',
                              color: task.status === 'completed' ? 'var(--success)' : 'var(--text-muted)'
                            }}
                            onClick={() => handleToggleTaskStatus(task.id)}
                            title={task.status === 'completed' ? "Mark as Pending" : "Mark as Completed"}
                          >
                            {task.status === 'completed' ? <CheckSquare size={20} /> : <Square size={20} />}
                          </button>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <span style={{ 
                                fontWeight: 600, 
                                fontSize: '14px',
                                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                color: task.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)'
                              }}>
                                {task.name}
                              </span>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: statusColor,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {daysLeftStr}
                              </span>
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)' }}>
                                {task.category}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> Due: {task.dueDate}
                              </span>
                            </div>

                            {task.notes && (
                              <p style={{ 
                                fontSize: '12px', 
                                color: 'var(--text-secondary)', 
                                marginTop: '4px',
                                textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                              }}>
                                {task.notes}
                              </p>
                            )}
                          </div>

                          {/* Delete Obligation */}
                          <button 
                            className="btn-icon delete" 
                            style={{ alignSelf: 'center', width: '28px', height: '28px' }}
                            onClick={() => handleDeleteComplianceTask(task.id, task.name)}
                            title="Remove Obligation"
                          >
                            <Trash2 size={12} />
                          </button>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: Bank Accounts */}
          {activeTab === 'banks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label" style={{ fontSize: '14px', fontWeight: 600 }}>Company Banking Portals</span>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowAddBankForm(prev => !prev)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {showAddBankForm ? 'Cancel' : 'Add Bank Account'}
                </button>
              </div>

              {/* Add Bank Form */}
              {showAddBankForm && (
                <form onSubmit={handleAddBankAccount} className="detail-section" style={{ animation: 'fadeIn 0.2s', border: '1px solid var(--primary)' }}>
                  <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                    <PlusCircle size={14} /> New Corporate Bank Account
                  </div>
                  
                  <div className="form-group-row">
                    <div className="form-group">
                      <label className="form-label">Bank Name <span>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Barclays Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Account Name / Holder <span>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Humres Ltd - Operating"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="form-group">
                      <label className="form-label">Account Number / IBAN <span>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Account Number or IBAN"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Sort Code / SWIFT / IFSC <span>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Routing Code or SWIFT"
                        value={bankSortCode}
                        onChange={(e) => setBankSortCode(e.target.value)}
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Currency <span>*</span></label>
                    <select 
                      className="select-filter"
                      value={bankCurrency}
                      onChange={(e) => setBankCurrency(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      <option value="GBP">GBP - British Pound (£)</option>
                      <option value="USD">USD - US Dollar ($)</option>
                      <option value="AED">AED - UAE Dirham (AED)</option>
                      <option value="INR">INR - Indian Rupee (₹)</option>
                      <option value="ZAR">ZAR - South African Rand (R)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Internal Reference / Notes</label>
                    <textarea 
                      className="form-input"
                      rows="2"
                      placeholder="e.g. Primary payout account, contractor disbursements..."
                      value={bankNotes}
                      onChange={(e) => setBankNotes(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Save Bank Account
                  </button>
                </form>
              )}

              {/* Accounts list */}
              {(!company.bankAccounts || company.bankAccounts.length === 0) ? (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <Wallet size={40} className="empty-state-icon" />
                  <div>No bank accounts recorded for this company.</div>
                  <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowAddBankForm(true)}>
                    Add Bank Account
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {company.bankAccounts.map(account => {
                    const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };
                    const symbol = symbolMap[account.currency] || '';
                    
                    return (
                      <div 
                        key={account.id} 
                        className="doc-card"
                        style={{ 
                          alignItems: 'flex-start',
                          padding: '16px',
                          borderLeft: `4px solid var(--primary)`,
                          backgroundColor: 'var(--bg-card)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                          <div style={{ color: 'var(--primary)', marginTop: '2px' }}>
                            <Wallet size={20} />
                          </div>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {account.bankName}
                              </span>
                              <span className="country-badge" style={{ 
                                background: 'rgba(16, 185, 129, 0.15)', 
                                color: 'var(--success)',
                                fontSize: '10px',
                                padding: '2px 8px',
                                textTransform: 'uppercase'
                              }}>
                                {account.currency} ({symbol.trim()})
                              </span>
                            </div>

                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              Holder: <strong>{account.accountName}</strong>
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', gap: '16px', marginTop: '2px' }}>
                              <span>A/C: {account.accountNumber}</span>
                              <span>Code/SWIFT: {account.sortCode}</span>
                            </div>

                            {account.notes && (
                              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                "{account.notes}"
                              </p>
                            )}
                          </div>

                          <button 
                            type="button" 
                            className="btn-icon delete" 
                            style={{ alignSelf: 'center', width: '28px', height: '28px' }}
                            onClick={() => handleDeleteBankAccount(account.id, account.bankName)}
                            title="Remove Account"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
