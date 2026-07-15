import { describe, it, expect } from 'vitest';
import { calculateCashReceivedCommission } from './utils';
import { Company, Staff, Placement } from '../../types';

describe('Commissions Calculations', () => {
  const mockStaff: Staff = {
    id: 's1',
    fullName: 'Alice Smith',
    status: 'active',
    startDate: '2025-01-01',
    jobTitle: 'Consultant',
    email: '',
    role: 'user'
  };

  const mockCompanies: Company[] = [
    { id: 'c1', name: 'Humres Recruitment', departments: [], currency: 'GBP' }
  ];

  const mockPlacements: Placement[] = [
    {
      id: 'p1',
      placementId: 'PL-1',
      clientCompany: 'A',
      candidateName: 'B',
      startDate: '2026-05-10',
      netScoreValue: 15000,
      status: 'active',
      clientPaymentStatus: 'paid',
      companyId: 'c1',
      splits: [{ staffId: 's1', percentage: 100 }]
    } as any
  ];

  it('should return 0 payout if no policy assigned', () => {
    const res = calculateCashReceivedCommission(mockStaff, null, '2026-06', [mockStaff], mockCompanies, mockPlacements);
    expect(res.totalPayout).toBe(0);
  });

  it('should calculate progressive slab payout correctly', () => {
    const policy = {
      id: 'scheme-1',
      companyId: 'c1',
      type: 'individual',
      monthlyThreshold: 3000, // 15000 - 3000 = 12000 commissionable
      slabs: [
        { minAmount: 0, maxAmount: 10000, rate: 10 }, // 10000 * 10% = 1000
        { minAmount: 10000, maxAmount: 20000, rate: 15 } // 2000 * 15% = 300
      ],
      slabType: 'progressive',
      calcInterval: 'monthly'
    };

    const res = calculateCashReceivedCommission(mockStaff, policy, '2026-06', [mockStaff], mockCompanies, mockPlacements);
    expect(res.billing).toBe(15000);
    expect(res.baseEarned).toBe(1300); // 1000 + 300
    expect(res.totalPayout).toBe(1300);
  });
});
