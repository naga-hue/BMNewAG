import React, { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Company } from '../../types';

interface HolidaysConfigProps {
  companies: Company[];
  holidays: any[];
  onSaveHoliday: (holiday: any) => Promise<any>;
  onDeleteHoliday?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function HolidaysConfig({
  companies,
  holidays,
  onSaveHoliday,
  onDeleteHoliday,
  onShowToast
}: HolidaysConfigProps) {
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayCompanyId, setHolidayCompanyId] = useState('All');
  const [holidayAddCompanyIds, setHolidayAddCompanyIds] = useState<string[]>([]);

  const handleHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate || holidayAddCompanyIds.length === 0) {
      onShowToast("Please fill in all holiday details and check at least one company.", "warning");
      return;
    }

    try {
      for (let i = 0; i < holidayAddCompanyIds.length; i++) {
        const cid = holidayAddCompanyIds[i];
        const newHoliday = {
          id: `hol-${Date.now()}-${i}`,
          companyId: cid,
          name: holidayName.trim(),
          date: holidayDate
        };
        await onSaveHoliday(newHoliday);
      }
      onShowToast(`Created public holiday "${holidayName}" for ${holidayAddCompanyIds.length} companies.`, "success");
      setHolidayName('');
      setHolidayDate('');
      setHolidayAddCompanyIds([]);
      setShowHolidayForm(false);
    } catch (err: any) {
      onShowToast(`Error saving holiday: ${err.message}`, "warning");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Company Public Holidays</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Set holidays for each country and company. These are excluded from leave calculations.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowHolidayForm(prev => !prev)}>
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      {showHolidayForm && (
        <form onSubmit={handleHolidaySubmit} className="detail-section" style={{ border: '1px solid var(--primary)', animation: 'fadeIn 0.2s' }}>
          <div className="section-title" style={{ fontSize: '13px', color: 'var(--primary)' }}>
            <Plus size={14} /> Add Public Holiday Calendar Event
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label className="form-label">Holiday Name <span>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Good Friday"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Date <span>*</span></label>
              <input 
                type="date" 
                className="form-input" 
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Applicable Companies (Check all that apply) <span>*</span></label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                maxHeight: '130px',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                width: '100%'
              }}>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setHolidayAddCompanyIds(companies.map(c => c.id))}
                    style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setHolidayAddCompanyIds([])}
                    style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    Deselect All
                  </button>
                </div>
                {companies.map(c => {
                  const isChecked = holidayAddCompanyIds.includes(c.id);
                  return (
                    <label 
                      key={c.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        fontSize: '12px', 
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        backgroundColor: isChecked ? 'rgba(99,102,241,0.05)' : 'transparent'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setHolidayAddCompanyIds(prev => 
                            prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                        {c.name} <span style={{ color: 'var(--text-muted)' }}>({c.country})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Save Holiday Event
          </button>
        </form>
      )}

      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group">
          <span className="form-label" style={{ margin: 0, alignSelf: 'center' }}>Filter Roster:</span>
          <select 
            className="select-filter"
            value={holidayCompanyId}
            onChange={(e) => setHolidayCompanyId(e.target.value)}
          >
            <option value="All">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {holidays.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} className="empty-state-icon" />
          <h2>No Public Holidays Defined</h2>
        </div>
      ) : (
        <div className="table-container">
          <table className="entity-table">
            <thead>
              <tr>
                <th>Holiday Title</th>
                <th>Date Scheduled</th>
                <th>Applicable Company</th>
                <th>Region / Country</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays
                .filter(h => holidayCompanyId === 'All' || h.companyId === holidayCompanyId)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(h => {
                  const matComp = companies.find(c => c.id === h.companyId);
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.name}</td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                        {h.date}
                      </td>
                      <td>{matComp ? matComp.name : 'Unknown Group'}</td>
                      <td>
                        <span className={`country-badge country-${matComp ? matComp.country.toLowerCase().replace(/[^a-z]/g, '') : 'uk'}`}>
                          {matComp ? matComp.country : 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {onDeleteHoliday && (
                            <button 
                              className="btn-icon delete" 
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete holiday "${h.name}"?`)) {
                                  onDeleteHoliday(h.id);
                                  onShowToast(`Deleted holiday "${h.name}"`, "info");
                                }
                              }}
                              title="Remove Holiday"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
