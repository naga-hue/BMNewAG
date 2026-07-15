import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Company, Staff, Vendor } from '../../types';
import { CURRENCIES } from './shared';

interface ContractRegisterModalProps {
  contract: any | null;
  onClose: () => void;
  vendors: Vendor[];
  companies: Company[];
  staff: Staff[];
  onSaveContract: (contract: any) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function ContractRegisterModal({
  contract,
  onClose,
  vendors,
  companies,
  staff,
  onSaveContract,
  onShowToast
}: ContractRegisterModalProps) {
  const [contractName, setContractName] = useState('');
  const [contractVendorId, setContractVendorId] = useState('');
  const [contractCompanyId, setContractCompanyId] = useState('');
  const [costInterval, setCostInterval] = useState('monthly');
  const [contractCurrency, setContractCurrency] = useState('GBP');
  const [unitCost, setUnitCost] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState('1');
  const [taxRate, setTaxRate] = useState('20.0');
  const [splitPackageCost, setSplitPackageCost] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentReminderDate, setPaymentReminderDate] = useState('');
  const [unusedCompanyId, setUnusedCompanyId] = useState('');
  const [unusedDept, setUnusedDept] = useState('Operations');

  useEffect(() => {
    if (contract) {
      setContractName(contract.name || '');
      setContractVendorId(contract.vendorId || '');
      setContractCompanyId(contract.companyId || '');
      setCostInterval(contract.costInterval || 'monthly');
      setContractCurrency(contract.currency || 'GBP');
      setUnitCost(String(contract.unitCost || ''));
      setQuantityPurchased(String(contract.quantityPurchased || '1'));
      setTaxRate(String(contract.taxRate ?? '20.0'));
      setSplitPackageCost(!!contract.splitPackageCost);
      setStartDate(contract.startDate || '');
      setEndDate(contract.endDate || '');
      setRenewalDate(contract.renewalDate || '');
      setPaymentDueDate(contract.paymentDueDate || '');
      setPaymentReminderDate(contract.paymentReminderDate || '');
      setUnusedCompanyId(contract.unusedCostTag?.companyId || '');
      setUnusedDept(contract.unusedCostTag?.department || 'Operations');
    } else {
      setContractName('');
      setContractVendorId('');
      setContractCompanyId('');
      setCostInterval('monthly');
      setContractCurrency('GBP');
      setUnitCost('');
      setQuantityPurchased('1');
      setTaxRate('20.0');
      setSplitPackageCost(false);
      setStartDate('');
      setEndDate('');
      setRenewalDate('');
      setPaymentDueDate('');
      setPaymentReminderDate('');
      setUnusedCompanyId('');
      setUnusedDept('Operations');
    }
  }, [contract]);

  const availableDeptsForChosenCompany = useMemo(() => {
    if (!unusedCompanyId) return ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    
    const depts: string[] = [];
    const companyProfile = companies.find(c => c.id === unusedCompanyId);
    if (companyProfile && Array.isArray(companyProfile.departments)) {
      companyProfile.departments.forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    }
    const companyStaff = staff.filter(s => s.companyId === unusedCompanyId);
    companyStaff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    if (depts.length === 0) {
      return ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    }
    return depts.sort();
  }, [unusedCompanyId, companies, staff]);

  const handleCompanyChange = (companyId: string) => {
    setUnusedCompanyId(companyId);
    const depts: string[] = [];
    const companyProfile = companies.find(c => c.id === companyId);
    if (companyProfile && Array.isArray(companyProfile.departments)) {
      companyProfile.departments.forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    }
    const companyStaff = staff.filter(s => s.companyId === companyId);
    companyStaff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    const fallbackList = depts.length > 0 ? depts.sort() : ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    setUnusedDept(fallbackList[0]);
  };

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractName.trim()) {
      onShowToast('Contract Name is required.', 'warning');
      return;
    }
    if (!contractVendorId) {
      onShowToast('Vendor partner selection is required.', 'warning');
      return;
    }
    if (!contractCompanyId) {
      onShowToast('Paying entity selection is required.', 'warning');
      return;
    }
    if (!startDate) {
      onShowToast('Start date is required.', 'warning');
      return;
    }

    const payload = {
      ...contract,
      id: contract?.id || `contract-${Date.now()}`,
      name: contractName.trim(),
      vendorId: contractVendorId,
      companyId: contractCompanyId,
      costInterval,
      currency: contractCurrency,
      unitCost: parseFloat(unitCost) || 0,
      quantityPurchased: parseInt(quantityPurchased, 10) || 1,
      taxRate: parseFloat(taxRate) || 0,
      splitPackageCost,
      startDate,
      endDate,
      renewalDate,
      paymentDueDate,
      paymentReminderDate,
      unusedCostTag: unusedCompanyId ? {
        companyId: unusedCompanyId,
        department: unusedDept
      } : null
    };

    try {
      await onSaveContract(payload);
      onShowToast(contract ? `Updated contract details successfully.` : `Registered contract successfully.`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Error saving contract: ${err.message}`, 'warning');
    }
  };

  const selectedVendor = vendors.find(v => v.id === contractVendorId);
  const isSoftware = selectedVendor && selectedVendor.category === 'Software License';

  return (
    <div className="form-wizard-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Plus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                {contract ? 'Modify Contract Agreement' : 'Register Contract Agreement'}
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill in agreement parameters</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleContractSubmit} className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label className="form-label">Agreement Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Office 365 Seats Group Plan"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Vendor Partner <span>*</span></label>
              <select 
                className="select-filter"
                value={contractVendorId}
                onChange={(e) => setContractVendorId(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
                required
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Billing Entity (Company) <span>*</span></label>
              <select 
                className="select-filter"
                value={contractCompanyId}
                onChange={(e) => setContractCompanyId(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
                required
              >
                <option value="">-- Select Company --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group-row" style={{ flex: 1, gap: '10px', marginBottom: 0 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Billing Frequency <span>*</span></label>
                <select 
                  className="select-filter"
                  value={costInterval}
                  onChange={(e) => setCostInterval(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="monthly">Monthly Recurring</option>
                  <option value="quarterly">Quarterly Recurring</option>
                  <option value="annual">Annual Recurring</option>
                  <option value="one-off">One-Off / Direct Pay</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Contract Currency <span>*</span></label>
                <select 
                  className="select-filter"
                  value={contractCurrency}
                  onChange={(e) => setContractCurrency(e.target.value)}
                  style={{ width: '100%', padding: '10px' }}
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unit Cost (excl. Tax) <span>*</span></label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0.00"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Quantity / Seats Purchased <span>*</span></label>
              <input 
                type="number" 
                className="form-input" 
                value={quantityPurchased}
                onChange={(e) => setQuantityPurchased(e.target.value)}
                min="1"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">VAT / Tax Rate (%) <span>*</span></label>
              <input 
                type="number" 
                className="form-input" 
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                required
              />
            </div>
          </div>

          {isSoftware && (
            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={splitPackageCost} 
                  onChange={(e) => setSplitPackageCost(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                💼 Split total package cost equally among all assigned staff users
              </label>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginLeft: '20px' }}>
                Check this if you pay a flat package rate (e.g. CVLibrary package) rather than per-seat licensing. This enables allocating any number of users, and divides the fixed total cost equally among them.
              </span>
            </div>
          )}

          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Agreement Start Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Agreement End Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contract Renewal Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Alert Parameters */}
          <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Next Payment Due Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Used to trigger overdue and imminent payment alarms.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Payment Reminder Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={paymentReminderDate}
                onChange={(e) => setPaymentReminderDate(e.target.value)}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Date when an admin reminder will trigger.
              </span>
            </div>
          </div>

          <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unused License Cost absorbed by (Company)</label>
              <select 
                className="select-filter"
                value={unusedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="">-- Select Company --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Unused License Cost absorbed by (Department)</label>
              <select 
                className="select-filter"
                value={unusedDept}
                onChange={(e) => setUnusedDept(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
                disabled={!unusedCompanyId}
              >
                {!unusedCompanyId ? (
                  <option value="">-- Select Company First --</option>
                ) : (
                  availableDeptsForChosenCompany.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {contract ? 'Update Contract' : 'Save Contract Agreement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
