import { toGBP } from '../../utils/currency';
import { Company, Staff, Placement } from '../../types';

export const symbolMap: Record<string, string> = { 
  GBP: '£', 
  USD: '$', 
  AED: 'AED ', 
  INR: '₹', 
  ZAR: 'R' 
};

export const calculateCashReceivedCommission = (
  member: Staff,
  policy: any,
  monthStr: string,
  staff: Staff[],
  companies: Company[],
  placements: Placement[]
) => {
  if (!policy) {
    return { 
      billing: 0, 
      baseEarned: 0, 
      withheld: 0, 
      paidNow: 0, 
      released: 0, 
      totalPayout: 0, 
      currentPlacements: [] as any[], 
      releasedPlacements: [] as any[], 
      historicalWithheld: [] as any[] 
    };
  }

  const getMonthsOfService = (startStr: string | undefined | null, dateStr: string) => {
    if (!startStr) return 999;
    try {
      const [startYear, startMonth] = startStr.substring(0, 7).split('-').map(Number);
      const [payYear, payMonth] = dateStr.split('-').map(Number);
      return (payYear - startYear) * 12 + (payMonth - startMonth);
    } catch {
      return 999;
    }
  };

  const monthsOfService = getMonthsOfService(member.startDate || (member as any).joinDate, monthStr);
  const isStarterWaiverActive = policy.starterWaiveThreshold && monthsOfService < 12;
  const isLocked = policy.effectiveFrom === 'one_year_service' && monthsOfService < 12 && !isStarterWaiverActive;

  if (isLocked) {
    return { 
      billing: 0, 
      baseEarned: 0, 
      withheld: 0, 
      paidNow: 0, 
      released: 0, 
      totalPayout: 0, 
      currentPlacements: [] as any[], 
      releasedPlacements: [] as any[], 
      historicalWithheld: [] as any[] 
    };
  }

  const [payYear, payMonth] = monthStr.split('-').map(Number);
  
  // Placements evaluated are those starting in the PREVIOUS month
  let cycleYear = payYear;
  let cycleMonth = payMonth - 1;
  if (cycleMonth === 0) {
    cycleMonth = 12;
    cycleYear = payYear - 1;
  }

  // Determine target staff members
  let targetStaffIds = [member.id];
  if (policy.type === 'manager') {
    if (policy.assignedDepartments && policy.assignedDepartments.length > 0) {
      const deptStaff = staff.filter(s => policy.assignedDepartments.includes(s.department));
      targetStaffIds = Array.from(new Set([member.id, ...deptStaff.map(s => s.id)]));
    } else {
      const teamMembers = staff.filter(s => s.reportingManagerId === member.id);
      targetStaffIds = [member.id, ...teamMembers.map(s => s.id)];
    }
  }

  // Helper to calculate total recruiter split billing for a specific start month
  const getRecruiterBillingForStartMonth = (yearVal: number, monthVal: number) => {
    let sum = 0;
    placements.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pStart = new Date(p.startDate);
      if (pStart.getFullYear() === yearVal && (pStart.getMonth() + 1) === monthVal) {
        p.splits?.forEach(s => {
          if (targetStaffIds.includes(s.staffId)) {
            sum += (p.netScoreValue * s.percentage) / 100;
          }
        });
      }
    });
    return sum;
  };

  // Helper to apply slabs to a billing amount (normalized to GBP)
  const getPolicyCommission = (billingAmt: number) => {
    const policyCompany = companies.find(c => c.id === policy.companyId);
    const policyCurrency = policyCompany ? policyCompany.currency : 'GBP';
    
    const thresh = isStarterWaiverActive ? 0 : toGBP(policy.monthlyThreshold || 0, policyCurrency);
    const commissionable = Math.max(0, billingAmt - thresh);
    const slabs = policy.slabs || [];

    if (commissionable <= 0) return 0;

    if (policy.slabType === 'flat_rate') {
      let highestRate = 0;
      for (const slab of slabs) {
        const min = toGBP(slab.minAmount || 0, policyCurrency);
        if (commissionable > min) {
          highestRate = Number(slab.rate) || 0;
        }
      }
      return (commissionable * highestRate) / 100;
    } else {
      let earned = 0;
      let remaining = commissionable;
      for (const slab of slabs) {
        const min = toGBP(slab.minAmount || 0, policyCurrency);
        const max = toGBP(slab.maxAmount || 0, policyCurrency);
        const rate = Number(slab.rate) || 0;
        const slabCap = max - min;

        if (remaining <= 0) break;
        const applicable = Math.min(remaining, slabCap);
        earned += (applicable * rate) / 100;
        remaining -= applicable;
      }
      return earned;
    }
  };

  // Quarterly accumulator helper
  const getQuarterlyCommissionForMonth = (yearVal: number, monthVal: number) => {
    const quarterIdx = Math.floor((monthVal - 1) / 3);
    const startMonthOfQuarter = quarterIdx * 3 + 1;

    let cumulativeBilling = 0;
    for (let m = startMonthOfQuarter; m <= monthVal; m++) {
      cumulativeBilling += getRecruiterBillingForStartMonth(yearVal, m);
    }
    const cumulativeCommission = getPolicyCommission(cumulativeBilling);

    let previousBilling = 0;
    for (let m = startMonthOfQuarter; m <= monthVal - 1; m++) {
      previousBilling += getRecruiterBillingForStartMonth(yearVal, m);
    }
    const previousCommission = getPolicyCommission(previousBilling);

    return Math.max(0, cumulativeCommission - previousCommission);
  };

  // 1. Current Cycle calculations (starts in previous month)
  const isAHComissn = policy.name === 'AH comissn';
  const isTeamLeadCommission = policy.name === 'AH Manager commission Team Lead Commission' || policy.name === 'Team Lead Commission';
  
  // Get reporting team members
  const teamMembers = staff.filter(s => s.reportingManagerId === member.id && s.status === 'active');
  const teamStaffIds = teamMembers.map(s => s.id);
  const teamHeadcount = teamStaffIds.length;

  // Individual cycle billing and base earned
  const managerBilling = getRecruiterBillingForStartMonth(cycleYear, cycleMonth);
  const individualBaseEarned = policy.calcInterval === 'quarterly'
    ? getQuarterlyCommissionForMonth(cycleYear, cycleMonth)
    : getPolicyCommission(managerBilling);

  // Team override billing and base earned
  let teamBillingForCycle = 0;
  let teamRate = 0;
  let teamLeadBaseEarned = 0;

  if (isAHComissn || isTeamLeadCommission) {
    placements.forEach(p => {
      if (!p.startDate || p.status === 'dns') return;
      const pStart = new Date(p.startDate);
      if (pStart.getFullYear() === cycleYear && (pStart.getMonth() + 1) === cycleMonth) {
        p.splits?.forEach(s => {
          if (teamStaffIds.includes(s.staffId)) {
            teamBillingForCycle += (p.netScoreValue * s.percentage) / 100;
          }
        });
      }
    });

    const ratio = teamHeadcount > 0 ? teamBillingForCycle / teamHeadcount : 0;
    if (ratio >= 15000) teamRate = 5;
    else if (ratio >= 10000) teamRate = 4;
    else if (ratio >= 5000) teamRate = 3;

    teamLeadBaseEarned = (teamBillingForCycle * teamRate) / 100;
  }

  const currentCycleBilling = isAHComissn 
    ? (managerBilling + teamBillingForCycle) 
    : (isTeamLeadCommission ? teamBillingForCycle : managerBilling);

  const baseEarned = isAHComissn 
    ? (individualBaseEarned + teamLeadBaseEarned) 
    : (isTeamLeadCommission ? teamLeadBaseEarned : individualBaseEarned);

  // Active target staff IDs for filter
  const activeTargetStaffIds = isAHComissn 
    ? Array.from(new Set([member.id, ...teamStaffIds]))
    : (isTeamLeadCommission ? teamStaffIds : targetStaffIds);

  // Helper to compute a placement's commission share
  const computePlacementCommShare = (
    p: any, 
    cycleBilling: number, 
    baseIndividual: number, 
    teamBilling: number, 
    baseTeam: number
  ) => {
    let placementCommShare = 0;
    
    // Manager's individual portion
    if (!isTeamLeadCommission) {
      const managerSplit = p.splits?.find((s: any) => s.staffId === member.id);
      if (managerSplit) {
        const billingShare = (p.netScoreValue * managerSplit.percentage) / 100;
        placementCommShare += cycleBilling > 0 ? (billingShare / cycleBilling) * baseIndividual : 0;
      }
    }
    
    // Team override portion
    if (isAHComissn || isTeamLeadCommission) {
      const teamSplits = p.splits?.filter((s: any) => teamStaffIds.includes(s.staffId)) || [];
      if (teamSplits.length > 0) {
        const teamSplitPct = teamSplits.reduce((acc: number, s: any) => acc + s.percentage, 0);
        const teamBillingShare = (p.netScoreValue * teamSplitPct) / 100;
        placementCommShare += teamBilling > 0 ? (teamBillingShare / teamBilling) * baseTeam : 0;
      }
    }

    return placementCommShare;
  };

  const currentPlacements: any[] = [];
  let totalPaidNow = 0;
  let totalWithheld = 0;

  placements.forEach(p => {
    if (!p.startDate || p.status === 'dns') return;
    const pStart = new Date(p.startDate);
    if (pStart.getFullYear() === cycleYear && (pStart.getMonth() + 1) === cycleMonth) {
      const mySplits = p.splits?.filter(s => activeTargetStaffIds.includes(s.staffId)) || [];
      if (mySplits.length > 0) {
        const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
        const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;
        
        const myCommShare = computePlacementCommShare(
          p, 
          managerBilling, 
          individualBaseEarned, 
          teamBillingForCycle, 
          teamLeadBaseEarned
        );

        const isPaid = p.clientPaymentStatus === 'paid';
        if (isPaid) {
          totalPaidNow += myCommShare;
        } else {
          totalWithheld += myCommShare;
        }

        currentPlacements.push({
          id: p.id,
          placementId: p.placementId,
          clientCompany: p.clientCompany,
          candidateName: p.candidateName,
          startDate: p.startDate,
          netScoreValue: p.netScoreValue,
          mySplitPct: totalSplitPct,
          myBillingShare,
          myCommShare,
          isPaid,
          paymentStatus: p.clientPaymentStatus,
          clientPaidDate: (p as any).clientPaidDate || (p as any).paymentReceivedDate
        });
      }
    }
  });

  // 2. Releases from Prior Withholds (starts before the previous month)
  const releasedPlacements: any[] = [];
  const historicalWithheld: any[] = [];
  let totalReleased = 0;

  placements.forEach(p => {
    if (!p.startDate || p.status === 'dns') return;
    const pStart = new Date(p.startDate);
    const pStartYear = pStart.getFullYear();
    const pStartMonth = pStart.getMonth() + 1;

    // strictly prior to the current cycle month
    const isPriorStart = pStartYear < cycleYear || (pStartYear === cycleYear && pStartMonth < cycleMonth);

    if (isPriorStart) {
      const mySplits = p.splits?.filter(s => activeTargetStaffIds.includes(s.staffId)) || [];
      if (mySplits.length > 0) {
        const totalSplitPct = mySplits.reduce((acc, s) => acc + s.percentage, 0);
        const myBillingShare = (p.netScoreValue * totalSplitPct) / 100;

        // Reconstruct historical month's aggregate
        let histIndividualBase = 0;
        let histManagerBilling = 0;
        let histTeamBilling = 0;
        let histTeamBase = 0;

        if (!isTeamLeadCommission) {
          histManagerBilling = getRecruiterBillingForStartMonth(pStartYear, pStartMonth);
          histIndividualBase = policy.calcInterval === 'quarterly'
            ? getQuarterlyCommissionForMonth(pStartYear, pStartMonth)
            : getPolicyCommission(histManagerBilling);
        }

        if (isAHComissn || isTeamLeadCommission) {
          placements.forEach(hp => {
            if (!hp.startDate || hp.status === 'dns') return;
            const hpStart = new Date(hp.startDate);
            if (hpStart.getFullYear() === pStartYear && (hpStart.getMonth() + 1) === pStartMonth) {
              hp.splits?.forEach(s => {
                if (teamStaffIds.includes(s.staffId)) {
                  histTeamBilling += (hp.netScoreValue * s.percentage) / 100;
                }
              });
            }
          });
          const histRatio = teamHeadcount > 0 ? histTeamBilling / teamHeadcount : 0;
          let histRate = 0;
          if (histRatio >= 15000) histRate = 5;
          else if (histRatio >= 10000) histRate = 4;
          else if (histRatio >= 5000) histRate = 3;

          histTeamBase = (histTeamBilling * histRate) / 100;
        }

        const myCommShare = computePlacementCommShare(
          p, 
          histManagerBilling, 
          histIndividualBase, 
          histTeamBilling, 
          histTeamBase
        );

        if (myCommShare > 0) {
          const isPaid = p.clientPaymentStatus === 'paid';
          const pPaidDateStr = (p as any).clientPaidDate || (p as any).paymentReceivedDate;
          
          // Check if clientPaidDate falls in the current payroll month
          let paidInCurrentMonth = false;
          if (pPaidDateStr) {
            const pPaidDate = new Date(pPaidDateStr);
            paidInCurrentMonth = pPaidDate.getFullYear() === payYear && (pPaidDate.getMonth() + 1) === payMonth;
          }

          if (isPaid && paidInCurrentMonth) {
            totalReleased += myCommShare;
            releasedPlacements.push({
              id: p.id,
              placementId: p.placementId,
              clientCompany: p.clientCompany,
              candidateName: p.candidateName,
              startDate: p.startDate,
              myBillingShare,
              myCommShare,
              clientPaidDate: pPaidDateStr
            });
          } else if (!isPaid) {
            historicalWithheld.push({
              id: p.id,
              placementId: p.placementId,
              clientCompany: p.clientCompany,
              candidateName: p.candidateName,
              startDate: p.startDate,
              myBillingShare,
              myCommShare
            });
          }
        }
      }
    }
  });

  return {
    billing: currentCycleBilling,
    baseEarned,
    withheld: totalWithheld,
    paidNow: totalPaidNow,
    released: totalReleased,
    totalPayout: totalPaidNow + totalReleased,
    currentPlacements,
    releasedPlacements,
    historicalWithheld
  };
};
