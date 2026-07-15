import { describe, it, expect } from 'vitest';
import { 
  getCategoryStyles, 
  getPaymentAlert, 
  getActiveHeadcountsForMonth, 
  getSplitProRataShares, 
  getContractCompanyShare,
  Split
} from './shared';
import { Company, Staff } from '../../types';

describe('Vendors Module Utilities', () => {
  describe('getCategoryStyles', () => {
    it('should return software styles for saas/it/license', () => {
      const styles = getCategoryStyles('SaaS License');
      expect(styles.accent).toBe('var(--primary)');
      expect(styles.indicator).toBe('💻');
    });

    it('should return office styles for rent/lease/office', () => {
      const styles = getCategoryStyles('Office Rent');
      expect(styles.accent).toBe('var(--success)');
      expect(styles.indicator).toBe('🏢');
    });

    it('should return utility styles for internet/phone', () => {
      const styles = getCategoryStyles('Phone Internet');
      expect(styles.accent).toBe('var(--warning)');
      expect(styles.indicator).toBe('📞');
    });

    it('should return default styles for other categories', () => {
      const styles = getCategoryStyles('Consulting Fees');
      expect(styles.accent).toBe('var(--text-secondary)');
      expect(styles.indicator).toBe('💼');
    });
  });

  describe('getPaymentAlert', () => {
    it('should return null if no date provided', () => {
      expect(getPaymentAlert(undefined)).toBeNull();
    });

    it('should calculate overdue alerts correctly', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const alert = getPaymentAlert(pastDate.toISOString().split('T')[0]);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('overdue');
      expect(alert?.text).toContain('Overdue by 5 days');
    });

    it('should calculate due soon alerts correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const alert = getPaymentAlert(futureDate.toISOString().split('T')[0]);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe('soon');
      expect(alert?.text).toContain('Due in 3 days');
    });
  });

  describe('getActiveHeadcountsForMonth', () => {
    const mockCompanies: Company[] = [
      { id: 'c1', name: 'Humres Recruitment', departments: [] },
      { id: 'c2', name: 'Humres Technology', departments: [] }
    ];

    const mockStaff: Staff[] = [
      { id: 's1', fullName: 'Alice Smith', companyId: 'c1', status: 'active', jobTitle: '', email: '', role: 'user' },
      { id: 's2', fullName: 'Bob Jones', companyId: 'c2', status: 'active', jobTitle: '', email: '', role: 'user' },
      { id: 's3', fullName: 'Charlie Davis', companyId: 'c1', status: 'exited', exitDate: '2026-05-15', jobTitle: '', email: '', role: 'user' }
    ];

    it('should count Alice and Bob but not Charlie in June 2026', () => {
      const headcounts = getActiveHeadcountsForMonth(mockStaff, mockCompanies, 2026, 5); // June is month index 5
      expect(headcounts['c1']).toBe(1); // Alice
      expect(headcounts['c2']).toBe(1); // Bob
    });

    it('should count Alice, Bob, and Charlie in April 2026', () => {
      const headcounts = getActiveHeadcountsForMonth(mockStaff, mockCompanies, 2026, 3); // April is month index 3
      expect(headcounts['c1']).toBe(2); // Alice + Charlie
      expect(headcounts['c2']).toBe(1); // Bob
    });
  });

  describe('getSplitProRataShares', () => {
    const mockStaff: Staff[] = [
      { id: 's1', fullName: 'Alice Smith', companyId: 'c1', department: 'Sales', status: 'active', jobTitle: '', email: '', role: 'user' },
      { id: 's2', fullName: 'Bob Jones', companyId: 'c2', department: 'Sales', status: 'active', jobTitle: '', email: '', role: 'user' },
      { id: 's3', fullName: 'Charlie Davis', companyId: 'c1', department: 'Technology', status: 'active', jobTitle: '', email: '', role: 'user' }
    ];

    const mockSplits: Split[] = [
      { type: 'company', targetId: 'c1', percentage: 0 },
      { type: 'company', targetId: 'c2', percentage: 0 }
    ];

    it('should allocate splits proportionally based on headcount', () => {
      const updatedSplits = getSplitProRataShares(mockStaff, mockSplits, 2026, 5);
      expect(updatedSplits[0].percentage).toBe(67); // c1 has 2/3 headcounts
      expect(updatedSplits[1].percentage).toBe(33); // c2 has 1/3 headcounts
    });
  });

  describe('getContractCompanyShare', () => {
    const mockCompanies: Company[] = [
      { id: 'c1', name: 'Humres Recruitment', departments: [] },
      { id: 'c2', name: 'Humres Technology', departments: [] }
    ];

    const mockStaff: Staff[] = [
      { id: 's1', fullName: 'Alice Smith', companyId: 'c1', department: 'Sales', status: 'active', jobTitle: '', email: '', role: 'user' },
      { id: 's2', fullName: 'Bob Jones', companyId: 'c2', department: 'Sales', status: 'active', jobTitle: '', email: '', role: 'user' }
    ];

    it('should allocate 100% to contract owner company if no splits specified', () => {
      const mockContract = {
        companyId: 'c1',
        useHeadcountSplit: false,
        splits: []
      };
      const share = getContractCompanyShare(mockContract, mockStaff, mockCompanies, 'c1', 2026, 5);
      expect(share).toBe(1.0);
    });

    it('should split by headcount pro-rata across companies if headcount split enabled and no manual splits defined', () => {
      const mockContract = {
        companyId: 'c1',
        useHeadcountSplit: true,
        splits: []
      };
      const shareC1 = getContractCompanyShare(mockContract, mockStaff, mockCompanies, 'c1', 2026, 5);
      const shareC2 = getContractCompanyShare(mockContract, mockStaff, mockCompanies, 'c2', 2026, 5);
      expect(shareC1).toBe(0.5);
      expect(shareC2).toBe(0.5);
    });
  });
});
