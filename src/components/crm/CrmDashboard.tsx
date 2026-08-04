import React, { useState } from 'react';
import CrmClientTab from './CrmClientTab';
import CrmCandidateTab from './CrmCandidateTab';
import { useBoundStore } from '../../store/useBoundStore';

interface CrmDashboardProps {
  onShowToast: (msg: string, type?: string) => void;
}

type TabType = 'clients' | 'candidates';

export default function CrmDashboard({ onShowToast }: CrmDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('clients');
  const crmClientCompanies = useBoundStore(state => state.crmClientCompanies);
  const crmCandidates = useBoundStore(state => state.crmCandidates);
  const placements = useBoundStore(state => state.placements);

  // Computing stats
  const totalClients = crmClientCompanies.length;
  const totalCandidates = crmCandidates.length;
  const candidatesWithCv = crmCandidates.filter(c => !!c.cvUrl).length;
  const totalBilling = placements.reduce((sum, p) => sum + (Number(p.netScoreValue) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Dynamic Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>CRM Recruiting Desk</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage client organization structures, candidate talent profiles, CV attachments, and active placements.
          </p>
        </div>
      </div>

      {/* Modern Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="summary-card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Clients</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0' }}>{totalClients}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Registered corporate entities</span>
        </div>
        <div className="summary-card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Talent Pool size</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0' }}>{totalCandidates}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Professional candidate database</span>
        </div>
        <div className="summary-card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Candidates with CVs</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', margin: '8px 0' }}>{candidatesWithCv}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {totalCandidates > 0 ? `${((candidatesWithCv / totalCandidates) * 100).toFixed(0)}% coverage rate` : '0% coverage'}
          </span>
        </div>
        <div className="summary-card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Value Billed</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6', margin: '8px 0' }}>
            £{totalBilling.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Aggregate sum of placement fees</span>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('clients')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'clients' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'clients' ? '#3b82f6' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Corporate Clients Directory
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'candidates' ? '3px solid #3b82f6' : '3px solid transparent',
            color: activeTab === 'candidates' ? '#3b82f6' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Candidate Talent Database
        </button>
      </div>

      {/* Active Tab Screen */}
      <div>
        {activeTab === 'clients' ? (
          <CrmClientTab onShowToast={onShowToast} />
        ) : (
          <CrmCandidateTab onShowToast={onShowToast} />
        )}
      </div>
    </div>
  );
}
