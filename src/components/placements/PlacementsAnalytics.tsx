import React, { useState, useMemo } from 'react';
import { Company, Staff } from '../../types';
import { ExtendedPlacement } from './shared';
import { formatGBP } from '../../utils/currency';

interface PlacementsAnalyticsProps {
  companies: Company[];
  staff: Staff[];
  placements: ExtendedPlacement[];
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PlacementsAnalytics({
  companies,
  staff,
  placements
}: PlacementsAnalyticsProps) {
  const [selectedYear, setSelectedYear] = useState('2026');

  // Filter placements by selected year and active status
  const yearPlacements = useMemo(() => {
    return placements.filter(p => {
      if (!p.startDate || p.status === 'dns') return false;
      const yr = p.startDate.split('-')[0];
      return yr === selectedYear;
    });
  }, [placements, selectedYear]);

  // Calculations for KPIs
  const stats = useMemo(() => {
    let totalFee = 0;
    let count = 0;
    let permCount = 0;
    let contractCount = 0;

    yearPlacements.forEach(p => {
      const fee = Number(p.grossFee || p.netScoreValue || 0);
      totalFee += fee;
      count++;
      
      const type = (p.placementType || 'permanent').toLowerCase();
      if (type.includes('contract') || type.includes('temp')) {
        contractCount++;
      } else {
        permCount++;
      }
    });

    const avgFee = count > 0 ? totalFee / count : 0;

    return {
      totalFee,
      count,
      permCount,
      contractCount,
      avgFee
    };
  }, [yearPlacements]);

  // Month-over-Month data
  const monthlyData = useMemo(() => {
    const data = Array(12).fill(0);
    yearPlacements.forEach(p => {
      const parts = p.startDate.split('-');
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        data[monthIdx] += Number(p.grossFee || p.netScoreValue || 0);
      }
    });
    return data;
  }, [yearPlacements]);

  // Top 5 Clients
  const topClients = useMemo(() => {
    const clientsMap: Record<string, number> = {};
    yearPlacements.forEach(p => {
      const client = p.clientCompany || 'Unknown Client';
      clientsMap[client] = (clientsMap[client] || 0) + Number(p.grossFee || p.netScoreValue || 0);
    });

    return Object.entries(clientsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [yearPlacements]);

  // Chart measurements for MoM line chart
  const padding = 40;
  const chartHeight = 220;
  const chartWidth = 700;
  const maxVal = Math.max(...monthlyData, 10000); // at least 10k to scale nicely

  const points = useMemo(() => {
    return monthlyData.map((val, idx) => {
      const x = padding + (idx * (chartWidth - padding * 2)) / 11;
      const y = chartHeight - padding - (val * (chartHeight - padding * 2)) / maxVal;
      return { x, y, val, month: months[idx] };
    });
  }, [monthlyData, maxVal]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} ${chartHeight - padding} L ${first.x} ${chartHeight - padding} Z`;
  }, [points, pathD]);

  // [Tooltip Hover State]
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; month: string } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Placements Analytics & Billing Trends</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Visual analytics of placement volumes, billing distributions, and top clients.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Fiscal Year:</span>
          <select
            className="select-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: '8px', fontSize: '13px' }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2027">2027</option>
          </select>
        </div>
      </div>

      {/* KPI stats widgets */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="metric-card" style={{ '--card-accent': 'var(--primary)', padding: '16px' } as any}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>YTD Total Fee Volume</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>
              {formatGBP(stats.totalFee)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Gross recruitment invoices</div>
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--accent)', padding: '16px' } as any}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Average Placement Fee</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>
              {formatGBP(stats.avgFee)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Per billed invoice deal</div>
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--success)', padding: '16px' } as any}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Invoiced Deals</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>
              {stats.count} placements
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Excluding DNS entries</div>
          </div>
        </div>

        <div className="metric-card" style={{ '--card-accent': 'var(--warning)', padding: '16px' } as any}>
          <div className="metric-info">
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Placement Type Share</span>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>
              {stats.permCount} P / {stats.contractCount} C
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Permanent vs Contract ratio</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '20px' }}>
        
        {/* Month-over-Month billing line chart */}
        <div className="detail-section" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>📈 Month-over-Month Placed Fee Volume</h3>
          
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              style={{ width: '100%', height: 'auto', overflow: 'visible' }}
            >
              {/* Gradients */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--accent)" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padding + ratio * (chartHeight - padding * 2);
                const gridVal = maxVal * (1 - ratio);
                return (
                  <g key={idx}>
                    <line 
                      x1={padding} 
                      y1={y} 
                      x2={chartWidth - padding} 
                      y2={y} 
                      stroke="var(--border-color)" 
                      strokeWidth="1" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={padding - 8} 
                      y={y + 4} 
                      fill="var(--text-muted)" 
                      fontSize="9" 
                      textAnchor="end"
                    >
                      £{Math.round(gridVal / 1000)}k
                    </text>
                  </g>
                );
              })}

              {/* Area path */}
              <path d={areaD} fill="url(#chartGradient)" />

              {/* Line path */}
              <path 
                d={pathD} 
                fill="none" 
                stroke="url(#lineGlow)" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Points & Hover zones */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="4" 
                    fill="var(--bg-card)" 
                    stroke="var(--primary)" 
                    strokeWidth="2.5" 
                  />
                  {/* Invisible larger hover zone */}
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="12" 
                    fill="transparent" 
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}

              {/* X Axis Labels */}
              {points.map((p, idx) => (
                <text 
                  key={idx} 
                  x={p.x} 
                  y={chartHeight - padding + 16} 
                  fill="var(--text-secondary)" 
                  fontSize="10" 
                  textAnchor="middle"
                >
                  {p.month}
                </text>
              ))}
            </svg>

            {/* Custom Interactive Tooltip */}
            {hoveredPoint && (
              <div style={{
                position: 'absolute',
                top: `${hoveredPoint.y - 65}px`,
                left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid var(--primary)',
                borderRadius: '8px',
                padding: '6px 12px',
                boxShadow: 'var(--shadow-lg)',
                color: '#fff',
                fontSize: '11px',
                zIndex: 10,
                pointerEvents: 'none',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{hoveredPoint.month} Billings</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  {formatGBP(hoveredPoint.val)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Clients Bar Chart */}
        <div className="detail-section" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>🏆 Top 5 Client Billings</h3>

          {topClients.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No billing data available for this year.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
              {(() => {
                const maxClientVal = Math.max(...topClients.map(c => c.value), 1);
                return topClients.map((client, idx) => {
                  const percentage = (client.value / maxClientVal) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{client.name}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatGBP(client.value)}</span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${percentage}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, var(--primary), var(--accent))', 
                            borderRadius: '4px',
                            transition: 'width 0.8s ease'
                          }} 
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
export { PlacementsAnalytics };
