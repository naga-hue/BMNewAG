import React from 'react';
import { Staff } from '../../types';
import { ExtendedPlacement } from './shared';

interface PlacementsLeaderboardProps {
  staff: Staff[];
  placements: ExtendedPlacement[];
  leaderboardMonth: string;
  setLeaderboardMonth: (month: string) => void;
}

export default function PlacementsLeaderboard({
  staff,
  placements,
  leaderboardMonth,
  setLeaderboardMonth
}: PlacementsLeaderboardProps) {
  // Billings Leaderboard calculations based on splits
  const getLeaderboardData = () => {
    const [year, month] = leaderboardMonth.split('-').map(Number);

    const summaries = staff.map(member => {
      let totalBilling = 0;
      let placementCount = 0;

      placements.forEach(p => {
        if (p.status === 'dns') return;
        const dateStr = p.startDate || p.scoredDate || '';
        if (!dateStr) return;
        const pDate = new Date(dateStr);
        if (pDate.getFullYear() === year && pDate.getMonth() + 1 === month) {
          const splitObj = p.splits?.find(s => s.staffId === member.id);
          if (splitObj) {
            const netValue = p.netScoreValue || 0;
            const percentage = splitObj.percentage || 100;
            const allocation = (netValue * percentage) / 100;
            totalBilling += allocation;
            placementCount += percentage / 100;
          }
        }
      });

      return {
        member,
        totalBilling,
        placementCount
      };
    });

    return summaries.sort((a, b) => b.totalBilling - a.totalBilling);
  };

  const leaderboardList = getLeaderboardData();
  const maxBilling = Math.max(...leaderboardList.map(l => l.totalBilling), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Consultant Billing Rankings</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Rankings based on split placement net fees generated during the selected calendar month.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Select Month:</span>
          <input
            type="month"
            className="select-filter"
            value={leaderboardMonth}
            onChange={e => setLeaderboardMonth(e.target.value)}
            style={{ padding: '6px' }}
          />
        </div>
      </div>

      <div className="chart-card" style={{ width: '100%', padding: '24px' }}>
        <div className="distribution-list" style={{ gap: '20px' }}>
          {leaderboardList.map((row, idx) => (
            <div key={row.member.id} className="distribution-item">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: idx === 0 ? 'var(--warning)' : 'var(--text-muted)',
                      width: '24px',
                      textAlign: 'center'
                    }}
                  >
                    #{idx + 1}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{row.member.fullName}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {row.member.jobTitle || 'Consultant'} &bull; {row.member.department || 'Sales'}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>
                    £
                    {row.totalBilling.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {Number(row.placementCount.toFixed(2))}{' '}
                    {Number(row.placementCount.toFixed(2)) === 1 ? 'placement' : 'placements'} (split
                    allocations)
                  </div>
                </div>
              </div>

              <div className="dist-bar-bg" style={{ height: '8px' }}>
                <div
                  className="dist-bar-fill"
                  style={{
                    width: `${(row.totalBilling / maxBilling) * 100}%`,
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #6366f1, #4f46e5)'
                  }}
                />
              </div>
            </div>
          ))}
          {leaderboardList.length === 0 && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontStyle: 'italic'
              }}
            >
              No active placements scored for this month.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
