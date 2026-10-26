import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, Building2, Calendar, DollarSign, ShieldCheck, FileText, Layers, Plus } from 'lucide-react';

export default function StaffTransferModal({
  isOpen,
  onClose,
  staffMember,
  companies = [],
  staff = [],
  payrollPolicies = [],
  leavePolicies = [],
  commissionPolicies = [],
  onSave,
  onShowToast
}) {
  const [transferType, setTransferType] = useState('inter_company'); // 'inter_company' | 'inter_departmental'
  const [exitDate, setExitDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [customDept, setCustomDept] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newCurrency, setNewCurrency] = useState('GBP');
  const [newPayrollPolicyId, setNewPayrollPolicyId] = useState('');
  const [newLeavePolicyId, setNewLeavePolicyId] = useState('');
  const [newCommissionPolicyId, setNewCommissionPolicyId] = useState('');
  const [notes, setNotes] = useState('');

  const currentComp = companies.find(c => c.id === staffMember?.companyId);
  const isInterDept = transferType === 'inter_departmental';
  const targetComp = isInterDept ? currentComp : companies.find(c => c.id === targetCompanyId);

  // Available departments for the target entity
  const availableDepartments = useMemo(() => {
    const activeComp = targetComp;
    if (!activeComp) return [];
    const deptSet = new Set();
    if (Array.isArray(activeComp.departments)) {
      activeComp.departments.forEach(d => {
        if (!d) return;
        const name = typeof d === 'object' ? d.name : d;
        if (name && typeof name === 'string') deptSet.add(name);
      });
    }
    staff.forEach(s => {
      if (s.companyId === activeComp.id && s.department) {
        const name = typeof s.department === 'object' ? s.department.name : s.department;
        if (name && typeof name === 'string') deptSet.add(name);
      }
    });
    return Array.from(deptSet).sort();
  }, [targetComp, staff]);

  useEffect(() => {
    if (staffMember) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      setExitDate(yesterdayStr);
      setStartDate(todayStr);

      if (transferType === 'inter_departmental') {
        setTargetCompanyId(staffMember.companyId || '');
        setTargetDepartment('');
        setNewCurrency(staffMember.currency || currentComp?.currency || 'GBP');
      } else {
        // Default to first other company available
        const otherCompanies = companies.filter(c => c.id !== staffMember.companyId);
        const defaultTargetComp = otherCompanies[0] || companies[0];
        const defaultTargetCompId = defaultTargetComp ? defaultTargetComp.id : '';
        setTargetCompanyId(defaultTargetCompId);

        const depts = defaultTargetComp?.departments || [];
        const firstDeptName = typeof depts[0] === 'string' ? depts[0] : (depts[0]?.name || '');
        setTargetDepartment(firstDeptName || '');
        setNewCurrency(defaultTargetComp?.currency || staffMember.currency || 'GBP');
      }

      setIsCustomDept(false);
      setCustomDept('');
      setNewSalary(staffMember.salary ? String(staffMember.salary) : '');
      setNewPayrollPolicyId(staffMember.payrollPolicyId || '');
      setNewLeavePolicyId(staffMember.leavePolicyId || '');
      setNewCommissionPolicyId(staffMember.commissionPolicyId || '');
      setNotes('');
    }
  }, [staffMember, isOpen, companies, transferType]);

  // Handle transfer type switch (inter-company vs inter-departmental)
  const handleTypeSwitch = (type) => {
    setTransferType(type);
    setIsCustomDept(false);
    setCustomDept('');
    if (type === 'inter_departmental') {
      setTargetCompanyId(staffMember.companyId);
      setTargetDepartment('');
      setNewCurrency(currentComp?.currency || staffMember.currency || 'GBP');
    } else {
      const otherCompanies = companies.filter(c => c.id !== staffMember.companyId);
      const defaultTargetComp = otherCompanies[0] || companies[0];
      setTargetCompanyId(defaultTargetComp ? defaultTargetComp.id : '');
      const depts = defaultTargetComp?.departments || [];
      const firstDeptName = typeof depts[0] === 'string' ? depts[0] : (depts[0]?.name || '');
      setTargetDepartment(firstDeptName || '');
      if (defaultTargetComp?.currency) {
        setNewCurrency(defaultTargetComp.currency);
      }
    }
  };

  // Handle target company change
  const handleTargetCompanyChange = (compId) => {
    setTargetCompanyId(compId);
    setIsCustomDept(false);
    setCustomDept('');
    const comp = companies.find(c => c.id === compId);
    if (comp) {
      const depts = comp.departments || [];
      const firstDeptName = typeof depts[0] === 'string' ? depts[0] : (depts[0]?.name || '');
      setTargetDepartment(firstDeptName || '');
      if (comp.currency) {
        setNewCurrency(comp.currency);
      }
    }
  };

  if (!isOpen || !staffMember) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalTargetDept = isCustomDept ? customDept.trim() : targetDepartment.trim();

    if (isInterDept) {
      if (!finalTargetDept) {
        if (onShowToast) onShowToast("Please specify the destination department.", "warning");
        return;
      }
      if (finalTargetDept.toLowerCase() === (staffMember.department || '').toLowerCase()) {
        if (onShowToast) onShowToast("Destination department must be different from current department.", "warning");
        return;
      }
    } else {
      if (!targetCompanyId || targetCompanyId === staffMember.companyId) {
        if (onShowToast) onShowToast("Please select a different target company for an inter-company transfer.", "warning");
        return;
      }
    }

    if (!exitDate || !startDate) {
      if (onShowToast) onShowToast("Please specify both exit date and effective start date.", "warning");
      return;
    }

    const transferRecord = {
      id: `transfer-${Date.now()}`,
      transferType: isInterDept ? 'department' : 'company',
      fromCompanyId: staffMember.companyId,
      fromCompanyName: currentComp?.name || 'Previous Company',
      fromDepartment: staffMember.department || 'General',
      toCompanyId: isInterDept ? staffMember.companyId : targetCompanyId,
      toCompanyName: isInterDept ? (currentComp?.name || 'Current Company') : (targetComp?.name || 'New Company'),
      toDepartment: finalTargetDept,
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
      companyId: isInterDept ? staffMember.companyId : targetCompanyId,
      department: finalTargetDept,
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
      if (isInterDept) {
        onShowToast(`Successfully transferred ${staffMember.fullName} from ${staffMember.department || 'General'} to ${finalTargetDept}.`, "success");
      } else {
        onShowToast(`Successfully transferred ${staffMember.fullName} to ${targetComp?.name || 'new entity'}.`, "success");
      }
    }
    onClose();
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose}>
      <form 
        onSubmit={handleSubmit} 
        className="form-wizard-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#fff' }}>
                {isInterDept ? 'Inter-Departmental Staff Transfer' : 'Inter-Company Staff Transfer'}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isInterDept 
                  ? <>Transfer <strong>{staffMember.fullName}</strong> across departments within <strong>{currentComp?.name}</strong></>
                  : <>Transfer <strong>{staffMember.fullName}</strong> while preserving sales deals, tenure, and call history</>
                }
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
          
          {/* Transfer Mode Selector Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            gap: '6px'
          }}>
            <button
              type="button"
              onClick={() => handleTypeSwitch('inter_company')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: transferType === 'inter_company' ? 'var(--primary)' : 'transparent',
                color: transferType === 'inter_company' ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Building2 size={15} /> Inter-Company Transfer
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('inter_departmental')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: transferType === 'inter_departmental' ? 'var(--primary)' : 'transparent',
                color: transferType === 'inter_departmental' ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Layers size={15} /> Inter-Departmental Transfer
            </button>
          </div>

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
                Department: <strong style={{ color: 'var(--primary)' }}>{staffMember.department || 'General'}</strong> &bull; Start Date: {staffMember.startDate || 'N/A'}
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
                {isInterDept ? `1. Last Day in ${staffMember.department || 'Current Department'}` : `1. Exit Date from ${currentComp?.name || 'Current Entity'}`} <span style={{ color: 'var(--danger)' }}>*</span>
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
                {isInterDept ? 'Final active working day in current department' : 'Final active working day under origin company'}
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                {isInterDept ? `2. Effective Start Date in New Department` : `2. Effective Start Date in New Entity`} <span style={{ color: 'var(--danger)' }}>*</span>
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
                {isInterDept ? 'Effective starting date in new department' : 'Effective employment date under new contract'}
              </span>
            </div>
          </div>

          {/* 3. Destination Entity & Department */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                {isInterDept ? '3. Company (Same Entity)' : '3. Destination Company'} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              {isInterDept ? (
                <div style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '38px',
                  boxSizing: 'border-box'
                }}>
                  <Building2 size={14} color="var(--primary)" />
                  <span style={{ fontWeight: 600 }}>{currentComp?.name || 'Current Company'}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>(Internal)</span>
                </div>
              ) : (
                <select
                  className="select-filter"
                  value={targetCompanyId}
                  onChange={(e) => handleTargetCompanyChange(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', height: '38px' }}
                  required
                >
                  <option value="">-- Select Destination Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === staffMember.companyId}>
                      {c.name} {c.id === staffMember.companyId ? '(Current)' : `(${c.currency || 'GBP'})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
                  4. Destination Department <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDept(!isCustomDept);
                    if (!isCustomDept) setCustomDept('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  {isCustomDept ? 'Choose from list' : '+ New department'}
                </button>
              </div>

              {isCustomDept ? (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter new department name..."
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', height: '38px' }}
                  required
                  autoFocus
                />
              ) : (
                <select
                  className="select-filter"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', height: '38px' }}
                  required
                >
                  <option value="">-- Choose New Department --</option>
                  {availableDepartments.map((deptName, idx) => (
                    <option 
                      key={idx} 
                      value={deptName} 
                      disabled={isInterDept && deptName === staffMember.department}
                    >
                      {deptName} {isInterDept && deptName === staffMember.department ? '(Current Department)' : ''}
                    </option>
                  ))}
                </select>
              )}
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
              placeholder={isInterDept 
                ? "e.g. Internal promotion / department reassignment to Civils" 
                : "e.g. Relocation / inter-company entity contract restructuring"}
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
            <ArrowRightLeft size={14} /> {isInterDept ? 'Execute Department Transfer' : 'Execute Company Transfer'}
          </button>
        </div>
      </form>
    </div>
  );
}
