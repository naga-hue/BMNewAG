import React, { useState } from 'react';
import { Plus, Trash2, Building2, Users } from 'lucide-react';
import { Company, Staff } from '../../types';
import { symbolMap } from './utils';

interface CommissionsBandsSetupProps {
  companies: Company[];
  staff: Staff[];
  commissionPolicies: any[];
  onSavePolicy: (policy: any) => Promise<any>;
  onDeletePolicy?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function CommissionsBandsSetup({
  companies,
  staff,
  commissionPolicies,
  onSavePolicy,
  onDeletePolicy,
  onShowToast
}: CommissionsBandsSetupProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState(companies[0]?.id || '');
  const [type, setType] = useState('individual'); // individual | manager
  const [effectiveFrom, setEffectiveFrom] = useState('day_one'); // day_one | one_year_service
  const [monthlyThreshold, setMonthlyThreshold] = useState('3000');
  const [teamOverridePercent, setTeamOverridePercent] = useState('2.5');
  const [description, setDescription] = useState('');
  const [starterWaiveThreshold, setStarterWaiveThreshold] = useState(false);
  const [calcInterval, setCalcInterval] = useState('monthly'); // monthly | quarterly
  const [slabType, setSlabType] = useState('progressive'); // progressive | flat_rate
  const [assignedDepartments, setAssignedDepartments] = useState<string[]>([]);

  const [slabs, setSlabs] = useState([
    { minAmount: 0, maxAmount: 10000, rate: 10 },
    { minAmount: 10000, maxAmount: 15000, rate: 15 },
    { minAmount: 15000, maxAmount: 999999, rate: 20 }
  ]);

  const allAvailableDepts = (() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        const dname = typeof d === 'string' ? d : d.name;
        if (dname && !depts.includes(dname)) depts.push(dname);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  })();

  const handleAddSlabRow = () => {
    const lastSlab = slabs[slabs.length - 1];
    const nextMin = lastSlab ? lastSlab.maxAmount : 0;
    setSlabs(prev => [...prev, { minAmount: nextMin, maxAmount: nextMin + 5000, rate: 10 }]);
  };

  const handleRemoveSlabRow = (index: number) => {
    if (slabs.length <= 1) {
      onShowToast("Policy must have at least one billing slab.", "warning");
      return;
    }
    setSlabs(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSlab = (index: number, field: string, value: any) => {
    setSlabs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(value) };
      return copy;
    });
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'flat-10') {
      setSlabType('flat_rate');
      setSlabs([{ minAmount: 0, maxAmount: 999999, rate: 10 }]);
    } else if (presetName === 'flat-15') {
      setSlabType('flat_rate');
      setSlabs([{ minAmount: 0, maxAmount: 999999, rate: 15 }]);
    } else if (presetName === 'prog-standard') {
      setSlabType('progressive');
      setSlabs([
        { minAmount: 0, maxAmount: 10000, rate: 10 },
        { minAmount: 10000, maxAmount: 15000, rate: 15 },
        { minAmount: 15000, maxAmount: 999999, rate: 20 }
      ]);
    } else if (presetName === 'prog-high') {
      setSlabType('progressive');
      setSlabs([
        { minAmount: 0, maxAmount: 15000, rate: 12.5 },
        { minAmount: 15000, maxAmount: 30000, rate: 17.5 },
        { minAmount: 30000, maxAmount: 999999, rate: 25 }
      ]);
    }
    onShowToast(`Applied "${presetName}" template preset!`, "success");
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyId || !monthlyThreshold) {
      onShowToast("Please enter all required scheme fields.", "warning");
      return;
    }

    const sortedSlabs = [...slabs].sort((a, b) => a.minAmount - b.minAmount);

    const newPolicy = {
      id: editingPolicyId || `comm-${Date.now()}`,
      name: name.trim(),
      companyId,
      type,
      effectiveFrom,
      monthlyThreshold: Number(monthlyThreshold),
      slabs: sortedSlabs,
      teamOverridePercent: type === 'manager' ? Number(teamOverridePercent) : 0,
      description: description.trim(),
      starterWaiveThreshold,
      calcInterval,
      slabType,
      assignedDepartments: type === 'manager' ? assignedDepartments : []
    };

    try {
      await onSavePolicy(newPolicy);
      onShowToast(
        editingPolicyId 
          ? `Successfully updated commission scheme "${name}"`
          : `Successfully created commission scheme "${name}"`, 
        "success"
      );
      
      // Reset form
      setName('');
      setDescription('');
      setType('individual');
      setEffectiveFrom('day_one');
      setMonthlyThreshold('3000');
      setTeamOverridePercent('2.5');
      setStarterWaiveThreshold(false);
      setCalcInterval('monthly');
      setSlabType('progressive');
      setAssignedDepartments([]);
      setSlabs([
        { minAmount: 0, maxAmount: 10000, rate: 10 },
        { minAmount: 10000, maxAmount: 15000, rate: 15 },
        { minAmount: 15000, maxAmount: 999999, rate: 20 }
      ]);
      setEditingPolicyId(null);
      setShowForm(false);
    } catch (err: any) {
      onShowToast(`Error saving scheme: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Commission Scheme Configurator</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage tiered brackets, thresholds, and override bonuses across the group.</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setEditingPolicyId(null);
          setName('');
          setDescription('');
          setType('individual');
          setEffectiveFrom('day_one');
          setMonthlyThreshold('3000');
          setTeamOverridePercent('2.5');
          setStarterWaiveThreshold(false);
          setSlabs([
            { minAmount: 0, maxAmount: 10000, rate: 10 },
            { minAmount: 10000, maxAmount: 15000, rate: 15 },
            { minAmount: 15000, maxAmount: 999999, rate: 20 }
          ]);
          setShowForm(prev => !prev);
        }}>
          <Plus size={16} /> {showForm ? 'Close Form' : 'Create Incentive Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handlePolicySubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
          <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
            <Plus size={14} /> {editingPolicyId ? 'Modify Corporate Incentive Plan' : 'Create Corporate Incentive Plan'}
          </div>

          <div className="form-group-row" style={{ backgroundColor: 'rgba(99, 102, 241, 0.04)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent)' }}>⚡ Load Preset Template (Optional)</label>
              <select
                className="select-filter"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    applyPreset(e.target.value);
                    e.target.value = ""; // reset selection
                  }
                }}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="">-- Select Template Blueprint --</option>
                <option value="flat-10">Flat Rate 10% Plan</option>
                <option value="flat-15">Flat Rate 15% Plan</option>
                <option value="prog-standard">Standard Progressive (10% - 15% - 20%)</option>
                <option value="prog-high">High Performer Progressive (12.5% - 17.5% - 25%)</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Plan Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. UK Consultant day-one scheme"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Employer Company <span>*</span></label>
              <select 
                className="select-filter"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
                required
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Scheme Structure <span>*</span></label>
              <select 
                className="select-filter"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="individual">Individual Consultant Plan</option>
                <option value="manager">Manager Override Plan</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Calculation Cycle</label>
              <select 
                className="select-filter"
                value={calcInterval}
                onChange={(e) => setCalcInterval(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="monthly">Monthly Billings Interval</option>
                <option value="quarterly">Quarterly Billings Interval</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Slab Application</label>
              <select 
                className="select-filter"
                value={slabType}
                onChange={(e) => setSlabType(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="progressive">Progressive Tiering (Slab Brackets)</option>
                <option value="flat_rate">Flat Rate Threshold Trigger</option>
              </select>
            </div>
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Monthly Billing Validation Threshold <span>*</span></label>
              <input 
                type="number" 
                className="form-input" 
                value={monthlyThreshold}
                onChange={(e) => setMonthlyThreshold(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Plan Effective Date</label>
              <select 
                className="select-filter"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="day_one">From Day One of Service</option>
                <option value="one_year_service">Locked Till 1-Year Tenure Completion</option>
              </select>
            </div>
          </div>

          {type === 'manager' && (
            <div className="form-group-row" style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '16px', margin: '12px 0' }}>
              <div className="form-group">
                <label className="form-label">Manager Override Payout Percentage <span>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    step="0.1"
                    value={teamOverridePercent}
                    onChange={(e) => setTeamOverridePercent(e.target.value)}
                    required
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Assigned Roster Departments (Leave blank for direct reports)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {allAvailableDepts.map(d => {
                    const isChecked = assignedDepartments.includes(d);
                    return (
                      <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', backgroundColor: isChecked ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setAssignedDepartments(prev => 
                              prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d]
                            );
                          }}
                        />
                        {d}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div style={{ margin: '16px 0', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label className="form-label" style={{ margin: 0 }}>Slab Bracket Target Rates (%)</label>
              <button type="button" className="btn-secondary" onClick={handleAddSlabRow} style={{ padding: '4px 10px', fontSize: '11px' }}>
                + Add Slab Range
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {slabs.map((slab, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Min Amt</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={slab.minAmount}
                      onChange={(e) => handleUpdateSlab(idx, 'minAmount', e.target.value)}
                      style={{ padding: '6px' }}
                      required
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max Amt</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={slab.maxAmount}
                      onChange={(e) => handleUpdateSlab(idx, 'maxAmount', e.target.value)}
                      style={{ padding: '6px' }}
                      required
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bonus Rate</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={slab.rate}
                      onChange={(e) => handleUpdateSlab(idx, 'rate', e.target.value)}
                      style={{ padding: '6px' }}
                      required
                    />
                    <span>%</span>
                  </div>

                  <button type="button" className="btn-icon delete" onClick={() => handleRemoveSlabRow(idx)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Rules / Memo Notes</label>
            <textarea 
              className="form-input" 
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Incentive plan terms or exceptions info..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '6px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                checked={starterWaiveThreshold}
                onChange={(e) => setStarterWaiveThreshold(e.target.checked)}
              />
              <span>Waive monthly billings threshold validation during employee's first 12 months (New Starter Grace)</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setEditingPolicyId(null);
                setName('');
                setDescription('');
                setType('individual');
                setEffectiveFrom('day_one');
                setMonthlyThreshold('3000');
                setTeamOverridePercent('2.5');
                setStarterWaiveThreshold(false);
                setCalcInterval('monthly');
                setSlabType('progressive');
                setAssignedDepartments([]);
                setSlabs([
                  { minAmount: 0, maxAmount: 10000, rate: 10 },
                  { minAmount: 10000, maxAmount: 15000, rate: 15 },
                  { minAmount: 15000, maxAmount: 999999, rate: 20 }
                ]);
                setShowForm(false);
              }}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              {editingPolicyId ? 'Save Changes' : 'Create Scheme'}
            </button>
          </div>
        </form>
      )}

      <div className="entities-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {commissionPolicies.map(p => {
          const matchedComp = companies.find(c => c.id === p.companyId);
          const mappedStaffCount = staff.filter(s => s.commissionPolicyId === p.id).length;
          const currencySymbol = symbolMap[matchedComp?.currency || 'GBP'] || '£';
          
          return (
            <div key={p.id} className="entity-card" style={{ height: 'auto', padding: '16px' }}>
              <div className="entity-card-header" style={{ marginBottom: '8px' }}>
                <div className="entity-title-group">
                  <span className="entity-name" style={{ fontSize: '15px' }}>{p.name}</span>
                  <span className="entity-legal-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={12} />
                    {matchedComp ? matchedComp.name : 'Unknown Employer'}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.description || "No rules description provided."}
              </p>

              <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Threshold</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)' }}>{currencySymbol}{Number(p.monthlyThreshold || 0).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', textTransform: 'capitalize' }}>{p.type || 'individual'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mapped</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Users size={12} /> {mappedStaffCount}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingPolicyId(p.id);
                    setName(p.name);
                    setCompanyId(p.companyId);
                    setType(p.type || 'individual');
                    setEffectiveFrom(p.effectiveFrom || 'day_one');
                    setMonthlyThreshold(String(p.monthlyThreshold || '3000'));
                    setTeamOverridePercent(String(p.teamOverridePercent || '2.5'));
                    setDescription(p.description || '');
                    setStarterWaiveThreshold(p.starterWaiveThreshold || false);
                    setCalcInterval(p.calcInterval || 'monthly');
                    setSlabType(p.slabType || 'progressive');
                    setAssignedDepartments(p.assignedDepartments || []);
                    setSlabs(p.slabs || []);
                    setShowForm(true);
                  }}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  Edit
                </button>

                {onDeletePolicy && (
                  <button 
                    className="btn-icon delete" 
                    onClick={() => {
                      if (mappedStaffCount > 0) {
                        onShowToast("Cannot delete scheme. Staff profiles are currently mapped to this scheme.", "warning");
                        return;
                      }
                      if (window.confirm(`Are you sure you want to delete scheme "${p.name}"?`)) {
                        onDeletePolicy(p.id);
                        onShowToast(`Deleted scheme "${p.name}"`, "info");
                      }
                    }}
                    style={{ height: '28px', width: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Policy"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
