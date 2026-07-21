import React, { useState, useEffect } from 'react';
import { Building2, X } from 'lucide-react';
import { Vendor } from '../../types';

interface VendorRegisterModalProps {
  vendor: Vendor | null;
  onClose: () => void;
  nominalCodes?: any[];
  onSaveVendor: (vendor: any) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function VendorRegisterModal({
  vendor,
  onClose,
  nominalCodes = [],
  onSaveVendor,
  onShowToast
}: VendorRegisterModalProps) {
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Software License');
  const [presetCategory, setPresetCategory] = useState('Software License');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorDesc, setVendorDesc] = useState('');
  const [nominalCode, setNominalCode] = useState('');

  useEffect(() => {
    if (vendor) {
      setVendorName(vendor.name || '');
      setVendorEmail(vendor.email || '');
      setVendorPhone(vendor.phone || '');
      setVendorDesc(vendor.notes || '');
      setNominalCode(vendor.nominalCode || '');

      const isPreset = ['Software License', 'Office Rental', 'Telecom', 'AI Service', 'Other'].includes(vendor.category || '');
      if (isPreset) {
        setPresetCategory(vendor.category || 'Software License');
        setVendorCategory(vendor.category || 'Software License');
      } else {
        setPresetCategory('custom');
        setVendorCategory(vendor.category || '');
      }
    } else {
      setVendorName('');
      setVendorEmail('');
      setVendorPhone('');
      setVendorDesc('');
      setNominalCode('');
      setPresetCategory('Software License');
      setVendorCategory('Software License');
    }
  }, [vendor]);

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      onShowToast('Vendor name is required.', 'warning');
      return;
    }
    if (!vendorCategory.trim()) {
      onShowToast('Category is required.', 'warning');
      return;
    }

    const payload = {
      id: vendor?.id || `vendor-${Date.now()}`,
      name: vendorName.trim(),
      category: vendorCategory.trim(),
      email: vendorEmail.trim(),
      phone: vendorPhone.trim(),
      notes: vendorDesc.trim(),
      nominalCode: nominalCode || ''
    };

    try {
      await onSaveVendor(payload);
      onShowToast(vendor ? `Updated vendor ${vendorName}` : `Registered new vendor ${vendorName}`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Error saving vendor: ${err.message}`, 'warning');
    }
  };

  return (
    <div className="form-wizard-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                {vendor ? 'Update Vendor Company Details' : 'Add Vendor Partner Details'}
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill in company information below</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleVendorSubmit} className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category <span>*</span></label>
              <select 
                className="select-filter"
                value={presetCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setPresetCategory(val);
                  if (val !== 'custom') {
                    setVendorCategory(val);
                  } else {
                    setVendorCategory('');
                  }
                }}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="Software License">Software Licenses (Office, CRM, etc.)</option>
                <option value="Office Rental">Office Rentals & Landlords</option>
                <option value="Telecom">Telecom & Phone Systems</option>
                <option value="AI Service">AI Services (OpenAI, Anthropic)</option>
                <option value="Other">Other Vendors</option>
                <option value="custom">Custom / New Category...</option>
              </select>
              {(presetCategory === 'custom' || !['Software License', 'Office Rental', 'Telecom', 'AI Service', 'Other'].includes(vendorCategory)) && (
                <div style={{ marginTop: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Type custom category..."
                    value={vendorCategory}
                    onChange={(e) => setVendorCategory(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Default Expense Nominal Code</label>
              <select 
                className="select-filter"
                value={nominalCode}
                onChange={(e) => setNominalCode(e.target.value)}
                style={{ width: '100%', padding: '10px' }}
              >
                <option value="">-- Select Default Nominal Code --</option>
                {(nominalCodes || []).map((nc: any) => (
                  <option key={nc.id || nc.code} value={nc.code}>
                    {nc.code} {nc.name ? `- ${nc.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contact Email</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="e.g. billing@microsoft.com"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contact Phone</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. +353 1 1234567"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notes & Description</label>
            <textarea 
              className="form-input" 
              rows={3}
              placeholder="What products or services they supply..."
              value={vendorDesc}
              onChange={(e) => setVendorDesc(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {vendor ? 'Update Vendor Company' : 'Save Vendor Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
