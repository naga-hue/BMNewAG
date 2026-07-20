import React, { useState, useMemo, useEffect } from 'react';
import { Company, Staff, Vendor } from '../../types';
import { Search, Building2, User, Plus, Trash2, ChevronDown, ChevronUp, UserPlus, Info } from 'lucide-react';
import { symbolMap } from './shared';

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

interface UnifiedAssetsManagerProps {
  companies: Company[];
  staff: Staff[];
  vendors: Vendor[];
  contracts: any[];
  assetAssignments: any[];
  onSaveAssetAssignment: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function UnifiedAssetsManager({
  companies,
  staff,
  vendors,
  contracts,
  assetAssignments,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast
}: UnifiedAssetsManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'software' | 'hardware'>('all');
  const [filterCompanyId, setFilterCompanyId] = useState('all');
  
  // Track which rows are expanded (showing assignment detail inline in 1-click!)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Quick inline assign dropdown inputs
  const [assigneeStaffId, setAssigneeStaffId] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [assigneeNotes, setAssigneeNotes] = useState('');

  // Load physical hardware assets from localStorage (seeded if missing)
  const [hardwareAssets, setHardwareAssets] = useState<HardwareAsset[]>(() => {
    try {
      const saved = localStorage.getItem('bm-hardware-assets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'hw-1', assetTag: 'HUM-LP-041', category: 'laptop', brand: 'Apple', model: 'MacBook Pro 14" M3', serialNumber: 'C02FT39XMD6M', assignedStaffId: 'staff-1', purchaseDate: '2025-02-10', status: 'active', value: 1899 },
      { id: 'hw-2', assetTag: 'HUM-LP-042', category: 'laptop', brand: 'Dell', model: 'XPS 15 9530', serialNumber: '5D93X82M21', assignedStaffId: 'staff-2', purchaseDate: '2025-05-15', status: 'active', value: 1650 },
      { id: 'hw-3', assetTag: 'HUM-PH-012', category: 'phone', brand: 'Apple', model: 'iPhone 15 Pro 256GB', serialNumber: 'F182X93MD81', assignedStaffId: 'staff-1', purchaseDate: '2024-11-20', status: 'active', value: 999 },
      { id: 'hw-4', assetTag: 'HUM-MN-078', category: 'monitor', brand: 'LG', model: '27" UltraFine 4K', serialNumber: 'LG27U882193', assignedStaffId: 'staff-3', purchaseDate: '2025-01-08', status: 'active', value: 450 },
      { id: 'hw-5', assetTag: 'HUM-LP-043', category: 'laptop', brand: 'Apple', model: 'MacBook Air 13" M2', serialNumber: 'C02GL12YMD5N', assignedStaffId: '', purchaseDate: '2025-08-01', status: 'stored', value: 1099 }
    ];
  });

  const saveHardwareToStorage = (newAssets: HardwareAsset[]) => {
    setHardwareAssets(newAssets);
    try {
      localStorage.setItem('bm-hardware-assets', JSON.stringify(newAssets));
    } catch {}
  };

  // Compile unified list
  const unifiedList = useMemo(() => {
    const list: any[] = [];

    // 1. SaaS / Software Contracts
    const softwareContracts = contracts.filter(c => {
      const v = vendors.find(vend => vend.id === c.vendorId);
      return v && (v.category === 'Software License' || v.category === 'SaaS' || c.category === 'software');
    });

    softwareContracts.forEach(c => {
      const assigned = assetAssignments.filter(a => a.contractId === c.id);
      const matchedComp = companies.find(comp => comp.id === c.companyId);
      const vendor = vendors.find(v => v.id === c.vendorId);
      const symbol = symbolMap[c.currency] || '£';

      list.push({
        id: c.id,
        name: c.name,
        type: 'SaaS License',
        categoryTag: 'software',
        vendorName: vendor ? vendor.name : 'Unknown',
        unitPrice: c.unitCost || 0,
        currencySymbol: symbol,
        costInterval: c.costInterval || 'monthly',
        poolSize: c.quantityPurchased || 0,
        assignedCount: assigned.length,
        companyName: matchedComp ? matchedComp.name : 'Group Company',
        companyId: c.companyId,
        assignments: assigned.map(a => {
          const s = staff.find(member => member.id === a.staffId);
          return {
            id: a.id,
            staffId: a.staffId,
            fullName: s ? s.fullName : `ID "${a.staffId}"`,
            email: a.email || s?.businessEmail || 'N/A',
            notes: a.notes || '',
            date: a.assignedDate || 'N/A'
          };
        })
      });
    });

    // 2. Hardware Assets
    hardwareAssets.forEach(hw => {
      const matchedStaff = staff.find(s => s.id === hw.assignedStaffId);
      // Try to match the vendor if Apple/Dell etc.
      const vendorName = hw.brand || 'Hardware Vendor';

      list.push({
        id: hw.id,
        name: `${hw.brand} ${hw.model} (${hw.assetTag})`,
        type: `Hardware (${hw.category})`,
        categoryTag: 'hardware',
        vendorName: vendorName,
        unitPrice: hw.value,
        currencySymbol: '£', // physical hardware value is tracked in local currency £
        costInterval: 'one-time',
        poolSize: 1,
        assignedCount: hw.assignedStaffId ? 1 : 0,
        companyName: matchedStaff ? (companies.find(c => c.id === matchedStaff.companyId)?.name || 'Group') : 'In Storage',
        companyId: matchedStaff ? matchedStaff.companyId : 'stored',
        assignments: hw.assignedStaffId ? [{
          id: `hw-ass-${hw.id}`,
          staffId: hw.assignedStaffId,
          fullName: matchedStaff ? matchedStaff.fullName : 'Assigned',
          email: matchedStaff?.businessEmail || 'N/A',
          notes: `Serial: ${hw.serialNumber}`,
          date: hw.purchaseDate || 'N/A'
        }] : []
      });
    });

    return list;
  }, [contracts, vendors, companies, assetAssignments, staff, hardwareAssets]);

  // Filter unified list
  const filteredList = useMemo(() => {
    return unifiedList.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.assignments.some((a: any) => a.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = filterCategory === 'all' || item.categoryTag === filterCategory;
      const matchCompany = filterCompanyId === 'all' || item.companyId === filterCompanyId;

      return matchSearch && matchCategory && matchCompany;
    });
  }, [unifiedList, searchTerm, filterCategory, filterCompanyId]);

  // Handle assigning seat or hardware
  const handleAssignAsset = async (itemId: string, categoryTag: 'software' | 'hardware') => {
    if (!assigneeStaffId) {
      onShowToast("Please select a staff member to assign.", "warning");
      return;
    }

    const matchedStaff = staff.find(s => s.id === assigneeStaffId);
    if (!matchedStaff) return;

    if (categoryTag === 'software') {
      // Allocate seat in assetAssignments
      try {
        const newAssignment = {
          id: `ass-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          contractId: itemId,
          staffId: assigneeStaffId,
          assignedDate: new Date().toISOString().split('T')[0],
          email: assigneeEmail.trim() || matchedStaff.businessEmail || '',
          notes: assigneeNotes.trim() || ''
        };
        await onSaveAssetAssignment(newAssignment);
        onShowToast(`Assigned license seat to ${matchedStaff.fullName} successfully.`, "success");
        
        // Reset inputs
        setAssigneeStaffId('');
        setAssigneeEmail('');
        setAssigneeNotes('');
      } catch (err: any) {
        onShowToast(`Error assigning license: ${err.message}`, "warning");
      }
    } else {
      // Assign physical hardware
      const updatedHardware = hardwareAssets.map(hw => {
        if (hw.id === itemId) {
          return {
            ...hw,
            assignedStaffId: assigneeStaffId,
            status: 'active' as const
          };
        }
        return hw;
      });
      saveHardwareToStorage(updatedHardware);
      onShowToast(`Assigned hardware device to ${matchedStaff.fullName} successfully.`, "success");
      
      setAssigneeStaffId('');
    }
  };

  // Handle unassigning seat or hardware
  const handleUnassignAsset = async (assignmentId: string, itemId: string, categoryTag: 'software' | 'hardware') => {
    if (window.confirm("Are you sure you want to release this asset assignment?")) {
      if (categoryTag === 'software') {
        try {
          await onDeleteAssetAssignment(assignmentId);
          onShowToast("Released license seat successfully.", "info");
        } catch (err: any) {
          onShowToast(`Error releasing seat: ${err.message}`, "warning");
        }
      } else {
        const updatedHardware = hardwareAssets.map(hw => {
          if (hw.id === itemId) {
            return {
              ...hw,
              assignedStaffId: '',
              status: 'stored' as const
            };
          }
          return hw;
        });
        saveHardwareToStorage(updatedHardware);
        onShowToast("Hardware device unassigned and returned to storage.", "info");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and Filters controls */}
      <div className="controls-row" style={{ marginTop: 0, paddingBottom: '10px' }}>
        <div className="search-filter-group" style={{ flex: 1 }}>
          
          {/* Search Box */}
          <div className="search-input-wrapper" style={{ flex: 1.5 }}>
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search assets, vendors, assigned employees..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <select 
            className="select-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
          >
            <option value="all">All Asset Types</option>
            <option value="software">💻 SaaS & Software Licenses</option>
            <option value="hardware">🔌 Hardware Inventory</option>
          </select>

          {/* Company Filter */}
          <select 
            className="select-filter"
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
          >
            <option value="all">All Owner Companies</option>
            <option value="stored">📦 Unassigned/In Storage</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

        </div>
      </div>

      {/* Main Consolidated Table */}
      <div className="detail-section" style={{ padding: '0px', marginBottom: 0, overflow: 'hidden' }}>
        {filteredList.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No SaaS licenses or physical hardware assets found matching your criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="payroll-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Asset / License Name</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Vendor</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Unit Price</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Interval</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>Allocation Status</th>
                  <th style={{ textAlign: 'left', padding: '12px' }}>Company Billed</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(item => {
                  const isExpanded = expandedRowId === item.id;
                  const percentAssigned = item.poolSize > 0 ? (item.assignedCount / item.poolSize) * 100 : 0;
                  
                  return (
                    <React.Fragment key={item.id}>
                      
                      {/* Main Asset Row */}
                      <tr 
                        onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                        style={{ 
                          borderBottom: '1px solid var(--border-color)', 
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontWeight: 600,
                            backgroundColor: item.categoryTag === 'software' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: item.categoryTag === 'software' ? 'var(--primary)' : 'var(--success)'
                          }}>
                            {item.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.vendorName}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {item.currencySymbol}{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {item.costInterval}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {item.categoryTag === 'software' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: item.assignedCount === item.poolSize ? 'var(--success)' : 'var(--warning)' }}>
                                {item.assignedCount} / {item.poolSize} Seats
                              </span>
                              <div style={{ width: '80px', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${percentAssigned}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                              </div>
                            </div>
                          ) : (
                            <span style={{ 
                              fontWeight: 700, 
                              color: item.assignedCount > 0 ? 'var(--primary)' : 'var(--text-muted)'
                            }}>
                              {item.assignedCount > 0 ? 'Assigned' : 'In Storage'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.companyName}</td>
                      </tr>

                      {/* Expanded Section: Assignments & Operations (1-Click Reveal!) */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.015)' }}>
                          <td colSpan={8} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              
                              {/* Subtitle */}
                              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)' }}>
                                  👤 Active Seat / Device Assignments
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {item.assignments.length} total active users
                                </span>
                              </div>

                              {/* Assignments List */}
                              {item.assignments.length === 0 ? (
                                <div style={{ padding: '10px 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No employees are currently assigned to this asset.
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                                  {item.assignments.map((ass: any) => (
                                    <div 
                                      key={ass.id} 
                                      style={{ 
                                        backgroundColor: 'var(--bg-card)', 
                                        border: '1px solid var(--border-color)', 
                                        padding: '10px 14px', 
                                        borderRadius: '6px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ass.fullName}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{ass.email}</div>
                                        {ass.notes && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>Note: {ass.notes}</div>}
                                      </div>
                                      
                                      <button 
                                        type="button"
                                        onClick={() => handleUnassignAsset(ass.id, item.id, item.categoryTag)}
                                        className="btn-icon delete"
                                        style={{ width: '28px', height: '28px', padding: 0 }}
                                        title="Release Asset"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Form to Assign New Seat / Device (2-Clicks Assignment!) */}
                              {((item.categoryTag === 'software' && item.assignedCount < item.poolSize) || (item.categoryTag === 'hardware' && item.assignedCount === 0)) && (
                                <div 
                                  style={{ 
                                    backgroundColor: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    padding: '12px 16px', 
                                    borderRadius: '8px',
                                    marginTop: '8px'
                                  }}
                                >
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <UserPlus size={12} /> Assign a New Seat / Device to Staff
                                  </div>

                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
                                    
                                    {/* Select Staff */}
                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Select Employee</label>
                                      <select
                                        className="select-filter"
                                        value={assigneeStaffId}
                                        onChange={(e) => setAssigneeStaffId(e.target.value)}
                                        style={{ width: '100%', padding: '6px' }}
                                      >
                                        <option value="">-- Choose Employee --</option>
                                        {staff
                                          .filter(s => s.status !== 'exited')
                                          .map(s => (
                                            <option key={s.id} value={s.id}>{s.fullName} ({s.department || 'No Dept'})</option>
                                          ))
                                        }
                                      </select>
                                    </div>

                                    {/* Email Alias (Only for Software licenses) */}
                                    {item.categoryTag === 'software' && (
                                      <div style={{ flex: 1.2, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Alias (Optional)</label>
                                        <input
                                          type="email"
                                          className="form-input"
                                          placeholder="e.g. licensing@company.com"
                                          value={assigneeEmail}
                                          onChange={(e) => setAssigneeEmail(e.target.value)}
                                          style={{ padding: '6px 10px', width: '100%', fontSize: '12px' }}
                                        />
                                      </div>
                                    )}

                                    {/* Notes (Only for Software licenses) */}
                                    {item.categoryTag === 'software' && (
                                      <div style={{ flex: 1.2, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Allocation Notes (Optional)</label>
                                        <input
                                          type="text"
                                          className="form-input"
                                          placeholder="e.g. Sales team seat allocation"
                                          value={assigneeNotes}
                                          onChange={(e) => setAssigneeNotes(e.target.value)}
                                          style={{ padding: '6px 10px', width: '100%', fontSize: '12px' }}
                                        />
                                      </div>
                                    )}

                                    {/* Assign Trigger Button (2nd Click!) */}
                                    <button
                                      type="button"
                                      onClick={() => handleAssignAsset(item.id, item.categoryTag)}
                                      className="btn-primary"
                                      style={{ padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}
                                    >
                                      <Plus size={12} /> Assign Asset
                                    </button>
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
