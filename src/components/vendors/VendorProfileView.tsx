import React from 'react';
import { Mail, Phone, Building2, Plus, Edit3, Trash2, ArrowLeft } from 'lucide-react';
import { Company, Staff, Vendor } from '../../types';
import { symbolMap } from './shared';

interface VendorProfileViewProps {
  vendorId: string;
  vendors: Vendor[];
  contracts: any[];
  staff: Staff[];
  companies: Company[];
  assetAssignments: any[];
  onBack: () => void;
  onEditVendor: (v: Vendor) => void;
  onDeleteVendor: (id: string) => Promise<any>;
  onEditContract: (contract: any) => void;
  onDeleteContract: (id: string) => Promise<any>;
  onSaveAssetAssignment: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function VendorProfileView({
  vendorId,
  vendors,
  contracts,
  staff,
  companies,
  assetAssignments,
  onBack,
  onEditVendor,
  onDeleteVendor,
  onEditContract,
  onDeleteContract,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast
}: VendorProfileViewProps) {
  const vendor = vendors.find(v => v.id === vendorId);

  React.useEffect(() => {
    if (!vendor) {
      onBack();
    }
  }, [vendor, onBack]);

  if (!vendor) {
    return null;
  }

  const vendorContracts = contracts.filter(c => c.vendorId === vendor.id);

  // Handle inline seat allocation
  const handleAllocateSeatInline = async (e: React.FormEvent<HTMLFormElement>, contractId: string, contractName: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const staffId = (form.elements.namedItem('staffSelect') as HTMLSelectElement)?.value;
    const qty = parseInt((form.elements.namedItem('quantityInput') as HTMLInputElement)?.value || '1', 10);
    const email = (form.elements.namedItem('emailInput') as HTMLInputElement)?.value || '';
    const notes = (form.elements.namedItem('notesInput') as HTMLInputElement)?.value || '';
    if (!staffId) return;

    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;

    try {
      for (let i = 0; i < qty; i++) {
        const newAssignment = {
          id: `ass-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          contractId: contractId,
          staffId: staffId,
          assignedDate: new Date().toISOString().split('T')[0],
          email: qty === 1 ? email : (email ? `${email} (Seat ${i + 1})` : ''),
          notes: qty === 1 ? notes : (notes ? `${notes} (Seat ${i + 1})` : '')
        };
        await onSaveAssetAssignment(newAssignment);
      }
      onShowToast(`Assigned ${qty} seat(s) of "${contractName}" to ${staffMember.fullName}.`, 'success');
      form.reset();
    } catch (err: any) {
      onShowToast(`Error allocating seat: ${err.message}`, 'warning');
    }
  };

  // Handle inline seat release
  const handleReleaseSeat = async (assignmentId: string, contractName: string, staffName: string) => {
    if (window.confirm(`Are you sure you want to release the "${contractName}" license seat from ${staffName}?`)) {
      try {
        await onDeleteAssetAssignment(assignmentId);
        onShowToast(`Released "${contractName}" seat for ${staffName} back to pool.`, 'info');
      } catch (err: any) {
        onShowToast(`Error releasing seat: ${err.message}`, 'warning');
      }
    }
  };

  // Handle updating allocation fields inline (email or notes)
  const handleUpdateAssignmentField = async (assignmentId: string, field: 'email' | 'notes', value: string) => {
    const assignment = assetAssignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    if (assignment[field] === value) return;

    const updated = {
      ...assignment,
      [field]: value
    };

    try {
      await onSaveAssetAssignment(updated);
      onShowToast(`Updated seat ${field} successfully.`, 'success');
    } catch (err: any) {
      onShowToast(`Error updating seat ${field}: ${err.message}`, 'warning');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.2s' }}>
      
      {/* Header / Back Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn-secondary" 
          onClick={onBack}
          style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} /> Back to Vendor Directory
        </button>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => onEditVendor(vendor)} title="Edit Vendor Details">
            <Edit3 size={14} /> Edit Partner
          </button>
          <button className="btn-secondary delete" onClick={() => {
            if (window.confirm(`Are you sure you want to delete vendor "${vendor.name}"?`)) {
              onDeleteVendor(vendor.id);
              onShowToast(`Deleted vendor "${vendor.name}"`, "info");
              onBack();
            }
          }} title="Delete Vendor Partner">
            <Trash2 size={14} /> Delete Partner
          </button>
        </div>
      </div>

      {/* Vendor Details Card */}
      <div className="entity-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--primary)', height: 'auto' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{vendor.name}</h2>
          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{vendor.category}</span>
        </div>
        {vendor.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
            {vendor.description}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
          {vendor.contactEmail && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={12} />
              <strong>Email:</strong> <a href={`mailto:${vendor.contactEmail}`} style={{ color: 'var(--accent)' }}>{vendor.contactEmail}</a>
            </span>
          )}
          {vendor.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={12} />
              <strong>Phone:</strong> <a href={`tel:${vendor.phone}`} style={{ color: 'var(--accent)' }}>{vendor.phone}</a>
            </span>
          )}
          <span>
            <strong>Active Contracts:</strong> {vendorContracts.length}
          </span>
        </div>
      </div>

      {/* Contracts & Licenses list */}
      <div className="detail-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Building2 size={16} /> Contracts & Landlord Leases ({vendorContracts.length})
          </h3>
          <button 
            className="btn-primary" 
            onClick={() => onEditContract({ vendorId: vendor.id })}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Plus size={14} /> Register New Contract
          </button>
        </div>

        {/* List of Contracts */}
        {vendorContracts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
            No active contracts or leases registered under this vendor partner.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {vendorContracts.map(c => {
              const assigned = assetAssignments.filter(a => a.contractId === c.id);
              const assignedCount = assigned.length;
              const unusedCount = Math.max(0, c.quantityPurchased - assignedCount);
              const symbol = symbolMap[c.currency] || '£';
              const taxFactor = 1 + ((c.taxRate || 0) / 100);
              const costPerSeatWithTax = c.unitCost * taxFactor;
              const unusedCostWithTax = unusedCount * costPerSeatWithTax;
              const matchedCompany = companies.find(comp => comp.id === c.companyId);

              return (
                <div key={c.id} className="entity-card" style={{ height: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{c.name}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Billed to: <strong>{matchedCompany ? matchedCompany.name : 'Group'}</strong> &bull; Cost: <strong>{symbol}{c.unitCost}/mo</strong> {c.taxRate > 0 && `(+${c.taxRate}% VAT)`} &bull; Qty: <strong>{c.quantityPurchased}</strong>
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>
                          Unused: {symbol}{unusedCostWithTax.toFixed(2)}/mo
                        </span>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {unusedCount} unallocated seats
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => onEditContract(c)} title="Edit Contract details">
                        <Edit3 size={11} />
                      </button>
                      <button className="btn-icon delete" onClick={() => {
                        if (window.confirm(`Are you sure you want to delete contract "${c.name}"?`)) {
                          onDeleteContract(c.id);
                          onShowToast(`Deleted contract "${c.name}"`, "info");
                        }
                      }} title="Delete Contract">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* If seat pool */}
                  {c.quantityPurchased > 1 && (
                    <div>
                      {/* Progress bar */}
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (assignedCount / c.quantityPurchased) * 100)}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <span><strong>{assignedCount} Assigned</strong></span>
                        <span><strong>{c.quantityPurchased} Seats Total</strong></span>
                      </div>

                      {/* Assignments Grid */}
                      {assigned.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 40px', gap: '8px', padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            <div>Staff Member</div>
                            <div>Email / Alias</div>
                            <div>Notes</div>
                            <div style={{ textAlign: 'center' }}>Release</div>
                          </div>
                          {assigned.map(a => {
                            const member = staff.find(s => s.id === a.staffId);
                            if (!member) return null;
                            return (
                              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 40px', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)', alignItems: 'center', fontSize: '11px' }}>
                                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{member.fullName}</div>
                                <div>
                                  <input 
                                    type="text" 
                                    placeholder="Enter Email/Alias" 
                                    defaultValue={a.email || ''} 
                                    onBlur={(e) => handleUpdateAssignmentField(a.id, 'email', e.target.value)}
                                    style={{ width: '100%', padding: '2px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                  />
                                </div>
                                <div>
                                  <input 
                                    type="text" 
                                    placeholder="Add notes..." 
                                    defaultValue={a.notes || ''} 
                                    onBlur={(e) => handleUpdateAssignmentField(a.id, 'notes', e.target.value)}
                                    style={{ width: '100%', padding: '2px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => handleReleaseSeat(a.id, c.name, member.fullName)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Allocate Seat Form */}
                      {unusedCount > 0 && (() => {
                        const activeStaffList = staff.filter(s => s.status !== 'exited');
                        if (activeStaffList.length === 0) return null;
                        const sortedStaffSingle = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                        return (
                          <form 
                            onSubmit={(e) => handleAllocateSeatInline(e, c.id, c.name)} 
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '4px', border: '1px dashed var(--border-color)', width: 'fit-content', flexWrap: 'wrap', marginTop: '10px' }}
                          >
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocate:</span>
                            <select name="staffSelect" className="select-filter" style={{ padding: '3px 6px', fontSize: '11px', minWidth: '130px' }} required>
                              <option value="">-- Choose Staff --</option>
                              {sortedStaffSingle.map(s => (
                                <option key={s.id} value={s.id}>{s.fullName}</option>
                              ))}
                            </select>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty:</span>
                            <input type="number" name="quantityInput" min="1" max={unusedCount} defaultValue="1" style={{ width: '45px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} required />
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email:</span>
                            <input type="text" name="emailInput" placeholder="Email/Alias" style={{ width: '100px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes:</span>
                            <input type="text" name="notesInput" placeholder="Notes..." style={{ width: '100px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                            <button type="submit" className="btn-primary" style={{ padding: '3px 8px', fontSize: '10px' }}>Assign</button>
                          </form>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
