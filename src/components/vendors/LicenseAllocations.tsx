import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Company, Staff, Vendor } from '../../types';
import { symbolMap } from './shared';

interface LicenseAllocationsProps {
  contracts: any[];
  vendors: Vendor[];
  companies: Company[];
  staff: Staff[];
  assetAssignments: any[];
  onSaveContract: (contract: any) => Promise<any>;
  onSaveAssetAssignment: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function LicenseAllocations({
  contracts,
  vendors,
  companies,
  staff,
  assetAssignments,
  onSaveContract,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast
}: LicenseAllocationsProps) {
  const [activeAllocId, setActiveAllocId] = useState<string | null>(null);

  const seatPoolContracts = React.useMemo(() => {
    return contracts.filter(c => {
      const v = vendors.find(vend => vend.id === c.vendorId);
      return v && v.category === 'Software License' && c.quantityPurchased >= 1;
    });
  }, [contracts, vendors]);

  const currentAllocContract = React.useMemo(() => {
    if (activeAllocId) {
      return seatPoolContracts.find(c => c.id === activeAllocId) || seatPoolContracts[0];
    }
    return seatPoolContracts[0];
  }, [activeAllocId, seatPoolContracts]);

  const allAvailableDepts = React.useMemo(() => {
    const deptSet = new Set<string>();
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        if (d.name) deptSet.add(d.name);
      });
    });
    ['Operations', 'Sales', 'Admin', 'Recruitment', 'Accounts'].forEach(d => deptSet.add(d));
    return Array.from(deptSet).sort();
  }, [companies]);

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
      onShowToast(`Assigned ${qty} license seat(s) of "${contractName}" to ${staffMember.fullName}.`, 'success');
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

  // Handle unused cost routing tags
  const handleUpdateUnusedTag = async (contractId: string, companyId: string, department: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const updatedContract = {
      ...contract,
      unusedCostTag: {
        companyId,
        department
      }
    };

    try {
      await onSaveContract(updatedContract);
      onShowToast("Updated unused seats overhead routing tag.", "success");
    } catch (err: any) {
      onShowToast(`Error updating routing tag: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>License Allocations Desk</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track license pool allocations, identify unassigned license overheads, and route unused seat costs to designated cost centers.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', minHeight: '600px', alignItems: 'flex-start' }}>
        {/* Left Sidebar: List of Seat Pool Contracts */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
          <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0, fontWeight: 700, letterSpacing: '0.5px' }}>
            License Pools ({seatPoolContracts.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '4px' }}>
            {seatPoolContracts.map(c => {
              const assigned = assetAssignments.filter(a => a.contractId === c.id);
              const assignedCount = assigned.length;
              const isSelected = currentAllocContract && currentAllocContract.id === c.id;
              const matchedComp = companies.find(comp => comp.id === c.companyId);

              return (
                <div 
                  key={c.id} 
                  onClick={() => setActiveAllocId(c.id)}
                  style={{ 
                    padding: '12px 14px', 
                    borderRadius: '8px', 
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ fontSize: '12px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: assignedCount === c.quantityPurchased ? 'var(--success)' : 'var(--warning)',
                      backgroundColor: assignedCount === c.quantityPurchased ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      {assignedCount}/{c.quantityPurchased}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Billed to: {matchedComp ? matchedComp.name : 'Group'}
                  </span>
                </div>
              );
            })}
            {seatPoolContracts.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No seat pool contracts registered.
              </span>
            )}
          </div>
        </div>

        {/* Right Panel: Detail view of selected contract */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {currentAllocContract ? (() => {
            const c = currentAllocContract;
            const assigned = assetAssignments.filter(a => a.contractId === c.id);
            const assignedCount = assigned.length;
            const unusedCount = Math.max(0, c.quantityPurchased - assignedCount);
            const symbol = symbolMap[c.currency] || '£';
            
            const taxFactor = 1 + ((c.taxRate || 0) / 100);
            const seatCostPerMonth = (c.costInterval === 'annual' ? (c.unitCost / 12) : (c.costInterval === 'one_time' || c.costInterval === 'one-off' ? 0 : c.unitCost));
            const costPerSeatWithTax = seatCostPerMonth * taxFactor;
            const unusedCostWithTax = unusedCount * costPerSeatWithTax;
            
            const matchedCompany = companies.find(comp => comp.id === c.companyId);

            return (
              <div className="entity-card" style={{ height: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{c.name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                      Billed to: <strong>{matchedCompany ? matchedCompany.name : 'Group'}</strong> &bull; Seat Cost: <strong>{symbol}{c.unitCost}/mo</strong> {c.taxRate > 0 && `(+${c.taxRate}% VAT)`}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--warning)' }}>
                      Unused cost: {symbol}{unusedCostWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                    </span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', alignItems: 'center' }}>
                    <span><strong>{assignedCount} Assigned</strong></span>
                    <span><strong>{c.quantityPurchased} Seats Total</strong></span>
                  </div>
                </div>

                {/* Assigned Users list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    Assigned Staff Users ({assignedCount})
                  </h4>
                  {assigned.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 60px', gap: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <div>Staff Member</div>
                        <div>Email / Alias</div>
                        <div>Notes</div>
                        <div style={{ textAlign: 'center' }}>Release</div>
                      </div>
                      <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        {assigned.map(a => {
                          const member = staff.find(s => s.id === a.staffId);
                          if (!member) return null;
                          return (
                            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 60px', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', fontSize: '12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{member.fullName}</div>
                              <div>
                                <input 
                                  type="text" 
                                  placeholder="Enter Email/Alias" 
                                  defaultValue={a.email || ''} 
                                  onBlur={(e) => handleUpdateAssignmentField(a.id, 'email', e.target.value)}
                                  style={{ width: '100%', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />
                              </div>
                              <div>
                                <input 
                                  type="text" 
                                  placeholder="Add notes (e.g. branch, role)" 
                                  defaultValue={a.notes || ''} 
                                  onBlur={(e) => handleUpdateAssignmentField(a.id, 'notes', e.target.value)}
                                  style={{ width: '100%', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button 
                                  onClick={() => handleReleaseSeat(a.id, c.name, member.fullName)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Release license seat"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No staff members assigned to this license pool.
                    </div>
                  )}
                </div>

                {/* Inline Allocate Seat Form */}
                {unusedCount > 0 && (() => {
                  const activeStaffList = staff.filter(s => s.status !== 'exited');
                  if (activeStaffList.length === 0) return null;
                  
                  const sortedStaffSingle = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                  return (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      <form 
                        onSubmit={(e) => handleAllocateSeatInline(e, c.id, c.name)} 
                        style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          alignItems: 'center', 
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px dashed var(--border-color)',
                          flexWrap: 'wrap',
                          flex: 1
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocate Seat:</span>
                        <select 
                          className="select-filter"
                          name="staffSelect"
                          style={{ padding: '6px 10px', fontSize: '12px', minWidth: '160px' }}
                          required
                        >
                          <option value="">-- Choose Staff --</option>
                          {sortedStaffSingle.map(s => {
                            const comp = companies.find(comp => comp.id === s.companyId);
                            return (
                              <option key={s.id} value={s.id}>
                                {s.fullName} ({comp ? comp.name : 'Group'})
                              </option>
                            );
                          })}
                        </select>
                        
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty:</span>
                        <input 
                          type="number" 
                          name="quantityInput"
                          min="1"
                          max={unusedCount}
                          defaultValue="1"
                          style={{ 
                            width: '55px', 
                            padding: '6px 8px', 
                            fontSize: '12px', 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-primary)', 
                            borderRadius: '4px' 
                          }}
                          required
                        />

                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email:</span>
                        <input 
                          type="text" 
                          name="emailInput"
                          placeholder="Email / Alias"
                          style={{ 
                            width: '140px', 
                            padding: '6px 8px', 
                            fontSize: '12px', 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-primary)', 
                            borderRadius: '4px' 
                          }}
                        />

                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes:</span>
                        <input 
                          type="text" 
                          name="notesInput"
                          placeholder="Add notes..."
                          style={{ 
                            width: '140px', 
                            padding: '6px 8px', 
                            fontSize: '12px', 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-color)', 
                            color: 'var(--text-primary)', 
                            borderRadius: '4px' 
                          }}
                        />

                        <button 
                          type="submit" 
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '11px' }}
                        >
                          Assign
                        </button>
                      </form>
                    </div>
                  );
                })()}

                {/* Unused cost account routing picker */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-secondary)', 
                  padding: '12px 16px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)',
                  gap: '16px',
                  marginTop: '10px'
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
                      onChange={(e) => handleUpdateUnusedTag(c.id, c.unusedCostTag?.companyId || companies[0]?.id || '', e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {allAvailableDepts.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            );
          })() : (
            <div style={{ padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
              Please select a license pool from the left panel to manage allocations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
