import { Company, Staff, Expense, Vendor } from '../../types';
import { toGBP } from '../../utils/currency';

export const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

export const symbolMap: Record<string, string> = { 
  GBP: '£', 
  USD: '$', 
  AED: 'AED ', 
  INR: '₹', 
  ZAR: 'R' 
};

export const getCategoryStyles = (category: string) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('software') || cat.includes('license') || cat.includes('it') || cat.includes('saas')) {
    return {
      accent: 'var(--primary)',
      bg: 'rgba(99, 102, 241, 0.08)',
      border: 'rgba(99, 102, 241, 0.2)',
      indicator: '💻',
      badgeColor: '#38bdf8'
    };
  }
  if (cat.includes('rent') || cat.includes('lease') || cat.includes('landlord') || cat.includes('office')) {
    return {
      accent: 'var(--success)',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
      indicator: '🏢',
      badgeColor: '#34d399'
    };
  }
  if (cat.includes('utilities') || cat.includes('utility') || cat.includes('phone') || cat.includes('internet') || cat.includes('comm')) {
    return {
      accent: 'var(--warning)',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      indicator: '📞',
      badgeColor: '#fbbf24'
    };
  }
  return {
    accent: 'var(--text-secondary)',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.2)',
    indicator: '💼',
    badgeColor: '#cbd5e1'
  };
};

export interface VendorsDashboardProps {
  companies: Company[];
  staff: Staff[];
  vendors: Vendor[];
  contracts: any[];
  assetAssignments: any[];
  expenses: Expense[];
  nominalCodes?: any[];
  onSaveExpense: (exp: Expense) => Promise<any>;
  onSaveVendor: (v: Vendor) => Promise<any>;
  onDeleteVendor?: (id: string) => Promise<any>;
  onSaveContract?: (contract: any) => Promise<any>;
  onDeleteContract?: (id: string) => Promise<any>;
  onSaveAssetAssignment?: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
}

export interface Split {
  type: 'company' | 'department' | 'user';
  targetId: string;
  percentage: number;
}

export const getPaymentAlert = (dueDateStr?: string) => {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime())) return null;
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { type: 'overdue', text: `Overdue by ${Math.abs(diffDays)} days`, color: 'var(--danger)' };
  } else if (diffDays === 0) {
    return { type: 'today', text: 'Due Today', color: 'var(--danger)' };
  } else if (diffDays <= 7) {
    return { type: 'soon', text: `Due in ${diffDays} days`, color: 'var(--warning)' };
  }
  return null;
};

export const getActiveHeadcountsForMonth = (staff: Staff[], companies: Company[], year: number, monthIndex: number) => {
  const periodStart = new Date(year, monthIndex, 1);
  const periodEnd = new Date(year, monthIndex + 1, 0);

  const activeStaff = staff.filter(s => {
    if (s.status === 'exited' && s.exitDate) {
      const exit = new Date(s.exitDate);
      if (exit < periodStart) return false;
    }
    if (s.joinDate) {
      const join = new Date(s.joinDate);
      if (join > periodEnd) return false;
    }
    return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
  });

  const counts: Record<string, number> = {};
  companies.forEach(c => {
    counts[c.id] = 0;
  });

  activeStaff.forEach(s => {
    if (s.companyId) {
      counts[s.companyId] = (counts[s.companyId] || 0) + 1;
    }
  });

  return counts;
};

export const getSplitProRataShares = (staff: Staff[], splits: Split[], year: number, monthIndex: number) => {
  const periodStart = new Date(year, monthIndex, 1);
  const periodEnd = new Date(year, monthIndex + 1, 0);

  const activeStaff = staff.filter(s => {
    if (s.status === 'exited' && s.exitDate) {
      const exit = new Date(s.exitDate);
      if (exit < periodStart) return false;
    }
    if (s.joinDate) {
      const join = new Date(s.joinDate);
      if (join > periodEnd) return false;
    }
    return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
  });

  const counts = splits.map(s => {
    if (s.type === 'company') {
      return activeStaff.filter(member => member.companyId === s.targetId).length;
    } else if (s.type === 'department') {
      return activeStaff.filter(member => member.department === s.targetId).length;
    } else if (s.type === 'user') {
      return activeStaff.some(member => member.id === s.targetId) ? 1 : 0;
    }
    return 0;
  });

  const totalCount = counts.reduce((a, b) => a + b, 0);

  return splits.map((s, idx) => {
    const count = counts[idx];
    const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
    return {
      ...s,
      percentage: Math.round(percentage)
    };
  });
};

export const getContractCompanyShare = (c: any, staff: Staff[], companies: Company[], companyId: string, year: number, monthIndex: number) => {
  const splits: Split[] = c.splits || [];
  if (c.useHeadcountSplit) {
    if (splits.length === 0) {
      const headcounts = getActiveHeadcountsForMonth(staff, companies, year, monthIndex);
      const total = Object.values(headcounts).reduce((a, b) => a + b, 0);
      const count = headcounts[companyId] || 0;
      return total > 0 ? (count / total) : 0;
    } else {
      const activeStaff = staff.filter(s => {
        const periodStart = new Date(year, monthIndex, 1);
        const periodEnd = new Date(year, monthIndex + 1, 0);
        if (s.status === 'exited' && s.exitDate) {
          const exit = new Date(s.exitDate);
          if (exit < periodStart) return false;
        }
        if (s.joinDate) {
          const join = new Date(s.joinDate);
          if (join > periodEnd) return false;
        }
        return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
      });

      const counts = splits.map(s => {
        if (s.type === 'company') {
          return activeStaff.filter(member => member.companyId === s.targetId).length;
        } else if (s.type === 'department') {
          return activeStaff.filter(member => member.department === s.targetId).length;
        } else if (s.type === 'user') {
          return activeStaff.some(member => member.id === s.targetId) ? 1 : 0;
        }
        return 0;
      });

      const totalCount = counts.reduce((a, b) => a + b, 0);
      if (totalCount <= 0) return 0;

      let companyShare = 0;
      splits.forEach((s, idx) => {
        const count = counts[idx];
        const targetShare = count / totalCount;
        
        if (s.type === 'company' && s.targetId === companyId) {
          companyShare += targetShare;
        } else if (s.type === 'department') {
          const deptStaff = activeStaff.filter(member => member.department === s.targetId);
          const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
          if (deptStaff.length > 0) {
            companyShare += targetShare * (targetCompStaffCount / deptStaff.length);
          }
        } else if (s.type === 'user' && s.targetId) {
          const member = activeStaff.find(member => member.id === s.targetId);
          if (member && member.companyId === companyId) {
            companyShare += targetShare;
          }
        }
      });

      return companyShare;
    }
  } else {
    if (splits.length === 0) {
      return c.companyId === companyId ? 1.0 : 0;
    }

    let companyShare = 0;
    const totalManualPercentage = splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
    
    splits.forEach(s => {
      const manualPct = Number(s.percentage || 0) / 100;
      if (s.type === 'company' && s.targetId === companyId) {
        companyShare += manualPct;
      } else if (s.type === 'department') {
        const activeStaff = staff.filter(member => {
          const periodStart = new Date(year, monthIndex, 1);
          const periodEnd = new Date(year, monthIndex + 1, 0);
          if (member.status === 'exited' && member.exitDate) {
            const exit = new Date(member.exitDate);
            if (exit < periodStart) return false;
          }
          if (member.joinDate) {
            const join = new Date(member.joinDate);
            if (join > periodEnd) return false;
          }
          return member.status !== 'exited' || (member.exitDate && new Date(member.exitDate) >= periodStart);
        });
        const deptStaff = activeStaff.filter(member => member.department === s.targetId);
        const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
        if (deptStaff.length > 0) {
          companyShare += manualPct * (targetCompStaffCount / deptStaff.length);
        }
      } else if (s.type === 'user' && s.targetId) {
        const member = staff.find(member => member.id === s.targetId);
        if (member && member.companyId === companyId) {
          companyShare += manualPct;
        }
      }
    });

    if (c.companyId === companyId) {
      const fallbackShare = Math.max(0, 100 - totalManualPercentage) / 100;
      companyShare += fallbackShare;
    }
    return companyShare;
  }
};
