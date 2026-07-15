import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, calculateDaysOverdue } from './shared';
import { Company, Placement } from '../../types';

describe('Credit Control Utilities', () => {
  describe('getCurrencySymbol', () => {
    const mockCompanies: Company[] = [
      { id: 'c1', name: 'Humres Recruitment', departments: [], currency: 'USD' },
      { id: 'c2', name: 'Humres Technology', departments: [], currency: 'ZAR' }
    ];

    it('should return USD symbol for company matching placement.companyId', () => {
      const mockPlacement = {
        companyId: 'c1',
        placementId: 'PL-1',
        clientCompany: 'A',
        candidateName: 'B',
        status: 'active'
      } as Placement;
      expect(getCurrencySymbol(mockPlacement, mockCompanies)).toBe('$');
    });

    it('should return ZAR symbol for company matching placement.companyId', () => {
      const mockPlacement = {
        companyId: 'c2',
        placementId: 'PL-2',
        clientCompany: 'A',
        candidateName: 'B',
        status: 'active'
      } as Placement;
      expect(getCurrencySymbol(mockPlacement, mockCompanies)).toBe('R');
    });

    it('should default to GBP symbol if company matched has no currency or not found', () => {
      const mockPlacement = {
        companyId: 'c3',
        placementId: 'PL-3',
        clientCompany: 'A',
        candidateName: 'B',
        status: 'active'
      } as Placement;
      expect(getCurrencySymbol(mockPlacement, mockCompanies)).toBe('£');
    });
  });

  describe('calculateDaysOverdue', () => {
    it('should return 0 if no due date provided', () => {
      expect(calculateDaysOverdue(null, '2026-06-15')).toBe(0);
    });

    it('should return 0 if due date is today', () => {
      expect(calculateDaysOverdue('2026-06-15', '2026-06-15')).toBe(0);
    });

    it('should return 0 if due date is in the future', () => {
      expect(calculateDaysOverdue('2026-06-20', '2026-06-15')).toBe(0);
    });

    it('should return positive days overdue if due date is in the past', () => {
      expect(calculateDaysOverdue('2026-06-10', '2026-06-15')).toBe(5);
    });
  });
});
