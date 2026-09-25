import { describe, it, expect } from 'vitest';
import { isInternalContraTransfer, isIntercompanyTransfer, parseTransactionLines } from './pdfStatementParser';
import { parseBankAmount } from '../components/expenses/BankStatementImport';

describe('pdfStatementParser helpers', () => {
  describe('isInternalContraTransfer', () => {
    it('detects Wise payments as internal contra', () => {
      expect(isInternalContraTransfer('WISE PAYMENTS LTD', 'Monthly topup')).toBe(true);
      expect(isInternalContraTransfer('TransferWise', 'Account transfer')).toBe(true);
      expect(isInternalContraTransfer('Wise Payments', 'Ref 12345')).toBe(true);
      expect(isInternalContraTransfer('Internal Treasury Transfer', '')).toBe(true);
      expect(isInternalContraTransfer('Transfer to Wise', 'ZAR Account funding')).toBe(true);
    });

    it('detects transfers matching internal bank accounts', () => {
      const knownBanks = [
        { bankName: 'HSBC', accountName: 'Main Current', accountNumber: '98765432' },
        { bankName: 'Wise', accountName: 'Wise Primary', accountNumber: '11223344' }
      ];

      expect(isInternalContraTransfer('Bank Transfer', 'To 98765432', knownBanks)).toBe(true);
      expect(isInternalContraTransfer('Wise Primary', '', knownBanks)).toBe(true);
      expect(isInternalContraTransfer('Standard Vendor Ltd', 'Invoice 44', knownBanks)).toBe(false);
    });

    it('returns false for normal vendor and payroll transactions', () => {
      expect(isInternalContraTransfer('Recruitly Limited', 'Monthly subscription')).toBe(false);
      expect(isInternalContraTransfer('John Smith', 'Salary Jan 2026')).toBe(false);
      expect(isInternalContraTransfer('Amazon Web Services', 'Hosting')).toBe(false);
    });
  });

  describe('isIntercompanyTransfer', () => {
    const companies = [
      { id: 'comp-1', name: 'Humres Technical Recruitment Ltd', aliases: ['Humres Tech', 'HTR'] },
      { id: 'comp-2', name: 'Humres Global Limited', aliases: ['Humres Global', 'HGL'] },
      { id: 'comp-3', name: 'Talent Services Group', aliases: ['TSG'] }
    ];

    it('detects intercompany transfers to other group entities', () => {
      const res = isIntercompanyTransfer('Humres Global Limited', 'Management recharge', 'comp-1', companies);
      expect(res.isIntercompany).toBe(true);
      expect(res.targetCompanyId).toBe('comp-2');
      expect(res.targetCompanyName).toBe('Humres Global Limited');
    });

    it('detects intercompany transfers using aliases', () => {
      const res = isIntercompanyTransfer('Transfer to TSG', 'Intercompany loan', 'comp-1', companies);
      expect(res.isIntercompany).toBe(true);
      expect(res.targetCompanyId).toBe('comp-3');
    });

    it('ignores transfers within the same company (self)', () => {
      const res = isIntercompanyTransfer('Humres Technical Recruitment Ltd', 'Self', 'comp-1', companies);
      expect(res.isIntercompany).toBe(false);
    });

    it('returns false for unrelated payees', () => {
      const res = isIntercompanyTransfer('British Telecom', 'Broadband', 'comp-1', companies);
      expect(res.isIntercompany).toBe(false);
    });
  });

  describe('parseTransactionLines', () => {
    it('parses typical HSBC statement lines', () => {
      const lines = [
        { y: 500, items: [], fullText: 'Date Payment details Paid out Paid in Balance' },
        { y: 480, items: [], fullText: '23 Jan 26 BP WISE PAYMENTS LTD 10,000.00 45,210.50' },
        { y: 460, items: [], fullText: '24 Jan 26 CR RECRUITLY LTD 2,500.00 47,710.50' }
      ];

      const res = parseTransactionLines(lines);
      expect(res.rows.length).toBe(2);
      expect(res.rows[0][0]).toBe('23 Jan 26');
      expect(res.rows[0][1]).toContain('WISE PAYMENTS LTD');
      expect(res.rows[0][2]).toBe('10000.00');
      expect(res.rows[0][4]).toBe('45210.50');
    });

    it('parses typical Wise statement lines with ISO dates', () => {
      const lines = [
        { y: 500, items: [], fullText: 'Transfer ID Date Amount Currency Description Balance' },
        { y: 480, items: [], fullText: 'TRANSFER-99123 2026-01-25 -500.00 GBP Adobe Creative Cloud 14,500.00' },
        { y: 460, items: [], fullText: 'TRANSFER-99124 2026-01-26 -2,500.00 GBP Salary Thabo Mokoena 12,000.00' }
      ];

      const res = parseTransactionLines(lines);
      expect(res.rows.length).toBe(2);
      expect(res.rows[0][0]).toBe('2026-01-25');
      expect(res.rows[0][1]).toContain('Adobe Creative Cloud');
      expect(res.rows[0][2]).toBe('-500.00');
    });

    it('handles continuation lines gracefully', () => {
      const lines = [
        { y: 500, items: [], fullText: '15/01/2026 RECRUITMENT SOFTWARE CO 1,200.00 30,000.00' },
        { y: 485, items: [], fullText: 'Monthly Enterprise License INV-8891' }
      ];

      const res = parseTransactionLines(lines);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0][1]).toContain('RECRUITMENT SOFTWARE CO');
      expect(res.rows[0][1]).toContain('INV-8891');
    });
  });
});

describe('parseBankAmount (Credit vs Debit amount parser)', () => {
  it('parses standard positive amounts as credit/positive', () => {
    expect(parseBankAmount('1500.50')).toEqual({ num: 1500.5, isNegative: false });
    expect(parseBankAmount(2500)).toEqual({ num: 2500, isNegative: false });
    expect(parseBankAmount('£1,250.00')).toEqual({ num: 1250, isNegative: false });
  });

  it('parses minus and en-dash signed amounts as negative (debit)', () => {
    expect(parseBankAmount('-450.00')).toEqual({ num: 450, isNegative: true });
    expect(parseBankAmount('–1,200.50')).toEqual({ num: 1200.5, isNegative: true });
    expect(parseBankAmount(-75)).toEqual({ num: 75, isNegative: true });
  });

  it('parses accounting parentheses as negative (debit)', () => {
    expect(parseBankAmount('(350.00)')).toEqual({ num: 350, isNegative: true });
    expect(parseBankAmount('(£1,500.00)')).toEqual({ num: 1500, isNegative: true });
  });

  it('parses CR as credit (positive) and DR as debit (negative)', () => {
    expect(parseBankAmount('10,000.00 CR')).toEqual({ num: 10000, isNegative: false });
    expect(parseBankAmount('500.00 DR')).toEqual({ num: 500, isNegative: true });
  });

  it('handles empty or null values gracefully', () => {
    expect(parseBankAmount('')).toEqual({ num: 0, isNegative: false });
    expect(parseBankAmount(null)).toEqual({ num: 0, isNegative: false });
    expect(parseBankAmount(undefined)).toEqual({ num: 0, isNegative: false });
  });
});
