import React, { useState } from 'react';
import { toGBP } from '../utils/currency';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Laptop, 
  FileText, 
  UploadCloud, 
  Eye, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Grid,
  Info,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  Edit3,
  Mail,
  Phone,
  Bell
} from 'lucide-react';
import { firebaseService } from '../services/firebase';

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

export default function VendorsDashboard({ 
  companies = [], 
  staff = [], 
  vendors = [], 
  contracts = [], 
  assetAssignments = [],
  onSaveVendor,
  onDeleteVendor,
  onSaveContract,
  onDeleteContract,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('contracts'); // contracts, allocations, forecast

  // Editing trackers
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingContractId, setEditingContractId] = useState(null);

  // Form states - Vendor
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Software License');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorDesc, setVendorDesc] = useState('');
  const [showVendorForm, setShowVendorForm] = useState(false);

  // Form states - Contract
  const [contractName, setContractName] = useState('');
  const [contractVendorId, setContractVendorId] = useState('');
  const [contractCompanyId, setContractCompanyId] = useState('');
  const [costInterval, setCostInterval] = useState('monthly');
  const [unitCost, setUnitCost] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState('1');
  const [contractCurrency, setContractCurrency] = useState('GBP');
  const [taxRate, setTaxRate] = useState('20.0'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [unusedCompanyId, setUnusedCompanyId] = useState('');
  const [unusedDept, setUnusedDept] = useState('Operations');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentReminderDate, setPaymentReminderDate] = useState('');
  const [showContractForm, setShowContractForm] = useState(false);

  // Upload Invoice states
  const [uploadContractId, setUploadContractId] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('invoice');
  const [isUploading, setIsUploading] = useState(false);

  // Forecast currency selector
  const [forecastCurrency, setForecastCurrency] = useState('GBP');

  // Load defaults when lists load
  React.useEffect(() => {
    if (vendors.length > 0 && !contractVendorId) {
      setContractVendorId(vendors[0].id);
    }
  }, [vendors]);

  React.useEffect(() => {
    if (companies.length > 0 && !contractCompanyId) {
      setContractCompanyId(companies[0].id);
      setUnusedCompanyId(companies[0].id);
    }
  }, [companies]);

  // Trigger Edit Vendor
  const handleEditVendor = (vendor) => {
    setVendorName(vendor.name);
    setVendorCategory(vendor.category);
    setVendorEmail(vendor.contactEmail || '');
    setVendorPhone(vendor.phone || '');
    setVendorDesc(vendor.description || '');
    setEditingVendorId(vendor.id);
    setShowVendorForm(true);
    setShowContractForm(false);
  };

  // Submit Vendor
  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      onShowToast("Please enter a vendor name.", "warning");
      return;
    }

    const updatedVendor = {
      id: editingVendorId || `vendor-${Date.now()}`,
      name: vendorName.trim(),
      category: vendorCategory,
      contactEmail: vendorEmail.trim(),
      phone: vendorPhone.trim(),
      description: vendorDesc.trim()
    };

    try {
      await onSaveVendor(updatedVendor);
      onShowToast(
        editingVendorId 
          ? `Updated vendor details for "${vendorName}"` 
          : `Registered vendor partner "${vendorName}"`, 
        "success"
      );
      
      // Reset
      setVendorName('');
      setVendorEmail('');
      setVendorPhone('');
      setVendorDesc('');
      setEditingVendorId(null);
      setShowVendorForm(false);
    } catch (err) {
      onShowToast(`Error saving vendor: ${err.message}`, "warning");
    }
  };

  // Trigger Edit Contract
  const handleEditContract = (contract) => {
    setContractName(contract.name);
    setContractVendorId(contract.vendorId);
    setContractCompanyId(contract.companyId);
    setCostInterval(contract.costInterval);
    setUnitCost(String(contract.unitCost));
    setQuantityPurchased(String(contract.quantityPurchased));
    setContractCurrency(contract.currency);
    setTaxRate(String(contract.taxRate || 0));
    setStartDate(contract.startDate);
    setEndDate(contract.endDate);
    setRenewalDate(contract.renewalDate || '');
    setUnusedCompanyId(contract.unusedCostTag?.companyId || contract.companyId);
    setUnusedDept(contract.unusedCostTag?.department || 'Operations');
    setPaymentDueDate(contract.paymentDueDate || '');
    setPaymentReminderDate(contract.paymentReminderDate || '');
    setEditingContractId(contract.id);
    setShowContractForm(true);
    setShowVendorForm(false);
  };

  // Submit Contract
  const handleContractSubmit = async (e) => {
    e.preventDefault();
    if (!contractName.trim() || !contractVendorId || !contractCompanyId || !unitCost || !startDate || !endDate) {
      onShowToast("Please enter all required contract fields.", "warning");
      return;
    }

    const targetContract = contracts.find(c => c.id === editingContractId);
    const attachedDocs = targetContract ? (targetContract.documents || []) : [];

    const updatedContract = {
      id: editingContractId || `contract-${Date.now()}`,
      vendorId: contractVendorId,
      companyId: contractCompanyId,
      name: contractName.trim(),
      costInterval,
      unitCost: Number(unitCost),
      quantityPurchased: Number(quantityPurchased),
      currency: contractCurrency,
      taxRate: Number(taxRate) || 0,
      startDate,
      endDate,
      renewalDate: renewalDate || endDate,
      unusedCostTag: { companyId: unusedCompanyId, department: unusedDept },
      paymentDueDate: paymentDueDate || null,
      paymentReminderDate: paymentReminderDate || null,
      documents: attachedDocs
    };

    try {
      await onSaveContract(updatedContract);
      onShowToast(
        editingContractId 
          ? `Updated contract parameters for "${contractName}"` 
          : `Registered contract agreement "${contractName}"`, 
        "success"
      );
      
      // Reset
      setContractName('');
      setUnitCost('');
      setQuantityPurchased('1');
      setTaxRate('20.0');
      setStartDate('');
      setEndDate('');
      setRenewalDate('');
      setPaymentDueDate('');
      setPaymentReminderDate('');
      setEditingContractId(null);
      setShowContractForm(false);
    } catch (err) {
      onShowToast(`Error saving contract: ${err.message}`, "warning");
    }
  };

  // Calculate payment alert flags
  const getPaymentAlert = (dueDateStr) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { type: 'overdue', text: `Overdue by ${Math.abs(diffDays)} days`, color: 'var(--danger)' };
    } else if (diffDays === 0) {
      return { type: 'today', text: 'Due Today', color: 'var(--danger)' };
    } else if (diffDays <= 7) {
      return { type: 'soon', text: `Due in ${diffDays} days`, color: 'var(--warning)' };
    }
    return null;
  };

  // Forecast calculations (next 12 months)
  const getForecastData = () => {
    const months = [];
    const date = new Date('2026-07-01'); // anchor start: July 2026
    for (let i = 0; i < 12; i++) {
      months.push(new Date(date.getFullYear(), date.getMonth() + i, 1));
    }

    const forecastData = months.map(m => {
      const year = m.getFullYear();
      const monthIndex = m.getMonth();
      const monthStr = m.toLocaleString('default', { month: 'short' }) + ' ' + year;

      let fixedCosts = 0;
      let assignedCosts = 0;
      let unusedCosts = 0;
      const renewalsList = [];

      contracts
        .forEach(c => {
          const cStart = new Date(c.startDate);
          const cEnd = new Date(c.endDate);
          const currentMonthDate = new Date(year, monthIndex, 1);

          if (cStart <= new Date(year, monthIndex + 1, 0) && cEnd >= currentMonthDate) {
            
            // Calculate base monthly cost (excluding tax) converted to GBP
            let monthlyTotal = 0;
            const unitCostGBP = toGBP(c.unitCost, c.currency);
            
            if (c.costInterval === 'monthly') {
              monthlyTotal = unitCostGBP * c.quantityPurchased;
            } else if (c.costInterval === 'annual') {
              monthlyTotal = (unitCostGBP * c.quantityPurchased) / 12;
            } else if (c.costInterval === 'one_time' && cEnd.getMonth() === monthIndex && cEnd.getFullYear() === year) {
              monthlyTotal = unitCostGBP * c.quantityPurchased;
            }

            const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
            const monthlyTotalWithTax = monthlyTotal * taxFactor;

            if (c.quantityPurchased === 1) {
              fixedCosts += monthlyTotalWithTax;
            } else {
              const assignedSeats = assetAssignments.filter(a => a.contractId === c.id).length;
              const unusedSeats = Math.max(0, c.quantityPurchased - assignedSeats);
              const costPerSeatWithTax = unitCostGBP * taxFactor;
              
              assignedCosts += assignedSeats * costPerSeatWithTax;
              unusedCosts += unusedSeats * costPerSeatWithTax;
            }

            if (cEnd.getMonth() === monthIndex && cEnd.getFullYear() === year) {
              renewalsList.push(c.name);
            }
          }
        });

      return {
        month: monthStr,
        fixed: fixedCosts,
        assigned: assignedCosts,
        unused: unusedCosts,
        total: fixedCosts + assignedCosts + unusedCosts,
        renewals: renewalsList
      };
    });

    return forecastData;
  };

  const forecastPoints = getForecastData();
  const activeCurrencySymbol = symbolMap[forecastCurrency] || '£';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        width: 'fit-content',
        gap: '4px'
      }}>
        {[
          { key: 'contracts', label: 'Vendors & Agreements' },
          { key: 'allocations', label: 'License Allocations' },
          { key: 'forecast', label: 'Expense Forecasting' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'var(--bg-sidebar)' : 'none',
              border: 'none',
              color: activeSubTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==============================================================
          SUB-TAB 1: VENDORS & AGREEMENTS
          ============================================================== */}
      {activeSubTab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Vendors, Rentals & Contracts</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage landlord agreements, software licenses, payment terms, and invoice schedules.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => {
                setEditingVendorId(null);
                setVendorName('');
                setVendorEmail('');
                setVendorPhone('');
                setVendorDesc('');
                setShowVendorForm(prev => !prev);
                setShowContractForm(false);
              }}>
                <Plus size={16} /> Add Vendor Partner
              </button>
              <button className="btn-primary" onClick={() => {
                setEditingContractId(null);
                setContractName('');
                setUnitCost('');
                setQuantityPurchased('1');
                setTaxRate('20.0');
                setStartDate('');
                setEndDate('');
                setRenewalDate('');
                setPaymentDueDate('');
                setPaymentReminderDate('');
                setShowContractForm(prev => !prev);
                setShowVendorForm(false);
              }}>
                <Plus size={16} /> Register Contract
              </button>
            </div>
          </div>

          {/* Create / Edit Vendor Form */}
          {showVendorForm && (
            <form onSubmit={handleVendorSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> {editingVendorId ? 'Update Vendor Company Details' : 'Add Vendor Partner Details'}
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Vendor Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Microsoft Ireland"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={vendorCategory}
                    onChange={(e) => setVendorCategory(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="Software License">Software Licenses (Office, CRM, etc.)</option>
                    <option value="Office Rental">Office Rentals & Landlords</option>
                    <option value="Telecom">Telecom & Phone Systems</option>
                    <option value="AI Service">AI Services (OpenAI, Anthropic)</option>
                    <option value="Other">Other Vendors</option>
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="billing@vendor.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="+1 (800) ..."
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Scope of Service</label>
                <textarea 
                  className="form-input" 
                  rows="2"
                  placeholder="What products or services they supply..."
                  value={vendorDesc}
                  onChange={(e) => setVendorDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editingVendorId ? 'Update Vendor Company' : 'Save Vendor Partner'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowVendorForm(false);
                  setEditingVendorId(null);
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Create / Edit Contract Form */}
          {showContractForm && (
            <form onSubmit={handleContractSubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
              <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
                <Plus size={14} /> {editingContractId ? 'Modify Contract Agreement' : 'Register Contract Agreement'}
              </div>

              <div className="form-group-row">
                <div className="form-group" style={{ flex: 2 }}>
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

                <div className="form-group">
                  <label className="form-label">Vendor <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={contractVendorId}
                    onChange={(e) => setContractVendorId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Billed To (paying Company) <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={contractCompanyId}
                    onChange={(e) => setContractCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Interval <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={costInterval}
                    onChange={(e) => setCostInterval(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="monthly">Monthly Recurring</option>
                    <option value="annual">Annual Recurring</option>
                    <option value="one_time">One-Time Purchase</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Currency <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={contractCurrency}
                    onChange={(e) => setContractCurrency(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Unit Cost (excluding tax) <span>*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    placeholder="e.g. 10" 
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity Purchased <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={quantityPurchased}
                    onChange={(e) => setQuantityPurchased(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">VAT / GST / Sales Tax Rate (%)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    max="100"
                    className="form-input" 
                    placeholder="e.g. 20" 
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label">Start Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Renewal Review Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Alert Parameters */}
              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                <div className="form-group">
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

                <div className="form-group">
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

              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Unused License Cost absorbed by (Company)</label>
                  <select 
                    className="select-filter"
                    value={unusedCompanyId}
                    onChange={(e) => setUnusedCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unused License Cost absorbed by (Department)</label>
                  <select 
                    className="select-filter"
                    value={unusedDept}
                    onChange={(e) => setUnusedDept(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="Operations">Operations</option>
                    <option value="Recruitment">Recruitment</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {editingContractId ? 'Update Contract' : 'Save Contract Agreement'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setShowContractForm(false);
                  setEditingContractId(null);
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Vendors Directory Section */}
          <div className="detail-section" style={{ padding: '16px' }}>
            <div className="section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>
              <Building2 size={16} /> Vendor Partners Directory ({vendors.length})
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {vendors.map(v => (
                <div key={v.id} style={{ 
                  flex: '1 1 300px', 
                  backgroundColor: 'var(--bg-sidebar)', 
                  border: '1px solid var(--border-color)', 
                  padding: '12px', 
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{v.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>{v.category}</span>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {v.contactEmail && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={10} />{v.contactEmail}</span>
                      )}
                      {v.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={10} />{v.phone}</span>
                      )}
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => handleEditVendor(v)} title="Edit Vendor">
                    <Edit3 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Contracts grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {contracts.map(contract => {
              const matchedVendor = vendors.find(v => v.id === contract.vendorId);
              const matchedCompany = companies.find(c => c.id === contract.companyId);
              const symbol = symbolMap[contract.currency] || '£';
              
              const unitCostGBP = toGBP(contract.unitCost, contract.currency);
              const rawCost = unitCostGBP * contract.quantityPurchased;
              const taxRateVal = contract.taxRate || 0;
              const taxAmount = (rawCost * taxRateVal) / 100;
              const totalWithTax = rawCost + taxAmount;

              const monthlyCostEquivalent = contract.costInterval === 'monthly'
                ? totalWithTax
                : contract.costInterval === 'annual'
                ? totalWithTax / 12
                : 0;

              const alert = getPaymentAlert(contract.paymentDueDate);

              return (
                <div key={contract.id} className="doc-card" style={{ padding: '20px', flexDirection: 'column', alignItems: 'stretch', gap: '16px', backgroundColor: 'var(--bg-card)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '40px', 
                        height: '40px', 
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--primary)'
                      }}>
                        <Receipt size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{contract.name}</h3>
                          
                          {/* Payment Alarm Badges */}
                          {alert && (
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 700, 
                              color: alert.color, 
                              backgroundColor: `${alert.color}15`, 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: `1px solid ${alert.color}30`
                            }}>
                              <Bell size={10} />
                              {alert.text}
                            </span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                            <Building2 size={13} style={{ color: 'var(--primary)' }} />
                            Paying Entity: <strong>{matchedCompany ? `${matchedCompany.name} (${matchedCompany.country})` : 'Unknown Entity'}</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                            <UserCheck size={13} style={{ color: 'var(--accent)' }} />
                            Contract Vendor: <strong>{matchedVendor ? `${matchedVendor.name} (${matchedVendor.category})` : 'Unknown Vendor'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
                        {contract.currency === 'GBP' ? (
                          `£${monthlyCostEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          `£${monthlyCostEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${symbol}${((contract.costInterval === 'monthly' ? (contract.unitCost * contract.quantityPurchased * (1 + (contract.taxRate || 0)/100)) : (contract.unitCost * contract.quantityPurchased * (1 + (contract.taxRate || 0)/100)) / 12)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo)`
                        )}
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'normal' }}> / mo (incl. tax)</span>
                      </span>
                      
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <div>Subtotal: £{rawCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contract.currency !== 'GBP' && `(${symbol}${(contract.unitCost * contract.quantityPurchased).toLocaleString(undefined, { maximumFractionDigits: 2 })})`}</div>
                        {taxRateVal > 0 && (
                          <div style={{ color: 'var(--warning)' }}>
                            Tax ({taxRateVal}%): +£{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contract.currency !== 'GBP' && `(+${symbol}${((contract.unitCost * contract.quantityPurchased * taxRateVal) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })})`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Details grid */}
                  <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px' }}>
                    <div>
                      <span className="detail-label" style={{ fontSize: '10px' }}>Start Date</span>
                      <span className="detail-value" style={{ fontSize: '12px' }}>{contract.startDate}</span>
                    </div>
                    <div>
                      <span className="detail-label" style={{ fontSize: '10px' }}>Expiration Date</span>
                      <span className="detail-value" style={{ fontSize: '12px' }}>{contract.endDate}</span>
                    </div>
                    <div>
                      <span className="detail-label" style={{ fontSize: '10px' }}>Renewal Date</span>
                      <span className="detail-value" style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>{contract.renewalDate}</span>
                    </div>
                    <div>
                      <span className="detail-label" style={{ fontSize: '10px' }}>Quantity (Seats)</span>
                      <span className="detail-value" style={{ fontSize: '12px' }}>{contract.quantityPurchased}</span>
                    </div>
                  </div>

                  {/* Payment Schedules and Reminder display */}
                  {(contract.paymentDueDate || contract.paymentReminderDate) && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '24px', 
                      fontSize: '12px', 
                      backgroundColor: 'rgba(255,255,255,0.01)', 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid rgba(255,255,255,0.03)' 
                    }}>
                      {contract.paymentDueDate && (
                        <div>
                          Payment Due: <strong style={{ color: 'var(--text-primary)' }}>{contract.paymentDueDate}</strong>
                        </div>
                      )}
                      {contract.paymentReminderDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Bell size={12} style={{ color: 'var(--accent)' }} />
                          Reminder Set: <strong style={{ color: 'var(--text-secondary)' }}>{contract.paymentReminderDate}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invoices and Documents attachments list */}
                  <div>
                    <span className="form-label" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>Attached Invoices & Documents ({(contract.documents || []).length})</span>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {(contract.documents || []).map(doc => (
                        <div key={doc.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid var(--border-color)', 
                          padding: '4px 10px', 
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                          <span title={doc.name} style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                          <button type="button" onClick={() => handlePreviewInvoice(doc)} style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }} title="Preview">
                            <Eye size={12} />
                          </button>
                          <button type="button" onClick={() => handleDeleteInvoice(contract.id, doc.id, doc)} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }} title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {(contract.documents || []).length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No invoices attached yet.</span>
                      )}
                    </div>

                    {/* Quick invoice uploader */}
                    {uploadContractId === contract.id ? (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.02)', padding: '10px', borderRadius: '6px', border: '1px dashed var(--primary)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Attach Invoice PDF:</span>
                        <input 
                          type="file" 
                          onChange={(e) => handleFileUpload(e, contract.id)} 
                          style={{ fontSize: '12px' }} 
                        />
                        <button type="button" className="btn-secondary" onClick={() => setUploadContractId(null)} style={{ padding: '2px 8px', fontSize: '11px' }}>Cancel</button>
                      </div>
                    ) : (
                      <button 
                        className="btn-secondary" 
                        onClick={() => setUploadContractId(contract.id)}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        + Attach Invoice File
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleEditContract(contract)}
                      title="Edit Contract Parameters"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      className="btn-icon delete" 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete contract "${contract.name}"?`)) {
                          onDeleteContract(contract.id);
                          onShowToast(`Deleted contract "${contract.name}"`, "info");
                        }
                      }}
                      title="Delete Contract"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 2: LICENSE ALLOCATIONS & UNUSED COST ROUTING
          ============================================================== */}
      {activeSubTab === 'allocations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>License Allocations Desk</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track license pool allocations, identify unassigned license overheads, and route unused seat costs to designated cost centers.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {contracts
              .filter(c => c.quantityPurchased > 1) // seat pools
              .map(c => {
                const assigned = assetAssignments.filter(a => a.contractId === c.id);
                const assignedCount = assigned.length;
                const unusedCount = Math.max(0, c.quantityPurchased - assignedCount);
                const symbol = symbolMap[c.currency] || '£';
                
                // Seat unit cost including tax
                const taxFactor = 1 + ((c.taxRate || 0) / 100);
                const costPerSeatWithTax = c.unitCost * taxFactor;
                const unusedCostWithTax = unusedCount * costPerSeatWithTax;
                
                const matchedCompany = companies.find(comp => comp.id === c.companyId);

                return (
                  <div key={c.id} className="entity-card" style={{ height: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Billed to: <strong>{matchedCompany ? matchedCompany.name : 'Group'}</strong> &bull; Seat Cost: <strong>{symbol}{c.unitCost}/mo</strong> {c.taxRate > 0 && `(+${c.taxRate}% VAT)`}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)' }}>
                          Unused cost: {symbol}{unusedCostWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                        </span>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {unusedCount} unallocated seats (incl. tax)
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, (assignedCount / c.quantityPurchased) * 100)}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--primary)' 
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        <span>
                          <strong>{assignedCount} Assigned</strong> ({assigned.map(a => staff.find(s => s.id === a.staffId)?.fullName).filter(Boolean).join(', ') || 'None'})
                        </span>
                        <span><strong>{c.quantityPurchased} Seats Total</strong></span>
                      </div>
                    </div>

                    {/* Unused cost account routing picker */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      backgroundColor: 'var(--bg-sidebar)', 
                      padding: '12px 16px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border-color)',
                      gap: '16px'
                    }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Info size={14} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Unused seats overhead billed to:
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select 
                          className="select-filter"
                          value={c.unusedCostTag?.companyId || ''}
                          onChange={(e) => handleUpdateUnusedTag(c.id, e.target.value, c.unusedCostTag?.department || 'Operations')}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          {companies.map(comp => (
                            <option key={comp.id} value={comp.id}>{comp.name}</option>
                          ))}
                        </select>

                        <select 
                          className="select-filter"
                          value={c.unusedCostTag?.department || 'Operations'}
                          onChange={(e) => handleUpdateUnusedTag(c.id, c.unusedCostTag?.companyId || c.companyId, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          <option value="Operations">Operations</option>
                          <option value="Recruitment">Recruitment</option>
                          <option value="Finance">Finance</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Sales">Sales</option>
                        </select>
                      </div>
                    </div>

                  </div>
                );
              })}
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: EXPENSE FORECASTING
          ============================================================== */}
      {activeSubTab === 'forecast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>12-Month Expense Forecaster</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Forecast future expenditures across your software assets, rentals, and unassigned license seat capacities (includes tax details).</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Forecast Currency:</span>
              <select 
                className="select-filter"
                value={forecastCurrency}
                onChange={(e) => setForecastCurrency(e.target.value)}
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="AED">AED (AED)</option>
                <option value="INR">INR (₹)</option>
                <option value="ZAR">ZAR (R)</option>
              </select>
            </div>
          </div>

          {/* Forecasting Month Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {forecastPoints.map((point, idx) => (
              <div 
                key={idx} 
                className="doc-card" 
                style={{ 
                  padding: '16px', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-card)',
                  borderLeft: point.renewals.length > 0 ? '4px solid var(--warning)' : '1px solid var(--border-color)' 
                }}
              >
                <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '100px', fontWeight: 700, fontSize: '15px' }}>{point.month}</div>
                  
                  {/* Spend distribution progress preview */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', fontSize: '11px', color: 'var(--text-secondary)', gap: '16px' }}>
                      <span>Fixed Rents/Leases: <strong>{activeCurrencySymbol}{Math.round(point.fixed).toLocaleString()}</strong></span>
                      <span>Assigned Seats: <strong>{activeCurrencySymbol}{Math.round(point.assigned).toLocaleString()}</strong></span>
                      <span>Unused License Waste: <strong style={{ color: 'var(--warning)' }}>{activeCurrencySymbol}{Math.round(point.unused).toLocaleString()}</strong></span>
                    </div>

                    {/* visual bar splits */}
                    <div style={{ 
                      width: '100%', 
                      height: '6px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderRadius: '3px',
                      display: 'flex',
                      overflow: 'hidden'
                    }}>
                      {point.total > 0 && (
                        <>
                          <div style={{ width: `${(point.fixed / point.total) * 100}%`, height: '100%', backgroundColor: 'var(--primary)' }} title="Fixed leases" />
                          <div style={{ width: `${(point.assigned / point.total) * 100}%`, height: '100%', backgroundColor: 'var(--success)' }} title="Assigned seats" />
                          <div style={{ width: `${(point.unused / point.total) * 100}%`, height: '100%', backgroundColor: 'var(--warning)' }} title="Unused seats waste" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expirations alert */}
                <div style={{ width: '220px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {point.renewals.map((rName, i) => (
                    <span 
                      key={i} 
                      style={{ 
                        fontSize: '10px', 
                        color: 'var(--warning)', 
                        background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <AlertTriangle size={10} /> Expiring: {rName}
                    </span>
                  ))}
                </div>

                <div style={{ textAlign: 'right', width: '150px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>
                    {activeCurrencySymbol}{Math.round(point.total).toLocaleString()}
                  </span>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Est. Spend (incl. tax)</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}
