import React, { useState } from 'react';
import { Plus, Edit3, Trash2, FileText } from 'lucide-react';
import { Company, Staff, Vendor, Split } from '../../types';
import { firebaseService } from '../../services/firebase';
import { 
  CURRENCIES, 
  symbolMap, 
  getCategoryStyles, 
  getPaymentAlert, 
  getSplitProRataShares, 
  getContractCompanyShare 
} from './shared';
import { toGBP } from '../../utils/currency';

interface ContractsRegisterProps {
  contracts: any[];
  vendors: Vendor[];
  companies: Company[];
  staff: Staff[];
  assetAssignments: any[];
  expenses?: any[];
  onSaveContract: (contract: any) => Promise<any>;
  onDeleteContract?: (id: string) => Promise<any>;
  onSaveAssetAssignment: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  handleEditContract?: (contract: any) => void;
  onEditContract?: (contract: any) => void;
  onRegisterContractClick: () => void;
  onBatchAllocateSeatsClick?: (contract: any) => void;
}

export default function ContractsRegister({
  contracts,
  vendors,
  companies,
  staff,
  assetAssignments,
  expenses = [],
  onSaveContract,
  onDeleteContract,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast,
  handleEditContract,
  onEditContract,
  onRegisterContractClick
}: ContractsRegisterProps) {
  const triggerEditContract = onEditContract || handleEditContract;
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [expandedSplitsContractId, setExpandedSplitsContractId] = useState<string | null>(null);
  const [uploadContractId, setUploadContractId] = useState<string | null>(null);

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
    const email = (form.elements.namedItem('emailInput') as HTMLInputElement)?.value || '';
    const notes = (form.elements.namedItem('notesInput') as HTMLInputElement)?.value || '';
    if (!staffId) return;

    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;

    try {
      const newAssignment = {
        id: `ass-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        contractId: contractId,
        staffId: staffId,
        assignedDate: new Date().toISOString().split('T')[0],
        email,
        notes
      };
      await onSaveAssetAssignment(newAssignment);
      onShowToast(`Assigned license seat of "${contractName}" to ${staffMember.fullName}.`, 'success');
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

  // Handle updating contract splits
  const handleUpdateContractSplits = async (contractId: string, newSplits: Split[]) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const updatedContract = {
      ...contract,
      splits: newSplits
    };

    try {
      await onSaveContract(updatedContract);
      onShowToast("Updated contract cost splits successfully.", "success");
    } catch (err: any) {
      onShowToast(`Error updating splits: ${err.message}`, "warning");
    }
  };

  // Handle file uploading
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, contractId: string) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    onShowToast(`Uploading file "${file.name}"...`, 'info');
    try {
      const docMetadata = await firebaseService.uploadFile(contractId, file, 'contract_attachment');
      const contract = contracts.find(c => c.id === contractId);
      if (contract) {
        const updatedDocuments = [...(contract.documents || []), docMetadata];
        const updatedContract = { ...contract, documents: updatedDocuments };
        await onSaveContract(updatedContract);
        onShowToast(`Uploaded "${file.name}" successfully!`, 'success');
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      onShowToast(`Failed to upload file: ${err.message}`, 'warning');
    } finally {
      setUploadContractId(null);
    }
  };

  const handlePreviewInvoice = (doc: any) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else {
      alert(`[SIMULATED FILE VIEWER]\nViewing file: ${doc.name}\nUploaded: ${doc.uploadDate}\nSize: ${doc.fileSize}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Contracts & Landlord Leases</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage software license pools, landlord leases, payment schedules, and currency settings.</p>
        </div>
        
        <button className="btn-primary" onClick={onRegisterContractClick}>
          <Plus size={16} /> Register Contract
        </button>
      </div>

      {/* Contracts Spreadsheet Grid Table */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Contract Name</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Vendor Partner</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Paying Entity</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '130px' }}>Cost Splits</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Unit Cost</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '80px' }}>Qty (Seats)</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '110px' }}>Allocations</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Equiv. Monthly Cost</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '90px' }}>Interval</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>Start Date</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>End Date</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '110px' }}>Next Payment Due</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '60px' }}>Docs</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract, idx) => {
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
                : totalWithTax;

              const alert = getPaymentAlert(contract.paymentDueDate);

              return (
                <React.Fragment key={contract.id}>
                  <tr 
                    onClick={() => triggerEditContract && triggerEditContract(contract)}
                    className="table-row-hover"
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{contract.name}</span>
                        {contract.nominalCode && (
                          <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>
                            🏷️ {contract.nominalCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                      {matchedVendor ? matchedVendor.name : '—'}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                      {matchedCompany ? matchedCompany.name : 'Group'}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const splits: Split[] = contract.splits || [];
                        const splitsCount = splits.length;
                        const totalSplitPercentage = contract.useHeadcountSplit 
                          ? 100 
                          : splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
                        
                        return (
                          <span 
                            onClick={() => {
                              setExpandedSplitsContractId(expandedSplitsContractId === contract.id ? null : contract.id);
                              setExpandedContractId(null); // Close seat allocations drawer if open
                            }}
                            style={{ 
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: expandedSplitsContractId === contract.id 
                                ? 'var(--accent)' 
                                : (splitsCount > 0 ? 'rgba(167, 139, 250, 0.08)' : 'rgba(255, 255, 255, 0.03)'),
                              color: expandedSplitsContractId === contract.id 
                                ? '#fff' 
                                : (splitsCount > 0 ? '#a78bfa' : 'var(--text-muted)'),
                              border: '1px solid var(--border-color)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                          >
                            🔗 {splitsCount > 0 ? `${splitsCount} Splits (${totalSplitPercentage}%)` : 'Assign Splits'}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {symbol}{contract.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {contract.quantityPurchased}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const isSoftware = matchedVendor && matchedVendor.category === 'Software License';
                        if (!isSoftware) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                        const assigned = assetAssignments.filter(a => a.contractId === contract.id);
                        const assignedCount = assigned.length;
                        const unusedCount = Math.max(0, contract.quantityPurchased - assignedCount);
                        return (
                          <span 
                            onClick={() => setExpandedContractId(expandedContractId === contract.id ? null : contract.id)}
                            style={{ 
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: expandedContractId === contract.id 
                                ? 'var(--primary)' 
                                : (unusedCount > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)'),
                              color: expandedContractId === contract.id 
                                ? '#fff' 
                                : (unusedCount > 0 ? '#38bdf8' : '#34d399'),
                              border: '1px solid var(--border-color)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                          >
                            👥 {assignedCount} / {contract.quantityPurchased}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {(() => {
                        const matchedV = vendors.find(v => v.name === contract.vendorName || v.id === contract.vendorId);
                        const actualPaid = (expenses || []).reduce((sum, exp) => {
                          const isMatch = (exp.recipientType === 'vendor' && (exp.recipientId === matchedV?.id || exp.recipientId === contract.vendorId)) ||
                                          (exp.payee && matchedV && exp.payee.toLowerCase().includes(matchedV.name.toLowerCase()));
                          if (isMatch && exp.status !== 'dns' && exp.status !== 'cancelled') {
                            return sum + toGBP(exp.amount, exp.currency || 'GBP');
                          }
                          return sum;
                        }, 0);

                        const diff = actualPaid - monthlyCostEquivalent;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <div style={{ color: 'var(--success)', fontWeight: 700 }}>
                              Proj: £{monthlyCostEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '10px', color: actualPaid > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                              Actual Paid: £{actualPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {actualPaid > 0 && (
                              <span style={{ 
                                fontSize: '9px', 
                                padding: '1px 5px', 
                                borderRadius: '3px',
                                fontWeight: 700,
                                backgroundColor: diff <= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: diff <= 0 ? 'var(--success)' : 'var(--danger)'
                              }}>
                                {diff <= 0 ? `-${toGBP(Math.abs(diff), 'GBP').toLocaleString()} Under` : `+${toGBP(diff, 'GBP').toLocaleString()} Over`}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        textTransform: 'uppercase', 
                        fontWeight: 700, 
                        color: contract.costInterval === 'monthly' ? '#38bdf8' : (contract.costInterval === 'annual' ? '#fbbf24' : '#a78bfa'),
                        backgroundColor: contract.costInterval === 'monthly' ? 'rgba(56, 189, 248, 0.08)' : (contract.costInterval === 'annual' ? 'rgba(251, 191, 36, 0.08)' : 'rgba(167, 139, 250, 0.08)'),
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {contract.costInterval}
                      </span>
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {contract.startDate || '—'}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {contract.endDate || '—'}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: alert ? alert.color : 'inherit', fontWeight: alert ? 700 : 'normal' }}>{contract.paymentDueDate || '—'}</span>
                        {alert && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: alert.color }} title={alert.text} />}
                      </div>
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {(contract.documents || []).length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {(contract.documents || []).slice(0, 2).map((doc: any) => (
                            <a key={doc.id} href="#" onClick={(e) => { e.preventDefault(); handlePreviewInvoice(doc); }} style={{ color: 'var(--primary)' }} title={`Preview: ${doc.name}`}>
                              <FileText size={12} />
                            </a>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {uploadContractId === contract.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                          <input 
                            type="file" 
                            onChange={(e) => handleFileUpload(e, contract.id)} 
                            style={{ fontSize: '10px', width: '110px' }} 
                          />
                          <button type="button" className="btn-secondary" onClick={() => setUploadContractId(null)} style={{ padding: '2px 4px', fontSize: '9px' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn-icon" onClick={() => setUploadContractId(contract.id)} title="Attach Invoice Document" style={{ padding: '4px', borderRadius: '4px' }}>
                            <Plus size={11} />
                          </button>
                          <button className="btn-icon" onClick={() => triggerEditContract && triggerEditContract(contract)} title="Edit Contract" style={{ padding: '4px', borderRadius: '4px' }}>
                            <Edit3 size={11} />
                          </button>
                          {onDeleteContract && (
                            <button className="btn-icon delete" onClick={() => {
                              if (window.confirm(`Are you sure you want to delete contract "${contract.name}"?`)) {
                                onDeleteContract(contract.id);
                                onShowToast(`Deleted contract "${contract.name}"`, "info");
                              }
                            }} title="Delete Contract" style={{ padding: '4px', borderRadius: '4px' }}>
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  
                  {expandedContractId === contract.id && (() => {
                    const isSoftware = matchedVendor && matchedVendor.category === 'Software License';
                    if (!isSoftware) return null;
                    const assigned = assetAssignments.filter(a => a.contractId === contract.id);
                    const assignedCount = assigned.length;
                    const isPackage = !!contract.splitPackageCost;
                    const unusedCount = isPackage ? 999999 : Math.max(0, contract.quantityPurchased - assignedCount);
                    const activeStaffList = staff.filter(s => s.status !== 'exited');
                    const sortedStaff = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                    return (
                      <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.25)' }}>
                        <td colSpan={14} style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                                Manage Seat Allocations for "{contract.name}"
                              </h4>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {isPackage 
                                  ? `Allocations: ${assignedCount} assigned users (Unlimited package pool)`
                                  : `Remaining: ${unusedCount} unallocated seats`
                                }
                              </span>
                            </div>

                            {assigned.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {assigned.map(a => {
                                  const member = staff.find(s => s.id === a.staffId);
                                  if (!member) return null;
                                  return (
                                    <div key={a.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      backgroundColor: 'var(--bg-secondary)', 
                                      border: '1px solid var(--border-color)', 
                                      padding: '4px 10px', 
                                      borderRadius: '6px',
                                      fontSize: '11.5px' 
                                    }}>
                                      <strong style={{ color: 'var(--text-primary)' }}>{member.fullName}</strong>
                                      {a.email && <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>({a.email})</span>}
                                      <button 
                                        onClick={() => handleReleaseSeat(a.id, contract.name, member.fullName)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', padding: 0, marginLeft: '4px' }}
                                        title="Release Seat"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No staff users allocated to this license pool yet. Choose a member below to assign.
                              </div>
                            )}

                            {isPackage || unusedCount > 0 ? (
                              <form 
                                onSubmit={(e) => handleAllocateSeatInline(e, contract.id, contract.name)}
                                style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}
                              >
                                <select name="staffSelect" className="select-filter" style={{ padding: '4px 8px', fontSize: '11px', minWidth: '160px' }} required>
                                  <option value="">-- Choose Staff Member --</option>
                                  {sortedStaff.map(s => (
                                    <option key={s.id} value={s.id}>{s.fullName}</option>
                                  ))}
                                </select>
                                
                                <input 
                                  type="text" 
                                  name="emailInput" 
                                  placeholder="Optional Email/Alias" 
                                  style={{ width: '160px', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />

                                <input 
                                  type="text" 
                                  name="notesInput" 
                                  placeholder="Optional Notes..." 
                                  style={{ width: '160px', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                />

                                <button type="submit" className="btn-primary" style={{ padding: '4px 14px', fontSize: '11px' }}>
                                  Assign Seat
                                </button>
                              </form>
                            ) : (
                              <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                                ⚠️ All license seats are fully allocated. Release an existing user to assign a new one.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })()}

                  {expandedSplitsContractId === contract.id && (() => {
                    const splits: Split[] = contract.splits || [];
                    const totalSplitPercentage = contract.useHeadcountSplit 
                      ? 100 
                      : splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
                    const activeStaffList = staff.filter(s => s.status !== 'exited');
                    const sortedStaff = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                    const renderCheckboxItem = (id: string, type: 'company' | 'department' | 'user', name: string) => {
                      const isChecked = splits.some(s => s.type === type && s.targetId === id);
                      const splitItem = splits.find(s => s.type === type && s.targetId === id);

                      // Resolve dynamic pro-rata share if Automatic is selected
                      let proRataLabel = '';
                      if (contract.useHeadcountSplit && splits.length > 0) {
                        const shares = getSplitProRataShares(staff, splits, new Date().getFullYear(), new Date().getMonth());
                        const matchedShare = shares.find(s => s.type === type && s.targetId === id);
                        proRataLabel = matchedShare ? `${matchedShare.percentage}%` : '0%';
                      }

                      return (
                        <div 
                          key={id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            gap: '8px', 
                            fontSize: '11px', 
                            padding: '6px 8px', 
                            borderRadius: '4px', 
                            backgroundColor: isChecked ? 'rgba(167, 139, 250, 0.05)' : 'transparent', 
                            border: isChecked ? '1px solid rgba(167, 139, 250, 0.2)' : '1px solid transparent',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={async (e) => {
                                let updatedSplits;
                                if (e.target.checked) {
                                  updatedSplits = [...splits, { type, targetId: id, percentage: 0 }];
                                } else {
                                  updatedSplits = splits.filter(s => !(s.type === type && s.targetId === id));
                                }
                                await handleUpdateContractSplits(contract.id, updatedSplits);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isChecked ? 600 : 400 }}>{name}</span>
                          </div>
                          {isChecked && (
                            <div>
                              {contract.useHeadcountSplit ? (
                                <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '11px' }}>{proRataLabel}</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    value={splitItem?.percentage || 0}
                                    onChange={async (e) => {
                                      const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                      const updatedSplits = splits.map(s => {
                                        if (s.type === type && s.targetId === id) {
                                          return { ...s, percentage: pct };
                                        }
                                        return s;
                                      });
                                      const total = updatedSplits.reduce((sum, item) => sum + item.percentage, 0);
                                      if (total > 100) {
                                        onShowToast(`Cannot set to ${pct}%. Total manual split would exceed 100% (currently ${total}%).`, 'warning');
                                        return;
                                      }
                                      await handleUpdateContractSplits(contract.id, updatedSplits);
                                    }}
                                    style={{ 
                                      width: '45px', 
                                      padding: '2px 4px', 
                                      fontSize: '10.5px', 
                                      textAlign: 'center', 
                                      background: 'var(--bg-card)', 
                                      border: '1px solid var(--border-color)', 
                                      color: 'var(--text-primary)', 
                                      borderRadius: '4px' 
                                    }}
                                  />
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <tr style={{ backgroundColor: 'rgba(167, 139, 250, 0.02)' }}>
                        <td colSpan={14} style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            
                            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', margin: 0, flex: 1 }}>
                                Cost Splits & Distributions for "{contract.name}"
                              </h4>
                              <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const updatedContract = { ...contract, useHeadcountSplit: true };
                                    try {
                                      await onSaveContract(updatedContract);
                                      onShowToast("Dynamic headcount split active.", "success");
                                    } catch (err: any) {
                                      onShowToast("Error updating split mode: " + err.message, "warning");
                                    }
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    border: 'none',
                                    backgroundColor: contract.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                    color: contract.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: 600
                                  }}
                                >
                                  👥 Automatic (Staff Headcount)
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const updatedContract = { ...contract, useHeadcountSplit: false };
                                    try {
                                      await onSaveContract(updatedContract);
                                      onShowToast("Manual percentage splits active.", "success");
                                    } catch (err: any) {
                                      onShowToast("Error updating split mode: " + err.message, "warning");
                                    }
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    border: 'none',
                                    backgroundColor: !contract.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                    color: !contract.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: 600
                                  }}
                                >
                                  ⚙️ Manual Override (%)
                                </button>
                              </div>
                            </div>

                            {contract.useHeadcountSplit && (
                              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '6px', fontSize: '11px', color: '#38bdf8' }}>
                                {splits.length === 0 ? (
                                  <span>
                                    ℹ️ <strong>Global Mode</strong>: Cost is dynamically split pro-rata across <strong>all companies</strong> in the workspace based on active headcount.
                                  </span>
                                ) : (
                                  <span>
                                    ℹ️ <strong>Targeted Mode</strong>: Cost is dynamically split pro-rata based on headcount <strong>only among the selected targets</strong> checked below.
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Three-column checkbox grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏢 Companies</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {companies.map(c => renderCheckboxItem(c.id, 'company', c.name))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💼 Departments</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {allAvailableDepts.map(d => renderCheckboxItem(d, 'department', d))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Staff Users</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {sortedStaff.map(s => renderCheckboxItem(s.id, 'user', s.fullName))}
                                </div>
                              </div>
                            </div>

                            {!contract.useHeadcountSplit && (
                              <div style={{ fontSize: '11px', color: totalSplitPercentage === 100 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600, borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Total Manual Splits: {totalSplitPercentage}%</span>
                                {totalSplitPercentage < 100 && (
                                  <span style={{ fontStyle: 'italic', fontWeight: 400 }}>
                                    * Remaining {100 - totalSplitPercentage}% will be billed to the primary Paying Entity ({companies.find(comp => comp.id === contract.companyId)?.name || 'Unassigned'}).
                                  </span>
                                )}
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={14} style={{ border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No registered contracts or operating leases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
