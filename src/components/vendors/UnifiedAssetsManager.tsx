import React, { useState, useMemo } from 'react';
import { Company, Staff, Vendor } from '../../types';
import { Search, Building2, User, Plus, Trash2, ChevronDown, ChevronUp, UserPlus, Info, Check, Percent, Settings } from 'lucide-react';
import { symbolMap, getSplitProRataShares } from './shared';

interface Split {
  type: 'company' | 'department' | 'user';
  targetId: string;
  percentage: number;
}

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
  onSaveContract: (contract: any) => Promise<any>;
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
  onSaveContract,
  onShowToast
}: UnifiedAssetsManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'software' | 'hardware'>('all');
  const [filterCompanyId, setFilterCompanyId] = useState('all');
  
  // Track expanded row
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Quick inline assign dropdown inputs
  const [assigneeStaffId, setAssigneeStaffId] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState('');
  const [assigneeNotes, setAssigneeNotes] = useState('');

  // Cost splits editing panel visibility toggle per row
  const [showSplitsEditor, setShowSplitsEditor] = useState(false);

  // Load hardware assets
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

  // Build list
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

      // Load cost splits
      const rawSplits = c.splits || [];
      const resolvedSplits = c.useHeadcountSplit
        ? getSplitProRataShares(staff, rawSplits, new Date().getFullYear(), new Date().getMonth())
        : rawSplits;

      list.push({
        id: c.id,
        rawContract: c,
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
        useHeadcountSplit: !!c.useHeadcountSplit,
        splits: resolvedSplits,
        rawSplitsList: rawSplits,
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
      const vendorName = hw.brand || 'Hardware Vendor';

      list.push({
        id: hw.id,
        rawContract: null,
        name: `${hw.brand} ${hw.model} (${hw.assetTag})`,
        type: `Hardware (${hw.category})`,
        categoryTag: 'hardware',
        vendorName: vendorName,
        unitPrice: hw.value,
        currencySymbol: '£',
        costInterval: 'one-time',
        poolSize: 1,
        assignedCount: hw.assignedStaffId ? 1 : 0,
        companyName: matchedStaff ? (companies.find(c => c.id === matchedStaff.companyId)?.name || 'Group') : 'In Storage',
        companyId: matchedStaff ? matchedStaff.companyId : 'stored',
        useHeadcountSplit: false,
        splits: [],
        rawSplitsList: [],
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

  // Filtered List
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

  // Handle assigning asset
  const handleAssignAsset = async (itemId: string, categoryTag: 'software' | 'hardware') => {
    if (!assigneeStaffId) {
      onShowToast("Please select a staff member to assign.", "warning");
      return;
    }

    const matchedStaff = staff.find(s => s.id === assigneeStaffId);
    if (!matchedStaff) return;

    if (categoryTag === 'software') {
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
        setAssigneeStaffId('');
        setAssigneeEmail('');
        setAssigneeNotes('');
      } catch (err: any) {
        onShowToast(`Error assigning license: ${err.message}`, "warning");
      }
    } else {
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

  // Handle unassigning asset
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

  // Update cost split values in 1 click!
  const handleToggleSplitTarget = async (contract: any, type: 'company' | 'department' | 'user', targetId: string) => {
    const currentSplits = contract.splits || [];
    const exists = currentSplits.some((s: any) => s.type === type && s.targetId === targetId);
    let updatedSplits: Split[] = [];

    if (exists) {
      updatedSplits = currentSplits.filter((s: any) => !(s.type === type && s.targetId === targetId));
    } else {
      updatedSplits = [...currentSplits, { type, targetId, percentage: 0 }];
    }

    const updatedContract = {
      ...contract,
      splits: updatedSplits
    };

    try {
      await onSaveContract(updatedContract);
      onShowToast("Apportionment target toggled.", "success");
    } catch (err: any) {
      onShowToast("Error updating splits: " + err.message, "warning");
    }
  };

  const handleUpdateSplitPercentage = async (contract: any, type: 'company' | 'department' | 'user', targetId: string, value: number) => {
    const currentSplits = contract.splits || [];
    const updatedSplits = currentSplits.map((s: any) => {
      if (s.type === type && s.targetId === targetId) {
        return { ...s, percentage: value };
      }
      return s;
    });

    const total = updatedSplits.reduce((sum: number, item: any) => sum + item.percentage, 0);
    if (total > 100) {
      onShowToast(`Percentage exceeds 100% limit (total is ${total}%).`, "warning");
      return;
    }

    const updatedContract = {
      ...contract,
      splits: updatedSplits
    };

    try {
      await onSaveContract(updatedContract);
    } catch (err: any) {
      onShowToast("Error updating percentage: " + err.message, "warning");
    }
  };

  const handleToggleHeadcountSplit = async (contract: any, useHeadcount: boolean) => {
    const updatedContract = {
      ...contract,
      useHeadcountSplit: useHeadcount
    };
    try {
      await onSaveContract(updatedContract);
      onShowToast(useHeadcount ? "Dynamic headcount splitting active." : "Manual percentage splits active.", "success");
    } catch (err: any) {
      onShowToast("Error changing split mode: " + err.message, "warning");
    }
  };

  // Get active departments list
  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        if (d.name) depts.add(d.name);
      });
    });
    ['Operations', 'Sales', 'Admin', 'Recruitment', 'Accounts'].forEach(d => depts.add(d));
    return Array.from(depts).sort();
  }, [companies]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and Filters controls */}
      <div className="controls-row" style={{ marginTop: 0, paddingBottom: '10px' }}>
        <div className="search-filter-group" style={{ flex: 1 }}>
          
          <div className="search-input-wrapper" style={{ flex: 1.5 }}>
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search assets, accounts splits, or assigned staff..." 
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
          >
            <option value="all">All Asset Types</option>
            <option value="software">💻 SaaS & Software Licenses</option>
            <option value="hardware">🔌 Hardware Inventory</option>
          </select>

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
            No assets or physical hardware inventory records found.
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
                  <th style={{ textAlign: 'left', padding: '12px' }}>Apportioned Accounts (Splits)</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(item => {
                  const isExpanded = expandedRowId === item.id;
                  const percentAssigned = item.poolSize > 0 ? (item.assignedCount / item.poolSize) * 100 : 0;
                  
                  // Compute simple textual list of splits for quick visual overview (Zero clicks!)
                  const splitsTextList = item.splits.map((s: any) => {
                    let targetName = s.targetId;
                    if (s.type === 'company') {
                      targetName = companies.find(c => c.id === s.targetId)?.name || s.targetId;
                    } else if (s.type === 'user') {
                      targetName = staff.find(st => st.id === s.targetId)?.fullName || s.targetId;
                    }
                    return `${targetName} (${s.percentage}%)`;
                  });

                  return (
                    <React.Fragment key={item.id}>
                      
                      {/* Main Row */}
                      <tr 
                        onClick={() => {
                          setExpandedRowId(isExpanded ? null : item.id);
                          setShowSplitsEditor(false);
                        }}
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
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {item.categoryTag === 'software' ? (
                            splitsTextList.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {splitsTextList.map((txt: string, idx: number) => (
                                  <span key={idx} style={{ 
                                    fontSize: '9.5px', 
                                    backgroundColor: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                  }}>
                                    {txt}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                                Global Apportionment (Headcount)
                              </span>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Billed to assigned staff company ({item.companyName})
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Section (Seat assignments + Apportionments) */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.01)' }}>
                          <td colSpan={8} style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              
                              {/* 1. SEAT ASSIGNMENTS */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)' }}>
                                    💻 User Seats / Device Allocations
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {item.assignments.length} active seat(s)
                                  </span>
                                </div>

                                {item.assignments.length === 0 ? (
                                  <div style={{ padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No staff member is currently assigned to this seat.
                                  </div>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnassignAsset(ass.id, item.id, item.categoryTag);
                                          }}
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

                                {/* Assign Seat Trigger Form */}
                                {((item.categoryTag === 'software' && item.assignedCount < item.poolSize) || (item.categoryTag === 'hardware' && item.assignedCount === 0)) && (
                                  <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '8px', marginTop: '4px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <UserPlus size={12} /> Allocate Seat to Employee
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
                                      <div style={{ flex: 1, minWidth: '180px' }}>
                                        <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Select Employee</label>
                                        <select
                                          className="select-filter"
                                          value={assigneeStaffId}
                                          onChange={(e) => setAssigneeStaffId(e.target.value)}
                                          style={{ width: '100%', padding: '6px' }}
                                        >
                                          <option value="">-- Choose Employee --</option>
                                          {staff.filter(s => s.status !== 'exited').map(s => (
                                            <option key={s.id} value={s.id}>{s.fullName} ({s.department || 'No Dept'})</option>
                                          ))}
                                        </select>
                                      </div>
                                      {item.categoryTag === 'software' && (
                                        <>
                                          <div style={{ flex: 1.2, minWidth: '180px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Alias (Optional)</label>
                                            <input
                                              type="email"
                                              className="form-input"
                                              placeholder="e.g. email@alias.com"
                                              value={assigneeEmail}
                                              onChange={(e) => setAssigneeEmail(e.target.value)}
                                              style={{ padding: '6px 10px', width: '100%', fontSize: '12px' }}
                                            />
                                          </div>
                                          <div style={{ flex: 1.2, minWidth: '180px' }}>
                                            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Notes</label>
                                            <input
                                              type="text"
                                              className="form-input"
                                              placeholder="Allocated notes"
                                              value={assigneeNotes}
                                              onChange={(e) => setAssigneeNotes(e.target.value)}
                                              style={{ padding: '6px 10px', width: '100%', fontSize: '12px' }}
                                            />
                                          </div>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleAssignAsset(item.id, item.categoryTag)}
                                        className="btn-primary"
                                        style={{ padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}
                                      >
                                        <Plus size={12} /> Assign
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 2. COST APPORTIONMENT / COST SPLITS (Only for Software licenses/contracts) */}
                              {item.categoryTag === 'software' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      💰 Cost Splits & Accounts Apportionment
                                    </span>
                                    
                                    {/* Apportionment Mode Select */}
                                    <div style={{ display: 'flex', gap: '4px', padding: '3px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleHeadcountSplit(item.rawContract, true)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '10px',
                                          border: 'none',
                                          borderRadius: '4px',
                                          backgroundColor: item.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                          color: item.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                          cursor: 'pointer',
                                          fontWeight: 600
                                        }}
                                      >
                                        👥 Dynamic Headcount
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleHeadcountSplit(item.rawContract, false)}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '10px',
                                          border: 'none',
                                          borderRadius: '4px',
                                          backgroundColor: !item.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                          color: !item.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                          cursor: 'pointer',
                                          fontWeight: 600
                                        }}
                                      >
                                        ⚙️ Manual Percentage
                                      </button>
                                    </div>
                                  </div>

                                  {/* Apportioned Cost visual progress bars */}
                                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Apportioned Monthly Cost Breakdown</span>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        Total contract cost: <strong>{item.currencySymbol}{(item.unitPrice * (item.poolSize || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}/mo</strong>
                                      </span>
                                    </div>

                                    {item.splits.length === 0 ? (
                                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                                        ℹ️ Cost is distributed globally across all companies based on total headcount.
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {item.splits.map((s: any, idx: number) => {
                                          let targetName = s.targetId;
                                          if (s.type === 'company') {
                                            targetName = companies.find(c => c.id === s.targetId)?.name || s.targetId;
                                          } else if (s.type === 'department') {
                                            targetName = s.targetId;
                                          } else if (s.type === 'user') {
                                            targetName = staff.find(st => st.id === s.targetId)?.fullName || s.targetId;
                                          }
                                          const costShare = (item.unitPrice * (item.poolSize || 1) * s.percentage) / 100;

                                          return (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                  {s.type === 'company' ? '🏢' : s.type === 'department' ? '📂' : '👤'} {targetName}
                                                </span>
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                  {item.currencySymbol}{costShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}/mo ({s.percentage}%)
                                                </span>
                                              </div>
                                              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${s.percentage}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Action button to expand inline targets list */}
                                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowSplitsEditor(!showSplitsEditor);
                                        }}
                                        className="btn-secondary"
                                        style={{ fontSize: '10.5px', padding: '4px 10px', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Settings size={12} /> {showSplitsEditor ? 'Close Split Target Settings' : 'Edit Apportionment Targets'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Apportionment Checklist Editor (1-Click toggle!) */}
                                  {showSplitsEditor && (
                                    <div 
                                      style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 1fr 1fr', 
                                        gap: '16px', 
                                        backgroundColor: 'var(--bg-card)', 
                                        padding: '16px', 
                                        borderRadius: '8px', 
                                        border: '1px solid var(--border-color)',
                                        animation: 'slideDown 0.2s ease-out'
                                      }}
                                    >
                                      {/* COMPANIES COLUMN */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>🏢 Companies</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                          {companies.map(c => {
                                            const isChecked = item.rawSplitsList.some((s: any) => s.type === 'company' && s.targetId === c.id);
                                            const splitItem = item.rawSplitsList.find((s: any) => s.type === 'company' && s.targetId === c.id);
                                            return (
                                              <div 
                                                key={c.id} 
                                                onClick={() => handleToggleSplitTarget(item.rawContract, 'company', c.id)}
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  justifyContent: 'space-between', 
                                                  padding: '6px 8px', 
                                                  borderRadius: '6px',
                                                  backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                                  border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                  cursor: 'pointer',
                                                  fontSize: '11px',
                                                  transition: 'all 0.15s'
                                                }}
                                              >
                                                <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--primary)' : 'var(--text-primary)' }}>{c.name}</span>
                                                {isChecked && (
                                                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {!item.useHeadcountSplit ? (
                                                      <input
                                                        type="number"
                                                        value={splitItem?.percentage || 0}
                                                        onChange={(e) => handleUpdateSplitPercentage(item.rawContract, 'company', c.id, Number(e.target.value))}
                                                        style={{ width: '42px', padding: '2px', fontSize: '10px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                      />
                                                    ) : (
                                                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}>Auto</span>
                                                    )}
                                                    <Check size={12} style={{ color: 'var(--primary)' }} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* DEPARTMENTS COLUMN */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>📂 Departments</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                          {departmentsList.map(dept => {
                                            const isChecked = item.rawSplitsList.some((s: any) => s.type === 'department' && s.targetId === dept);
                                            const splitItem = item.rawSplitsList.find((s: any) => s.type === 'department' && s.targetId === dept);
                                            return (
                                              <div 
                                                key={dept} 
                                                onClick={() => handleToggleSplitTarget(item.rawContract, 'department', dept)}
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  justifyContent: 'space-between', 
                                                  padding: '6px 8px', 
                                                  borderRadius: '6px',
                                                  backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                                  border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                  cursor: 'pointer',
                                                  fontSize: '11px',
                                                  transition: 'all 0.15s'
                                                }}
                                              >
                                                <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--primary)' : 'var(--text-primary)' }}>{dept}</span>
                                                {isChecked && (
                                                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {!item.useHeadcountSplit ? (
                                                      <input
                                                        type="number"
                                                        value={splitItem?.percentage || 0}
                                                        onChange={(e) => handleUpdateSplitPercentage(item.rawContract, 'department', dept, Number(e.target.value))}
                                                        style={{ width: '42px', padding: '2px', fontSize: '10px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                      />
                                                    ) : (
                                                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}>Auto</span>
                                                    )}
                                                    <Check size={12} style={{ color: 'var(--primary)' }} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* STAFF USERS COLUMN */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>👤 Staff Users</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                          {staff.filter(s => s.status !== 'exited').map(st => {
                                            const isChecked = item.rawSplitsList.some((s: any) => s.type === 'user' && s.targetId === st.id);
                                            const splitItem = item.rawSplitsList.find((s: any) => s.type === 'user' && s.targetId === st.id);
                                            return (
                                              <div 
                                                key={st.id} 
                                                onClick={() => handleToggleSplitTarget(item.rawContract, 'user', st.id)}
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  justifyContent: 'space-between', 
                                                  padding: '6px 8px', 
                                                  borderRadius: '6px',
                                                  backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                                  border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                  cursor: 'pointer',
                                                  fontSize: '11px',
                                                  transition: 'all 0.15s'
                                                }}
                                              >
                                                <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--primary)' : 'var(--text-primary)' }}>{st.fullName}</span>
                                                {isChecked && (
                                                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {!item.useHeadcountSplit ? (
                                                      <input
                                                        type="number"
                                                        value={splitItem?.percentage || 0}
                                                        onChange={(e) => handleUpdateSplitPercentage(item.rawContract, 'user', st.id, Number(e.target.value))}
                                                        style={{ width: '42px', padding: '2px', fontSize: '10px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                                      />
                                                    ) : (
                                                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700 }}>Auto</span>
                                                    )}
                                                    <Check size={12} style={{ color: 'var(--primary)' }} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                    </div>
                                  )}

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
