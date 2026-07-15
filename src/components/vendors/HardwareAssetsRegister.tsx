import React, { useState, useMemo } from 'react';
import { Staff } from '../../types';
import { Search, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';

interface HardwareAsset {
  id: string;
  assetTag: string;
  category: 'laptop' | 'phone' | 'monitor' | 'peripheral' | 'other';
  brand: string;
  model: string;
  serialNumber: string;
  assignedStaffId: string;
  purchaseDate: string;
  status: 'active' | 'stored' | 'retired' | 'lost';
  value: number;
}

interface HardwareProps {
  staff: Staff[];
  assetAssignments?: any[];
  contracts?: any[];
  onShowToast: (msg: string, type?: string) => void;
}

export default function HardwareAssetsRegister({
  staff = [],
  assetAssignments = [],
  contracts = [],
  onShowToast
}: HardwareProps) {
  const [viewMode, setViewMode] = useState<'inventory' | 'profiles'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [assets, setAssets] = useState<HardwareAsset[]>(() => {
    try {
      const saved = localStorage.getItem('bm-hardware-assets');
      if (saved) return JSON.parse(saved);
    } catch {}
    
    // Seed initial mock hardware assets
    return [
      { id: 'hw-1', assetTag: 'HUM-LP-041', category: 'laptop', brand: 'Apple', model: 'MacBook Pro 14" M3', serialNumber: 'C02FT39XMD6M', assignedStaffId: 'staff-1', purchaseDate: '2025-02-10', status: 'active', value: 1899 },
      { id: 'hw-2', assetTag: 'HUM-LP-042', category: 'laptop', brand: 'Dell', model: 'XPS 15 9530', serialNumber: '5D93X82M21', assignedStaffId: 'staff-2', purchaseDate: '2025-05-15', status: 'active', value: 1650 },
      { id: 'hw-3', assetTag: 'HUM-PH-012', category: 'phone', brand: 'Apple', model: 'iPhone 15 Pro 256GB', serialNumber: 'F182X93MD81', assignedStaffId: 'staff-1', purchaseDate: '2024-11-20', status: 'active', value: 999 },
      { id: 'hw-4', assetTag: 'HUM-MN-078', category: 'monitor', brand: 'LG', model: '27" UltraFine 4K', serialNumber: 'LG27U882193', assignedStaffId: 'staff-3', purchaseDate: '2025-01-08', status: 'active', value: 450 },
      { id: 'hw-5', assetTag: 'HUM-LP-043', category: 'laptop', brand: 'Apple', model: 'MacBook Air 13" M2', serialNumber: 'C02GL12YMD5N', assignedStaffId: '', purchaseDate: '2025-08-01', status: 'stored', value: 1099 }
    ];
  });

  const saveAssetsToStorage = (newAssets: HardwareAsset[]) => {
    setAssets(newAssets);
    try {
      localStorage.setItem('bm-hardware-assets', JSON.stringify(newAssets));
    } catch {}
  };

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assetTag, setAssetTag] = useState('');
  const [category, setCategory] = useState<'laptop' | 'phone' | 'monitor' | 'peripheral' | 'other'>('laptop');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [status, setStatus] = useState<'active' | 'stored' | 'retired' | 'lost'>('active');
  const [value, setValue] = useState('0');

  const handleEditClick = (asset: HardwareAsset) => {
    setEditingId(asset.id);
    setAssetTag(asset.assetTag);
    setCategory(asset.category);
    setBrand(asset.brand);
    setModel(asset.model);
    setSerialNumber(asset.serialNumber);
    setAssignedStaffId(asset.assignedStaffId);
    setPurchaseDate(asset.purchaseDate);
    setStatus(asset.status);
    setValue(String(asset.value));
    setShowAddForm(true);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setAssetTag(`HUM-HW-${Date.now().toString().slice(-4)}`);
    setCategory('laptop');
    setBrand('');
    setModel('');
    setSerialNumber('');
    setAssignedStaffId('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setStatus('stored');
    setValue('1000');
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model || !serialNumber) {
      onShowToast("Please enter brand, model, and serial number.", "warning");
      return;
    }

    const newAsset: HardwareAsset = {
      id: editingId || `hw-${Date.now()}`,
      assetTag,
      category,
      brand,
      model,
      serialNumber,
      assignedStaffId,
      purchaseDate,
      status: assignedStaffId ? 'active' : status,
      value: Number(value) || 0
    };

    let updated: HardwareAsset[] = [];
    if (editingId) {
      updated = assets.map(a => a.id === editingId ? newAsset : a);
      onShowToast("Hardware asset updated successfully.", "success");
    } else {
      updated = [newAsset, ...assets];
      onShowToast("New hardware asset registered.", "success");
    }

    saveAssetsToStorage(updated);
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this hardware asset record?")) {
      const updated = assets.filter(a => a.id !== id);
      saveAssetsToStorage(updated);
      onShowToast("Hardware asset deleted.", "info");
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = 
        a.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [assets, searchTerm, filterStatus]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Controls Bar */}
      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search tag, brand, serial..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Asset Statuses</option>
            <option value="active">Active Assignment</option>
            <option value="stored">In Storage</option>
            <option value="retired">Retired / Defective</option>
            <option value="lost">Lost / Stolen</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button 
            type="button" 
            className={`btn-secondary ${viewMode === 'inventory' ? 'active' : ''}`}
            onClick={() => setViewMode('inventory')}
            style={{ fontSize: '12px', padding: '8px 12px', border: viewMode === 'inventory' ? '1px solid var(--accent)' : '1px solid var(--border-color)', backgroundColor: viewMode === 'inventory' ? 'rgba(99,102,241,0.08)' : 'transparent', color: viewMode === 'inventory' ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            📋 Inventory List
          </button>
          <button 
            type="button" 
            className={`btn-secondary ${viewMode === 'profiles' ? 'active' : ''}`}
            onClick={() => setViewMode('profiles')}
            style={{ fontSize: '12px', padding: '8px 12px', border: viewMode === 'profiles' ? '1px solid var(--accent)' : '1px solid var(--border-color)', backgroundColor: viewMode === 'profiles' ? 'rgba(99,102,241,0.08)' : 'transparent', color: viewMode === 'profiles' ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            🏢 Workspace Cost Profiles
          </button>
        </div>

        {viewMode === 'inventory' && (
          <button type="button" className="btn-primary" onClick={handleCreateClick} style={{ marginLeft: '12px' }}>
            ➕ Add Hardware Asset
          </button>
        )}
      </div>

      {/* Grid Table */}
      {viewMode === 'inventory' && (
        <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table className="entity-table dense" style={{ minWidth: '950px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <th>Asset Tag</th>
              <th>Category</th>
              <th>Brand / Model</th>
              <th>Serial Number</th>
              <th>Assigned Staff</th>
              <th>Purchase Date</th>
              <th>Valuation</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length > 0 ? filteredAssets.map(a => {
              const assignedStaff = staff.find(s => s.id === a.assignedStaffId);
              return (
                <tr key={a.id}>
                  <td>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{a.assetTag}</strong>
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize', fontSize: '11px', color: 'var(--text-secondary)' }}>{a.category}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.brand}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.model}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{a.serialNumber}</span>
                  </td>
                  <td>
                    {assignedStaff ? (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{assignedStaff.fullName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{assignedStaff.department}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>— Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px' }}>{a.purchaseDate}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>
                    £{a.value.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      color: a.status === 'active' ? 'var(--success)' : a.status === 'stored' ? 'var(--info)' : 'var(--danger)',
                      backgroundColor: a.status === 'active' ? 'rgba(16,185,129,0.1)' : a.status === 'stored' ? 'rgba(14,165,233,0.1)' : 'rgba(239,68,68,0.1)'
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button className="btn-icon" title="Edit Asset" onClick={() => handleEditClick(a)}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn-icon delete" title="Delete Asset" onClick={() => handleDelete(a.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No hardware assets match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {viewMode === 'profiles' && (
        <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table className="entity-table dense" style={{ minWidth: '850px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th>Consultant Name</th>
                <th>Department</th>
                <th>Assigned Devices</th>
                <th style={{ textAlign: 'right' }}>Hardware Asset Value</th>
                <th>Assigned Software Seats</th>
                <th style={{ textAlign: 'right' }}>Monthly Software Seat Cost</th>
                <th style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>Total Monthly Workspace Cost</th>
              </tr>
            </thead>
            <tbody>
              {staff.filter(s => s.status !== 'exited').map(s => {
                const myHardware = assets.filter(a => a.assignedStaffId === s.id && a.status === 'active');
                const hwValue = myHardware.reduce((sum, h) => sum + (h.value || 0), 0);
                const hwNames = myHardware.map(h => `${h.brand} ${h.model}`).join(', ') || 'None';

                const mySoftware = assetAssignments.filter(a => a.staffId === s.id);
                const swNames = mySoftware.map(a => {
                  const c = contracts.find(con => con.id === a.contractId);
                  return c ? c.name : 'Unknown License';
                }).join(', ') || 'None';

                const swMonthlyCost = mySoftware.reduce((sum, a) => {
                  const c = contracts.find(con => con.id === a.contractId);
                  if (c) {
                    const monthlyCost = Number(c.monthlyCost || 0);
                    const seatCount = Number(c.licenseSeats || 1);
                    return sum + (monthlyCost / (seatCount || 1));
                  }
                  return sum;
                }, 0);

                const totalMonthlyCost = (hwValue * 0.03) + swMonthlyCost;

                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.fullName}</td>
                    <td>{s.department || 'Other'}</td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{hwNames}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      £{hwValue.toLocaleString()}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{swNames}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      £{Math.round(swMonthlyCost).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      £{Math.round(totalMonthlyCost).toLocaleString()} /mo
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Form Overlay */}
      {showAddForm && (
        <div className="form-wizard-overlay" onClick={() => setShowAddForm(false)}>
          <form onSubmit={handleSubmit} className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="wizard-header">
              <h2 className="wizard-title" style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                {editingId ? "✏️ Modify Hardware Asset Record" : "➕ Register Physical Hardware Asset"}
              </h2>
              <button type="button" className="btn-close" onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Asset Tag <span>*</span></label>
                  <input type="text" className="form-input" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="select-filter" style={{ width: '100%' }} value={category} onChange={(e) => setCategory(e.target.value as any)}>
                    <option value="laptop">Laptop Computer</option>
                    <option value="phone">Mobile Phone</option>
                    <option value="monitor">Office Monitor</option>
                    <option value="peripheral">Peripheral / Accessory</option>
                    <option value="other">Other Asset</option>
                  </select>
                </div>
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Brand Name <span>*</span></label>
                  <input type="text" className="form-input" placeholder="e.g. Apple" value={brand} onChange={(e) => setBrand(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Model / Spec <span>*</span></label>
                  <input type="text" className="form-input" placeholder="e.g. MacBook Pro 16" value={model} onChange={(e) => setModel(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Serial Number (S/N) <span>*</span></label>
                <input type="text" className="form-input" placeholder="e.g. C02GL12YMD5N" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Assign To Employee</label>
                <select className="select-filter" style={{ width: '100%' }} value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)}>
                  <option value="">-- Unassigned / In Storage --</option>
                  {staff.filter(s => s.status !== 'exited').map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.department})</option>
                  ))}
                </select>
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input type="date" className="form-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Value (£)</label>
                  <input type="number" className="form-input" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
              </div>

              {!assignedStaffId && (
                <div className="form-group">
                  <label className="form-label">Storage Status</label>
                  <select className="select-filter" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    <option value="stored">In Storage</option>
                    <option value="retired">Retired / Defective</option>
                    <option value="lost">Lost / Stolen</option>
                  </select>
                </div>
              )}
            </div>

            <div className="wizard-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Asset</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
