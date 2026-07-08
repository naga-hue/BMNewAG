import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, Save } from 'lucide-react';

export default function StaffExitModal({ 
  isOpen, 
  onClose, 
  staffMember, 
  onSave, 
  companies = [] 
}) {
  const [exitDate, setExitDate] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [noticePayPeriod, setNoticePayPeriod] = useState('');
  const [noticePayoutOption, setNoticePayoutOption] = useState('regular-payroll');
  const [noticePayoutCustomDate, setNoticePayoutCustomDate] = useState('');
  const [additionalExitPayment, setAdditionalExitPayment] = useState('');
  const [salaryPaidUntilDate, setSalaryPaidUntilDate] = useState('');

  const normalizeDateForInput = (dateStr) => {
    if (!dateStr) return '';
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

  useEffect(() => {
    if (staffMember) {
      setExitDate(normalizeDateForInput(staffMember.exitDate || ''));
      setLastWorkingDate(normalizeDateForInput(staffMember.lastWorkingDate || ''));
      setNoticePeriod(staffMember.noticePeriod || '');
      setNoticePayPeriod(staffMember.noticePayPeriod || '');
      setNoticePayoutOption(staffMember.noticePayoutOption || 'regular-payroll');
      setNoticePayoutCustomDate(normalizeDateForInput(staffMember.noticePayoutCustomDate || ''));
      setAdditionalExitPayment(staffMember.additionalExitPayment || '');
      setSalaryPaidUntilDate(normalizeDateForInput(staffMember.salaryPaidUntilDate || ''));
    } else {
      setExitDate(new Date().toISOString().split('T')[0]);
      setLastWorkingDate('');
      setNoticePeriod('');
      setNoticePayPeriod('');
      setNoticePayoutOption('regular-payroll');
      setNoticePayoutCustomDate('');
      setAdditionalExitPayment('');
      setSalaryPaidUntilDate('');
    }
  }, [staffMember, isOpen]);

  if (!isOpen || !staffMember) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updatedStaff = {
      ...staffMember,
      status: 'exited',
      exitDate,
      lastWorkingDate,
      noticePeriod,
      noticePayPeriod,
      noticePayoutOption,
      noticePayoutCustomDate: noticePayoutOption === 'custom-date' ? noticePayoutCustomDate : '',
      additionalExitPayment: Number(additionalExitPayment) || 0,
      salaryPaidUntilDate
    };

    onSave(updatedStaff);
    onClose();
  };

  const matchedCompany = companies.find(c => c.id === staffMember.companyId) || { currency: 'GBP' };
  const currencySymbol = matchedCompany.currency === 'USD' ? '$' : 
                         matchedCompany.currency === 'AED' ? 'AED ' : 
                         matchedCompany.currency === 'INR' ? '₹' : 
                         matchedCompany.currency === 'ZAR' ? 'R' : '£';

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <form 
        onSubmit={handleSubmit} 
        className="form-wizard-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '550px', maxHeight: '85vh' }}
      >
        
        {/* Modal Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>Process Employee Exit</h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Configure final details for <strong>{staffMember.fullName}</strong></span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close dialog" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Wizard Content */}
        <div className="wizard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          
          {/* Info warning alert banner */}
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.05)', 
            border: '1px solid rgba(239, 68, 68, 0.15)', 
            borderRadius: '8px', 
            padding: '12px 16px', 
            display: 'flex',
            gap: '10px'
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Marking this staff member as <strong>Exited</strong> will stop regular payroll runs and activate the asset recovery/account suspensions checklist on their profile details view.
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exit Notification Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={exitDate} 
                onChange={(e) => setExitDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Actual Last Working Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={lastWorkingDate} 
                onChange={(e) => setLastWorkingDate(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notice Period Served</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 1 month, 4 weeks"
                value={noticePeriod} 
                onChange={(e) => setNoticePeriod(e.target.value)} 
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notice Pay Period</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 4 weeks"
                value={noticePayPeriod} 
                onChange={(e) => setNoticePayPeriod(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notice Payout Term</label>
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

            {noticePayoutOption === 'custom-date' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Custom Payout Date <span>*</span></label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={noticePayoutCustomDate} 
                  onChange={(e) => setNoticePayoutCustomDate(e.target.value)} 
                  required={noticePayoutOption === 'custom-date'}
                />
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Salary Paid Until Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={salaryPaidUntilDate} 
                  onChange={(e) => setSalaryPaidUntilDate(e.target.value)} 
                />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Additional Exit/Severance Payment ({currencySymbol})</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 2000"
              value={additionalExitPayment} 
              onChange={(e) => setAdditionalExitPayment(e.target.value)} 
            />
          </div>

        </div>

        {/* Fixed Wizard Footer Actions */}
        <div className="wizard-footer" style={{ padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={14} /> Confirm Exit & Deactivate
          </button>
        </div>

      </form>
    </div>
  );
}
