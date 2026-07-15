import React, { useState } from 'react';
import PlacementsMatrix from './PlacementsMatrix';
import PlacementsRegistry from './PlacementsRegistry';
import PlacementsImporter from './PlacementsImporter';
import PlacementsLeaderboard from './PlacementsLeaderboard';
import PlacementsAnalytics from './PlacementsAnalytics';
import { Company, Staff } from '../../types';
import { ExtendedPlacement } from './shared';
import { useBoundStore } from '../../store/useBoundStore';
import { firebaseService } from '../../services/firebase';
import '../placements.css';

interface PlacementsDashboardProps {
  companies?: Company[];
  staff?: Staff[];
  placements?: ExtendedPlacement[];
  onSavePlacement?: (placement: any) => Promise<any>;
  onDeletePlacement?: (id: string) => Promise<any>;
  onSavePlacementsBatch?: (batch: any[]) => Promise<any>;
  onClearAllPlacements?: () => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function PlacementsDashboard({
  companies: propCompanies,
  staff: propStaff,
  placements: propPlacements,
  onSavePlacement: propOnSavePlacement,
  onDeletePlacement: propOnDeletePlacement,
  onSavePlacementsBatch: propOnSavePlacementsBatch,
  onClearAllPlacements: propOnClearAllPlacements,
  onShowToast
}: PlacementsDashboardProps) {
  const storePlacements = useBoundStore(state => state.placements) as ExtendedPlacement[];
  const storeCompanies = useBoundStore(state => state.companies);
  const storeStaff = useBoundStore(state => state.staff);

  const placements = propPlacements || storePlacements;
  const companies = propCompanies || storeCompanies;
  const staff = propStaff || storeStaff;

  const onSavePlacement = propOnSavePlacement || (async (placement) => {
    return await firebaseService.savePlacement(placement);
  });
  const onDeletePlacement = propOnDeletePlacement || (async (id) => {
    return await firebaseService.deletePlacement(id);
  });
  const onSavePlacementsBatch = propOnSavePlacementsBatch || (async (batch) => {
    return await firebaseService.savePlacementsBatch(batch);
  });
  const onClearAllPlacements = propOnClearAllPlacements || (async () => {
    return await firebaseService.clearPlacements(placements);
  });

  const [activeSubTab, setActiveSubTab] = useState<string>('matrix'); // matrix, registry, import, leaderboard, analytics

  // Shared detail modal state
  const [viewingPlacement, setViewingPlacement] = useState<ExtendedPlacement | null>(null);

  // Matrix states
  const [matrixYear, setMatrixYear] = useState('2026');
  const [matrixViewType, setMatrixViewType] = useState<'count' | 'value'>('count');
  const [selectedCellPlacements, setSelectedCellPlacements] = useState<any[] | null>(null);
  const [showDrilldownModal, setShowDrilldownModal] = useState(false);
  const [drilldownClient, setDrilldownClient] = useState('');
  const [drilldownMonthName, setDrilldownMonthName] = useState('');

  // Leaderboard states
  const [leaderboardMonth, setLeaderboardMonth] = useState('2026-06');

  // Trigger Matrix Drill-down modal
  const handleDrilldown = (cellPlacements: any[], clientName: string, monthName: string) => {
    setDrilldownClient(clientName);
    setDrilldownMonthName(monthName);
    setSelectedCellPlacements(cellPlacements);
    setShowDrilldownModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sub-tab Navigation */}
      <div className="placements-tab-nav">
        {[
          { key: 'matrix', label: 'YTD Client Placements Matrix' },
          { key: 'registry', label: 'Placements Log Desk' },
          { key: 'import', label: 'CSV Spreadsheet Importer' },
          { key: 'leaderboard', label: 'Monthly Billing Rankings' },
          { key: 'analytics', label: 'Billing Charts & Trends' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            className={`placements-tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUBtabs Routing */}
      {activeSubTab === 'analytics' && (
        <PlacementsAnalytics
          companies={companies}
          staff={staff}
          placements={placements}
        />
      )}

      {activeSubTab === 'matrix' && (
        <PlacementsMatrix
          companies={companies}
          staff={staff}
          placements={placements}
          matrixYear={matrixYear}
          setMatrixYear={setMatrixYear}
          matrixViewType={matrixViewType}
          setMatrixViewType={setMatrixViewType}
          onDrilldown={handleDrilldown}
        />
      )}

      {activeSubTab === 'registry' && (
        <PlacementsRegistry
          companies={companies}
          staff={staff}
          placements={placements}
          onSavePlacement={onSavePlacement}
          onDeletePlacement={onDeletePlacement || (async () => {})}
          onShowToast={onShowToast}
          viewingPlacement={viewingPlacement}
          setViewingPlacement={setViewingPlacement}
        />
      )}

      {activeSubTab === 'import' && (
        <PlacementsImporter
          staff={staff}
          onSavePlacementsBatch={onSavePlacementsBatch || (async () => {})}
          onClearAllPlacements={onClearAllPlacements}
          onShowToast={onShowToast}
          onImportDone={() => setActiveSubTab('registry')}
        />
      )}

      {activeSubTab === 'leaderboard' && (
        <PlacementsLeaderboard
          staff={staff}
          placements={placements}
          leaderboardMonth={leaderboardMonth}
          setLeaderboardMonth={setLeaderboardMonth}
        />
      )}

      {/* Drill-down modal */}
      {showDrilldownModal && selectedCellPlacements && (
        <div className="slide-over-overlay active" onClick={() => setShowDrilldownModal(false)} style={{ zIndex: 1000 }}>
          <div
            className="slide-over-panel"
            onClick={e => e.stopPropagation()}
            style={{
              width: '60%',
              maxWidth: '800px',
              backgroundColor: 'var(--bg-secondary)',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '16px',
                marginBottom: '20px'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                  Placements Drill-down: {drilldownClient}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Period: {drilldownMonthName} {matrixYear} &bull; {selectedCellPlacements.length}{' '}
                  {selectedCellPlacements.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <button
                onClick={() => setShowDrilldownModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                &times;
              </button>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="entity-table dense" style={{ fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Placement ID</th>
                    <th>Candidate Name</th>
                    <th>Client Company</th>
                    <th>Start Date</th>
                    <th style={{ textAlign: 'right' }}>Total Fee</th>
                    <th style={{ textAlign: 'center' }}>Split %</th>
                    <th style={{ textAlign: 'right' }}>Split Fee Share</th>
                    <th>Recruiter Splits</th>
                    <th>Client Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCellPlacements.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.placementId}</td>
                      <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
                      <td>{p.clientCompany || '—'}</td>
                      <td>{p.startDate}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        £{Number(p.netScoreValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {p.splits?.map((s: any) => (
                          <div key={s.staffId} style={{ fontSize: '10px' }}>
                            {s.percentage}%
                          </div>
                        ))}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                        {p.splits?.map((s: any) => {
                          const share = (Number(p.netScoreValue) || 0) * (Number(s.percentage) || 100) / 100;
                          return (
                            <div key={s.staffId} style={{ fontSize: '10px' }}>
                              £{share.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          );
                        })}
                      </td>
                      <td>
                        {p.splits?.map((s: any) => {
                          const r = staff.find(st => st.id === s.staffId);
                          return (
                            <div key={s.staffId} style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {r ? r.fullName : 'Recruiter'}
                            </div>
                          );
                        })}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)',
                            backgroundColor:
                              p.clientPaymentStatus === 'paid'
                                ? 'rgba(16, 185, 129, 0.08)'
                                : 'rgba(245, 158, 11, 0.08)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            border:
                              p.clientPaymentStatus === 'paid'
                                ? '1px solid rgba(16, 185, 129, 0.2)'
                                : '1px solid rgba(245, 158, 11, 0.2)'
                          }}
                        >
                          {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowDrilldownModal(false)}>
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
