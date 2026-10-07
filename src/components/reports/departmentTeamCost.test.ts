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
  });

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
});

