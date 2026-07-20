import React, { useState, useMemo } from 'react';
import { Company, Staff } from '../../types';
import { Users, Calendar, ShieldCheck, Building2, Search, Filter } from 'lucide-react';

interface TeamLeaveDashboardProps {
  companies: Company[];
  staff: Staff[];
  leavePolicies: any[];
  leaveRequests: any[];
  onShowToast: (msg: string, type?: string) => void;
}

export default function TeamLeaveDashboard({
  companies,
  staff,
  leavePolicies,
  leaveRequests,
  onShowToast
}: TeamLeaveDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to compute dynamic annual leave allowance based on service years
  const resolveAnnualAllowance = (member: Staff, policy: any) => {
    if (!policy) return 20;
    if (policy.name.toLowerCase().includes('global recruiters')) {
      if (!member.startDate) return 20;
      const start = new Date(member.startDate);
      if (isNaN(start.getTime())) return 20;

      const today = new Date();
      let years = today.getFullYear() - start.getFullYear();
      const m = today.getMonth() - start.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
        years--;
      }
      const calculated = 20 + Math.max(0, years);
      return Math.min(25, calculated);
    }
    return policy.annualAllowance || 20;
  };

  // Resolve departments list dynamically based on company selection
  const allDepartments = useMemo(() => {
    const depts: string[] = [];
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        if (selectedCompanyId === 'all' || s.companyId === selectedCompanyId) {
          depts.push(s.department);
        }
      }
    });
    return depts.sort();
  }, [staff, selectedCompanyId]);

  // Compute all balances
  const balances = useMemo(() => {
    return staff.map(member => {
      const policy = leavePolicies.find(p => p.id === member.leavePolicyId);
      const company = companies.find(c => c.id === member.companyId);
      const companyName = company ? company.name : 'Unknown Company';
      
      const memberLeaves = leaveRequests.filter(r => r.staffId === member.id && r.status === 'approved');
      
      const annualTaken = memberLeaves.filter(r => r.leaveType === 'annual').reduce((sum, r) => sum + r.totalDays, 0);
      const sickTaken = memberLeaves.filter(r => r.leaveType === 'sick').reduce((sum, r) => sum + r.totalDays, 0);
      const unpaidTaken = memberLeaves.filter(r => r.leaveType === 'unpaid').reduce((sum, r) => sum + r.totalDays, 0);
      const compassionateTaken = memberLeaves.filter(r => r.leaveType === 'other').reduce((sum, r) => sum + r.totalDays, 0);

      const annualAllowed = resolveAnnualAllowance(member, policy);
      const sickAllowed = policy ? policy.sickAllowance : 10;

      return {
        member,
        companyName,
        policyName: policy ? policy.name : 'None',
        annualAllowed,
        annualTaken,
        annualRemaining: Math.max(0, annualAllowed - annualTaken),
        sickAllowed,
        sickTaken,
        sickRemaining: Math.max(0, sickAllowed - sickTaken),
        unpaidTaken,
        compassionateTaken
      };
    });
  }, [staff, leavePolicies, leaveRequests, companies]);

  // Filtered staff balances list
  const filteredBalances = useMemo(() => {
    return balances.filter(b => {
      const matchSearch = b.member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (b.member.jobTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCompany = selectedCompanyId === 'all' || b.member.companyId === selectedCompanyId;
      const matchDept = selectedDept === 'all' || b.member.department === selectedDept;

      return matchSearch && matchCompany && matchDept;
    });
  }, [balances, searchQuery, selectedCompanyId, selectedDept]);

  // Who is on leave today / this week
  const currentLeaves = useMemo(() => {
    // Check if start date <= today and end date >= today
    return leaveRequests
      .filter(req => req.status === 'approved' && req.startDate <= todayStr && req.endDate >= todayStr)
      .map(req => {
        const member = staff.find(s => s.id === req.staffId);
        const company = member ? companies.find(c => c.id === member.companyId) : null;
        return {
          id: req.id,
          employeeName: member ? member.fullName : 'Unknown',
          companyName: company ? company.name : 'Group Company',
          department: member ? member.department || 'N/A' : 'N/A',
          type: req.leaveType,
          startDate: req.startDate,
          endDate: req.endDate,
          totalDays: req.totalDays,
          notes: req.notes || ''
        };
      });
  }, [leaveRequests, staff, companies, todayStr]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="detail-section" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 0, padding: '20px' }}>
          <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>On Leave Today</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{currentLeaves.length}</div>
          </div>
        </div>

        <div className="detail-section" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 0, padding: '20px' }}>
          <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)', padding: '12px', borderRadius: '10px' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Directory</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{staff.filter(s => s.status !== 'exited').length} members</div>
          </div>
        </div>

        <div className="detail-section" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 0, padding: '20px' }}>
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '10px' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Mapped Leave Policies</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{leavePolicies.length} Active</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left side Today's Absences, Right side filters and search */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* Section: Who is on leave today */}
        <div className="detail-section" style={{ padding: '20px', marginBottom: 0 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🌴 Team Members Out of Office (Today)</span>
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px' }}>
              {currentLeaves.length} Active
            </span>
          </h3>

          {currentLeaves.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No team members are out of office today.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="payroll-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Company</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Total Days</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLeaves.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.employeeName}</td>
                      <td>{l.companyName}</td>
                      <td>{l.department}</td>
                      <td>
                        <span style={{ 
                          textTransform: 'capitalize', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          fontSize: '10px',
                          backgroundColor: l.type === 'annual' ? 'rgba(99, 102, 241, 0.12)' : l.type === 'sick' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.06)',
                          color: l.type === 'annual' ? 'var(--primary)' : l.type === 'sick' ? 'var(--warning)' : 'var(--text-secondary)'
                        }}>
                          {l.type} Leave
                        </span>
                      </td>
                      <td>{l.startDate} to {l.endDate}</td>
                      <td style={{ fontWeight: 700 }}>{l.totalDays} days</td>
                      <td style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{l.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section: Leave Balance Directory */}
        <div className="detail-section" style={{ padding: '20px', marginBottom: 0 }}>
          
          {/* Header & Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>📊 Team Leave Balances & Allowances</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Showing {filteredBalances.length} of {balances.length} employees
              </div>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Search name, job title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px', width: '100%' }}
                />
              </div>

              {/* Company Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="select-filter"
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedDept('all'); // Reset department filter
                  }}
                  style={{ flex: 1, padding: '8px' }}
                >
                  <option value="all">All Companies</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Department Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="select-filter"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  style={{ flex: 1, padding: '8px' }}
                >
                  <option value="all">All Departments</option>
                  {allDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Balances Directory Table */}
          {filteredBalances.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No employees match the selected search and filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="payroll-table" style={{ width: '100%', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th>Employee Name</th>
                    <th>Company</th>
                    <th>Department</th>
                    <th>Leave Policy</th>
                    <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>Annual Allowed</th>
                    <th style={{ textAlign: 'center' }}>Annual Taken</th>
                    <th style={{ textAlign: 'center', color: 'var(--primary)' }}>Annual Left</th>
                    <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>Sick Allowed</th>
                    <th style={{ textAlign: 'center' }}>Sick Taken</th>
                    <th style={{ textAlign: 'center', color: 'var(--warning)' }}>Sick Left</th>
                    <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)' }}>Unpaid Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalances.map(b => (
                    <tr key={b.member.id}>
                      <td style={{ fontWeight: 600, fontSize: '12px' }}>{b.member.fullName}</td>
                      <td>{b.companyName}</td>
                      <td>{b.member.department || 'N/A'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.policyName}</td>
                      
                      {/* Annual leave */}
                      <td style={{ textAlign: 'center', fontWeight: 600, borderLeft: '1px solid var(--border-color)' }}>{b.annualAllowed}d</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{b.annualTaken}d</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '12px' }}>{b.annualRemaining}d</td>
                      
                      {/* Sick leave */}
                      <td style={{ textAlign: 'center', fontWeight: 600, borderLeft: '1px solid var(--border-color)' }}>{b.sickAllowed}d</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{b.sickTaken}d</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--warning)', fontSize: '12px' }}>{b.sickRemaining}d</td>
                      
                      {/* Unpaid */}
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-color)' }}>{b.unpaidTaken}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
