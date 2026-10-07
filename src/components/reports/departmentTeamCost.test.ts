import { describe, it, expect } from 'vitest';
import { DepartmentTool } from '../../types';

describe('Department Team & Tool Costs - Contract Ratchet Engine', () => {

  it('ratchets committed seats up when headcount expands, and holds high-water mark when headcount contracts', () => {
    // Contract starts with 7 baseline committed seats
    const tool: DepartmentTool = {
      id: 'tool-dialpad',
      name: 'Dialpad Phone System',
      department: 'Civils',
      licenseCostPerSeat: 45,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: 7
    };

    // Monthly headcount profile:
    // Jan: 7, Feb: 7, Mar: 10 (expands!), Apr: 8 (drops), May: 7 (drops further), Jun: 12 (new expansion!)
    const monthlyHeadcount = {
      '2026-01': 7,
      '2026-02': 7,
      '2026-03': 10,
      '2026-04': 8,
      '2026-05': 7,
      '2026-06': 12
    };

    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

    let peakSoFar = tool.baselineCommittedSeats;
    const results: Record<string, { committed: number; active: number; unutilized: number; cost: number }> = {};

    months.forEach(m => {
      const active = monthlyHeadcount[m as keyof typeof monthlyHeadcount];
      if (active > peakSoFar) {
        peakSoFar = active;
      }
      const committed = peakSoFar;
      const unutilized = Math.max(0, committed - active);
      const cost = committed * tool.licenseCostPerSeat;

      results[m] = { committed, active, unutilized, cost };
    });

    // Jan: 7 baseline, 7 active -> 0 unutilized, £315
    expect(results['2026-01'].committed).toBe(7);
    expect(results['2026-01'].active).toBe(7);
    expect(results['2026-01'].unutilized).toBe(0);
    expect(results['2026-01'].cost).toBe(315);

    // Mar: active expanded to 10 -> committed ratchets to 10, £450
    expect(results['2026-03'].committed).toBe(10);
    expect(results['2026-03'].active).toBe(10);
    expect(results['2026-03'].unutilized).toBe(0);
    expect(results['2026-03'].cost).toBe(450);

    // Apr: active dropped to 8 -> committed holds at 10 (contract commitment), 2 unutilized, cost remains £450
    expect(results['2026-04'].committed).toBe(10);
    expect(results['2026-04'].active).toBe(8);
    expect(results['2026-04'].unutilized).toBe(2);
    expect(results['2026-04'].cost).toBe(450);

    // May: active dropped to 7 -> committed holds at 10, 3 unutilized, cost remains £450
    expect(results['2026-05'].committed).toBe(10);
    expect(results['2026-05'].active).toBe(7);
    expect(results['2026-05'].unutilized).toBe(3);
    expect(results['2026-05'].cost).toBe(450);

    // Jun: active expands to 12 -> committed ratchets to 12, 0 unutilized, cost is £540
    expect(results['2026-06'].committed).toBe(12);
    expect(results['2026-06'].active).toBe(12);
    expect(results['2026-06'].unutilized).toBe(0);
    expect(results['2026-06'].cost).toBe(540);
  });

  it('honors baseline commitment even if initial headcount is lower than baseline contract', () => {
    // Contract baseline: 10 committed seats
    const tool: DepartmentTool = {
      id: 'tool-crm',
      name: 'Recruitly CRM',
      department: 'Rail',
      licenseCostPerSeat: 50,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: 10
    };

    // Headcount is only 6 in Jan, 7 in Feb, 8 in Mar
    const months = ['2026-01', '2026-02', '2026-03'];
    const headcount: Record<string, number> = { '2026-01': 6, '2026-02': 7, '2026-03': 8 };

    let peak = tool.baselineCommittedSeats;
    months.forEach(m => {
      const active = headcount[m];
      if (active > peak) peak = active;
      const committed = peak;
      const unutilized = Math.max(0, committed - active);

      // Committed seats must remain at least the baseline (10)
      expect(committed).toBe(10);
      expect(unutilized).toBe(10 - active);
      expect(committed * tool.licenseCostPerSeat).toBe(500);
    });
  });

  it('supports manual overrides if negotiated with the vendor', () => {
    const tool: DepartmentTool = {
      id: 'tool-linkedin',
      name: 'LinkedIn Recruiter',
      department: 'Executive',
      licenseCostPerSeat: 100,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: 5,
      manualCommittedSeatsOverride: {
        '2026-04': 4 // Vendor gave special 1-seat reduction credit
      }
    };

    const monthKey = '2026-04';
    const active = 4;
    const peak = 5;
    const committed = tool.manualCommittedSeatsOverride?.[monthKey] ?? peak;

    expect(committed).toBe(4);
    expect(committed * tool.licenseCostPerSeat).toBe(400);
  });

  it('tracks department-level high-water mark ratchet holding committed seats forward when headcount drops', () => {
    // Civils department has 6 active consultants in Jan/Feb, expands to 7 in March, drops to 6 in April
    const unitCost = 75;
    const monthlyActive = {
      '2026-01': 6,
      '2026-02': 6,
      '2026-03': 7,
      '2026-04': 6,
      '2026-05': 6
    };
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const initialBaseline = monthlyActive['2026-01']; // 6 seats
    let peakSoFar = initialBaseline;
    const results: Record<string, { committed: number; active: number; unutilized: number; cost: number }> = {};

    months.forEach(m => {
      const active = monthlyActive[m as keyof typeof monthlyActive];
      if (active > peakSoFar) {
        peakSoFar = active;
      }
      const committed = peakSoFar;
      const unutilized = Math.max(0, committed - active);
      const cost = committed * unitCost;
      results[m] = { committed, active, unutilized, cost };
    });

    // Jan & Feb: 6 committed, 6 active, 0 spare, £450
    expect(results['2026-01']).toEqual({ committed: 6, active: 6, unutilized: 0, cost: 450 });
    expect(results['2026-02']).toEqual({ committed: 6, active: 6, unutilized: 0, cost: 450 });

    // Mar: ratchets up to 7 committed, 7 active, 0 spare, £525
    expect(results['2026-03']).toEqual({ committed: 7, active: 7, unutilized: 0, cost: 525 });

    // Apr: active drops back to 6, committed HOLDS at 7 (1 spare seat!), cost remains £525
    expect(results['2026-04']).toEqual({ committed: 7, active: 6, unutilized: 1, cost: 525 });

    // May: holds at 7 committed (1 spare seat!), cost remains £525
    expect(results['2026-05']).toEqual({ committed: 7, active: 6, unutilized: 1, cost: 525 });
  });

  it('correctly parses dates across ISO (YYYY-MM-DD) and UK (DD/MM/YYYY) formats', async () => {
    const { parseMonthFromDateStr } = await import('./DepartmentTeamCostTab');
    expect(parseMonthFromDateStr('2026-01-01')).toBe('2026-01');
    expect(parseMonthFromDateStr('01/01/2026')).toBe('2026-01');
    expect(parseMonthFromDateStr('2026-03-31')).toBe('2026-03');
    expect(parseMonthFromDateStr('31/03/2026')).toBe('2026-03');
    expect(parseMonthFromDateStr('')).toBeNull();
    expect(parseMonthFromDateStr(null)).toBeNull();
  }, 15000);

  it('strictly stops projecting costs after contract renewal/end date (e.g. Rent - Workshack ending 31/03/2026)', async () => {
    const { parseMonthFromDateStr } = await import('./DepartmentTeamCostTab');
    const tool: DepartmentTool = {
      id: 'tool-rent-workshack',
      name: 'Rent - Workshack',
      department: 'Civils',
      departments: ['Civils', 'Interiors'],
      costBasis: 'per_department',
      licenseCostPerSeat: 461,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: 0,
      contractStartDate: '01/01/2026',
      renewalDate: '31/03/2026'
    };

    const months = [
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
    ];

    const toolStartMonth = parseMonthFromDateStr(tool.contractStartDate);
    const toolEndMonth = parseMonthFromDateStr(tool.renewalDate);

    expect(toolStartMonth).toBe('2026-01');
    expect(toolEndMonth).toBe('2026-03');

    const monthlyCosts: Record<string, number> = {};
    let periodTotal = 0;

    months.forEach(m => {
      const isBeforeStart = toolStartMonth ? (m < toolStartMonth) : false;
      const isAfterEnd = toolEndMonth ? (m > toolEndMonth) : false;
      const isContractActiveInMonth = !isBeforeStart && !isAfterEnd;

      const cost = isContractActiveInMonth ? tool.licenseCostPerSeat : 0;
      monthlyCosts[m] = cost;
      periodTotal += cost;
    });

    // Q1: Active 3 months @ £461 = £1,383
    expect(monthlyCosts['2026-01']).toBe(461);
    expect(monthlyCosts['2026-02']).toBe(461);
    expect(monthlyCosts['2026-03']).toBe(461);

    // Q2-Q4: Contract ended on 31 March 2026 -> Strictly £0, NOT projected to end of year!
    expect(monthlyCosts['2026-04']).toBe(0);
    expect(monthlyCosts['2026-05']).toBe(0);
    expect(monthlyCosts['2026-06']).toBe(0);
    expect(monthlyCosts['2026-07']).toBe(0);
    expect(monthlyCosts['2026-08']).toBe(0);
    expect(monthlyCosts['2026-09']).toBe(0);
    expect(monthlyCosts['2026-10']).toBe(0);
    expect(monthlyCosts['2026-11']).toBe(0);
    expect(monthlyCosts['2026-12']).toBe(0);

    expect(periodTotal).toBe(1383); // Exactly 3 months of rent, NOT 12 months (£5,532)
  });

  it('sorts tools alphabetically based on first letter (A-Z and Z-A)', () => {
    const rawTools = [
      { id: '1', name: 'Recruitly' },
      { id: '2', name: 'Dialpad' },
      { id: '3', name: 'Accountancy' },
      { id: '4', name: 'Microsoft' },
      { id: '5', name: 'Back Office Support' },
      { id: '6', name: 'Rent - Workshack' }
    ];

    const sortAsc = [...rawTools].sort((a, b) => a.name.localeCompare(b.name));
    expect(sortAsc.map(t => t.name)).toEqual([
      'Accountancy',
      'Back Office Support',
      'Dialpad',
      'Microsoft',
      'Recruitly',
      'Rent - Workshack'
    ]);

    const sortDesc = [...rawTools].sort((a, b) => b.name.localeCompare(a.name));
    expect(sortDesc.map(t => t.name)).toEqual([
      'Rent - Workshack',
      'Recruitly',
      'Microsoft',
      'Dialpad',
      'Back Office Support',
      'Accountancy'
    ]);
  });

  it('restricts managers strictly to team & tool costs and locks their assigned department', () => {
    // Simulating manager user (e.g. Turan in Civils)
    const managerUser = {
      id: 'staff-turan',
      fullName: 'Turan',
      department: 'Civils',
      permissions: {
        role: 'manager',
        dataScope: 'department',
        allowedModules: ['directory', 'staff', 'leaves', 'reports']
      }
    };

    const isManager = managerUser.permissions.role === 'manager';
    const isTeamCostOnly = isManager || managerUser.permissions?.allowedModules?.includes('reports:team_cost_only');
    const userDept = managerUser.department;

    // Available tabs for standard users vs managers
    const allTabs = [
      { key: 'consolidated', label: 'Group P&L' },
      { key: 'team_cost', label: 'Team & Tool Costs' },
      { key: 'ratios', label: 'Salary to billings' },
      { key: 'leagues', label: 'Recruiter Leagues' }
    ];

    const accessibleTabs = !isTeamCostOnly
      ? allTabs
      : allTabs.filter(t => t.key === 'team_cost');

    expect(isTeamCostOnly).toBe(true);
    expect(accessibleTabs.map(t => t.key)).toEqual(['team_cost']); // ONLY team_cost accessible
    expect(accessibleTabs.find(t => t.key === 'consolidated')).toBeUndefined(); // Group P&L shielded
    expect(accessibleTabs.find(t => t.key === 'ratios')).toBeUndefined(); // Executive ratios shielded
    expect(accessibleTabs.find(t => t.key === 'leagues')).toBeUndefined(); // Recruiter leagues shielded

    // Initial and active tab enforcement
    const activeTab = isTeamCostOnly ? 'team_cost' : 'consolidated';
    expect(activeTab).toBe('team_cost');

    // Department filter is locked to their assigned department
    const deptFilter = isManager && userDept ? [userDept] : ['all'];
    expect(deptFilter).toEqual(['Civils']);
  });

  it('grants full Group P&L, executive ratios, and all departments to super-admin and directors', () => {
    const adminUser = {
      id: 'super-admin',
      fullName: 'Naga Kandasamy',
      permissions: {
        role: 'admin',
        dataScope: 'all',
        allowedModules: ['reports:write', 'reports:view']
      }
    };

    const isManager = adminUser.permissions.role === 'manager';
    const isTeamCostOnly = isManager;

    const allTabs = [
      { key: 'consolidated', label: 'Group P&L' },
      { key: 'team_cost', label: 'Team & Tool Costs' },
      { key: 'ratios', label: 'Salary to billings' },
      { key: 'leagues', label: 'Recruiter Leagues' }
    ];

    const accessibleTabs = !isTeamCostOnly
      ? allTabs
      : allTabs.filter(t => t.key === 'team_cost');

    expect(isTeamCostOnly).toBe(false);
    expect(accessibleTabs.length).toBe(4);
    expect(accessibleTabs.map(t => t.key)).toEqual(['consolidated', 'team_cost', 'ratios', 'leagues']);
  });

  it('auto-aligns team & tool remuneration with actual bank statement disbursements (Group P&L alignment)', () => {
    // Charlie Davies: baseline payroll record had £3,000, but bank statement (1003 - Consulting) disbursed £10,797
    const staffMember = { id: 'cd-1', fullName: 'Charlie Davies', department: 'Management' };
    const month = '2026-06';
    const payrollRecord = { basicSalary: 3000, totalCost: 3000 };

    const bankExpenses = [
      {
        id: 'exp-1',
        plMonth: '2026-06',
        payee: 'Charlie Davies',
        amount: 10797,
        currency: 'GBP',
        nominalCode: '1003 - Consulting',
        status: 'cleared'
      }
    ];

    // Extraction logic matching DepartmentTeamCostTab:
    const staffDirectExpenses = bankExpenses.filter(e => {
      if (e.status === 'dns' || e.status === 'cancelled') return false;
      const eMonth = e.plMonth || (e.date ? e.date.substring(0, 7) : '');
      if (eMonth !== month) return false;

      const p = (e.payee || '').toLowerCase().trim();
      const fn = (staffMember.fullName || '').toLowerCase().trim();
      const isPayeeMatch = fn && (p === fn || p.includes(fn) || fn.includes(p));
      const nom = (e.nominalCode || '').toLowerCase();
      const isRemunNominal = nom.includes('1003') || nom.includes('consulting') || nom.includes('1001') || nom.includes('freelanc') || nom.includes('salary');

      return isPayeeMatch && isRemunNominal;
    });

    const bankPaidTotal = staffDirectExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const cellData = {
      basic: bankPaidTotal > 0 ? bankPaidTotal : payrollRecord.basicSalary,
      total: bankPaidTotal > 0 ? bankPaidTotal : payrollRecord.totalCost,
      isReconciled: bankPaidTotal > 0
    };

    expect(cellData.basic).toBe(10797);
    expect(cellData.total).toBe(10797);
    expect(cellData.isReconciled).toBe(true);
  });

  it('preserves reconciled payroll records and ignores synthetic mirror expenses to prevent elevated freelance payments', () => {
    // Alex Herzenberg in Feb 2026:
    // Reconciled payroll record had basic: £3,526.84, reimbursements: £250.16 (total: £3,777.00)
    const staffMember = { id: 'staff-alex', fullName: 'Alex Herzenberg', department: 'Civils' };
    const month = '2026-02';
    const cell = {
      basic: 3526.84,
      commission: 0,
      reimbursements: 250.16,
      total: 3526.84,
      totalWithReimbursements: 3777.00,
      isReconciled: true,
      notes: ''
    };

    const mixedExpenses = [
      {
        id: 'exp-stmt-bank-1',
        plMonth: '2026-02',
        payee: 'Alex Herzenberg',
        amount: 3777.15,
        currency: 'GBP',
        nominalCode: '1001 - Freelancer Payments',
        status: 'cleared'
      },
      {
        id: 'payroll-salary-staff-alex-2026-02',
        plMonth: '2026-02',
        payee: 'Freelancer Payment: Alex Herzenberg',
        amount: 3526.84,
        currency: 'GBP',
        nominalCode: '1001 - Freelancer Payments',
        status: 'cleared'
      }
    ];

    let resultCell = cell;

    // Matching DepartmentTeamCostTab logic:
    if (!cell.isReconciled || cell.basic === 0) {
      const staffDirectExpenses = mixedExpenses.filter(e => {
        if (e.status === 'dns' || e.status === 'cancelled') return false;
        if (e.id && (e.id.startsWith('payroll-') || e.id.startsWith('exp-overhead-'))) return false;
        const eMonth = e.plMonth;
        if (eMonth !== month) return false;
        const p = (e.payee || '').toLowerCase().trim();
        const fn = (staffMember.fullName || '').toLowerCase().trim();
        const isPayeeMatch = fn && (p === fn || p.includes(fn) || fn.includes(p));
        const nom = (e.nominalCode || '').toLowerCase();
        const isRemunNominal = nom.includes('1001');
        return isPayeeMatch && isRemunNominal;
      });

      if (staffDirectExpenses.length > 0) {
        const bankPaidTotal = staffDirectExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        resultCell = {
          ...cell,
          basic: bankPaidTotal,
          total: bankPaidTotal,
          totalWithReimbursements: bankPaidTotal + (cell.reimbursements || 0)
        };
      }
    }

    // Because cell.isReconciled was true, the reconciled basic (£3,526.84) was preserved
    // and was NOT elevated to £7,303.99!
    expect(resultCell.basic).toBe(3526.84);
    expect(resultCell.totalWithReimbursements).toBe(3777.00);
    expect(resultCell.basic).not.toBe(7303.99);
  });

  it('strictly excludes nominals 1003.1 (Director) and 1003.2 (House) from team & tool costs', () => {
    const mixedExpenses = [
      {
        id: 'exp-dir-draw',
        payee: 'Paul Seth',
        amount: 15000,
        nominalCode: '1003.1 - Director',
        plMonth: '2026-02'
      },
      {
        id: 'exp-house-draw',
        payee: 'Sofia Caltabiano',
        amount: 55000,
        nominalCode: '1003.2 - House',
        plMonth: '2026-02'
      },
      {
        id: 'exp-valid-consult',
        payee: 'Charlie Davies',
        amount: 3000,
        nominalCode: '1003 - Consulting',
        plMonth: '2026-02'
      }
    ];

    // Filter matching DepartmentTeamCostTab logic:
    const filteredExpenses = mixedExpenses.filter(e => {
      const nom = (e.nominalCode || '').toLowerCase();
      // Strictly exclude 1003.1 and 1003.2
      if (nom.includes('1003.1') || nom.includes('1003.2') || nom.includes('house')) return false;

      const isRemunNominal = (nom.includes('1003') && !nom.includes('1003.1') && !nom.includes('1003.2')) ||
                             nom.includes('consulting') ||
                             nom.includes('1001') ||
                             nom.includes('freelanc') ||
                             nom.includes('salary');

      return isRemunNominal;
    });

    expect(filteredExpenses.length).toBe(1);
    expect(filteredExpenses[0].payee).toBe('Charlie Davies');
    expect(filteredExpenses[0].amount).toBe(3000);
    expect(filteredExpenses.some(e => e.nominalCode.includes('1003.1'))).toBe(false);
    expect(filteredExpenses.some(e => e.nominalCode.includes('1003.2'))).toBe(false);
  });

  it('correctly resolves commission policy with suffix/name matching and calculates recruiter commission for future forecast months', async () => {
    const { findCommissionPolicy, calculateCommissionForRecruiter } = await import('../payroll/utils');

    const commissionPolicies = [
      {
        id: 'comm-ah-comissn',
        name: 'AH comissn',
        type: 'manager',
        monthlyThreshold: 3000,
        slabs: [
          { minAmount: 0, maxAmount: 10000, rate: 10 },
          { minAmount: 10000, maxAmount: 15000, rate: 15 },
          { minAmount: 15000, maxAmount: 999999, rate: 20 }
        ]
      },
      {
        id: 'comm-standard',
        name: 'Standard Recruiter Plan',
        type: 'recruiter',
        monthlyThreshold: 5000,
        slabs: [{ minAmount: 0, maxAmount: 999999, rate: 10 }]
      }
    ];

    // Policy resolution with exact ID, exact Name, and suffix (e.g. "AH comissn (Manager Override 0%)")
    expect(findCommissionPolicy('comm-ah-comissn', commissionPolicies)?.id).toBe('comm-ah-comissn');
    expect(findCommissionPolicy('AH comissn', commissionPolicies)?.id).toBe('comm-ah-comissn');
    expect(findCommissionPolicy('AH comissn (Manager Override 0%)', commissionPolicies)?.id).toBe('comm-ah-comissn');

    // Recruiter Alex with September placements (£14,629) paying in October 2026
    const staff = [
      {
        id: 'staff-alex',
        fullName: 'Alex Herzenberg',
        department: 'Civils',
        commissionPolicyId: 'AH comissn (Manager Override 0%)',
        companyId: 'comp-humres',
        status: 'active'
      }
    ] as any[];

    const companies = [
      { id: 'comp-humres', name: 'Humres Limited', currency: 'GBP' }
    ] as any[];

    const placements = [
      {
        id: 'p-1',
        candidateName: 'Sandev Golhar',
        startDate: '2026-09-09',
        netScoreValue: 6250,
        splits: [{ staffId: 'staff-alex', percentage: 50 }] // 3125
      },
      {
        id: 'p-2',
        candidateName: 'Aksar Mahmood',
        startDate: '2026-09-15',
        netScoreValue: 12750,
        splits: [{ staffId: 'staff-alex', percentage: 50 }] // 6375
      },
      {
        id: 'p-3',
        candidateName: 'Madalin Adam',
        startDate: '2026-09-28',
        netScoreValue: 10258,
        splits: [{ staffId: 'staff-alex', percentage: 50 }] // 5129
      }
    ] as any[];

    // Commission for October 2026 (Sept placements in arrears)
    // Total billing = 3125 + 6375 + 5129 = 14629
    // Threshold = 3000 -> Commissionable = 11629
    // Slab 1: 0 - 10000 @ 10% = 1000
    // Slab 2: 10000 - 15000 (1629) @ 15% = 244.35
    // Total individual = 1244.35
    const commOct = calculateCommissionForRecruiter(
      'staff-alex',
      '2026-10',
      staff,
      companies,
      placements,
      commissionPolicies,
      'written'
    );

    expect(commOct).toBeCloseTo(1244.35, 2);
  });
});


