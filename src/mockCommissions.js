export const initialCommissionPolicies = [
  {
    id: "comm-1",
    name: "UK Recruiter Scheme - Day One",
    companyId: "comp-1",
    type: "individual",
    effectiveFrom: "day_one",
    monthlyThreshold: 3000,
    slabs: [
      { minAmount: 0, maxAmount: 10000, rate: 10 },
      { minAmount: 10000, maxAmount: 15000, rate: 15 },
      { minAmount: 15000, maxAmount: 999999, rate: 20 }
    ],
    teamOverridePercent: 0,
    description: "Standard UK recruiter commission scheme. Slabs apply from day one of billing. Monthly threshold: £3,000."
  },
  {
    id: "comm-2",
    name: "US Executive Search Scheme",
    companyId: "comp-2",
    type: "individual",
    effectiveFrom: "day_one",
    monthlyThreshold: 5000,
    slabs: [
      { minAmount: 0, maxAmount: 15000, rate: 12 },
      { minAmount: 15000, maxAmount: 30000, rate: 18 },
      { minAmount: 30000, maxAmount: 999999, rate: 25 }
    ],
    teamOverridePercent: 0,
    description: "US executive recruiter incentive plan. Higher billing threshold with up to 25% commissions on high-value placements."
  },
  {
    id: "comm-3",
    name: "India Recruiter - After 1 Year",
    companyId: "comp-4",
    type: "individual",
    effectiveFrom: "one_year_service",
    monthlyThreshold: 100000, // INR 100K
    slabs: [
      { minAmount: 0, maxAmount: 300000, rate: 5 },
      { minAmount: 300000, maxAmount: 600000, rate: 10 },
      { minAmount: 600000, maxAmount: 9999999, rate: 15 }
    ],
    teamOverridePercent: 0,
    description: "Incentive plan for India offshore sourcing agents. Commissions unlock after 1 year of continuous service."
  },
  {
    id: "comm-4",
    name: "UK Manager Team-Billing Scheme",
    companyId: "comp-1",
    type: "manager",
    effectiveFrom: "day_one",
    monthlyThreshold: 20000, // team has to generate £20K threshold
    slabs: [
      { minAmount: 0, maxAmount: 20000, rate: 2.5 }, // 2.5% on first £20k of surplus
      { minAmount: 20000, maxAmount: 50000, rate: 5.0 }, // 5% on next £30k
      { minAmount: 50000, maxAmount: 999999, rate: 8.0 }  // 8% on anything above
    ],
    teamOverridePercent: 0,
    description: "Manager incentive scheme based on cumulative team billing. Slabs apply to team billings exceeding the £20,000 team threshold."
  }
];
