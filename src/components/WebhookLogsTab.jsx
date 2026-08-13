import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Search, RefreshCw, Eye, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function WebhookLogsTab({ onShowToast }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activePayloadDetail, setActivePayloadDetail] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadLogs() {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'dialpad_webhook_logs'),
          orderBy('received_at', 'desc'),
          limit(150)
        );
        const snap = await getDocs(q);
        if (!active) return;
        const fetched = [];
        snap.forEach(docSnap => {
          fetched.push({ id: docSnap.id, ...docSnap.data() });
        });
        setLogs(fetched);
      } catch (err) {
        console.error('Failed to load webhook logs:', err);
        if (onShowToast) {
          onShowToast('Error loading webhook audit logs.', 'error');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadLogs();
    return () => { active = false; };
  }, [refreshTrigger]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.dialpad_call_id || '').toLowerCase().includes(q) ||
      (log.contact_name || '').toLowerCase().includes(q) ||
      (log.external_number || '').toLowerCase().includes(q) ||
      (log.internal_user || '').toLowerCase().includes(q) ||
      (log.event_type_state || '').toLowerCase().includes(q) ||
      (log.processing_result || '').toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  const getBadgeColors = (state) => {
    const s = (state || '').toLowerCase();
    if (s === 'hangup' || s === 'ended') return { bg: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af' };
    if (s === 'connected') return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (s === 'ringing') return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' };
    return { bg: 'rgba(255, 255, 255, 0.05)', color: '#e5e7eb' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Dialpad Webhook Audit Logs</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Real-time webhook events received from Dialpad and processed into Firestore database.
          </p>
        </div>
        
        <button
          onClick={() => setRefreshTrigger(p => p + 1)}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {/* Filter toolbar */}
      <div style={{ position: 'relative', maxWidth: '380px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by Call ID, Recruiter, Contact..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input"
          style={{ paddingLeft: '32px', fontSize: '12px', height: '34px', width: '100%' }}
        />
      </div>

      {/* Table Container */}
      <div className="card" style={{ padding: 0, borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Received At</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Call ID</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Recruiter</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Contact</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Dir</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>State</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Processing Summary</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', textAlign: 'center' }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                    <div>Loading webhook transaction registry...</div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No webhook logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const stateBadge = getBadgeColors(log.event_type_state);
                  const isSuccess = log.database_result !== 'failed';
                  
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {formatTimestamp(log.received_at)}
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {log.dialpad_call_id || 'N/A'}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>
                        {log.internal_user || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unmapped</span>}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>
                        {log.contact_name ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{log.contact_name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{log.external_number}</div>
                          </div>
                        ) : (
                          log.external_number || 'N/A'
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: log.direction === 'outbound' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          color: log.direction === 'outbound' ? '#3b82f6' : '#10b981'
                        }}>
                          {log.direction === 'outbound' ? 'OUT' : 'IN'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: stateBadge.bg,
                          color: stateBadge.color
                        }}>
                          {log.event_type_state ? log.event_type_state.toUpperCase() : 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.processing_result}>
                        {log.processing_result || 'Processed call state transition'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {isSuccess ? (
                            <CheckCircle size={16} color="var(--success)" title="Successfully committed to Firebase" />
                          ) : (
                            <AlertCircle size={16} color="var(--danger)" title={log.error_message || 'Database write failed'} />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setActivePayloadDetail(log)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Inspect raw log entry"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Payload Detail Modal */}
      {activePayloadDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '650px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🔍 Webhook Document Detail: {activePayloadDetail.id}
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Event Received: {new Date(activePayloadDetail.received_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setActivePayloadDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto' }}>
              
              {/* Summary attributes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>EVENT TYPE</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{activePayloadDetail.event_type_state || 'N/A'}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>HTTP RESPONSE STATUS</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: activePayloadDetail.http_response_status === 200 ? 'var(--success)' : 'var(--danger)' }}>
                    {activePayloadDetail.http_response_status || 'N/A'}
                  </div>
                </div>
              </div>

              {activePayloadDetail.error_message && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} color="var(--danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)' }}>Database Commit Error</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{activePayloadDetail.error_message}</div>
                  </div>
                </div>
              )}

              {/* JSON payload inspector */}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>RAW AUDIT RECORD FIELDS:</div>
              <pre style={{
                margin: 0,
                padding: '12px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '11px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                maxHeight: '260px',
                color: '#34d399'
              }}>
                {JSON.stringify(activePayloadDetail, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <button
                onClick={() => setActivePayloadDetail(null)}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
