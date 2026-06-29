import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Info,
  Calendar,
  XCircle,
  FileText
} from 'lucide-react';

export default function LogsDashboard({
  auditLogs = [],
  onClearLogs,
  onShowToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  // Sorting state
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc

  const handleHeaderClick = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('desc');
    }
  };

  // Sort helper
  const sortLogs = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[sortBy] || '';
      let valB = b[sortBy] || '';

      if (sortBy === 'timestamp') {
        valA = new Date(valA);
        valB = new Date(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (log.description || '').toLowerCase().includes(q);
      const matchUser = (log.user || '').toLowerCase().includes(q);
      return matchDesc || matchUser;
    }
    return true;
  });

  const sortedAndFiltered = sortLogs(filteredLogs);

  // Render sorting indicators
  const renderSortIndicator = (columnKey) => {
    if (sortBy !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    }
    return sortOrder === 'asc' 
      ? <ChevronUp size={12} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--accent)' }} />
      : <ChevronDown size={12} style={{ marginLeft: '4px', verticalAlign: 'middle', color: 'var(--accent)' }} />;
  };

  // Unique modules present in logs for helper filter
  const modulesList = ["Companies", "Staff", "Leaves", "Commissions", "Vendors", "Contracts", "Placements", "Expenses"];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>System Change Logs & Audit Trail</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track entries, edits, and deletions across all business modules in real-time.</p>
        </div>

        {auditLogs.length > 0 && (
          <button 
            className="btn-secondary delete" 
            style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all history audit logs? This action is permanent.")) {
                onClearLogs();
                onShowToast("Cleared audit log history registry.", "info");
              }
            }}
          >
            <Trash2 size={14} /> Clear Logs History
          </button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="controls-row">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search description or user..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="select-filter"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="all">All Modules</option>
            {modulesList.map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>

          <select 
            className="select-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All Action Types</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
        <table className="entity-table" style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick('timestamp')} style={{ cursor: 'pointer', userSelect: 'none', width: '180px' }}>
                Timestamp {renderSortIndicator('timestamp')}
              </th>
              <th onClick={() => handleHeaderClick('module')} style={{ cursor: 'pointer', userSelect: 'none', width: '140px' }}>
                Module {renderSortIndicator('module')}
              </th>
              <th onClick={() => handleHeaderClick('action')} style={{ cursor: 'pointer', userSelect: 'none', width: '120px' }}>
                Action {renderSortIndicator('action')}
              </th>
              <th>Description</th>
              <th onClick={() => handleHeaderClick('user')} style={{ cursor: 'pointer', userSelect: 'none', width: '150px' }}>
                User / Agent {renderSortIndicator('user')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFiltered.map(log => {
              const dateStr = new Date(log.timestamp).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              // Action badge styling
              const actionColor = log.action === 'CREATE' 
                ? 'var(--success)' 
                : log.action === 'UPDATE' 
                ? 'var(--primary)' 
                : 'var(--danger)';
              const actionBg = log.action === 'CREATE'
                ? 'rgba(16, 185, 129, 0.08)'
                : log.action === 'UPDATE'
                ? 'rgba(59, 130, 246, 0.08)'
                : 'rgba(239, 68, 68, 0.08)';

              return (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{dateStr}</td>
                  <td>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 600,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {log.module}
                    </span>
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: actionColor,
                      backgroundColor: actionBg,
                      border: `1px solid ${actionColor}33`,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: '13px' }}>{log.description}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{log.user || 'Admin'}</td>
                </tr>
              );
            })}
            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No activity logs matched selected filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
