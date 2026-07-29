import React, { useState, useMemo } from 'react';
import { Search, CheckCircle2, XCircle, Clock, User, Calendar, DollarSign } from 'lucide-react';
import { Company, Staff, Placement } from '../../types';
import { formatGBP } from '../../utils/currency';

interface CommissionPayoutTrackerProps {
  companies: Company[];
  staff: Staff[];
  placements: Placement[];
  onSavePlacement: (p: Placement) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  currentUser?: any;
}

export default function CommissionPayoutTracker({
  companies,
  staff,
  placements,
  onSavePlacement,
  onShowToast,
  currentUser
}: CommissionPayoutTrackerProps) {
  const isRecruiter = currentUser?.permissions?.role === 'recruiter';

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientPayFilter, setClientPayFilter] = useState('all'); // all, paid, unpaid
  const [commPayFilter, setCommPayFilter] = useState('all'); // all, paid, unpaid
  const [commMonthFilter, setCommMonthFilter] = useState('all'); // all, or specific month

  // Retrieve unique commission paid months for filter
  const allPaidMonths = useMemo(() => {
    const months = new Set<string>();
    placements.forEach(p => {
      if (p.commissionPaidMonth) {
        months.add(p.commissionPaidMonth);
      }
    });
    return Array.from(months).sort();
  }, [placements]);

  // Filtered Placements
  const filteredPlacements = useMemo(() => {
    return placements.filter(p => {
      // 1. Search term (candidate, client company, placementId)
      const matchesSearch = 
        (p.candidateName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.clientCompany?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.placementId?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      // 2. Recruiter filter
      const matchesRecruiter = recruiterFilter === 'all' || 
        p.splits?.some(s => s.staffId === recruiterFilter);

      // 3. Client Payment Status filter
      const isClientPaid = p.clientPaymentStatus === 'paid' || p.status === 'paid';
      const matchesClientPay = clientPayFilter === 'all' ||
        (clientPayFilter === 'paid' && isClientPaid) ||
        (clientPayFilter === 'unpaid' && !isClientPaid);

      // 4. Commission Payment Status filter
      const isCommPaid = !!p.commissionPaidMonth;
      const matchesCommPay = commPayFilter === 'all' ||
        (commPayFilter === 'paid' && isCommPaid) ||
        (commPayFilter === 'unpaid' && !isCommPaid);

      // 5. Commission Paid Month filter
      const matchesCommMonth = commMonthFilter === 'all' ||
        p.commissionPaidMonth === commMonthFilter;

      return matchesSearch && matchesRecruiter && matchesClientPay && matchesCommPay && matchesCommMonth;
    });
  }, [placements, searchTerm, recruiterFilter, clientPayFilter, commPayFilter, commMonthFilter]);

  // Stats Counters
  const stats = useMemo(() => {
    let totalFee = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    filteredPlacements.forEach(p => {
      totalFee += p.netScoreValue || 0;
      if (p.commissionPaidMonth) {
        paidCount++;
      } else {
        unpaidCount++;
      }
    });

    return {
      totalCount: filteredPlacements.length,
      totalFee,
      paidCount,
      unpaidCount
    };
  }, [filteredPlacements]);

  // Handle Mark Paid / Unpaid toggle
  const handleTogglePaidStatus = async (placement: Placement) => {
    if (isRecruiter) return;

    try {
      if (placement.commissionPaidMonth) {
        // Clear paid month (Mark Unpaid)
        await onSavePlacement({
          ...placement,
          commissionPaidMonth: undefined // will clear from document
        });
        onShowToast(`Placement ${placement.candidateName} marked as Commission Unpaid.`, "info");
      } else {
        // Mark Paid (Default to month following placement start date)
        let defaultMonth = '';
        if (placement.startDate) {
          const date = new Date(placement.startDate);
          date.setMonth(date.getMonth() + 1);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          defaultMonth = `${y}-${m}`;
        } else {
          // Default to current calendar month
          const date = new Date();
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          defaultMonth = `${y}-${m}`;
        }

        await onSavePlacement({
          ...placement,
          commissionPaidMonth: defaultMonth
        });
        onShowToast(`Placement ${placement.candidateName} marked as Commission Paid for ${defaultMonth}.`, "success");
      }
    } catch (err: any) {
      onShowToast(`Error updating commission status: ${err.message}`, "warning");
    }
  };

  // Handle Dropdown month change
  const handleMonthChange = async (placement: Placement, monthVal: string) => {
    if (isRecruiter) return;

    try {
      const updatedVal = monthVal === 'unpaid' ? undefined : monthVal;
      await onSavePlacement({
        ...placement,
        commissionPaidMonth: updatedVal
      });
      if (updatedVal) {
        onShowToast(`Commission month updated to ${updatedVal} for ${placement.candidateName}.`, "success");
      } else {
        onShowToast(`Commission status cleared for ${placement.candidateName}.`, "info");
      }
    } catch (err: any) {
      onShowToast(`Error updating commission month: ${err.message}`, "warning");
    }
  };

  // Generate Month list for Select dropdown (range: 2025-01 to 2027-12)
  const dropdownMonths = useMemo(() => {
    const list: string[] = [];
    const startYear = 2025;
    const endYear = 2027;
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        list.push(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    return list;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Stats Summary Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderRadius: '10px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Active Net Score</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{formatGBP(stats.totalFee)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stats.totalCount} Placements</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '10px' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Commissions Paid</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>{stats.paidCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Settled split allocations</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--warning)', borderRadius: '10px' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Commissions Pending</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--warning)' }}>{stats.unpaidCount}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Unpaid / pending schedule</div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="controls-card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
          <input 
            type="text"
            className="search-input"
            placeholder="Search candidate, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'none', width: '100%', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Recruiter Selector */}
        {!isRecruiter && (
          <select 
            className="select-filter"
            value={recruiterFilter}
            onChange={(e) => setRecruiterFilter(e.target.value)}
            style={{ minWidth: '150px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
          >
            <option value="all">All Recruiters</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        )}

        {/* Client Pay Status */}
        <select 
          className="select-filter"
          value={clientPayFilter}
          onChange={(e) => setClientPayFilter(e.target.value)}
          style={{ minWidth: '160px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
        >
          <option value="all">Client Payment Status (All)</option>
          <option value="paid">Client Settled (Paid)</option>
          <option value="unpaid">Client Outstanding (Unpaid)</option>
        </select>

        {/* Commission Pay Status */}
        <select 
          className="select-filter"
          value={commPayFilter}
          onChange={(e) => setCommPayFilter(e.target.value)}
          style={{ minWidth: '160px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
        >
          <option value="all">Commission Status (All)</option>
          <option value="paid">Commission Paid</option>
          <option value="unpaid">Commission Pending</option>
        </select>

        {/* Payout Month Filter */}
        <select 
          className="select-filter"
          value={commMonthFilter}
          onChange={(e) => setCommMonthFilter(e.target.value)}
          style={{ minWidth: '160px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
        >
          <option value="all">Payout Month (All)</option>
          {allPaidMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Main Table */}
      <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table className="entity-table dense" style={{ minWidth: '1100px' }}>
          <thead>
            <tr>
              <th>ID & Candidate</th>
              <th>Client Company</th>
              <th>Start Date</th>
              <th style={{ textAlign: 'right' }}>Net Score Fee</th>
              <th>Splits & Commissions</th>
              <th>Client Status</th>
              <th>Commission Status</th>
              {!isRecruiter && <th style={{ textAlign: 'center' }}>Action / Select Month</th>}
            </tr>
          </thead>
          <tbody>
            {filteredPlacements.length === 0 ? (
              <tr>
                <td colSpan={isRecruiter ? 7 : 8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No matching placements found.
                </td>
              </tr>
            ) : (
              filteredPlacements.map(p => {
                const isClientPaid = p.clientPaymentStatus === 'paid' || p.status === 'paid';
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.candidateName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.placementId || p.id.substring(0, 8).toUpperCase()}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{p.clientCompany}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        {p.startDate || 'Not set'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px' }}>
                      {formatGBP(p.netScoreValue || 0)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {p.splits && p.splits.length > 0 ? (
                          p.splits.map((s, idx) => {
                            const rec = staff.find(st => st.id === s.staffId);
                            const splitVal = (p.netScoreValue * s.percentage) / 100;
                            return (
                              <div key={idx} style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                                👤 <strong>{rec?.fullName || 'Unknown'}</strong> ({s.percentage}%): {formatGBP(splitVal)}
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100% House Placement</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isClientPaid ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          Paid {p.clientPaidDate ? `(${p.clientPaidDate})` : ''}
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td>
                      {p.commissionPaidMonth ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                          Paid ✅ ({p.commissionPaidMonth})
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--warning)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          Pending ⏳
                        </span>
                      )}
                    </td>
                    {!isRecruiter && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleTogglePaidStatus(p)}
                            className={p.commissionPaidMonth ? "btn-secondary" : "btn-primary"}
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '11px', 
                              fontWeight: 600, 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {p.commissionPaidMonth ? (
                              <>
                                <XCircle size={12} /> Mark Unpaid
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={12} /> Mark Paid
                              </>
                            )}
                          </button>

                          <select
                            value={p.commissionPaidMonth || 'unpaid'}
                            onChange={(e) => handleMonthChange(p, e.target.value)}
                            style={{ 
                              padding: '4px 6px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-color)', 
                              fontSize: '11px',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="unpaid">-- Payout Month --</option>
                            {dropdownMonths.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
