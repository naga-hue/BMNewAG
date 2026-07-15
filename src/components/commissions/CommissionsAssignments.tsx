import React, { useState } from 'react';
import MultiSelectFilter from '../MultiSelectFilter';
import { Company, Staff } from '../../types';

interface CommissionsAssignmentsProps {
  companies: Company[];
  staff: Staff[];
  commissionPolicies: any[];
  onUpdateStaff?: (s: Staff) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function CommissionsAssignments({
  companies,
  staff,
  commissionPolicies,
  onUpdateStaff,
  onShowToast
}: CommissionsAssignmentsProps) {
  const [companyFilter, setCompanyFilter] = useState(['all']);
  const [deptFilter, setDeptFilter] = useState(['all']);
  const [staffFilter, setStaffFilter] = useState('all');

  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedExitedAssignments, setExpandedExitedAssignments] = useState(false);

  const companyOptions = [
    { value: 'all', label: 'All Companies' },
    ...companies.map(c => ({ value: c.id, label: c.name }))
  ];

  const allAvailableDepts = (() => {
    const depts: string[] = [];
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        const dname = typeof d === 'string' ? d : d.name;
        if (dname && !depts.includes(dname)) depts.push(dname);
      });
    });
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  })();

  const departmentOptionsList = [
    { value: 'all', label: 'All Departments' },
    ...allAvailableDepts.map(d => ({ value: d, label: d }))
  ];

  const handleHeaderClick = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const handleAssignPolicy = async (staffId: string, policyId: string) => {
    const employee = staff.find(s => s.id === staffId);
    if (!employee) return;

    if (onUpdateStaff) {
      const updatedEmployee = { ...employee, commissionPolicyId: policyId || '' };
      try {
        await onUpdateStaff(updatedEmployee);
        onShowToast(`Updated commission mapping for ${employee.fullName}`, 'success');
      } catch (err: any) {
        onShowToast(`Error updating assignment: ${err.message}`, 'warning');
      }
    }
  };

  const filteredAssignmentsStaff = staff.filter(s => {
    if (!companyFilter.includes('all') && !companyFilter.includes(s.companyId || '')) return false;
    if (!deptFilter.includes('all') && !deptFilter.includes(s.department || '')) return false;
    if (staffFilter !== 'all' && s.id !== staffFilter) return false;
    return true;
  });

  const sortedAssignmentsStaff = [...filteredAssignmentsStaff].sort((a, b) => {
    let valA = (a as any)[sortBy] || '';
    let valB = (b as any)[sortBy] || '';

    if (sortBy === 'fullName' || sortBy === 'jobTitle') {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    } else if (sortBy === 'companyId') {
      const compA = companies.find(c => c.id === a.companyId)?.name || '';
      const compB = companies.find(c => c.id === b.companyId)?.name || '';
      valA = compA.toLowerCase();
      valB = compB.toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const activeAssignments = sortedAssignmentsStaff.filter(s => s.status !== 'exited');
  const exitedAssignments = sortedAssignmentsStaff.filter(s => s.status === 'exited');

  const renderAssignRow = (s: Staff) => {
    const employer = companies.find(c => c.id === s.companyId);
    return (
      <tr key={s.id} style={{ opacity: s.status === 'exited' ? 0.75 : 1 }}>
        <td style={{ fontWeight: 600 }}>
          {s.fullName} {s.status === 'exited' && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>(Exited)</span>}
        </td>
        <td>{employer ? employer.name : 'Group'}</td>
        <td>{s.jobTitle}</td>
        <td>
          <select 
            className="select-filter"
            value={s.commissionPolicyId || ''}
            onChange={(e) => handleAssignPolicy(s.id, e.target.value)}
            style={{ width: '100%', maxWidth: '280px', padding: '6px' }}
          >
            <option value="">-- No Incentive Plan --</option>
            {commissionPolicies.map(p => {
              const pComp = companies.find(c => c.id === p.companyId);
              return (
                <option key={p.id} value={p.id}>
                  {p.name} ({pComp ? pComp.name : 'Group-wide'})
                </option>
              );
            })}
          </select>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Recruiter Assignment Desk</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Map employees to their respective group commission structures.</p>
      </div>

      <div className="controls-row" style={{ marginTop: 0 }}>
        <div className="search-filter-group" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <MultiSelectFilter
            options={companyOptions}
            selectedValues={companyFilter}
            onChange={(vals) => {
              setCompanyFilter(vals);
              setDeptFilter(['all']);
            }}
            placeholder="Select Companies"
          />

          <MultiSelectFilter
            options={departmentOptionsList}
            selectedValues={deptFilter}
            onChange={(vals) => setDeptFilter(vals)}
            placeholder="Select Departments"
          />

          <select 
            className="select-filter"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">All Staff Allocated</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="entity-table dense">
          <thead>
            <tr>
              <th onClick={() => handleHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Employee Name {renderSortIndicator('fullName')}
              </th>
              <th onClick={() => handleHeaderClick('companyId')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Employer Entity {renderSortIndicator('companyId')}
              </th>
              <th onClick={() => handleHeaderClick('jobTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Designation / Title {renderSortIndicator('jobTitle')}
              </th>
              <th>Commission Scheme Allocation</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssignmentsStaff.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                  No staff matches the filters.
                </td>
              </tr>
            ) : (
              <>
                {activeAssignments.map(renderAssignRow)}
                {exitedAssignments.length > 0 && (
                  <>
                    <tr 
                      onClick={() => setExpandedExitedAssignments(!expandedExitedAssignments)}
                      style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <td colSpan={4} style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ marginRight: '6px' }}>{expandedExitedAssignments ? '▼' : '▶'}</span>
                        Exited Staff ({exitedAssignments.length})
                      </td>
                    </tr>
                    {expandedExitedAssignments && exitedAssignments.map(renderAssignRow)}
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
