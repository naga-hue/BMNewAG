import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
import PayrollRegisterTable from './PayrollRegisterTable';
import PayrollAdjustmentsForm from './PayrollAdjustmentsForm';
import { Company, Staff, Placement, Expense, NominalCode } from '../../types';
import './payroll.css';

interface PayrollDashboardProps {
  companies?: Company[];
  staff?: Staff[];
  commissionPolicies?: any[];
  placements?: Placement[];
  payrollRecords?: any[];
  payrollPolicies?: any[];
  leaveRequests?: any[];
  leavePolicies?: any[];
  holidays?: any[];
  expenses?: Expense[];
  nominalCodes?: NominalCode[];
  onSavePayrollRecord: (record: any) => Promise<any>;
  onSavePayrollPolicy: (policy: any) => Promise<any>;
  onDeletePayrollPolicy?: (id: string) => Promise<any>;
  onUpdateStaff?: (s: Staff) => Promise<any>;
  onSaveExpense?: (e: Expense) => Promise<any>;
  onDeleteExpense?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export default function PayrollDashboard({
  companies = [],
  staff = [],
  commissionPolicies = [],
  placements = [],
  payrollRecords = [],
  payrollPolicies = [],
  leaveRequests = [],
  leavePolicies = [],
  holidays = [],
  expenses = [],
  nominalCodes = [],
  onSavePayrollRecord,
  onSavePayrollPolicy,
  onDeletePayrollPolicy = async () => {},
  onUpdateStaff = async () => {},
  onSaveExpense = async () => {},
  onDeleteExpense = async () => {},
  onShowToast
}: PayrollDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState('grid'); // grid, policies, rates

  const [globalPayrollRates, setGlobalPayrollRates] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-global-payroll-rates');
      return saved ? JSON.parse(saved) : {
        employerNiRate: 13.8,
        employerNiThreshold: 758,
        employerPensionRate: 3.0,
        employeePensionRate: 5.0,
        employeeTaxNicRate: 20.0
      };
    } catch {
      return {
        employerNiRate: 13.8,
        employerNiThreshold: 758,
        employerPensionRate: 3.0,
        employeePensionRate: 5.0,
        employeeTaxNicRate: 20.0
      };
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      
      {/* Top Banner Details */}
      <div className="detail-section" style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
            <DollarSign size={28} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Spreadsheet Forecast & Actuals Ledgers</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Interactive workspace for group-wide salaries and commissions normalized to GBP (£). Click on any monthly cell to reconcile with your bank statement uploads or book expenses directly.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="payroll-tab-nav">
        {[
          { key: 'grid', label: 'Group Payroll & Projections' },
          { key: 'policies', label: 'Payroll Policy Templates' },
          { key: 'rates', label: 'Global Payroll Rates Setup' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            className={`payroll-tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Tab Rendering */}
      {activeSubTab === 'grid' && (
        <PayrollRegisterTable
          companies={companies}
          staff={staff}
          commissionPolicies={commissionPolicies}
          placements={placements}
          payrollRecords={payrollRecords}
          payrollPolicies={payrollPolicies}
          leaveRequests={leaveRequests}
          leavePolicies={leavePolicies}
          holidays={holidays}
          expenses={expenses}
          nominalCodes={nominalCodes}
          onSavePayrollRecord={onSavePayrollRecord}
          onSaveExpense={onSaveExpense}
          onDeleteExpense={onDeleteExpense}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'policies' && (
        <PayrollAdjustmentsForm
          staff={staff}
          payrollPolicies={payrollPolicies}
          nominalCodes={nominalCodes}
          onSavePayrollPolicy={onSavePayrollPolicy}
          onDeletePayrollPolicy={onDeletePayrollPolicy}
          onUpdateStaff={onUpdateStaff}
          onShowToast={onShowToast}
        />
      )}

      {activeSubTab === 'rates' && (
        <div className="detail-section" style={{ padding: '24px', animation: 'fadeIn 0.2s', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent)', margin: '0 0 16px 0' }}>⚙️ Global Payroll Rates Configuration</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '600px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Employer NI Rate (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={globalPayrollRates.employerNiRate}
                onChange={(e) => setGlobalPayrollRates((prev: any) => ({ ...prev, employerNiRate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Employer NI Monthly Threshold (£)</label>
              <input
                type="number"
                className="form-input"
                value={globalPayrollRates.employerNiThreshold}
                onChange={(e) => setGlobalPayrollRates((prev: any) => ({ ...prev, employerNiThreshold: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Employer Pension Rate (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={globalPayrollRates.employerPensionRate}
                onChange={(e) => setGlobalPayrollRates((prev: any) => ({ ...prev, employerPensionRate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Employee Pension Auto-Enrolment (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={globalPayrollRates.employeePensionRate}
                onChange={(e) => setGlobalPayrollRates((prev: any) => ({ ...prev, employeePensionRate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Employee Estimated Tax & Nic Rate (%)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                value={globalPayrollRates.employeeTaxNicRate}
                onChange={(e) => setGlobalPayrollRates((prev: any) => ({ ...prev, employeeTaxNicRate: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                localStorage.setItem('bm-global-payroll-rates', JSON.stringify(globalPayrollRates));
                onShowToast("💾 Global payroll rates saved successfully!", "success");
              }}
            >
              Save Rates Configuration
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
