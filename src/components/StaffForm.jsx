import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Building2, 
  Wallet, 
  Briefcase, 
  FileText, 
  ArrowLeft, 
  ArrowRight,
  Check,
  UploadCloud,
  Trash2
} from 'lucide-react';

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP - British Pound' },
  { code: 'USD', symbol: '$', label: 'USD - US Dollar' },
  { code: 'AED', symbol: 'AED ', label: 'AED - UAE Dirham' },
  { code: 'INR', symbol: '₹', label: 'INR - Indian Rupee' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR - South African Rand' }
];

export default function StaffForm({ staffMember, companies, isOpen, onClose, onSave, onShowToast, staffList = [], leavePolicies = [], commissionPolicies = [], payrollPolicies = [] }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  
  // Step 1: Personal details state
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');

  // Step 2: Employment details state
  const [companyId, setCompanyId] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [leavePolicyId, setLeavePolicyId] = useState('');
  const [commissionPolicyId, setCommissionPolicyId] = useState('');
  const [status, setStatus] = useState('active');
  const [exitDate, setExitDate] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [salaryPaidUntilDate, setSalaryPaidUntilDate] = useState('');
  const [additionalExitPayment, setAdditionalExitPayment] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [noticePayPeriod, setNoticePayPeriod] = useState('');
  const [noticePayoutOption, setNoticePayoutOption] = useState('regular-payroll');
  const [noticePayoutCustomDate, setNoticePayoutCustomDate] = useState('');
  const [payrollPolicyId, setPayrollPolicyId] = useState('');

  // Step 3: Compensation details state
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [attendanceRate, setAttendanceRate] = useState('');

  // Step 4: Business contact details state
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  // Step 5: Documents list state
  const [documents, setDocuments] = useState([]);
  const [uploadDocType, setUploadDocType] = useState('appointment');

  // Dynamically load departments of selected company
  const selectedCompanyObj = companies.find(c => c.id === companyId);
  const companyDepts = selectedCompanyObj ? (selectedCompanyObj.departments || []).map(d => d.name || d) : [];

  const normalizeDateForInput = (dateStr) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let [d, m, y] = parts;
        d = d.padStart(2, '0');
        m = m.padStart(2, '0');
        if (y.length === 2) {
          y = Number(y) > 30 ? `19${y}` : `20${y}`;
        }
        return `${y}-${m}-${d}`;
      }
    }
    try {
      const dObj = new Date(dateStr);
      if (!isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {}
    return dateStr;
  };

  // Reset or load editing staff member details
  useEffect(() => {
    if (staffMember) {
      setFullName(staffMember.fullName || '');
      setDateOfBirth(normalizeDateForInput(staffMember.dateOfBirth || ''));
      setAddress(staffMember.address || '');
      setPersonalEmail(staffMember.personalEmail || '');
      setPersonalPhone(staffMember.personalPhone || '');
      
      setCompanyId(staffMember.companyId || (companies[0] ? companies[0].id : ''));
      setDepartment(staffMember.department || '');
      setJobTitle(staffMember.jobTitle || '');
      setStartDate(normalizeDateForInput(staffMember.startDate || ''));
      setReportingManagerId(staffMember.reportingManagerId || '');
      setLeavePolicyId(staffMember.leavePolicyId || '');
      setCommissionPolicyId(staffMember.commissionPolicyId || '');
      setStatus(staffMember.status || 'active');
      setExitDate(normalizeDateForInput(staffMember.exitDate || ''));
      setNoticePeriod(staffMember.noticePeriod || '');
      setSalaryPaidUntilDate(normalizeDateForInput(staffMember.salaryPaidUntilDate || ''));
      setAdditionalExitPayment(staffMember.additionalExitPayment || '');
      setLastWorkingDate(normalizeDateForInput(staffMember.lastWorkingDate || ''));
      setNoticePayPeriod(staffMember.noticePayPeriod || '');
      setNoticePayoutOption(staffMember.noticePayoutOption || 'regular-payroll');
      setNoticePayoutCustomDate(normalizeDateForInput(staffMember.noticePayoutCustomDate || ''));
      setPayrollPolicyId(staffMember.payrollPolicyId || '');
      
      setSalary(staffMember.salary || '');
      setCurrency(staffMember.currency || 'GBP');
      setAttendanceRate(staffMember.attendanceRate || '');
      
      setBusinessEmail(staffMember.businessEmail || '');
      setBusinessPhone(staffMember.businessPhone || '');
      
      setDocuments(staffMember.documents || []);
    } else {
      // Default creation state
      setFullName('');
      setDateOfBirth('');
      setAddress('');
      setPersonalEmail('');
      setPersonalPhone('');
      
      const firstCompanyId = companies[0] ? companies[0].id : '';
      setCompanyId(firstCompanyId);
      setDepartment('');
      setJobTitle('');
      setStartDate('');
      setReportingManagerId('');
      setLeavePolicyId('');
      setCommissionPolicyId('');
      setStatus('active');
      setExitDate('');
      setNoticePeriod('');
      setSalaryPaidUntilDate('');
      setAdditionalExitPayment('');
      setLastWorkingDate('');
      setNoticePayPeriod('');
      setNoticePayoutOption('regular-payroll');
      setNoticePayoutCustomDate('');
      setPayrollPolicyId('');
      
      setSalary('');
      setCurrency(companies[0] ? (
        companies[0].country === 'United States' ? 'USD' : 
        companies[0].country === 'United Arab Emirates' ? 'AED' : 
        companies[0].country === 'India' ? 'INR' : 
        companies[0].country === 'South Africa' ? 'ZAR' : 
        'GBP'
      ) : 'GBP');
      setAttendanceRate('');
      
      setBusinessEmail('');
      setBusinessPhone('');
      
      setDocuments([]);
    }
    setCurrentStep(1);
  }, [staffMember, isOpen, companies]);

  // Adjust default department when company changes
  useEffect(() => {
    if (!staffMember && companyDepts.length > 0 && !companyDepts.includes(department)) {
      setDepartment(companyDepts[0]);
    }
    
    // Adjust default currency based on selected company country
    if (!staffMember && selectedCompanyObj) {
      const countryName = selectedCompanyObj.country;
      if (countryName === 'United States') setCurrency('USD');
      else if (countryName === 'United Arab Emirates') setCurrency('AED');
      else if (countryName === 'India') setCurrency('INR');
      else if (countryName === 'South Africa') setCurrency('ZAR');
      else setCurrency('GBP');
    }

    // Auto-select first matching leave policy
    const matchingPolicies = leavePolicies.filter(p => p.companyId === companyId);
    if (!staffMember && matchingPolicies.length > 0 && !matchingPolicies.some(p => p.id === leavePolicyId)) {
      setLeavePolicyId(matchingPolicies[0].id);
    }

    // Auto-select first matching commission policy
    const matchingComms = commissionPolicies.filter(p => p.companyId === companyId);
    if (!staffMember && matchingComms.length > 0 && !matchingComms.some(p => p.id === commissionPolicyId)) {
      setCommissionPolicyId(matchingComms[0].id);
    }
  }, [companyId, companies, leavePolicies, commissionPolicies, staffMember]);

  if (!isOpen) return null;

  // Form step validation check
  const canGoNext = () => {
    if (currentStep === 1) {
      const isEmailValid = /\S+@\S+\.\S+/.test(personalEmail);
      return fullName.trim() !== '' && dateOfBirth !== '' && address.trim() !== '' && isEmailValid && personalPhone.trim() !== '';
    }
    if (currentStep === 2) {
      const isExitValid = status !== 'exited' || exitDate !== '';
      return companyId !== '' && department !== '' && jobTitle.trim() !== '' && startDate !== '' && isExitValid;
    }
    if (currentStep === 3) {
      return salary !== '' && Number(salary) > 0 && currency !== '';
    }
    if (currentStep === 4) {
      const isEmailValid = /\S+@\S+\.\S+/.test(businessEmail);
      return isEmailValid && businessPhone.trim() !== '';
    }
    return true;
  };

  const handleNext = () => {
    const errs = {};
    if (currentStep === 1) {
      if (!fullName.trim()) errs.fullName = "Full Name";
      if (!dateOfBirth) errs.dateOfBirth = "Date of Birth";
      if (!address.trim()) errs.address = "Home Address";
      if (!personalEmail) {
        errs.personalEmail = "Personal Email";
      } else if (!/\S+@\S+\.\S+/.test(personalEmail)) {
        errs.personalEmail = "Valid Personal Email";
      }
      if (!personalPhone.trim()) errs.personalPhone = "Personal Phone";
    }
    else if (currentStep === 2) {
      if (!companyId) errs.companyId = "Employer Company";
      if (!department) errs.department = "Department / BU";
      if (!jobTitle.trim()) errs.jobTitle = "Job Title / Designation";
      if (!startDate) errs.startDate = "Official Start Date";
    }
    else if (currentStep === 3) {
      const selectedPolicy = payrollPolicies.find(p => p.id === payrollPolicyId);
      const isFreelance = selectedPolicy?.type === 'freelance';
      if (isFreelance) {
        if (!attendanceRate || Number(attendanceRate) <= 0) errs.attendanceRate = "Contractor Daily Rate";
      } else {
        if (!salary || Number(salary) <= 0) errs.salary = "Salary package";
      }
      if (!currency) errs.currency = "Currency selection";
    }
    else if (currentStep === 4) {
      if (!businessEmail) {
        errs.businessEmail = "Business Email";
      } else if (!/\S+@\S+\.\S+/.test(businessEmail)) {
        errs.businessEmail = "Valid Business Email";
      }
      if (!businessPhone.trim()) errs.businessPhone = "Work Phone";
    }

    if (Object.keys(errs).length === 0) {
      setErrors({});
      setCurrentStep(prev => prev + 1);
    } else {
      setErrors(errs);
      const missingFields = Object.values(errs).join(", ");
      onShowToast(`Please complete the required fields: ${missingFields}`, "warning");
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileSizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;

      const newDoc = {
        id: `sdoc-${Date.now()}`,
        type: uploadDocType,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: fileSizeStr,
        url: '#' // local mock url, uploaded to Storage in detail page
      };

      setDocuments(prev => [...prev, newDoc]);
      onShowToast(`Attached "${file.name}" as ${uploadDocType.toUpperCase()} letter`, "success");
    }
  };

  const handleDeleteDoc = (id) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canGoNext()) {
      onShowToast("Validation errors exist in the staff profile form.", "warning");
      return;
    }

    const savedStaff = {
      id: staffMember ? staffMember.id : `staff-${Date.now()}`,
      fullName,
      dateOfBirth,
      address,
      personalEmail,
      personalPhone,
      companyId,
      department,
      jobTitle,
      startDate,
      salary: Number(salary),
      currency,
      attendanceRate: attendanceRate ? Number(attendanceRate) : '',
      businessEmail,
      businessPhone,
      reportingManagerId,
      leavePolicyId,
      commissionPolicyId,
      payrollPolicyId,
      status,
      exitDate: status === 'exited' ? exitDate : '',
      noticePeriod: status === 'exited' ? noticePeriod : '',
      salaryPaidUntilDate: status === 'exited' ? salaryPaidUntilDate : '',
      additionalExitPayment: status === 'exited' ? Number(additionalExitPayment) || 0 : 0,
      lastWorkingDate: status === 'exited' ? lastWorkingDate : '',
      noticePayPeriod: status === 'exited' ? noticePayPeriod : '',
      noticePayoutOption: status === 'exited' ? noticePayoutOption : '',
      noticePayoutCustomDate: (status === 'exited' && noticePayoutOption === 'custom-date') ? noticePayoutCustomDate : '',
      documents
    };

    onSave(savedStaff);
    onClose();
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Wizard Header */}
        <div className="wizard-header">
          <div className="wizard-title">
            <h2>{staffMember ? `Edit Staff Profile: ${staffMember.fullName}` : 'Onboard New Staff Member'}</h2>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>

        {/* Wizard Step Indicators */}
        <div className="wizard-steps-indicator">
          {[
            { step: 1, label: 'Personal', icon: <User size={12} /> },
            { step: 2, label: 'Job details', icon: <Briefcase size={12} /> },
            { step: 3, label: 'Salary', icon: <Wallet size={12} /> },
            { step: 4, label: 'Work Contact', icon: <Briefcase size={12} /> },
            { step: 5, label: 'Documents', icon: <FileText size={12} /> }
          ].map(s => (
            <div 
              key={s.step} 
              className={`wizard-step ${currentStep === s.step ? 'active' : ''} ${currentStep > s.step ? 'completed' : ''}`}
            >
              <div className="step-number">
                {currentStep > s.step ? <Check size={12} /> : s.step}
              </div>
              <span className="step-label" style={{ display: 'none' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Form Content Area */}
        <div className="wizard-content">
          <form onSubmit={handleSubmit}>
            
            {/* STEP 1: Personal Details */}
            {currentStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Personal Information</h3>
                
                <div className="form-group">
                  <label className="form-label">Full Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Date of Birth <span>*</span></label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Personal Phone Number <span>*</span></label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="e.g. +44 7700 900111"
                      value={personalPhone}
                      onChange={(e) => setPersonalPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Personal Email Address <span>*</span></label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="e.g. j.doe.personal@gmail.com"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Residential Living Address <span>*</span></label>
                  <textarea 
                    className="form-input" 
                    rows="3"
                    placeholder="Full home residential address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Employment Details */}
            {currentStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Group Employment Details</h3>
                
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Employer Company <span>*</span></label>
                    <select 
                      className="select-filter"
                      value={companyId}
                      onChange={(e) => {
                        setCompanyId(e.target.value);
                        if (errors.companyId) setErrors(prev => ({ ...prev, companyId: null }));
                      }}
                      style={{ width: '100%', padding: '10px', borderColor: errors.companyId ? 'var(--danger)' : 'var(--border-color)' }}
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                      ))}
                    </select>
                    {errors.companyId && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{errors.companyId}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department / Business Unit <span>*</span></label>
                    {companyDepts.length > 0 ? (
                      <select 
                        className="select-filter"
                        value={department}
                        onChange={(e) => {
                          setDepartment(e.target.value);
                          if (errors.department) setErrors(prev => ({ ...prev, department: null }));
                        }}
                        style={{ width: '100%', padding: '10px', borderColor: errors.department ? 'var(--danger)' : 'var(--border-color)' }}
                      >
                        {companyDepts.map((d, index) => (
                          <option key={index} value={d}>{d}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--danger)', padding: '10px', background: 'var(--danger-light)', borderRadius: '6px' }}>
                        No departments found for this company. Please define departments in Company Profile first.
                      </div>
                    )}
                    {errors.department && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{errors.department}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Job Title / Designation <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. Recruitment Consultant"
                    value={jobTitle}
                    onChange={(e) => {
                      setJobTitle(e.target.value);
                      if (errors.jobTitle) setErrors(prev => ({ ...prev, jobTitle: null }));
                    }}
                    style={{ borderColor: errors.jobTitle ? 'var(--danger)' : 'var(--border-color)' }}
                    required
                  />
                  {errors.jobTitle && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{errors.jobTitle}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Official Start Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (errors.startDate) setErrors(prev => ({ ...prev, startDate: null }));
                    }}
                    style={{ borderColor: errors.startDate ? 'var(--danger)' : 'var(--border-color)' }}
                    required
                  />
                  {errors.startDate && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{errors.startDate}</span>}
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Reporting Manager</label>
                  <select 
                    className="select-filter"
                    value={reportingManagerId}
                    onChange={(e) => setReportingManagerId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="">None - Reports to Board / Director</option>
                    {staffList
                      .filter(s => s.companyId === companyId && s.id !== (staffMember ? staffMember.id : ''))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.fullName} ({s.jobTitle})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Leave Policy <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={leavePolicyId}
                    onChange={(e) => setLeavePolicyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Leave Policy --</option>
                    {leavePolicies
                      .filter(p => p.companyId === companyId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.annualAllowance} Annual / {p.sickAllowance} Sick)</option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group-row" style={{ marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select 
                      className="select-filter"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      <option value="active">Active Staff Member</option>
                      <option value="exited">Exited Staff Member</option>
                    </select>
                  </div>
                  
                  {status === 'exited' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Date of Exit <span>*</span></label>
                        <input 
                          type="date" 
                          className="form-input"
                          value={exitDate}
                          onChange={(e) => setExitDate(e.target.value)}
                          required={status === 'exited'}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Notice Period Served</label>
                        <input 
                          type="text" 
                          className="form-input"
                          placeholder="e.g. 1 month, 3 months, 30 days"
                          value={noticePeriod}
                          onChange={(e) => setNoticePeriod(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Salary Paid Until Date (Notice Period)</label>
                        <input 
                          type="date" 
                          className="form-input"
                          value={salaryPaidUntilDate}
                          onChange={(e) => setSalaryPaidUntilDate(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Additional Exit Payment Amount</label>
                        <input 
                          type="number" 
                          className="form-input"
                          placeholder="e.g. 1500"
                          value={additionalExitPayment}
                          onChange={(e) => setAdditionalExitPayment(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Actual Last Working Date</label>
                        <input 
                          type="date" 
                          className="form-input"
                          value={lastWorkingDate}
                          onChange={(e) => setLastWorkingDate(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Notice Pay Period</label>
                        <input 
                          type="text" 
                          className="form-input"
                          placeholder="e.g. 4 weeks, 1 month"
                          value={noticePayPeriod}
                          onChange={(e) => setNoticePayPeriod(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">When Notice Paid</label>
                        <select 
                          className="select-filter"
                          value={noticePayoutOption}
                          onChange={(e) => setNoticePayoutOption(e.target.value)}
                          style={{ width: '100%', padding: '10px' }}
                        >
                          <option value="regular-payroll">Paid on Next Regular Payroll</option>
                          <option value="end-of-notice">Paid at End of Notice Period</option>
                          <option value="custom-date">Paid on Custom Date...</option>
                        </select>
                      </div>
                      {noticePayoutOption === 'custom-date' && (
                        <div className="form-group">
                          <label className="form-label">Notice Payout Date <span>*</span></label>
                          <input 
                            type="date" 
                            className="form-input"
                            value={noticePayoutCustomDate}
                            onChange={(e) => setNoticePayoutCustomDate(e.target.value)}
                            required={status === 'exited' && noticePayoutOption === 'custom-date'}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Compensation Package */}
            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Compensation & Payroll</h3>
                
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Salary (Annual base amount) <span>*</span></label>
                    <input 
                      type="number" 
                      className="form-input"
                      placeholder="e.g. 50000"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Currency Designation <span>*</span></label>
                    <select 
                      className="select-filter"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Commission Structure <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={commissionPolicyId}
                    onChange={(e) => setCommissionPolicyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Commission Scheme --</option>
                    {commissionPolicies
                      .filter(p => p.companyId === companyId)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type === 'manager' ? `Manager Override ${p.teamOverridePercent}%` : 'Recruiter Plan'})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Payroll Policy Template (For projections & payslips)</label>
                  <select 
                    className="select-filter"
                    value={payrollPolicyId}
                    onChange={(e) => setPayrollPolicyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="">-- No Policy (Standard Salaried Projections) --</option>
                    {payrollPolicies.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type === 'ft_uk' ? 'FT UK Employee' : p.type === 'freelance' ? 'Freelance/Contractor' : 'Custom'})
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selectedPolicy = payrollPolicies.find(p => p.id === payrollPolicyId);
                  const isFreelance = selectedPolicy?.type === 'freelance';
                  if (!isFreelance) return null;
                  return (
                    <div className="form-group" style={{ marginTop: '8px', animation: 'fadeIn 0.2s' }}>
                      <label className="form-label">Contractor Daily Rate ({CURRENCIES.find(c => c.code === currency)?.symbol}) <span>*</span></label>
                      <input 
                        type="number"
                        className="form-input"
                        placeholder="e.g. 300"
                        value={attendanceRate}
                        onChange={(e) => setAttendanceRate(e.target.value)}
                        required
                      />
                    </div>
                  );
                })()}
                
                <div style={{ 
                  marginTop: '16px', 
                  padding: '16px', 
                  backgroundColor: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Salary Conversion Reference:</div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Paying: <strong>{CURRENCIES.find(c => c.code === currency)?.symbol}{Number(salary).toLocaleString()}</strong> per annum.
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Note: Salary currency is mapped to global financial reports. Please verify local compliance for cross-border payroll assignments.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Business Contact Details */}
            {currentStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Business Contact Information</h3>
                
                <div className="form-group">
                  <label className="form-label">Corporate Business Email <span>*</span></label>
                  <input 
                    type="email" 
                    className="form-input"
                    placeholder="e.g. j.doe@humres.co.uk"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Business Work Phone <span>*</span></label>
                  <input 
                    type="tel" 
                    className="form-input"
                    placeholder="e.g. +44 7700 900222"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* STEP 5: Employment Document Attachments */}
            {currentStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Onboarding Documents Checklist</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Attach contract letters, appraisal updates, or standard correspondence.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="form-label">Document Folder Category</span>
                  <select 
                    className="select-filter" 
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    style={{ padding: '6px 28px 6px 10px', fontSize: '12px', width: '200px' }}
                  >
                    <option value="appointment">Appointment Order</option>
                    <option value="appraisal">Appraisal Letter</option>
                    <option value="letter">Official Letter / Communications</option>
                    <option value="other">Other Document</option>
                  </select>
                </div>

                <div 
                  className="upload-zone"
                  onClick={() => document.getElementById('staff-wizard-uploader').click()}
                >
                  <input 
                    type="file" 
                    id="staff-wizard-uploader" 
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <UploadCloud size={32} className="upload-icon" />
                  <span className="upload-text">Select file to mock upload</span>
                  <span className="upload-subtext">Will be attached as: {uploadDocType.toUpperCase()}</span>
                </div>

                {/* Attached Files List */}
                {documents.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Attached Files ({documents.length})</span>
                    <div className="doc-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {documents.map(doc => (
                        <div className="doc-card" key={doc.id}>
                          <div className="doc-info">
                            <FileText size={16} style={{ color: 'var(--primary)' }} />
                            <div className="doc-name-group">
                              <span className="doc-name" style={{ fontSize: '12px', maxWidth: '220px' }}>{doc.name}</span>
                              <span className="doc-meta">{doc.type.toUpperCase()} &bull; {doc.fileSize}</span>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="btn-icon delete" 
                            onClick={() => handleDeleteDoc(doc.id)}
                            title="Remove attachment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </form>
        </div>

        {/* Wizard Footer Controls */}
        <div className="wizard-footer">
          {currentStep > 1 ? (
            <button type="button" className="btn-secondary" onClick={handleBack}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}

          {currentStep < 5 ? (
            <button type="button" className="btn-primary" onClick={handleNext} disabled={!canGoNext()}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!canGoNext()}>
              Save Staff Profile
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
