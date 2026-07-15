import React, { useState } from 'react';
import CommissionsBandsSetup from './CommissionsBandsSetup';
import CommissionsAssignments from './CommissionsAssignments';
import CommissionsPayroll from './CommissionsPayroll';
import CommissionsMatrix from './CommissionsMatrix';
import { Company, Staff, Placement } from '../../types';
import { calculateCashReceivedCommission } from './utils';
import './commissions.css';

interface CommissionsDashboardProps {
  companies?: Company[];
  staff?: Staff[];
  commissionPolicies?: any[];
  placements?: Placement[];
  onSavePolicy: (policy: any) => Promise<any>;
  onDeletePolicy?: (id: string) => Promise<any>;
  onUpdateStaff?: (s: Staff) => Promise<any>;
  onSavePlacement?: (p: Placement) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function CommissionsDashboard({
  companies = [],
  staff = [],
  commissionPolicies = [],
  placements = [],
  onSavePolicy,
  onDeletePolicy = async () => {},
  onUpdateStaff = async () => {},
  onSavePlacement = async () => {},
  onShowToast
}: CommissionsDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState('policies'); // policies, assignments, payroll, matrix
  const [payrollMonth, setPayrollMonth] = useState('2026-06');
  const [selectedBreakdownRow, setSelectedBreakdownRow] = useState<any>(null);

  const handleSelectRecruiterDetail = (member: Staff, policy: any, targetMonth: string) => {
    const calc = calculateCashReceivedCommission(member, policy, targetMonth, staff, companies, placements);
    setSelectedBreakdownRow({ member, policy, calc });
    setPayrollMonth(targetMonth);
    setActiveSubTab('payroll');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-tab Navigation */}
      <div className="commissions-tab-nav">
        {[
          { key: 'policies', label: 'Commission Schemes' },
          { key: 'assignments', label: 'Recruiter Assignments' },
          { key: 'payroll', label: 'Commissions Payroll Ledger' },
          { key: 'matrix', label: 'YTD Commission Matrix' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              setActiveSubTab(t.key);
              setSelectedBreakdownRow(null);
            }}
            className={`commissions-tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Tab Routing */}
      {activeSubTab === 'policies' && (
        <CommissionsBandsSetup
          companies={companies}
          staff={staff}
          commissionPolicies={commissionPolicies}
          onSavePolicy={onSavePolicy}
          onDeletePolicy={onDeletePolicy}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'assignments' && (
        <CommissionsAssignments
          companies={companies}
          staff={staff}
          commissionPolicies={commissionPolicies}
          onUpdateStaff={onUpdateStaff}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'payroll' && (
        <CommissionsPayroll
          companies={companies}
          staff={staff}
          commissionPolicies={commissionPolicies}
          placements={placements}
          onUpdateStaff={onUpdateStaff}
          onSavePlacement={onSavePlacement}
          onShowToast={onShowToast}
          payrollMonth={payrollMonth}
          setPayrollMonth={setPayrollMonth}
          selectedBreakdownRow={selectedBreakdownRow}
          setSelectedBreakdownRow={setSelectedBreakdownRow}
        />
      )}

      {activeSubTab === 'matrix' && (
        <CommissionsMatrix
          companies={companies}
          staff={staff}
          commissionPolicies={commissionPolicies}
          placements={placements}
          onSelectRecruiterDetail={handleSelectRecruiterDetail}
        />
      )}

    </div>
  );
}
