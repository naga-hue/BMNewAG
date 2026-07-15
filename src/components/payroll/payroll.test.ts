import { describe, it, expect } from 'vitest';
import { calculateSlabCost, getBusinessDaysInMonth, getCellData } from './utils';
import { Staff } from '../../types';

describe('Payroll Calculations', () => {
  it('should calculate progressive slab cost correctly', () => {
    const slabs = [
      { minAmount: 0, maxAmount: 1000, rate: 10 },    // 10% of first 1000 = 100
      { minAmount: 1000, maxAmount: 3000, rate: 20 },  // 20% of next 2000 = 400
      { minAmount: 3000, maxAmount: 999999, rate: 30 } // 30% of rest
    ];

    expect(calculateSlabCost(500, slabs)).toBe(50);     // 500 * 10%
    expect(calculateSlabCost(1500, slabs)).toBe(200);   // 1000*10% + 500*20% = 100 + 100
    expect(calculateSlabCost(3500, slabs)).toBe(100+400+150); // 1000*10% + 2000*20% + 500*30% = 650
  });

  it('should get correct business days in month excluding weekends and holidays', () => {
    const holidays = [
      { companyId: 'c1', date: '2026-05-01' }, // May Day
      { companyId: 'c1', date: '2026-05-25' }  // Late May Bank Holiday
    ];
    // May 2026 has 31 days. Starts on Friday, ends on Sunday.
    // 5 weekends = 10 days. 31 - 10 = 21 business days.
    // Excluding 2 holidays -> 19 business days.
    const days = getBusinessDaysInMonth('2026-05', 'c1', holidays);
    expect(days).toBe(19);
  });

  it('should project FT UK staff payroll correctly', () => {
    const staffMember: Staff = {
      id: 'staff-1',
      fullName: 'John Doe',
      status: 'active',
      startDate: '2025-01-01',
      jobTitle: 'Developer',
      email: 'john@example.com',
      role: 'user',
      salary: 60000, // 5000 per month
      currency: 'GBP',
      payrollPolicyId: 'policy-uk'
    };

    const payrollPolicies = [
      {
        id: 'policy-uk',
        type: 'ft_uk',
        employerNiRate: 13.8,
        employerNiThreshold: 758,
        employerPensionRate: 3.0,
        employeeTaxNicRate: 20.0,
        employeePensionRate: 5.0,
        studentLoanActive: true,
        studentLoanRate: 9.0,
        studentLoanThreshold: 2274
      }
    ];

    const cell = getCellData(
      staffMember,
      '2026-06',
      [], // payrollRecords
      payrollPolicies,
      [], // leaveRequests
      [], // holidays
      [staffMember], // staff
      [], // companies
      [], // placements
      []  // commissionPolicies
    );

    expect(cell.isReconciled).toBe(false);
    expect(cell.basic).toBe(5000);
    expect(cell.commission).toBe(0);
    // Employer NIC: (5000 - 758) * 13.8% = 4242 * 0.138 = 585.396 -> 585.40
    expect(cell.employerNi).toBeCloseTo(585.396, 2);
    // Employer pension: 5000 * 3% = 150
    expect(cell.employerPension).toBe(150);
    // Employee Pension: 5000 * 5% = 250
    expect(cell.employeePension).toBe(250);
    // PAYE / Tax (simple flat rate 20%): 5000 * 20% = 1000
    // Student Loan: (5000 - 2274) * 9% = 2726 * 0.09 = 245.34
    // Total employeeTaxNic = 1000 + 245.34 = 1245.34
    expect(cell.employeeTaxNic).toBeCloseTo(1245.34, 2);
  });

  it('should project freelance contractor staff payroll based on attendance', () => {
    const staffMember: Staff = {
      id: 'contractor-1',
      fullName: 'Bob Contractor',
      status: 'active',
      startDate: '2025-01-01',
      jobTitle: 'Consultant',
      email: 'bob@example.com',
      role: 'user',
      attendanceRate: 400, // 400 daily rate
      currency: 'GBP',
      payrollPolicyId: 'policy-freelance'
    };

    const payrollPolicies = [
      {
        id: 'policy-freelance',
        type: 'freelance',
        dailyRateDefault: 400,
        expectedDaysPerMonth: 20
      }
    ];

    const leaveRequests = [
      {
        id: 'l1',
        staffId: 'contractor-1',
        status: 'approved',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        totalDays: 3
      }
    ];

    // June 2026 starts on Monday. 30 days.
    // 4 weekends = 8 days. 30 - 8 = 22 business days.
    // Leaves = 3 days. Attendance = 19 days.
    // Basic = 19 * 400 = 7600.
    const cell = getCellData(
      staffMember,
      '2026-06',
      [],
      payrollPolicies,
      leaveRequests,
      [], // holidays
      [staffMember],
      [],
      [],
      []
    );

    expect(cell.isReconciled).toBe(false);
    expect(cell.basic).toBe(7600);
    expect(cell.employerNi).toBe(0);
    expect(cell.employeeTaxNic).toBe(0);
  });

  it('should fall back to global rates if not specified on the policy template', () => {
    const mockStorage: Record<string, string> = {
      'bm-global-payroll-rates': JSON.stringify({
        employerNiRate: 15.0,
        employerNiThreshold: 500,
        employerPensionRate: 4.0,
        employeePensionRate: 6.0,
        employeeTaxNicRate: 25.0
      })
    };

    // Mock global.localStorage directly since window is undefined in node tests
    const originalLocalStorage = (global as any).localStorage;
    (global as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null
    };

    const staffMember: Staff = {
      id: 'staff-2',
      fullName: 'Jane Global',
      status: 'active',
      startDate: '2025-01-01',
      jobTitle: 'Consultant',
      email: 'jane@example.com',
      role: 'user',
      salary: 12000,
      currency: 'GBP',
      payrollPolicyId: 'policy-fallback'
    };

    const payrollPolicies = [
      {
        id: 'policy-fallback',
        type: 'ft_uk'
      }
    ];

    const cell = getCellData(
      staffMember,
      '2026-06',
      [],
      payrollPolicies,
      [],
      [],
      [staffMember],
      [],
      [],
      []
    );

    expect(cell.employerNi).toBe(75);
    expect(cell.employerPension).toBe(40);
    expect(cell.employeePension).toBe(60);
    expect(cell.employeeTaxNic).toBe(250);
  });
});
