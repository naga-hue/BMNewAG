import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Users, 
  Building2, 
  Briefcase, 
  FileText, 
  Receipt, 
  Laptop, 
  X, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { toGBP } from '../utils/currency';

export default function GlobalQuickSearchModal({
  isOpen,
  onClose,
  staff = [],
  companies = [],
  placements = [],
  contracts = [],
  vendors = [],
  expenses = [],
  setActiveTab,
  setSelectedCompany,
  setSelectedStaff
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search results compilation
  const staffResults = q
    ? staff.filter(s => 
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.businessEmail && s.businessEmail.toLowerCase().includes(q)) ||
        (s.jobTitle && s.jobTitle.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const companyResults = q
    ? companies.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.registrationNumber && c.registrationNumber.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const placementResults = q
    ? placements.filter(p => 
        (p.candidateName && p.candidateName.toLowerCase().includes(q)) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(q)) ||
        (p.placementId && p.placementId.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const contractResults = q
    ? contracts.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.vendorName && c.vendorName.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const totalResults = staffResults.length + companyResults.length + placementResults.length + contractResults.length;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '80px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <Search size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Quick search staff, companies, placements, invoices, or contracts... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--text-primary)'
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          )}
          <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', padding: '3px 7px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div style={{ maxHeight: '450px', overflowY: 'auto', padding: q ? '12px' : '20px' }}>
          
          {!q && (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <Sparkles size={32} style={{ color: 'var(--primary)', marginBottom: '8px', opacity: 0.8 }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Instant Quick Search across all system records
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Type a name, candidate, client, invoice ID, or contract to jump directly to any record.
              </div>
            </div>
          )}

          {q && totalResults === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No records found matching "<strong>{query}</strong>"
            </div>
          )}

          {/* 👥 Staff Results */}
          {staffResults.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingLeft: '8px' }}>
                👥 Staff Personnel ({staffResults.length})
              </div>
              {staffResults.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    if (setSelectedStaff) setSelectedStaff(s);
                    setActiveTab('staff');
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.jobTitle || 'Staff Member'} • {s.department || 'General'}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* 🏢 Company Results */}
          {companyResults.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingLeft: '8px' }}>
                🏢 Companies & Group Entities ({companyResults.length})
              </div>
              {companyResults.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    if (setSelectedCompany) setSelectedCompany(c);
                    setActiveTab('directory');
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.country || 'Global'} • Reg: {c.registrationNumber || 'N/A'}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* 💼 Placement Results */}
          {placementResults.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingLeft: '8px' }}>
                💼 Placements & Invoices ({placementResults.length})
              </div>
              {placementResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveTab('placements');
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Candidate: {p.candidateName} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({p.clientCompany})</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Invoice #{p.invoiceNumber || 'N/A'} • Gross: £{toGBP(p.grossBillAmount || p.netScoreValue || 0, p.currency || 'GBP').toLocaleString()}
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* 📑 Contract Results */}
          {contractResults.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingLeft: '8px' }}>
                📑 Vendor Contracts & Subscriptions ({contractResults.length})
              </div>
              {contractResults.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveTab('vendors');
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vendor: {c.vendorName || 'Vendor'} • Quantity: {c.quantityPurchased || 1}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
