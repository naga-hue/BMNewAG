import { describe, it, expect } from 'vitest';
import { mergeDepartmentsData } from '../utils/departmentMerge';
import { Company, Staff, Expense, DepartmentTool } from '../types';

describe('mergeDepartmentsData - Native Department Consolidation', () => {
  const companyId = 'comp-humres';

  const mockCompany: Company = {
    id: companyId,
    name: 'Humres Technical Recruitment Ltd',
    departments: [
      { name: 'Civils', managerId: 'staff-alex' } as any,
      { name: 'Rail', managerId: '' } as any
    ]
  };

  const mockStaff: Staff[] = [
    {
      id: 'staff-alex',
      fullName: 'Alex Rosenberg',
      companyId: companyId,
      department: 'Civils'
    },
    {
      id: 'staff-christo',
      fullName: 'Christo van der Walt',
      companyId: companyId,
      department: 'Civils'
    },
    {
      id: 'staff-bob',
      fullName: 'Bob Smith',
      companyId: companyId,
      department: 'Rail'
    },
    {
      id: 'staff-other',
      fullName: 'Other Person',
      companyId: 'comp-other',
      department: 'Civils' // Different company, should NOT be touched
    }
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      date: '2026-02-01',
      plMonth: '2026-02',
      payee: 'Civils Software',
      nominalCode: '7001',
      amount: 500,
      currency: 'GBP',
      bankCompanyId: companyId,
      allocationType: 'department',
      allocationTarget: 'Civils'
    },
    {
      id: 'exp-2',
      date: '2026-02-01',
      plMonth: '2026-02',
      payee: 'Multi Dept Office',
      nominalCode: '7002',
      amount: 1000,
      currency: 'GBP',
      bankCompanyId: companyId,
      allocationType: 'department',
      allocationTarget: ['Civils', 'Rail'] as any
    },
    {
      id: 'exp-3',
      date: '2026-02-01',
      plMonth: '2026-02',
      payee: 'Shared Split',
      nominalCode: '7003',
      amount: 1200,
      currency: 'GBP',
      bankCompanyId: companyId,
      allocationType: 'manual',
      manualAllocationShares: {
        'Civils': 400,
        'Rail': 800
      }
    }
  ];

  const mockTools: DepartmentTool[] = [
    {
      id: 'tool-recruitly',
      name: 'Recruitly CRM',
      department: 'Civils',
      departments: ['Civils', 'Rail'],
      companyIds: [companyId],
      licenseCostPerSeat: 45,
      currency: 'GBP',
      billingFrequency: 'monthly',
      baselineCommittedSeats: 5
    }
  ];

  it('merges Civils into Rail, reassigns staff, updates expenses, and transfers manager', () => {
    const res = mergeDepartmentsData({
      companyId,
      sourceDept: 'Civils',
      targetDept: 'Rail',
      transferManager: true,
      companies: [mockCompany],
      staff: mockStaff,
      expenses: mockExpenses,
      departmentTools: mockTools
    });

    expect(res.updatedStaffCount).toBe(2); // Alex and Christo
    expect(res.updatedExpensesCount).toBe(3);
    expect(res.updatedToolsCount).toBe(1);

    // 1. Verify Company
    const updatedComp = res.updatedCompany;
    expect(updatedComp).not.toBeNull();
    expect(updatedComp?.departments).toHaveLength(1);
    expect(updatedComp?.departments?.[0]?.name).toBe('Rail');
    expect(updatedComp?.departments?.[0]?.managerId).toBe('staff-alex'); // Manager transferred!

    // 2. Verify Staff
    const alex = res.updatedStaff.find(s => s.id === 'staff-alex');
    const christo = res.updatedStaff.find(s => s.id === 'staff-christo');
    const bob = res.updatedStaff.find(s => s.id === 'staff-bob');
    const other = res.updatedStaff.find(s => s.id === 'staff-other');

    expect(alex?.department).toBe('Rail');
    expect(christo?.department).toBe('Rail');
    expect(bob?.department).toBe('Rail');
    expect(other?.department).toBe('Civils'); // Untouched

    // 3. Verify Expenses
    const exp1 = res.updatedExpenses.find(e => e.id === 'exp-1');
    const exp2 = res.updatedExpenses.find(e => e.id === 'exp-2');
    const exp3 = res.updatedExpenses.find(e => e.id === 'exp-3');

    expect(exp1?.allocationTarget).toBe('Rail');
    expect(exp2?.allocationTarget).toEqual(['Rail']); // Deduplicated!
    expect(exp3?.manualAllocationShares).toEqual({ 'Rail': 1200 }); // Combined 400 + 800!

    // 4. Verify Department Tools
    const recruitly = res.updatedTools.find(t => t.id === 'tool-recruitly');
    expect(recruitly?.department).toBe('Rail');
    expect(recruitly?.departments).toEqual(['Rail']); // Deduplicated!
  });

  it('allows merging into a brand new department name', () => {
    const res = mergeDepartmentsData({
      companyId,
      sourceDept: 'Civils',
      targetDept: 'Infrastructure & Engineering',
      transferManager: true,
      companies: [mockCompany],
      staff: mockStaff,
      expenses: mockExpenses,
      departmentTools: mockTools
    });

    const updatedComp = res.updatedCompany;
    expect(updatedComp).not.toBeNull();
    
    // Civils removed, Infrastructure & Engineering added
    const names = (updatedComp?.departments || []).map((d: any) => d.name);
    expect(names).toContain('Rail');
    expect(names).toContain('Infrastructure & Engineering');
    expect(names).not.toContain('Civils');

    const alex = res.updatedStaff.find(s => s.id === 'staff-alex');
    expect(alex?.department).toBe('Infrastructure & Engineering');
  });
});
