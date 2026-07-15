import React, { useState, useMemo } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { useBoundStore } from '../../store/useBoundStore';

interface NominalCodesSetupProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export default function NominalCodesSetup({ onShowToast }: NominalCodesSetupProps) {
  const nominalCodes = useBoundStore(state => state.nominalCodes);
  const saveNominalCode = useBoundStore(state => state.saveNominalCode);
  const deleteNominalCode = useBoundStore(state => state.deleteNominalCode);

  const [nominalMode, setNominalMode] = useState<'single' | 'bulk'>('single');
  const [newNominalCodeId, setNewNominalCodeId] = useState('');
  const [newNominalCodeName, setNewNominalCodeName] = useState('');
  const [newNominalType, setNewNominalType] = useState('indirect'); // direct, indirect
  const [bulkInput, setBulkInput] = useState('');
  const [selectedNominalIds, setSelectedNominalIds] = useState<string[]>([]);

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
              {activeNominalCodes.map(c => (
                <tr key={c.id}>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-icon delete" 
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete Nominal Code "${c.code}"?`)) {
                            deleteNominalCode(c.id);
                            onShowToast(`Deleted Nominal category: ${c.code}`, "info");
                          }
                        }}
                        title="Delete nominal code"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
