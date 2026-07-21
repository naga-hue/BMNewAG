import React, { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Staff, NominalCode } from '../../types';

interface PayrollAdjustmentsFormProps {
  staff: Staff[];
  payrollPolicies: any[];
  nominalCodes?: NominalCode[];
  onSavePayrollPolicy: (policy: any) => Promise<any>;
  onDeletePayrollPolicy: (id: string) => Promise<any>;
  onUpdateStaff: (s: Staff) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function PayrollAdjustmentsForm({
  staff,
  payrollPolicies,
  nominalCodes = [],
  onSavePayrollPolicy,
  onDeletePayrollPolicy,
  onUpdateStaff,
  onShowToast
}: PayrollAdjustmentsFormProps) {
  // Policy Form fields
  const [policyName, setPolicyName] = useState('');
  const [policyPaymentDay, setPolicyPaymentDay] = useState('25');
  const [policyNominalCode, setPolicyNominalCode] = useState('');
  const [policyType, setPolicyType] = useState('ft_uk'); // ft_uk, freelance, custom
  const [employerNiRate, setEmployerNiRate] = useState('13.8');
  const [employerNiThreshold, setEmployerNiThreshold] = useState('758');
  const [employerPensionRate, setEmployerPensionRate] = useState('3.0');
  const [employeeTaxNicRate, setEmployeeTaxNicRate] = useState('20.0');
  const [employeePensionRate, setEmployeePensionRate] = useState('5.0');
  const [studentLoanActive, setStudentLoanActive] = useState(false);
  const [studentLoanRate, setStudentLoanRate] = useState('9.0');
  const [studentLoanThreshold, setStudentLoanThreshold] = useState('2274');
  const [dailyRateDefault, setDailyRateDefault] = useState('0');
  const [expectedDaysPerMonth, setExpectedDaysPerMonth] = useState('21.67');
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  // Bulk assignment Desk
  const [selectedPayrollStaffIds, setSelectedPayrollStaffIds] = useState<string[]>([]);

  // Progressive Tax & NI slabs
  const [payeSlabs, setPayeSlabs] = useState([
    { minAmount: 0, maxAmount: 1047.50, rate: 0 },
    { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
    { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
    { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
  ]);
  const [employeeNiSlabs, setEmployeeNiSlabs] = useState([
    { minAmount: 0, maxAmount: 1047.00, rate: 0 },
    { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
    { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
  ]);
  const [employerNiSlabs, setEmployerNiSlabs] = useState([
    { minAmount: 0, maxAmount: 758.00, rate: 0 },
    { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
  ]);

  const handleUpdateSlab = (type: string, index: number, field: string, value: string) => {
    const numVal = Number(value) || 0;
    if (type === 'paye') {
      setPayeSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => prev.map((s, i) => i === index ? { ...s, [field]: numVal } : s));
    }
  };

  const handleAddSlab = (type: string) => {
    const newSlab = { minAmount: 0, maxAmount: 9999999, rate: 0 };
    if (type === 'paye') {
      setPayeSlabs(prev => [...prev, newSlab]);
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => [...prev, newSlab]);
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => [...prev, newSlab]);
    }
  };

  const handleRemoveSlab = (type: string, index: number) => {
    if (type === 'paye') {
      setPayeSlabs(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'eeNi') {
      setEmployeeNiSlabs(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'erNi') {
      setEmployerNiSlabs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSavePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim()) {
      onShowToast("Please enter a policy name.", "warning");
      return;
    }

    const savedPolicy = {
      id: editingPolicyId || `policy-${Date.now()}`,
      name: policyName.trim(),
      type: policyType,
      nominalCode: policyNominalCode,
      employerNiRate: policyType === 'freelance' ? 0 : Number(employerNiRate) || 0,
      employerNiThreshold: policyType === 'freelance' ? 0 : Number(employerNiThreshold) || 0,
      employerPensionRate: policyType === 'freelance' ? 0 : Number(employerPensionRate) || 0,
      employeeTaxNicRate: policyType === 'freelance' ? 0 : Number(employeeTaxNicRate) || 0,
      employeePensionRate: policyType === 'freelance' ? 0 : Number(employeePensionRate) || 0,
      studentLoanActive: policyType === 'ft_uk' ? studentLoanActive : false,
      studentLoanRate: policyType === 'ft_uk' ? (Number(studentLoanRate) || 0) : 0,
      studentLoanThreshold: policyType === 'ft_uk' ? (Number(studentLoanThreshold) || 0) : 0,
      dailyRateDefault: policyType === 'freelance' ? (Number(dailyRateDefault) || 0) : 0,
      expectedDaysPerMonth: policyType === 'freelance' ? (Number(expectedDaysPerMonth) || 0) : 21.67,
      paymentDayOfMonth: Number(policyPaymentDay) || 25,
      payeSlabs: policyType === 'freelance' ? [] : payeSlabs,
      employeeNiSlabs: policyType === 'freelance' ? [] : employeeNiSlabs,
      employerNiSlabs: policyType === 'freelance' ? [] : employerNiSlabs
    };

    try {
      await onSavePayrollPolicy(savedPolicy);
      onShowToast(`Payroll Policy "${policyName}" saved successfully.`, "success");
      
      // Reset Form fields
      setPolicyName('');
      setPolicyType('ft_uk');
      setPolicyNominalCode('');
      setEmployerNiRate('13.8');
      setEmployerNiThreshold('758');
      setEmployerPensionRate('3.0');
      setEmployeeTaxNicRate('20.0');
      setEmployeePensionRate('5.0');
      setStudentLoanActive(false);
      setStudentLoanRate('9.0');
      setStudentLoanThreshold('2274');
      setDailyRateDefault('0');
      setExpectedDaysPerMonth('21.67');
      setPolicyPaymentDay('25');
      setPayeSlabs([
        { minAmount: 0, maxAmount: 1047.50, rate: 0 },
        { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
        { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
        { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
      ]);
      setEmployeeNiSlabs([
        { minAmount: 0, maxAmount: 1047.00, rate: 0 },
        { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
        { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
      ]);
      setEmployerNiSlabs([
        { minAmount: 0, maxAmount: 758.00, rate: 0 },
        { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
      ]);
      setEditingPolicyId(null);
    } catch (err: any) {
      onShowToast(`Error saving policy: ${err.message}`, "warning");
    }
  };

  const handleEditPolicyClick = (policy: any) => {
    setEditingPolicyId(policy.id);
    setPolicyName(policy.name || '');
    setPolicyType(policy.type || 'ft_uk');
    setPolicyNominalCode(policy.nominalCode || '');
    setEmployerNiRate(String(policy.employerNiRate ?? '13.8'));
    setEmployerNiThreshold(String(policy.employerNiThreshold ?? '758'));
    setEmployerPensionRate(String(policy.employerPensionRate ?? '3.0'));
    setEmployeeTaxNicRate(String(policy.employeeTaxNicRate ?? '20.0'));
    setEmployeePensionRate(String(policy.employeePensionRate ?? '5.0'));
    setStudentLoanActive(!!policy.studentLoanActive);
    setStudentLoanRate(String(policy.studentLoanRate ?? '9.0'));
    setStudentLoanThreshold(String(policy.studentLoanThreshold ?? '2274'));
    setDailyRateDefault(String(policy.dailyRateDefault ?? '0'));
    setExpectedDaysPerMonth(String(policy.expectedDaysPerMonth ?? '21.67'));
    setPolicyPaymentDay(String(policy.paymentDayOfMonth ?? '25'));
    setPayeSlabs(policy.payeSlabs || [
      { minAmount: 0, maxAmount: 1047.50, rate: 0 },
      { minAmount: 1047.50, maxAmount: 4189.17, rate: 20 },
      { minAmount: 4189.17, maxAmount: 10428.33, rate: 40 },
      { minAmount: 10428.33, maxAmount: 9999999, rate: 45 }
    ]);
    setEmployeeNiSlabs(policy.employeeNiSlabs || [
      { minAmount: 0, maxAmount: 1047.00, rate: 0 },
      { minAmount: 1047.00, maxAmount: 4189.00, rate: 8 },
      { minAmount: 4189.00, maxAmount: 9999999, rate: 2 }
    ]);
    setEmployerNiSlabs(policy.employerNiSlabs || [
      { minAmount: 0, maxAmount: 758.00, rate: 0 },
      { minAmount: 758.00, maxAmount: 9999999, rate: 13.8 }
    ]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', animation: 'fadeIn 0.2s' }}>
      
      {/* Left Column: Form to create/edit policy */}
      <form onSubmit={handleSavePolicySubmit} className="detail-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Briefcase size={16} style={{ color: 'var(--primary)' }} /> 
          {editingPolicyId ? 'Modify' : 'Create'} Payroll Policy Template
        </div>
        
        <div className="form-group-row" style={{ marginBottom: '12px' }}>
          <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
            <label className="form-label">Template Name <span>*</span></label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. UK Full Time Staff"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Monthly Pay Day (1-31) <span>*</span></label>
            <input 
              type="number" 
              className="form-input" 
              min="1"
              max="31"
              placeholder="e.g. 25"
              value={policyPaymentDay}
              onChange={(e) => setPolicyPaymentDay(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Policy Structure Type <span>*</span></label>
          <select 
            className="select-filter"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="ft_uk">FT UK Employee (PAYE, NIC, Pension, Student Loan)</option>
            <option value="freelance">Freelance Contractor (Daily Rate, Attendance-based)</option>
            <option value="custom">Custom Formula (Global / Multi-rate)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Linked Nominal Code <span>*</span></label>
          <select 
            className="select-filter"
            value={policyNominalCode}
            onChange={(e) => setPolicyNominalCode(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
            required
          >
            <option value="">-- Choose Nominal Code --</option>
            {nominalCodes.map(nc => (
              <option key={nc.code} value={nc.code}>{nc.code}</option>
            ))}
          </select>
        </div>

        {policyType !== 'freelance' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  🏢 Employer Benefits
                </h4>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Employer Pension Rate (%)</label>
                  <input 
                    type="number" step="any" className="form-input" value={employerPensionRate} onChange={(e) => setEmployerPensionRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                  />
                </div>
              </div>
              
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  👥 Employee Deductions
                </h4>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '10px' }}>Employee Pension Rate (%)</label>
                  <input 
                    type="number" step="any" className="form-input" value={employeePensionRate} onChange={(e) => setEmployeePensionRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px' }}>
                📈 Progressive Tax & NI Bands (Monthly)
              </h4>
              
              <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Employee PAYE (Income Tax) Brackets:</span>
                  <button type="button" onClick={() => handleAddSlab('paye')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                    + Add Band
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {payeSlabs.map((slab, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('paye', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                      <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('paye', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                      <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('paye', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '11px' }}>%</span>
                      <button type="button" onClick={() => handleRemoveSlab('paye', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Employee NI (NIC) Brackets:</span>
                  <button type="button" onClick={() => handleAddSlab('eeNi')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                    + Add Band
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {employeeNiSlabs.map((slab, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('eeNi', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                      <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('eeNi', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                      <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('eeNi', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '11px' }}>%</span>
                      <button type="button" onClick={() => handleRemoveSlab('eeNi', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Employer NI (NIC) Brackets:</span>
                  <button type="button" onClick={() => handleAddSlab('erNi')} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--primary)', cursor: 'pointer' }}>
                    + Add Band
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {employerNiSlabs.map((slab, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input type="number" step="any" placeholder="Min (£)" value={slab.minAmount} onChange={(e) => handleUpdateSlab('erNi', i, 'minAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>to</span>
                      <input type="number" step="any" placeholder="Max (£)" value={slab.maxAmount} onChange={(e) => handleUpdateSlab('erNi', i, 'maxAmount', e.target.value)} style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>@</span>
                      <input type="number" step="any" placeholder="Rate (%)" value={slab.rate} onChange={(e) => handleUpdateSlab('erNi', i, 'rate', e.target.value)} style={{ width: '45px', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', minWidth: 0 }} />
                      <span style={{ fontSize: '11px' }}>%</span>
                      <button type="button" onClick={() => handleRemoveSlab('erNi', i)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {policyType === 'ft_uk' && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="policy-student-loan-check" 
                    checked={studentLoanActive} 
                    onChange={(e) => setStudentLoanActive(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="policy-student-loan-check" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                    Estimate Student Loan Deductions
                  </label>
                </div>
                {studentLoanActive && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px', animation: 'fadeIn 0.2s' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '10px' }}>Student Loan Rate (%)</label>
                      <input 
                        type="number" step="any" className="form-input" value={studentLoanRate} onChange={(e) => setStudentLoanRate(e.target.value)} style={{ width: '100%', padding: '6px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '10px' }}>Monthly Threshold (£)</label>
                      <input 
                        type="number" step="any" className="form-input" value={studentLoanThreshold} onChange={(e) => setStudentLoanThreshold(e.target.value)} style={{ width: '100%', padding: '6px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Default Daily Rate (£)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 300"
                value={dailyRateDefault} 
                onChange={(e) => setDailyRateDefault(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Est. Working Days / Month</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                placeholder="e.g. 21.67"
                value={expectedDaysPerMonth} 
                onChange={(e) => setExpectedDaysPerMonth(e.target.value)} 
              />
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                💡 Calculated automatically based on weekends & holidays. Enter fallback estimate (e.g. 0 to calculate dynamically).
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            {editingPolicyId ? 'Update Policy Template' : 'Create Policy Template'}
          </button>
          {editingPolicyId && (
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                setEditingPolicyId(null);
                setPolicyName('');
                setPolicyType('ft_uk');
                setEmployerNiRate('13.8');
                setEmployerNiThreshold('758');
                setEmployerPensionRate('3.0');
                setEmployeeTaxNicRate('20.0');
                setEmployeePensionRate('5.0');
                setStudentLoanActive(false);
                setStudentLoanRate('9.0');
                setStudentLoanThreshold('2274');
                setDailyRateDefault('0');
                setExpectedDaysPerMonth('21.67');
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Right Column: Policies Registry & Assignment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="detail-section">
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Active Policy Templates</h3>
          <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table className="entity-table dense" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Structure</th>
                  <th>Nominal Mapping</th>
                  <th>Summary Rates</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrollPolicies.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <span style={{ 
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: p.type === 'ft_uk' ? 'rgba(99, 102, 241, 0.12)' : p.type === 'freelance' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                        color: p.type === 'ft_uk' ? 'var(--primary)' : p.type === 'freelance' ? 'var(--warning)' : 'var(--text-secondary)'
                      }}>
                        {p.type === 'ft_uk' ? 'FT UK' : p.type === 'freelance' ? 'Freelance' : 'Custom'}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        color: 'var(--primary)',
                        fontFamily: 'monospace'
                      }}>
                        {p.nominalCode || 'Not Mapped'}
                      </span>
                    </td>
                    <td>
                      {p.type === 'freelance' ? (
                        <span>Daily: £{p.dailyRateDefault} ({p.expectedDaysPerMonth} days)</span>
                      ) : (
                        <span>Er NI: {p.employerNiRate}%, Er Pen: {p.employerPensionRate}%, Ee Tax: {p.employeeTaxNicRate}%</span>
                      )}
                      <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        📅 Pay Day: {p.paymentDayOfMonth || 25}th
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button type="button" className="btn-icon" onClick={() => handleEditPolicyClick(p)} title="Edit Policy" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                          📝
                        </button>
                        <button 
                          type="button"
                          className="btn-icon delete" 
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete policy template "${p.name}"?`)) {
                              try {
                                await onDeletePayrollPolicy(p.id);
                                onShowToast(`Deleted policy template "${p.name}".`, "success");
                              } catch (err: any) {
                                onShowToast(`Error deleting policy: ${err.message}`, "warning");
                              }
                            }
                          }}
                          title="Delete Policy"
                          style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {payrollPolicies.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                      No policies defined. Create one on the left.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Assignment Panel */}
        <div className="detail-section">
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Roster Policy Assignment Desk</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Quickly link staff members to payroll templates for real-time projections.
          </p>

          {selectedPayrollStaffIds.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              gap: '12px'
            }}>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Selected: {selectedPayrollStaffIds.length} staff member(s)
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  id="bulkPayrollPolicySelect"
                  className="select-filter"
                  defaultValue=""
                  style={{ padding: '4px 8px', fontSize: '11px', minWidth: '150px', height: '28px' }}
                >
                  <option value="">-- No Policy (Salaried Default) --</option>
                  {payrollPolicies.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    const selectedVal = (document.getElementById('bulkPayrollPolicySelect') as HTMLSelectElement)?.value || '';
                    try {
                      for (const staffId of selectedPayrollStaffIds) {
                        const s = staff.find(x => x.id === staffId);
                        if (s) {
                          await onUpdateStaff({ ...s, payrollPolicyId: selectedVal });
                        }
                      }
                      onShowToast(`Assigned policy template to ${selectedPayrollStaffIds.length} staff members.`, "success");
                      setSelectedPayrollStaffIds([]);
                    } catch (err: any) {
                      onShowToast(`Error updating policies: ${err.message}`, "warning");
                    }
                  }}
                  style={{ padding: '4px 12px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayrollStaffIds([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: 0
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table className="entity-table dense" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={staff.length > 0 && staff.every(s => selectedPayrollStaffIds.includes(s.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPayrollStaffIds(staff.map(s => s.id));
                        } else {
                          setSelectedPayrollStaffIds([]);
                        }
                      }}
                    />
                  </th>
                  <th>Recruiter / Staff</th>
                  <th>Assign Policy Template</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const isChecked = selectedPayrollStaffIds.includes(s.id);
                  return (
                    <tr 
                      key={s.id}
                      style={{ backgroundColor: isChecked ? 'rgba(99,102,241,0.04)' : 'transparent' }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedPayrollStaffIds(prev => 
                              prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                            );
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.fullName} ({s.department})</td>
                      <td>
                        <select
                          className="select-filter"
                          value={s.payrollPolicyId || ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            try {
                              await onUpdateStaff({ ...s, payrollPolicyId: val });
                              onShowToast(`Assigned policy template to ${s.fullName}`, "success");
                            } catch (err: any) {
                              onShowToast(`Error: ${err.message}`, "warning");
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                        >
                          <option value="">-- No Policy (Salaried Default) --</option>
                          {payrollPolicies.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
