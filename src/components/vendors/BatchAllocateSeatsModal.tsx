import React, { useState } from 'react';
import { Company, Staff } from '../../types';

interface BatchAllocateSeatsModalProps {
  contract: any;
  onClose: () => void;
  staff: Staff[];
  companies: Company[];
  assetAssignments: any[];
  onSaveAssetAssignment: (assignment: any) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function BatchAllocateSeatsModal({
  contract,
  onClose,
  staff,
  companies,
  assetAssignments,
  onSaveAssetAssignment,
  onShowToast
}: BatchAllocateSeatsModalProps) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const assigned = assetAssignments.filter(a => a.contractId === contract.id);
  const assignedCount = assigned.length;
  const unusedCount = Math.max(0, contract.quantityPurchased - assignedCount);

  const nonAssignedStaff = staff.filter(s => s.status !== 'exited' && !assigned.some(a => a.staffId === s.id));
  
  // Group staff by company
  const staffByCompany = React.useMemo(() => {
    const groups: Record<string, Staff[]> = {};
    nonAssignedStaff.forEach(s => {
      const compId = s.companyId || 'group';
      if (!groups[compId]) {
        groups[compId] = [];
      }
      groups[compId].push(s);
    });
    return groups;
  }, [nonAssignedStaff]);

  // Map and sort companies
  const groupedCompanies = React.useMemo(() => {
    return Object.keys(staffByCompany).map(compId => {
      const comp = companies.find(c => c.id === compId);
      const compName = comp ? comp.name : 'Group / Other';
      const sortedUsers = staffByCompany[compId].sort((a, b) => a.fullName.localeCompare(b.fullName));
      return {
        id: compId,
        name: compName,
        users: sortedUsers
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [staffByCompany, companies]);

  const toggleStaffSelection = (staffId: string) => {
    if (selectedStaffIds.includes(staffId)) {
      setSelectedStaffIds(selectedStaffIds.filter(id => id !== staffId));
    } else {
      setSelectedStaffIds([...selectedStaffIds, staffId]);
    }
  };

  const toggleAllStaff = () => {
    const allUserIds = nonAssignedStaff.map(s => s.id);
    if (selectedStaffIds.length === allUserIds.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(allUserIds);
    }
  };

  const handleBatchAllocateSeats = async () => {
    if (selectedStaffIds.length === 0) {
      onShowToast("Please select at least one staff member.", "warning");
      return;
    }

    if (selectedStaffIds.length > unusedCount) {
      onShowToast(`Cannot allocate ${selectedStaffIds.length} seats. Only ${unusedCount} seats are left in the pool.`, 'warning');
      return;
    }

    try {
      const promises = selectedStaffIds.map(staffId => {
        const newAssignment = {
          id: `ass-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          contractId: contract.id,
          staffId: staffId,
          assignedDate: new Date().toISOString().split('T')[0]
        };
        return onSaveAssetAssignment(newAssignment);
      });

      await Promise.all(promises);
      onShowToast(`Successfully allocated ${selectedStaffIds.length} seat(s) for "${contract.name}".`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(`Failed to allocate seats: ${err.message}`, 'warning');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="table-container" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '85vh',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Allocate Seats: {contract.name}
            </h3>
            <span style={{ fontSize: '12px', color: selectedStaffIds.length > unusedCount ? 'var(--danger)' : 'var(--text-secondary)' }}>
              Selected <strong>{selectedStaffIds.length}</strong> of <strong>{unusedCount}</strong> available seats remaining
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="selectAllMulti"
              checked={nonAssignedStaff.length > 0 && selectedStaffIds.length === nonAssignedStaff.length}
              onChange={toggleAllStaff}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="selectAllMulti" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
              Select All ({nonAssignedStaff.length})
            </label>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Grouped by Company Entity</span>
        </div>

        {/* Grouped Staff List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedCompanies.map(comp => {
            const companyUserIds = comp.users.map(u => u.id);
            const selectedInCompany = companyUserIds.filter(id => selectedStaffIds.includes(id));
            const isAllCompanySelected = companyUserIds.length > 0 && selectedInCompany.length === companyUserIds.length;
            const isPartiallySelected = selectedInCompany.length > 0 && selectedInCompany.length < companyUserIds.length;

            const toggleCompanySelection = () => {
              if (isAllCompanySelected) {
                setSelectedStaffIds(selectedStaffIds.filter(id => !companyUserIds.includes(id)));
              } else {
                const otherSelected = selectedStaffIds.filter(id => !companyUserIds.includes(id));
                setSelectedStaffIds([...otherSelected, ...companyUserIds]);
              }
            };

            return (
              <div key={comp.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Company Header Row */}
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAllCompanySelected}
                    ref={el => {
                      if (el) el.indeterminate = isPartiallySelected;
                    }}
                    onChange={toggleCompanySelection}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {comp.name} ({comp.users.length})
                  </span>
                </div>

                {/* Expanded Company Users */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                  {comp.users.map(s => {
                    const isChecked = selectedStaffIds.includes(s.id);
                    return (
                      <div 
                        key={s.id} 
                        onClick={() => toggleStaffSelection(s.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                          border: isChecked ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid transparent',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {s.department || 'Operations'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {nonAssignedStaff.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              All active staff members are already assigned to this license pool.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'var(--bg-secondary)',
          gap: '12px'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleBatchAllocateSeats}
            disabled={selectedStaffIds.length === 0 || selectedStaffIds.length > unusedCount}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Allocate {selectedStaffIds.length} Seats
          </button>
        </div>
      </div>
    </div>
  );
}
