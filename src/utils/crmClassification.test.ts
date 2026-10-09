import { describe, it, expect } from 'vitest';

// Function under test
function getPhoneSearchVariants(rawPhone: string): string[] {
  if (!rawPhone) return [];
  const clean = String(rawPhone).replace(/[^0-9+]/g, '').trim();
  if (clean.length < 6) return [];

  const variants = new Set<string>();
  variants.add(clean);

  if (clean.startsWith('+')) {
    variants.add(clean.substring(1));
  }

  if (clean.startsWith('+44')) {
    const rest = clean.substring(3);
    variants.add(`0${rest}`);
    variants.add(rest);
  } else if (clean.startsWith('44') && clean.length >= 11) {
    const rest = clean.substring(2);
    variants.add(`+44${rest}`);
    variants.add(`0${rest}`);
    variants.add(rest);
  } else if (clean.startsWith('0') && clean.length >= 10) {
    const rest = clean.substring(1);
    variants.add(`+44${rest}`);
    variants.add(rest);
  }

  return Array.from(variants);
}

function resolvePartyTypeFromCrmId(crmId: string, matchedType: string): 'Candidate' | 'Client' {
  const normId = (crmId || '').toLowerCase().trim();
  const normType = (matchedType || '').toLowerCase().trim();

  if (normId.startsWith('ca-') || normType.includes('cand')) {
    return 'Candidate';
  }
  if (normId.startsWith('ct-') || normId.startsWith('cy-') || normType.includes('cont') || normType.includes('comp')) {
    return 'Client';
  }
  return 'Client';
}

describe('Recruitly CRM & Party Classification Rules', () => {
  it('generates expected search variants for international and UK local phone numbers', () => {
    const ukMobile = '+447911123456';
    const variants = getPhoneSearchVariants(ukMobile);
    expect(variants).toContain('+447911123456');
    expect(variants).toContain('447911123456');
    expect(variants).toContain('07911123456');
    expect(variants).toContain('7911123456');

    const ukLocal = '07911123456';
    const variantsLocal = getPhoneSearchVariants(ukLocal);
    expect(variantsLocal).toContain('07911123456');
    expect(variantsLocal).toContain('+447911123456');
    expect(variantsLocal).toContain('7911123456');
  });

  it('correctly maps ca- ID prefix to Candidate', () => {
    const targetType = resolvePartyTypeFromCrmId('ca-987654321', 'CANDIDATE');
    expect(targetType).toBe('Candidate');
  });

  it('correctly maps ct- ID prefix (contact) to Client', () => {
    const targetType = resolvePartyTypeFromCrmId('ct-123456789', 'CONTACT');
    expect(targetType).toBe('Client');
  });

  it('correctly maps cy- ID prefix (company) to Client', () => {
    const targetType = resolvePartyTypeFromCrmId('cy-555666777', 'COMPANY');
    expect(targetType).toBe('Client');
  });
});
