import { describe, it, expect } from 'vitest';
import { getDaysWorkedInMonth } from './shared';

describe('getDaysWorkedInMonth', () => {
  it('should return full month days if employee active entire month', () => {
    // 2026-06 has 30 days
    const days = getDaysWorkedInMonth('2026-01-01', null, '2026-06');
    expect(days).toBe(30);
  });

  it('should return 0 if employee started after month end', () => {
    const days = getDaysWorkedInMonth('2026-07-01', null, '2026-06');
    expect(days).toBe(0);
  });

  it('should return 0 if employee exited before month start', () => {
    const days = getDaysWorkedInMonth('2026-01-01', '2026-05-15', '2026-06');
    expect(days).toBe(0);
  });

  it('should return partial days if employee started mid-month', () => {
    // Started on June 10th. Days: 10 to 30 = 21 days
    const days = getDaysWorkedInMonth('2026-06-10', null, '2026-06');
    expect(days).toBe(21);
  });

  it('should return partial days if employee exited mid-month', () => {
    // Exited on June 15th. Days: 1 to 15 = 15 days
    const days = getDaysWorkedInMonth('2026-01-01', '2026-06-15', '2026-06');
    expect(days).toBe(15);
  });

  it('should calculate overlap days if employee started and exited in same month', () => {
    // Started on June 5th, exited on June 12th. Days: 5 to 12 = 8 days
    const days = getDaysWorkedInMonth('2026-06-05', '2026-06-12', '2026-06');
    expect(days).toBe(8);
  });
});

import { parseAndStandardizeDate } from './shared';

describe('parseAndStandardizeDate', () => {
  it('should preserve already standardized date YYYY-MM-DD', () => {
    expect(parseAndStandardizeDate('2026-07-29')).toBe('2026-07-29');
  });

  it('should standardize DD/MM/YYYY', () => {
    expect(parseAndStandardizeDate('29/07/2026')).toBe('2026-07-29');
    expect(parseAndStandardizeDate('04/01/2026')).toBe('2026-01-04');
  });

  it('should standardize DD-MM-YYYY', () => {
    expect(parseAndStandardizeDate('29-07-2026')).toBe('2026-07-29');
  });

  it('should standardize DD-MMM-YY', () => {
    expect(parseAndStandardizeDate('29-Jul-26')).toBe('2026-07-29');
    expect(parseAndStandardizeDate('04-Jan-26')).toBe('2026-01-04');
  });

  it('should standardize DD-MMM-YYYY', () => {
    expect(parseAndStandardizeDate('29-Jul-2026')).toBe('2026-07-29');
  });

  it('should handle slashes, hyphens, and spaces with word months', () => {
    expect(parseAndStandardizeDate('29 Jul 2026')).toBe('2026-07-29');
    expect(parseAndStandardizeDate('29/Jul/2026')).toBe('2026-07-29');
  });
});

