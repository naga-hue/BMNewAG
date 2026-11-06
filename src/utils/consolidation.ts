import { Company } from '../types';

/**
 * Determines whether a company is included in Consolidated Group Financial Reports
 * (Consolidated Group P&L, Group Cashflow, Group Team & Tool Costs, and Group Overheads).
 *
 * A company is excluded if:
 * 1. Its `includeInConsolidation` field is explicitly `false`, or
 * 2. It matches known excluded back-office / non-consolidated entities:
 *    - TalentHatch Intelligence Services
 *    - TalentVerse AI Private Limited
 *    - Global Recruiters LLC FC / Global Recruiters
 *    - Pulsit / Pulse IT
 */
export const isCompanyConsolidated = (company?: Partial<Company> | null): boolean => {
  if (!company) return false;
  if (company.includeInConsolidation === false) return false;

  const name = (company.name || '').toLowerCase().trim();
  if (
    name.includes('talenthatch') ||
    name.includes('talentverse') ||
    name.includes('talentedge') ||
    name.includes('global recruiters') ||
    name.includes('pulsit') ||
    name.includes('pulse it') ||
    name.includes('pulse-it')
  ) {
    return false;
  }

  return true;
};

/**
 * Determines whether a staff member is an operating team member
 * included in departmental and group operating P&L statements.
 *
 * Paul Seth (Managing Director / Corporate Owner) is strictly excluded
 * from operational team costs and P&L salary projections.
 */
export const isOperatingStaffMember = (
  staff?: { fullName?: string; name?: string } | null,
  includeDirector: boolean = false
): boolean => {
  if (!staff) return false;
  if (includeDirector) return true;
  const fn = (staff.fullName || staff.name || '').toLowerCase().trim();
  if (fn === 'paul seth' || fn.includes('paul seth')) {
    return false;
  }
  return true;
};

/**
 * Identifies director distributions, owner drawings, and personal house expenses
 * (e.g. Paul Seth drawings under 1003.1, Sofia Caltabiano house drawings under 1003.2)
 * which are non-operating balance sheet transactions rather than operating P&L overheads.
 */
export const isPaulSethOrDrawings = (
  expense?: { payee?: string; nominalCode?: string } | null,
  includeDirector: boolean = false
): boolean => {
  if (!expense || includeDirector) return false;
  const payee = (expense.payee || '').toLowerCase().trim();
  const nom = (expense.nominalCode || '').toLowerCase().trim();
  if (
    payee.includes('paul seth') ||
    nom.includes('1003.1') ||
    nom.includes('1003.2') ||
    nom.includes('house')
  ) {
    return true;
  }
  return false;
};
