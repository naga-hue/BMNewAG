import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Building2, Calendar, DollarSign, ShieldCheck, FileText } from 'lucide-react';

export default function StaffTransferModal({
  isOpen,
  onClose,
  staffMember,
  companies = [],
  payrollPolicies = [],
  leavePolicies = [],
  commissionPolicies = [],
  onSave,
  onShowToast
}) {
  const [exitDate, setExitDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newCurrency, setNewCurrency] = useState('GBP');
  const [newPayrollPolicyId, setNewPayrollPolicyId] = useState('');
  const [newLeavePolicyId, setNewLeavePolicyId] = useState('');
  const [newCommissionPolicyId, setNewCommissionPolicyId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (staffMember) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      setExitDate(yesterdayStr);
      setStartDate(todayStr);

      // Default to first other company available
      const otherCompanies = companies.filter(c => c.id !== staffMember.companyId);
      const defaultTargetComp = otherCompanies[0] || companies[0];
      const defaultTargetCompId = defaultTargetComp ? defaultTargetComp.id : '';
      setTargetCompanyId(defaultTargetCompId);

      const depts = defaultTargetComp?.departments || [];
      const firstDeptName = typeof depts[0] === 'string' ? depts[0] : (depts[0]?.name || '');
      setTargetDepartment(firstDeptName || staffMember.department || '');

      setNewSalary(staffMember.salary ? String(staffMember.salary) : '');
      setNewCurrency(defaultTargetComp?.currency || staffMember.currency || 'GBP');
      setNewPayrollPolicyId(staffMember.payrollPolicyId || '');
      setNewLeavePolicyId(staffMember.leavePolicyId || '');
      setNewCommissionPolicyId(staffMember.commissionPolicyId || '');
      setNotes('');
    }
  }, [staffMember, isOpen, companies]);

  // Handle target company change
  const handleTargetCompanyChange = (compId) => {
    setTargetCompanyId(compId);
    const comp = companies.find(c => c.id === compId);
    if (comp) {
      const depts = comp.departments || [];
      const firstDeptName = typeof depts[0] === 'string' ? depts[0] : (depts[0]?.name || '');
      setTargetDepartment(firstDeptName);
      if (comp.currency) {
        setNewCurrency(comp.currency);
      }
    }
  };

  if (!isOpen || !staffMember) return null;

  const currentComp = companies.find(c => c.id === staffMember.companyId);
  const targetComp = companies.find(c => c.id === targetCompanyId);
  const targetDepartments = targetComp?.departments || [];

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!targetCompanyId || targetCompanyId === staffMember.companyId) {
      if (onShowToast) onShowToast("Please select a different target company.", "warning");
      return;
    }

    if (!exitDate || !startDate) {
      if (onShowToast) onShowToast("Please specify both exit date and effective start date.", "warning");
      return;
    }

    const transferRecord = {
      id: `transfer-${Date.now()}`,
      fromCompanyId: staffMember.companyId,
      fromCompanyName: currentComp?.name || 'Previous Company',
      fromDepartment: staffMember.department || '',
      toCompanyId: targetCompanyId,
      toCompanyName: targetComp?.name || 'New Company',
      toDepartment: targetDepartment,
      exitDateFromPreviousCompany: exitDate,
      effectiveStartDate: startDate,
      transferredAt: new Date().toISOString(),
      notes: notes.trim(),
      previousSalary: Number(staffMember.salary) || 0,
      previousCurrency: staffMember.currency || 'GBP',
      newSalary: Number(newSalary) || Number(staffMember.salary) || 0,
      newCurrency: newCurrency || staffMember.currency || 'GBP'
    };

    const updatedStaff = {
      ...staffMember,
      companyId: targetCompanyId,
      department: targetDepartment,
      startDate: startDate,
      originalJoinDate: staffMember.originalJoinDate || staffMember.startDate,
      salary: Number(newSalary) || staffMember.salary || 0,
      currency: newCurrency || staffMember.currency || 'GBP',
      payrollPolicyId: newPayrollPolicyId || '',
      leavePolicyId: newLeavePolicyId || '',
      commissionPolicyId: newCommissionPolicyId || '',
      status: 'active',
      companyTransfers: [
        ...(staffMember.companyTransfers || []),
        transferRecord
      ]
    };

    onSave(updatedStaff);
    if (onShowToast) {
      onShowToast(`Successfully transferred ${staffMember.fullName} to ${targetComp?.name || 'new entity'}.`, "success");
    }
    onClose();
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <form 
        onSubmit={handleSubmit} 
        className="form-wizard-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#fff' }}>Inter-Company Staff Transfer</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Transfer <strong>{staffMember.fullName}</strong> while preserving sales deals, tenure, and call history
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* 1. Origin Info Card */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>
                Current Employment (Origin)
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
                🏢 {currentComp?.name || 'Current Company'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Department: <strong>{staffMember.department || 'General'}</strong> &bull; Start Date: {staffMember.startDate || 'N/A'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>
                Group Tenure
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>
                Continuous Service Protected
              </span>
            </div>
          </div>

          {/* 2. Effective Dates Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                1. Exit Date from {currentComp?.name || 'Current Entity'} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Final active working day under origin company
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                2. Effective Start Date in New Entity <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Effective employment date under new contract
              </span>
            </div>
          </div>

          {/* 3. Destination Entity & Department */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                3. Destination Company <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                className="select-filter"
                value={targetCompanyId}
                onChange={(e) => handleTargetCompanyChange(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                required
              >
                <option value="">-- Select Destination Company --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} disabled={c.id === staffMember.companyId}>
                    {c.name} {c.id === staffMember.companyId ? '(Current)' : `(${c.currency || 'GBP'})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                4. Destination Department
              </label>
              <select
                className="select-filter"
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              >
                <option value="">-- Choose Department --</option>
                {targetDepartments.map((dept, idx) => {
                  const deptName = typeof dept === 'string' ? dept : dept.name;
                  return (
                    <option key={idx} value={deptName}>
                      {deptName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 4. Compensation Adjustment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                5. Base Salary (Annual / Monthly)
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="e.g. 50000"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                6. Contract Currency
              </label>
              <select
                className="select-filter"
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              >
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="ZAR">ZAR (R) - South African Rand</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="AED">AED (AED) - UAE Dirham</option>
                <option value="EUR">EUR (€) - Euro</option>
              </select>
            </div>
          </div>

          {/* 5. Policy Templates Alignment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>
                Payroll Template
              </label>
              <select
                className="select-filter"
                value={newPayrollPolicyId}
                onChange={(e) => setNewPayrollPolicyId(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
              >
                <option value="">-- None / Default --</option>
                {payrollPolicies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>
                Leave Policy
              </label>
              <select
                className="select-filter"
                value={newLeavePolicyId}
                onChange={(e) => setNewLeavePolicyId(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
              >
                <option value="">-- None / Default --</option>
                {leavePolicies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>
                Commission Scheme
              </label>
              <select
                className="select-filter"
                value={newCommissionPolicyId}
                onChange={(e) => setNewCommissionPolicyId(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
              >
                <option value="">-- None / Default --</option>
                {commissionPolicies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Transfer Notes */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
              7. Transfer Notes / Authorization Reason
            </label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Relocation / inter-company entity contract restructuring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '12px', resize: 'vertical' }}
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px', fontSize: '13px' }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={14} /> Execute Transfer
          </button>
        </div>
      </form>
    </div>
  );
}
