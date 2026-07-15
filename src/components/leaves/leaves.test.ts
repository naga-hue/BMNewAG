import { describe, it, expect } from 'vitest';

describe('Leaves Module Policy & Departmental Overrides', () => {
  it('should resolve standard leave allowance and apply departmental overrides when present', () => {
    const policy = {
      id: 'policy-uk',
      name: 'UK Standard',
      annualAllowance: 25,
      sickAllowance: 10,
      departmentOverrides: {
        'Sales & Marketing': {
          annualAllowance: 28,
          sickAllowance: 12
        }
      }
    };

    const getStaffAllowance = (staffDept: string, key: 'annualAllowance' | 'sickAllowance') => {
      const override = policy.departmentOverrides?.[staffDept];
      if (override) {
        return key === 'annualAllowance' ? override.annualAllowance : override.sickAllowance;
      }
      return policy[key];
    };

    // Standard Staff in Recruitment gets base allowance
    expect(getStaffAllowance('Recruitment', 'annualAllowance')).toBe(25);
    expect(getStaffAllowance('Recruitment', 'sickAllowance')).toBe(10);

    // Staff in Sales & Marketing gets the overridden allowance
    expect(getStaffAllowance('Sales & Marketing', 'annualAllowance')).toBe(28);
    expect(getStaffAllowance('Sales & Marketing', 'sickAllowance')).toBe(12);
  });
});
