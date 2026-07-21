import React, { useMemo } from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { Vendor } from '../../types';
import { getCategoryStyles } from './shared';

interface VendorDirectoryProps {
  vendors: Vendor[];
  contracts: any[];
  nominalCodes?: any[];
  onSaveVendor?: (vendor: Vendor) => Promise<any>;
  onEditVendor: (vendor: Vendor) => void;
  onDeleteVendor?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  onSelectProfileId: (id: string | null) => void;
  onAddNewVendorClick: () => void;
}

export default function VendorDirectory({
  vendors,
  contracts,
  nominalCodes = [],
  onSaveVendor,
  onEditVendor,
  onDeleteVendor,
  onShowToast,
  onSelectProfileId,
  onAddNewVendorClick
}: VendorDirectoryProps) {
  const activeNominalCodes = useMemo(() => {
    return (nominalCodes || []).map((c: any) => {
      if (typeof c === 'string') {
        const parts = c.split(' - ');
        return { id: parts[0] || c, code: c };
      }
      if (c && typeof c === 'object') {
        return {
          id: c.id || '',
          code: c.code || ''
        };
      }
      return null;
    }).filter((c): c is { id: string; code: string } => c !== null && !!c.code);
  }, [nominalCodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Vendor Directory & Partners</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Register service providers, software vendors, and office landlords.</p>
        </div>
        
        <button className="btn-primary" onClick={onAddNewVendorClick}>
          <Plus size={16} /> Add Vendor Partner
        </button>
      </div>

      {/* Vendors Spreadsheet Grid Table */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Vendor Name</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Category</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', minWidth: '220px' }}>Default Nominal Code</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Contact Email</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Phone Number</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '120px' }}>Active Contracts</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Description / Notes</th>
              <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v, idx) => {
              const catStyles = getCategoryStyles(v.category);
              const vendorContracts = contracts.filter(c => c.vendorId === v.id);
              return (
                <tr 
                  key={v.id} 
                  onClick={() => onSelectProfileId(v.id)}
                  className="table-row-hover"
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {v.name}
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px' }}>
                    <span style={{ 
                      fontSize: '9.5px', 
                      color: catStyles.badgeColor, 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      backgroundColor: catStyles.bg,
                      border: `1px solid ${catStyles.border}`,
                      padding: '1px 6px',
                      borderRadius: '8px',
                      display: 'inline-block'
                    }}>
                      {catStyles.indicator} {v.category}
                    </span>
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px' }} onClick={(e) => e.stopPropagation()}>
                    <select
                      className="select-filter"
                      value={v.nominalCode || ''}
                      onChange={async (e) => {
                        const newCode = e.target.value;
                        if (onSaveVendor) {
                          try {
                            await onSaveVendor({ ...v, nominalCode: newCode });
                            onShowToast(`Updated default nominal code for "${v.name}" to ${newCode || 'Unassigned'}`, 'success');
                          } catch (err: any) {
                            onShowToast(`Failed to update nominal code: ${err.message}`, 'error');
                          }
                        }
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: v.nominalCode ? '1px solid var(--border-color)' : '1px dashed #f59e0b',
                        backgroundColor: v.nominalCode ? 'var(--bg-card)' : 'rgba(245, 158, 11, 0.08)',
                        color: v.nominalCode ? 'var(--text-primary)' : '#f59e0b',
                        width: '100%',
                        maxWidth: '220px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">⚠️ -- Select Default Nominal Code --</option>
                      {activeNominalCodes.map(nc => (
                        <option key={nc.id} value={nc.code}>
                          {nc.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                    {v.contactEmail ? <a href={`mailto:${v.contactEmail}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}>{v.contactEmail}</a> : '—'}
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {v.phone || '—'}
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                    {vendorContracts.length}
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.description || '—'}
                  </td>
                  <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button className="btn-icon" onClick={() => onEditVendor(v)} title="Edit Vendor" style={{ padding: '4px', borderRadius: '4px' }}>
                        <Edit3 size={11} />
                      </button>
                      <button className="btn-icon delete" onClick={() => {
                        if (onDeleteVendor && window.confirm(`Are you sure you want to delete vendor "${v.name}"?`)) {
                          onDeleteVendor(v.id);
                          onShowToast(`Deleted vendor "${v.name}"`, "info");
                        }
                      }} title="Delete Vendor" style={{ padding: '4px', borderRadius: '4px' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={7} style={{ border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No registered vendor partners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
