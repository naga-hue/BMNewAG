import React, { useState, useMemo } from 'react';
import { 
  X, 
  GitMerge, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  CreditCard, 
  Wrench, 
  FileSpreadsheet, 
  UserCheck, 
  Building2, 
  Plus, 
  Loader2 
} from 'lucide-react';
import { useBoundStore } from '../store/useBoundStore';

export default function MergeDepartmentsModal({
  isOpen,
  onClose,
  company,
  onShowToast,
  onCompanyUpdated
}) {
  const { 
    staff = [], 
    expenses = [], 
    departmentTools = [], 
    payrollRecords = [], 
    mergeCompanyDepartments 
  } = useBoundStore();

  const [sourceDept, setSourceDept] = useState('');
  const [targetDeptMode, setTargetDeptMode] = useState('existing'); // 'existing' | 'new'
  const [selectedTargetDept, setSelectedTargetDept] = useState('');
  const [newTargetDeptName, setNewTargetDeptName] = useState('');
  const [transferManager, setTransferManager] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Normalize departments in this company
  const companyDepartments = useMemo(() => {
    if (!company || !Array.isArray(company.departments)) return [];
    return company.departments.map(d => {
      const name = typeof d === 'object' ? (d.name || '') : String(d);
      const managerId = typeof d === 'object' ? (d.managerId || '') : '';
      return { name: name.trim(), managerId };
    }).filter(d => Boolean(d.name));
  }, [company]);

  // Set default source & target when modal opens or company changes
  React.useEffect(() => {
    if (isOpen && companyDepartments.length >= 2) {
      const s = companyDepartments[0]?.name || '';
      const t = companyDepartments[1]?.name || '';
      setSourceDept(s);
      setSelectedTargetDept(t);
      setTargetDeptMode('existing');
      setNewTargetDeptName('');
      setIsConfirmed(false);
      setIsMerging(false);
    }
  }, [isOpen, companyDepartments]);

  const targetDept = targetDeptMode === 'new' ? newTargetDeptName.trim() : selectedTargetDept.trim();

  // Find source manager and target manager
  const sourceDeptObj = companyDepartments.find(d => d.name === sourceDept);
  const targetDeptObj = companyDepartments.find(d => d.name === targetDept);
  const sourceManager = staff.find(s => s.id === sourceDeptObj?.managerId);
  const targetManager = staff.find(s => s.id === targetDeptObj?.managerId);

  // Pre-flight impacts:
  // 1. Staff affected
  const affectedStaff = useMemo(() => {
    if (!company || !sourceDept) return [];
    const sNorm = sourceDept.toLowerCase();
    return staff.filter(s => s.companyId === company.id && s.department && s.department.trim().toLowerCase() === sNorm);
  }, [staff, company, sourceDept]);

  // 2. Expenses affected
  const affectedExpenses = useMemo(() => {
    if (!company || !sourceDept) return [];
    const sNorm = sourceDept.toLowerCase();
    return expenses.filter(e => {
      const isCompMatch = !e.bankCompanyId || e.bankCompanyId === company.id || e.recipientId === company.id || e.companyId === company.id;
      if (!isCompMatch) return false;

      if (e.allocationType === 'department') {
        if (typeof e.allocationTarget === 'string' && e.allocationTarget.trim().toLowerCase() === sNorm) return true;
        if (Array.isArray(e.allocationTarget) && e.allocationTarget.some(d => d.trim().toLowerCase() === sNorm)) return true;
      }
      if (e.manualAllocationShares) {
        if (Object.keys(e.manualAllocationShares).some(k => k.trim().toLowerCase() === sNorm)) return true;
      }
      return false;
    });
  }, [expenses, company, sourceDept]);

  // 3. Department Tools affected
  const affectedTools = useMemo(() => {
    if (!company || !sourceDept) return [];
    const sNorm = sourceDept.toLowerCase();
    return departmentTools.filter(t => {
      const comps = t.companyIds || [t.companyId || 'all'];
      if (!comps.includes('all') && !comps.includes(company.id)) return false;

      if (t.department && t.department.trim().toLowerCase() === sNorm) return true;
      if (Array.isArray(t.departments) && t.departments.some(d => d.trim().toLowerCase() === sNorm)) return true;
      return false;
    });
  }, [departmentTools, company, sourceDept]);

  // 4. Payroll records affected
  const affectedPayroll = useMemo(() => {
    if (!sourceDept) return [];
    const sNorm = sourceDept.toLowerCase();
    return payrollRecords.filter(r => {
      if (r.reimbursementDepartment && r.reimbursementDepartment.trim().toLowerCase() === sNorm) return true;
      if (Array.isArray(r.reimbursementItems) && r.reimbursementItems.some(i => i.department && i.department.trim().toLowerCase() === sNorm)) return true;
      return false;
    });
  }, [payrollRecords, sourceDept]);

  if (!isOpen || !company) return null;

  const isValid = Boolean(
    sourceDept &&
    targetDept &&
    sourceDept.toLowerCase() !== targetDept.toLowerCase() &&
    isConfirmed &&
    !isMerging
  );

  const handleExecuteMerge = async () => {
    if (!isValid) return;

    try {
      setIsMerging(true);
      const res = await mergeCompanyDepartments({
        companyId: company.id,
        sourceDept,
        targetDept,
        transferManager
      });

      if (onShowToast) {
        onShowToast(
          `Successfully merged "${sourceDept}" into "${targetDept}"! Updated ${res.updatedStaffCount} staff, ${res.updatedExpensesCount} expenses, and ${res.updatedToolsCount} tools.`,
          'success'
        );
      }

      if (onCompanyUpdated && res.updatedCompany) {
        onCompanyUpdated(res.updatedCompany);
      }

      onClose();
    } catch (err) {
      console.error("Failed to merge departments:", err);
      if (onShowToast) {
        onShowToast(`Failed to merge departments: ${err.message || 'Unknown error'}`, 'error');
      }
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !isMerging) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100005,
        padding: '16px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <GitMerge size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Merge Departments
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <Building2 size={11} />
                <span>{company.name}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Department Selection Workflow */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Source Department */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Department to Merge
              </label>
              <select
                value={sourceDept}
                onChange={(e) => {
                  const val = e.target.value;
                  setSourceDept(val);
                  if (val === selectedTargetDept) {
                    const other = companyDepartments.find(d => d.name !== val);
                    if (other) setSelectedTargetDept(other.name);
                  }
                }}
                disabled={isMerging}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {companyDepartments.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Will be retired &amp; removed
              </span>
            </div>

            {/* Merge Icon Arrow */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '10px', color: 'var(--primary)' }}>
              <ArrowRight size={18} />
            </div>

            {/* Target Department */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. Destination
                </label>
                <button
                  type="button"
                  onClick={() => setTargetDeptMode(m => m === 'existing' ? 'new' : 'existing')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {targetDeptMode === 'existing' ? '+ Create New' : 'Select Existing'}
                </button>
              </div>

              {targetDeptMode === 'existing' ? (
                <select
                  value={selectedTargetDept}
                  onChange={(e) => setSelectedTargetDept(e.target.value)}
                  disabled={isMerging}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {companyDepartments.filter(d => d.name !== sourceDept).map(d => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="New department name..."
                  value={newTargetDeptName}
                  onChange={(e) => setNewTargetDeptName(e.target.value)}
                  disabled={isMerging}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--primary)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
              )}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Receives all merged data
              </span>
            </div>
          </div>

          {/* Validation Error if same department */}
          {sourceDept && targetDept && sourceDept.toLowerCase() === targetDept.toLowerCase() && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '11px',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertTriangle size={14} />
              <span>Source and destination departments cannot be identical. Please select a different destination.</span>
            </div>
          )}

          {/* Pre-Flight Impact Assessment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />
              <span>Pre-Flight Data Impact for "{sourceDept}"</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              {/* Staff impact */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <Users size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600 }}>Team Members</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {affectedStaff.length} {affectedStaff.length === 1 ? 'member' : 'members'}
                </div>
                {affectedStaff.length > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {affectedStaff.map(s => s.fullName).slice(0, 3).join(', ')}
                    {affectedStaff.length > 3 && ` +${affectedStaff.length - 3} more`}
                  </div>
                )}
              </div>

              {/* Expenses impact */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <CreditCard size={13} style={{ color: '#10b981' }} />
                  <span style={{ fontWeight: 600 }}>Expense Allocations</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {affectedExpenses.length} {affectedExpenses.length === 1 ? 'record' : 'records'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Reallocated to {targetDept || 'destination'}
                </div>
              </div>

              {/* Tools impact */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <Wrench size={13} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600 }}>Software Tools</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {affectedTools.length} {affectedTools.length === 1 ? 'tool' : 'tools'}
                </div>
                {affectedTools.length > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {affectedTools.map(t => t.name).slice(0, 2).join(', ')}
                    {affectedTools.length > 2 && ` +${affectedTools.length - 2} more`}
                  </div>
                )}
              </div>

              {/* Payroll Reimbursements */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <FileSpreadsheet size={13} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontWeight: 600 }}>Payroll Reimbursements</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {affectedPayroll.length} {affectedPayroll.length === 1 ? 'item' : 'items'}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Updated to {targetDept || 'destination'}
                </div>
              </div>
            </div>
          </div>

          {/* Department Manager Transition */}
          {sourceManager && !targetManager && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <input
                type="checkbox"
                id="transferManagerCheck"
                checked={transferManager}
                onChange={(e) => setTransferManager(e.target.checked)}
                disabled={isMerging}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="transferManagerCheck" style={{ fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>Transfer Department Head:</span> Assign <strong>{sourceManager.fullName}</strong> as the Manager of <strong>{targetDept}</strong> (since {targetDept} currently has no manager).
              </label>
            </div>
          )}

          {/* Confirmation Guard Checkbox */}
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <input
              type="checkbox"
              id="confirmMergeCheck"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              disabled={isMerging}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <label htmlFor="confirmMergeCheck" style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.4, cursor: 'pointer' }}>
              I understand that merging will permanently reassign all active &amp; historical staff roster, expense records, software tool assignments, and reimbursements from <strong>"{sourceDept}"</strong> into <strong>"{targetDept}"</strong>, and remove <strong>"{sourceDept}"</strong> from <strong>{company.name}</strong>.
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isMerging}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: isMerging ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={!isValid}
            style={{
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: isValid ? 'var(--primary)' : 'rgba(99, 102, 241, 0.4)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isValid ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none'
            }}
          >
            {isMerging ? (
              <>
                <Loader2 size={14} className="spin-animation" />
                <span>Merging Departments...</span>
              </>
            ) : (
              <>
                <GitMerge size={14} />
                <span>Merge "{sourceDept}" into "{targetDept}"</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
