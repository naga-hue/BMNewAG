import { describe, it, expect } from 'vitest';
import {
  parseFlexibleDate,
  calculateDueDate,
  calculateSimplicityBreakdown,
  parseCSV
} from './utils';

describe('Placements utility functions', () => {
  describe('parseFlexibleDate', () => {
    it('should parse YYYY-MM-DD standard format', () => {
      expect(parseFlexibleDate('2026-07-15')).toBe('2026-07-15');
    });

    it('should parse DD/MM/YYYY UK format', () => {
      expect(parseFlexibleDate('15/07/2026')).toBe('2026-07-15');
    });

    it('should parse D/M/YY UK short format', () => {
      expect(parseFlexibleDate('15/7/26')).toBe('2026-07-15');
    });

    it('should swap day and month if month > 12 in ambiguous short formats', () => {
      expect(parseFlexibleDate('25/12/26')).toBe('2026-12-25');
    });

    it('should return empty string for empty inputs', () => {
      expect(parseFlexibleDate('')).toBe('');
      expect(parseFlexibleDate('   ')).toBe('');
    });
  });

  describe('calculateDueDate', () => {
    it('should calculate due date with positive days offset', () => {
      expect(calculateDueDate('2026-07-15', 30)).toBe('2026-08-14');
    });

    it('should calculate due date with short offsets', () => {
      expect(calculateDueDate('2026-07-15', 7)).toBe('2026-07-22');
    });

    it('should return input date if input is invalid', () => {
      expect(calculateDueDate('', 30)).toBe('');
      expect(calculateDueDate('invalid-date', 30)).toBe('invalid-date');
    });
  });

  describe('calculateSimplicityBreakdown', () => {
    it('should compute correct Simplicity factoring payout (97.04% of gross + 20% VAT)', () => {
      const gross = 10000;
      const breakdown = calculateSimplicityBreakdown(gross);
      // 10000 * 0.9704 = 9704
      expect(breakdown.factoredGross).toBe(9704);
      // 9704 * 0.20 = 1940.8
      expect(breakdown.vatAmount).toBe(1940.8);
      // 9704 + 1940.8 = 11644.8
      expect(breakdown.expectedPayout).toBe(11644.8);
    });
  });

  describe('parseCSV', () => {
    it('should parse standard CSV columns', () => {
      const csv = 'id,client,candidate,amount\nPL-001,Google,John Doe,10000';
      const parsed = parseCSV(csv);
      expect(parsed.length).toBe(2);
      expect(parsed[0]).toEqual(['id', 'client', 'candidate', 'amount']);
      expect(parsed[1]).toEqual(['PL-001', 'Google', 'John Doe', '10000']);
    });

    it('should handle quoted fields containing commas', () => {
      const csv = 'id,client,candidate,amount\nPL-002,"Apple, Inc.",Jane Smith,12000';
      const parsed = parseCSV(csv);
      expect(parsed[1]).toEqual(['PL-002', 'Apple, Inc.', 'Jane Smith', '12000']);
    });

    it('should handle quoted fields containing newlines', () => {
      const csv = 'id,client,candidate,notes\nPL-003,Microsoft,Bob,"Line 1\nLine 2"';
      const parsed = parseCSV(csv);
      expect(parsed.length).toBe(2);
      expect(parsed[1][3]).toBe('Line 1\nLine 2');
    });

    it('should handle escaped double quotes', () => {
      const csv = 'id,client,candidate,notes\nPL-004,Meta,Alice,"This is ""escaped"" notes"';
      const parsed = parseCSV(csv);
      expect(parsed[1][3]).toBe('This is "escaped" notes');
    });
  });
});
