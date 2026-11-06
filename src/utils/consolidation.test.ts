import { describe, it, expect } from 'vitest';
import { isCompanyConsolidated, isOperatingStaffMember, isPaulSethOrDrawings } from './consolidation';

describe('isCompanyConsolidated', () => {
  it('returns true for standard group companies', () => {
    expect(isCompanyConsolidated({ id: 'c1', name: 'Humres Recruitment Ltd', includeInConsolidation: true })).toBe(true);
    expect(isCompanyConsolidated({ id: 'c2', name: 'Huntek Engineering Ltd' })).toBe(true);
  });

  it('returns false when includeInConsolidation is explicitly false', () => {
    expect(isCompanyConsolidated({ id: 'c3', name: 'Any Company', includeInConsolidation: false })).toBe(false);
  });

  it('returns false for TalentHatch Intelligence Services', () => {
    expect(isCompanyConsolidated({ id: 'c4', name: 'TalentHatch Intelligence Services' })).toBe(false);
  });

  it('returns false for TalentVerse AI Private Limited', () => {
    expect(isCompanyConsolidated({ id: 'c5', name: 'TalentVerse AI Private Limited' })).toBe(false);
  });

  it('returns false for Global Recruiters LLC FC', () => {
    expect(isCompanyConsolidated({ id: 'c6', name: 'Global Recruiters LLC FC' })).toBe(false);
    expect(isCompanyConsolidated({ id: 'c7', name: 'Global Recruiters' })).toBe(false);
  });

  it('returns false for Pulsit / Pulse IT', () => {
    expect(isCompanyConsolidated({ id: 'c8', name: 'Pulsit' })).toBe(false);
    expect(isCompanyConsolidated({ id: 'c9', name: 'Pulsit Solutions Ltd' })).toBe(false);
    expect(isCompanyConsolidated({ id: 'c10', name: 'Pulse IT' })).toBe(false);
  });

  it('returns false for null or undefined company', () => {
    expect(isCompanyConsolidated(null)).toBe(false);
    expect(isCompanyConsolidated(undefined)).toBe(false);
  });
});

describe('isOperatingStaffMember', () => {
  it('excludes Paul Seth from operating staff by default', () => {
    expect(isOperatingStaffMember({ fullName: 'Paul Seth' })).toBe(false);
    expect(isOperatingStaffMember({ fullName: 'paul seth' })).toBe(false);
    expect(isOperatingStaffMember({ name: 'Paul Seth' })).toBe(false);
  });

  it('includes Paul Seth when includeDirector is true', () => {
    expect(isOperatingStaffMember({ fullName: 'Paul Seth' }, true)).toBe(true);
    expect(isOperatingStaffMember({ name: 'Paul Seth' }, true)).toBe(true);
  });

  it('keeps other operating staff', () => {
    expect(isOperatingStaffMember({ fullName: 'Charlie Davies' })).toBe(true);
    expect(isOperatingStaffMember({ fullName: 'Spencer Wicks' })).toBe(true);
  });
});

describe('isPaulSethOrDrawings', () => {
  it('identifies Paul Seth and 1003.1 / 1003.2 as non-operating drawings by default', () => {
    expect(isPaulSethOrDrawings({ payee: 'To Paul Seth', nominalCode: '1003.1 - Director' })).toBe(true);
    expect(isPaulSethOrDrawings({ payee: 'To Sofia Caltabiano', nominalCode: '1003.2 - House' })).toBe(true);
    expect(isPaulSethOrDrawings({ payee: 'Paul Seth', nominalCode: '1003 - Consulting' })).toBe(true);
  });

  it('returns false when includeDirector is true so expenses can flow into P&L', () => {
    expect(isPaulSethOrDrawings({ payee: 'To Paul Seth', nominalCode: '1003.1 - Director' }, true)).toBe(false);
    expect(isPaulSethOrDrawings({ payee: 'Paul Seth', nominalCode: '1003 - Consulting' }, true)).toBe(false);
  });

  it('allows standard operational expenses', () => {
    expect(isPaulSethOrDrawings({ payee: 'Dialpad Inc', nominalCode: '1008 - Telephone & Internet' })).toBe(false);
    expect(isPaulSethOrDrawings({ payee: 'Charlie Davies', nominalCode: '1003 - Consulting' })).toBe(false);
  });
});
