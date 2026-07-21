import React, { useState, useMemo } from 'react';
import { Trash2, PlusCircle, Edit3, Check, X, RefreshCw } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';
import { firebaseService } from '../../services/firebase';

interface NominalCodesSetupProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export default function NominalCodesSetup({ onShowToast }: NominalCodesSetupProps) {
  const nominalCodes = useBoundStore(state => state.nominalCodes);
  const expenses = useBoundStore(state => state.expenses) || [];
  const vendors = useBoundStore(state => state.vendors) || [];
  const contracts = useBoundStore(state => state.contracts) || [];

  const saveNominalCode = useBoundStore(state => state.saveNominalCode);
  const deleteNominalCode = useBoundStore(state => state.deleteNominalCode);

  const [nominalMode, setNominalMode] = useState<'single' | 'bulk'>('single');
  const [newNominalCodeId, setNewNominalCodeId] = useState('');
  const [newNominalCodeName, setNewNominalCodeName] = useState('');
  const [newNominalType, setNewNominalType] = useState('indirect'); // direct, indirect
  const [bulkInput, setBulkInput] = useState('');
  const [selectedNominalIds, setSelectedNominalIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inline edit state for renumbering / updating nominal codes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIdInput, setEditIdInput] = useState('');
  const [editNameInput, setEditNameInput] = useState('');
  const [editTypeInput, setEditTypeInput] = useState('indirect');

  const startEdit = (c: { id: string; code: string; type: string }) => {
    setEditingId(c.id);
    setEditIdInput(c.id);
    const parts = c.code.split(' - ');
    const label = parts.length > 1 ? parts.slice(1).join(' - ') : c.code;
    setEditNameInput(label);
    setEditTypeInput(c.type || 'indirect');
  };

  const cascadeSyncExistingRecords = async (oldId?: string, oldCode?: string, newCodeStr?: string) => {
    setIsSyncing(true);
    let updatedExpensesCount = 0;
    let updatedVendorsCount = 0;
    let updatedContractsCount = 0;

    try {
      // 1. Process Expenses
      for (const exp of expenses) {
        if (!exp.nominalCode) continue;
        let replacement = null;

        if (oldId && newCodeStr) {
          if (exp.nominalCode === oldId || exp.nominalCode === oldCode || exp.nominalCode.startsWith(oldId + ' - ') || exp.nominalCode.startsWith(oldId + ' ')) {
            replacement = newCodeStr;
          }
        } else {
          const matched = activeNominalCodes.find(nc => 
            nc.id === exp.nominalCode || 
            exp.nominalCode.startsWith(nc.id + ' - ') || 
            exp.nominalCode.startsWith(nc.id + ' ')
          );
          if (matched && matched.code !== exp.nominalCode) {
            replacement = matched.code;
          }
        }

        if (replacement && replacement !== exp.nominalCode) {
          await firebaseService.saveExpense({ ...exp, nominalCode: replacement });
          updatedExpensesCount++;
        }
      }

      // 2. Process Vendors
      for (const v of vendors) {
        if (!v.nominalCode) continue;
        let replacement = null;

        if (oldId && newCodeStr) {
          if (v.nominalCode === oldId || v.nominalCode === oldCode || v.nominalCode.startsWith(oldId + ' - ') || v.nominalCode.startsWith(oldId + ' ')) {
            replacement = newCodeStr;
          }
        } else {
          const matched = activeNominalCodes.find(nc => 
            nc.id === v.nominalCode || 
            v.nominalCode.startsWith(nc.id + ' - ') || 
            v.nominalCode.startsWith(nc.id + ' ')
          );
          if (matched && matched.code !== v.nominalCode) {
            replacement = matched.code;
          }
        }

        if (replacement && replacement !== v.nominalCode) {
          await firebaseService.saveVendor({ ...v, nominalCode: replacement });
          updatedVendorsCount++;
        }
      }

      // 3. Process Contracts
      for (const cnt of contracts) {
        if (!cnt.nominalCode) continue;
        let replacement = null;

        if (oldId && newCodeStr) {
          if (cnt.nominalCode === oldId || cnt.nominalCode === oldCode || cnt.nominalCode.startsWith(oldId + ' - ') || cnt.nominalCode.startsWith(oldId + ' ')) {
            replacement = newCodeStr;
          }
        } else {
          const matched = activeNominalCodes.find(nc => 
            nc.id === cnt.nominalCode || 
            cnt.nominalCode.startsWith(nc.id + ' - ') || 
            cnt.nominalCode.startsWith(nc.id + ' ')
          );
          if (matched && matched.code !== cnt.nominalCode) {
            replacement = matched.code;
          }
        }

        if (replacement && replacement !== cnt.nominalCode) {
          await firebaseService.saveContract({ ...cnt, nominalCode: replacement });
          updatedContractsCount++;
        }
      }

      const totalUpdates = updatedExpensesCount + updatedVendorsCount + updatedContractsCount;
      if (totalUpdates > 0) {
        onShowToast(`Synced ${totalUpdates} records to updated Nominal Codes! (Expenses: ${updatedExpensesCount}, Vendors: ${updatedVendorsCount}, Contracts: ${updatedContractsCount})`, "success");
      } else if (!oldId) {
        onShowToast("All existing expenses, vendors, and contracts are already aligned with active nominal codes.", "info");
      }
    } catch (err: any) {
      onShowToast(`Error syncing records: ${err.message}`, "warning");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveEdit = async (c: { id: string; code: string; type: string }) => {
    const newId = editIdInput.trim();
    const newName = editNameInput.trim();
    if (!newId || !newName) {
      onShowToast("Nominal Code ID and Description Label cannot be empty.", "warning");
      return;
    }

    const newCodeStr = `${newId} - ${newName}`;

    if (newId !== c.id) {
      const duplicate = activeNominalCodes.some(item => item.id === newId);
      if (duplicate) {
        onShowToast(`Nominal Code ID "${newId}" already exists. Please choose a unique ID.`, "warning");
        return;
      }
    }

    try {
      if (newId !== c.id) {
        await deleteNominalCode(c.id);
      }
      await saveNominalCode({
        id: newId,
        code: newCodeStr,
        type: editTypeInput
      });

      // Cascade update to all existing expenses, vendors, and contracts in Firebase
      await cascadeSyncExistingRecords(c.id, c.code, newCodeStr);

      onShowToast(`Updated Nominal Code to: ${newCodeStr}`, "success");
      setEditingId(null);
    } catch (err: any) {
      onShowToast(`Error saving Nominal Code: ${err.message}`, "warning");
    }
  };

  // Normalize nominal codes to handle any legacy string arrays gracefully
  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
      if (typeof c === 'string') {
        const parts = c.split(' - ');
        return { id: parts[0] || c, code: c, type: 'indirect' };
      }
      if (c && typeof c === 'object') {
        return {
          id: c.id || '',
          code: c.code || '',
          type: c.type || 'indirect'
        };
      }
      return null;
    }).filter((c): c is { id: string; code: string; type: string } => c !== null && !!c.code);
  }, [nominalCodes]);

  const handleNominalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNominalCodeId.trim() || !newNominalCodeName.trim()) {
      onShowToast("Please enter both nominal code and description name.", "warning");
      return;
    }

    const codeStr = `${newNominalCodeId.trim()} - ${newNominalCodeName.trim()}`;
    const exists = activeNominalCodes.some(c => c.id === newNominalCodeId.trim() || String(c.code || '').toLowerCase() === codeStr.toLowerCase());
    
    if (exists) {
      onShowToast("A nominal code with this key or description name already exists.", "warning");
      return;
    }

    try {
      await saveNominalCode({
        id: newNominalCodeId.trim(),
        code: codeStr,
        type: newNominalType
      });
      onShowToast(`Added Nominal code: ${codeStr} (${newNominalType === 'direct' ? 'Direct Cost' : 'Indirect Cost'})`, "success");
      setNewNominalCodeId('');
      setNewNominalCodeName('');
      setNewNominalType('indirect');
    } catch (err: any) {
      onShowToast(`Error creating Nominal: ${err.message}`, "warning");
    }
  };

  const handleBulkNominalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      onShowToast("Please enter nominal codes in the text area.", "warning");
      return;
    }

    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean);
    let successCount = 0;
    let failCount = 0;
    let existsCount = 0;

    for (let line of lines) {
      let codeId = '';
      let codeName = '';
      let typeVal = 'indirect';

      // Try split by comma
      if (line.includes(',')) {
        const parts = line.split(',');
        codeId = parts[0]?.trim() || '';
        codeName = parts[1]?.trim() || '';
        if (parts[2]) {
          const t = parts[2].trim().toLowerCase();
          if (t === 'direct' || t === 'indirect') {
            typeVal = t;
          }
        }
      } 
      // Try split by dash
      else if (line.includes(' - ')) {
        const parts = line.split(' - ');
        codeId = parts[0]?.trim() || '';
        codeName = parts[1]?.trim() || '';
      }
      else {
        // Fallback: split by whitespace
        const match = line.match(/^(\w+)\s+(.+)$/);
        if (match) {
          codeId = match[1];
          codeName = match[2];
        }
      }

      if (!codeId || !codeName) {
        failCount++;
        continue;
      }

      const codeStr = `${codeId} - ${codeName}`;
      const exists = activeNominalCodes.some(c => c.id === codeId || String(c.code || '').toLowerCase() === codeStr.toLowerCase());

      if (exists) {
        existsCount++;
        continue;
      }

      try {
        await saveNominalCode({
          id: codeId,
          code: codeStr,
          type: typeVal
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    onShowToast(`Bulk import complete. Success: ${successCount}, Skipped (Exists): ${existsCount}, Errors: ${failCount}`, successCount > 0 ? "success" : "warning");
    if (successCount > 0) {
      setBulkInput('');
    }
  };

  const handleBulkDeleteNominals = async () => {
    if (selectedNominalIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedNominalIds.length} selected Nominal category codes?`)) return;

    let successCount = 0;
    try {
      for (const id of selectedNominalIds) {
        await deleteNominalCode(id);
        successCount++;
      }
      onShowToast(`Successfully deleted ${successCount} nominal categories.`, "success");
      setSelectedNominalIds([]);
    } catch (err: any) {
      onShowToast(`Error bulk deleting nominals: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Nominal Codes Manager</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage the nominal ledger codes for categorization of bank statements and manual expense inputs.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => cascadeSyncExistingRecords()}
            disabled={isSyncing}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Scan & update all existing historical bank expenses, vendors, and contract packages in Firebase to match active nominal codes"
          >
            <RefreshCw size={12} style={isSyncing ? { animation: 'spin 1s linear infinite' } : undefined} />
            {isSyncing ? 'Syncing Records...' : '⚡ Sync & Re-link Records'}
          </button>
          <button 
            type="button" 
            className={nominalMode === 'single' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setNominalMode('single')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Single Nominal Add
          </button>
          <button 
            type="button" 
            className={nominalMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setNominalMode('bulk')}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Bulk Nominal Add / Paste List
          </button>
        </div>
      </div>

      {nominalMode === 'single' && (
        <form onSubmit={handleNominalSubmit} className="detail-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="section-title">
            <PlusCircle size={14} /> Add Nominal Category
          </div>

          <div className="form-group-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nominal Code ID (Key) <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. 7011"
                value={newNominalCodeId}
                onChange={(e) => setNewNominalCodeId(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Nominal Code Name / Description <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Marketing & Advertising Overhead"
                value={newNominalCodeName}
                onChange={(e) => setNewNominalCodeName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Cost Classification Type <span>*</span></label>
            <select 
              className="select-filter"
              value={newNominalType}
              onChange={(e) => setNewNominalType(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="indirect">Indirect Cost (Overhead / G&A)</option>
              <option value="direct">Direct Cost (Salaries, Commission, Placements Cost)</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px', marginTop: '4px' }}>
            Create Nominal Bracket
          </button>
        </form>
      )}

      {nominalMode === 'bulk' && (
        <form onSubmit={handleBulkNominalSubmit} className="detail-section" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="section-title">
            <PlusCircle size={14} /> Bulk Paste Nominal Ledger Codes
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Paste nominal codes one per line. Formats allowed:<br />
            • <code>500 - Salaries &amp; Wages</code> (Code and Name split by dash)<br />
            • <code>500,Salaries &amp; Wages</code> (Code and Name split by comma)<br />
            • <code>500,Salaries &amp; Wages,direct</code> (Include cost type: 'direct' or 'indirect')
          </p>
          <div className="form-group">
            <textarea
              className="form-input"
              rows={8}
              placeholder="e.g.&#10;500,Salaries & Wages,direct&#10;501,HMRC PAYE,direct&#10;7000,Marketing Expenses,indirect"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
            Bulk Import Nominals
          </button>
        </form>
      )}

      {/* Nominal Codes List */}
      <div style={{ maxWidth: '750px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Active Nominal Ledger Bracket Registry</h3>
          {selectedNominalIds.length > 0 && (
            <button 
              onClick={handleBulkDeleteNominals}
              className="btn-primary" 
              style={{ fontSize: '11px', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', padding: '4px 10px', gap: '4px' }}
            >
              <Trash2 size={10} /> Delete Selected ({selectedNominalIds.length})
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="entity-table dense" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={activeNominalCodes.length > 0 && selectedNominalIds.length === activeNominalCodes.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedNominalIds(activeNominalCodes.map(c => c.id));
                      } else {
                        setSelectedNominalIds([]);
                      }
                    }}
                  />
                </th>
                <th style={{ width: '130px' }}>Nominal Code ID</th>
                <th>Nominal Code Label</th>
                <th style={{ width: '130px' }}>Classification</th>
                <th style={{ textAlign: 'right', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeNominalCodes.map(c => {
                const isEditing = editingId === c.id;
                return (
                  <tr key={c.id} style={isEditing ? { backgroundColor: 'rgba(99, 102, 241, 0.08)' } : undefined}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox"
                        checked={selectedNominalIds.includes(c.id)}
                        onChange={() => {
                          setSelectedNominalIds(prev => 
                            prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                      />
                    </td>
                    
                    {isEditing ? (
                      <>
                        <td>
                          <input 
                            type="text" 
                            className="form-input"
                            value={editIdInput}
                            onChange={(e) => setEditIdInput(e.target.value)}
                            placeholder="e.g. 7000"
                            style={{ width: '90px', padding: '4px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px' }}
                            title="Edit / Renumber Nominal Code ID"
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-input"
                            value={editNameInput}
                            onChange={(e) => setEditNameInput(e.target.value)}
                            placeholder="Description Name"
                            style={{ width: '100%', padding: '4px 8px', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <select
                            className="select-filter"
                            value={editTypeInput}
                            onChange={(e) => setEditTypeInput(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                          >
                            <option value="indirect">INDIRECT COST</option>
                            <option value="direct">DIRECT COST</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button 
                              type="button"
                              className="btn-icon" 
                              onClick={() => handleSaveEdit(c)}
                              title="Save Changes"
                              style={{ color: 'var(--success)', padding: '4px' }}
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              type="button"
                              className="btn-icon" 
                              onClick={() => setEditingId(null)}
                              title="Cancel Edit"
                              style={{ color: 'var(--text-muted)', padding: '4px' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.id}</td>
                        <td>{c.code}</td>
                        <td>
                          <span style={{ 
                            display: 'inline-block',
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: c.type === 'direct' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                            color: c.type === 'direct' ? 'var(--primary)' : 'var(--text-secondary)'
                          }}>
                            {c.type === 'direct' ? 'DIRECT COST' : 'INDIRECT COST'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button 
                              type="button"
                              className="btn-icon" 
                              onClick={() => startEdit(c)}
                              title="Edit & Renumber nominal code"
                              style={{ padding: '4px' }}
                            >
                              <Edit3 size={12} />
                            </button>
                            <button 
                              type="button"
                              className="btn-icon delete" 
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete Nominal Code "${c.code}"?`)) {
                                  deleteNominalCode(c.id);
                                  onShowToast(`Deleted Nominal category: ${c.code}`, "info");
                                }
                              }}
                              title="Delete nominal code"
                              style={{ padding: '4px' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {activeNominalCodes.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                    No nominal categories initialized. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
