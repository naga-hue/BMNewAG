import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  User, 
  ShieldCheck, 
  ClipboardList, 
  ArrowLeft, 
  ArrowRight,
  Check,
  UploadCloud,
  Trash2,
  FileText
} from 'lucide-react';

const COUNTRIES = [
  { name: "United Kingdom", currency: "GBP", taxLabel: "VAT Registration Number", placeholder: "e.g. GB123456789" },
  { name: "United States", currency: "USD", taxLabel: "EIN / Tax ID", placeholder: "e.g. 12-3456789" },
  { name: "United Arab Emirates", currency: "AED", taxLabel: "TRN (Tax Registration Number)", placeholder: "e.g. 100293882700003" },
  { name: "India", currency: "INR", taxLabel: "GSTIN", placeholder: "e.g. 27AADCH4893K1Z9" }
];

export default function CompanyForm({ company, isOpen, onClose, onSave, onShowToast }) {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [notes, setNotes] = useState('');

  // POC state
  const [pocName, setPocName] = useState('');
  const [pocRole, setPocRole] = useState('');
  const [pocEmail, setPocEmail] = useState('');
  const [pocPhone, setPocPhone] = useState('');

  // Insurance state
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insProvider, setInsProvider] = useState('');
  const [insPolicyNumber, setInsPolicyNumber] = useState('');
  const [insCoverageAmount, setInsCoverageAmount] = useState('');
  const [insStartDate, setInsStartDate] = useState('');
  const [insExpiryDate, setInsExpiryDate] = useState('');

  // Documents state (created during wizard)
  const [documents, setDocuments] = useState([]);
  const [uploadDocType, setUploadDocType] = useState('registration');

  // Load editing company data if present
  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setLegalName(company.legalName || '');
      setCountry(company.country || 'United Kingdom');
      setRegistrationNumber(company.registrationNumber || '');
      setRegistrationDate(company.registrationDate || '');
      setVatNumber(company.vatNumber || '');
      setNotes(company.notes || '');

      if (company.pointOfContact) {
        setPocName(company.pointOfContact.name || '');
        setPocRole(company.pointOfContact.role || '');
        setPocEmail(company.pointOfContact.email || '');
        setPocPhone(company.pointOfContact.phone || '');
      } else {
        setPocName(''); setPocRole(''); setPocEmail(''); setPocPhone('');
      }

      setHasInsurance(!!company.hasInsurance);
      if (company.insurance) {
        setInsProvider(company.insurance.provider || '');
        setInsPolicyNumber(company.insurance.policyNumber || '');
        setInsCoverageAmount(company.insurance.coverageAmount || '');
        setInsStartDate(company.insurance.startDate || '');
        setInsExpiryDate(company.insurance.expiryDate || '');
      } else {
        setInsProvider(''); setInsPolicyNumber(''); setInsCoverageAmount(''); setInsStartDate(''); setInsExpiryDate('');
      }

      setDocuments(company.documents || []);
    } else {
      // Reset form
      setName('');
      setLegalName('');
      setCountry('United Kingdom');
      setRegistrationNumber('');
      setRegistrationDate('');
      setVatNumber('');
      setNotes('');
      setPocName('');
      setPocRole('');
      setPocEmail('');
      setPocPhone('');
      setHasInsurance(false);
      setInsProvider('');
      setInsPolicyNumber('');
      setInsCoverageAmount('');
      setInsStartDate('');
      setInsExpiryDate('');
      setDocuments([]);
    }
    setCurrentStep(1);
  }, [company, isOpen]);

  if (!isOpen) return null;

  // Selected country details
  const activeCountry = COUNTRIES.find(c => c.name === country) || COUNTRIES[0];

  // Helper to pre-seed standard compliances based on country
  const getInitialCompliances = (selectedCountry) => {
    const CURRENT_DATE = new Date('2026-06-29');
    
    const getFutureDate = (days) => {
      const copy = new Date(CURRENT_DATE);
      copy.setDate(copy.getDate() + days);
      return copy.toISOString().split('T')[0];
    };

    switch (selectedCountry) {
      case 'United Kingdom':
        return [
          { id: `task-s-${Date.now()}-1`, name: "Quarterly VAT Return", category: "VAT", dueDate: getFutureDate(90), recurrence: "quarterly", status: "pending", notes: "Quarterly VAT reconciliation filing with HMRC." },
          { id: `task-s-${Date.now()}-2`, name: "Annual Accounts Filing (Companies House)", category: "annual-accounts", dueDate: getFutureDate(270), recurrence: "annually", status: "pending", notes: "Preparation and audit submission to Companies House." },
          { id: `task-s-${Date.now()}-3`, name: "HMRC Corporation Tax Filing", category: "HMRC", dueDate: getFutureDate(365), recurrence: "annually", status: "pending", notes: "Corporate tax return (CT600)." }
        ];
      case 'United States':
        return [
          { id: `task-s-${Date.now()}-1`, name: "Q3 IRS Federal Tax Payment", category: "HMRC", dueDate: getFutureDate(90), recurrence: "quarterly", status: "pending", notes: "Estimated federal corporate income tax deposit." },
          { id: `task-s-${Date.now()}-2`, name: "Annual Delaware State Report", category: "annual-accounts", dueDate: getFutureDate(250), recurrence: "annually", status: "pending", notes: "State Franchise tax filing and fee clearance." }
        ];
      case 'United Arab Emirates':
        return [
          { id: `task-s-${Date.now()}-1`, name: "Commercial Trade License Renewal", category: "license", dueDate: getFutureDate(365), recurrence: "annually", status: "pending", notes: "Renew license with Dubai DED and Tenancy EJARI." },
          { id: `task-s-${Date.now()}-2`, name: "UAE FTA Quarterly VAT Filing", category: "VAT", dueDate: getFutureDate(90), recurrence: "quarterly", status: "pending", notes: "VAT returns submission to Federal Tax Authority." }
        ];
      case 'India':
        return [
          { id: `task-s-${Date.now()}-1`, name: "GSTR-1 Outward Invoices Filing", category: "VAT", dueDate: getFutureDate(30), recurrence: "monthly", status: "pending", notes: "Monthly GSTR-1 outbound invoice reporting (due by 11th)." },
          { id: `task-s-${Date.now()}-2`, name: "Income Tax Return (ITR-6) Submission", category: "HMRC", dueDate: getFutureDate(90), recurrence: "annually", status: "pending", notes: "Corporate Income Tax Filing to IT Department." },
          { id: `task-s-${Date.now()}-3`, name: "MCA Financial Filing Form AOC-4", category: "annual-accounts", dueDate: getFutureDate(120), recurrence: "annually", status: "pending", notes: "MCA annual audited financial filings." }
        ];
      default:
        return [];
    }
  };

  // Validate current step
  const canGoNext = () => {
    if (currentStep === 1) {
      return name.trim() !== '' && legalName.trim() !== '' && registrationNumber.trim() !== '';
    }
    if (currentStep === 2) {
      return true;
    }
    if (currentStep === 3) {
      if (pocEmail && !/\S+@\S+\.\S+/.test(pocEmail)) return false;
      return pocName.trim() !== '' && pocRole.trim() !== '' && pocEmail.trim() !== '';
    }
    if (currentStep === 4) {
      if (hasInsurance) {
        return insProvider.trim() !== '' && insPolicyNumber.trim() !== '' && insCoverageAmount.trim() !== '' && insStartDate !== '' && insExpiryDate !== '';
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (canGoNext()) {
      setCurrentStep(prev => prev + 1);
    } else {
      onShowToast("Please fill all required fields correctly before moving on.", "warning");
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
        id: `doc-${Date.now()}`,
        type: uploadDocType,
        name: file.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: fileSizeStr,
        url: '#'
      };

      setDocuments(prev => [...prev, newDoc]);
      onShowToast(`Attached mock file "${file.name}"`, "success");
    }
  };

  const handleDeleteDoc = (id) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canGoNext()) {
      onShowToast("Form has validation errors.", "warning");
      return;
    }

    const initialComplianceTasks = company 
      ? (company.complianceTasks || []) 
      : getInitialCompliances(country);

    const savedCompany = {
      id: company ? company.id : `comp-${Date.now()}`,
      name,
      legalName,
      country,
      registrationNumber,
      registrationDate,
      vatNumber,
      notes,
      pointOfContact: pocName ? {
        name: pocName,
        role: pocRole,
        email: pocEmail,
        phone: pocPhone
      } : null,
      hasInsurance,
      insurance: hasInsurance ? {
        provider: insProvider,
        policyNumber: insPolicyNumber,
        coverageAmount: insCoverageAmount,
        startDate: insStartDate,
        expiryDate: insExpiryDate
      } : null,
      documents,
      complianceTasks: initialComplianceTasks,
      departments: company ? (company.departments || []) : [],
      bankAccounts: company ? (company.bankAccounts || []) : []
    };

    onSave(savedCompany);
    onClose();
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Wizard Header */}
        <div className="wizard-header">
          <div className="wizard-title">
            <h2>{company ? `Edit Entity: ${company.name}` : 'Register New Group Entity'}</h2>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>

        {/* Wizard Step Indicators */}
        <div className="wizard-steps-indicator">
          {[
            { step: 1, label: 'Profile' },
            { step: 2, label: 'Tax & License' },
            { step: 3, label: 'Contact' },
            { step: 4, label: 'Insurance' },
            { step: 5, label: 'Documents' }
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

        {/* Wizard Form Content */}
        <div className="wizard-content">
          <form onSubmit={handleSubmit}>
            
            {/* STEP 1: Entity Profile */}
            {currentStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Corporate Identity</h3>
                
                <div className="form-group">
                  <label className="form-label">Operating Trade Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Humres Recruitment" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Registered Legal Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Humres Technical Recruitment Limited" 
                    value={legalName} 
                    onChange={(e) => setLegalName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Incorporation Jurisdiction <span>*</span></label>
                    <select 
                      className="select-filter" 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="India">India</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Registration Number <span>*</span></label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 08239472" 
                      value={registrationNumber} 
                      onChange={(e) => setRegistrationNumber(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Incorporation / Registration</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={registrationDate} 
                    onChange={(e) => setRegistrationDate(e.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brief Description / Notes</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    placeholder="Internal notes, specific division focuses, etc." 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Tax & Licensing */}
            {currentStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Taxation & Compliance Codes</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Please supply the official tax identification details for the <strong>{country}</strong> jurisdiction.
                </p>

                <div className="form-group">
                  <label className="form-label">{activeCountry.taxLabel}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={activeCountry.placeholder} 
                    value={vatNumber} 
                    onChange={(e) => setVatNumber(e.target.value)} 
                  />
                </div>

                <div className="alert-item" style={{ borderLeftColor: 'var(--info)', background: 'var(--info-light)', marginTop: '20px' }}>
                  <ClipboardList size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />
                  <div className="alert-content" style={{ fontSize: '12px' }}>
                    <div className="alert-title" style={{ fontWeight: 600 }}>Country-Specific Regulatory Reminders:</div>
                    {country === 'United Kingdom' && <div className="alert-desc">UK entities must comply with Companies House regulations and supply valid VAT registrations if turnover exceeds registration thresholds.</div>}
                    {country === 'United States' && <div className="alert-desc">US LLCs require a Federal Employer Identification Number (EIN) issued by the IRS for taxation and corporate banking transactions.</div>}
                    {country === 'United Arab Emirates' && <div className="alert-desc">UAE entities must obtain a Tax Registration Number (TRN) issued by the Federal Tax Authority for VAT compliance.</div>}
                    {country === 'India' && <div className="alert-desc">Indian private limited companies must record their 15-digit GSTIN (GST Identification Number) for state-specific operations.</div>}
                  </div>
                </div>

                {!company && (
                  <div className="alert-item" style={{ borderLeftColor: 'var(--success)', background: 'var(--success-light)', marginTop: '12px' }}>
                    <Check size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <div className="alert-content" style={{ fontSize: '12px' }}>
                      <div className="alert-title" style={{ fontWeight: 600 }}>Automated Statutory Pre-seed:</div>
                      <div className="alert-desc">Saving this new company will automatically pre-seed standard <strong>{country}</strong> compliance tasks (e.g. VAT and Accounts deadlines) to your dashboard.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Point of Contact */}
            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Primary Corporate Contact</h3>
                
                <div className="form-group">
                  <label className="form-label">Contact Full Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Jane Smith" 
                    value={pocName} 
                    onChange={(e) => setPocName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Job Title / Position <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Operations Director" 
                    value={pocRole} 
                    onChange={(e) => setPocRole(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">Work Email Address <span>*</span></label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. j.smith@company.com" 
                      value={pocEmail} 
                      onChange={(e) => setPocEmail(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Direct Phone Number</label>
                    <input 
                      type="tel" 
                      className="form-input" 
                      placeholder="e.g. +44 7700 900077" 
                      value={pocPhone} 
                      onChange={(e) => setPocPhone(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Insurance Portfolio */}
            {currentStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--accent)' }}>Commercial Liability Insurance</h3>
                
                <label className="form-checkbox">
                  <input 
                    type="checkbox" 
                    checked={hasInsurance} 
                    onChange={(e) => setHasInsurance(e.target.checked)} 
                  />
                  <span>This entity holds an active commercial liability insurance policy</span>
                </label>

                {hasInsurance && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.25s' }}>
                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">Insurance Provider <span>*</span></label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. AXA Commercial" 
                          value={insProvider} 
                          onChange={(e) => setInsProvider(e.target.value)} 
                          required 
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Policy Number <span>*</span></label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. AXA-992-8812" 
                          value={insPolicyNumber} 
                          onChange={(e) => setInsPolicyNumber(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Coverage Limit Amount <span>*</span></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder={country === 'United Kingdom' ? 'e.g. £5,000,000' : country === 'United States' ? 'e.g. $2,000,000' : country === 'India' ? 'e.g. ₹2,50,00,000' : 'e.g. AED 10,000,000'} 
                        value={insCoverageAmount} 
                        onChange={(e) => setInsCoverageAmount(e.target.value)} 
                        required 
                      />
                    </div>

                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">Policy Start Date <span>*</span></label>
                        <input 
                          type="date" 
                          className="form-input" 
                          value={insStartDate} 
                          onChange={(e) => setInsStartDate(e.target.value)} 
                          required 
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Policy Expiry Date <span>*</span></label>
                        <input 
                          type="date" 
                          className="form-input" 
                          value={insExpiryDate} 
                          onChange={(e) => setInsExpiryDate(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Document Library Checklist */}
            {currentStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>Document Attachment Checklist</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Provide initial scans of Certificate of Incorporation, VAT Certificate, License, and Insurance.
                </p>

                {/* Upload Zone */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="form-label">Select Document Category</span>
                  <select 
                    className="select-filter" 
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    style={{ padding: '6px 28px 6px 10px', fontSize: '12px', width: '200px' }}
                  >
                    <option value="registration">Registration Certificate</option>
                    <option value="vat">VAT / GST / Tax Cert</option>
                    <option value="license">License Certificate</option>
                    <option value="insurance">Insurance Policy Cert</option>
                    <option value="other">Other Attachment</option>
                  </select>
                </div>

                <div 
                  className="upload-zone"
                  onClick={() => document.getElementById('wizard-file-uploader').click()}
                >
                  <input 
                    type="file" 
                    id="wizard-file-uploader" 
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <UploadCloud size={32} className="upload-icon" />
                  <span className="upload-text">Select document to mock upload</span>
                  <span className="upload-subtext">Will be attached category: {uploadDocType.toUpperCase()}</span>
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

        {/* Wizard Footer */}
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
              Save Company details
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
