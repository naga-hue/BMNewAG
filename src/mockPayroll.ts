export const initialPayrollPolicies = [
  {
    id: 'policy-uk-ft',
    name: 'FT UK Employee Policy',
    type: 'ft_uk',
    employerNiRate: 13.8,
    employerNiThreshold: 758,
    employerPensionRate: 3.0,
    employeeTaxNicRate: 20.0,
    employeePensionRate: 5.0,
    studentLoanActive: true,
    studentLoanRate: 9.0,
    studentLoanThreshold: 2274,
    dailyRateDefault: 0,
    expectedDaysPerMonth: 21.67,
    paymentDayOfMonth: 25,
    payeSlabs: [
      { minAmount: 0, maxAmount: 1048, rate: 0 },
      { minAmount: 1048, maxAmount: 4189, rate: 20 },
      { minAmount: 4189, maxAmount: 10428, rate: 40 },
      { minAmount: 10428, maxAmount: 999999999, rate: 45 }
    ],
    employeeNiSlabs: [
      { minAmount: 0, maxAmount: 1048, rate: 0 },
      { minAmount: 1048, maxAmount: 4189, rate: 8 },
      { minAmount: 4189, maxAmount: 999999999, rate: 2 }
    ],
    employerNiSlabs: [
      { minAmount: 0, maxAmount: 758, rate: 0 },
      { minAmount: 758, maxAmount: 999999999, rate: 13.8 }
    ]
  },
  {
    id: 'policy-freelance',
    name: 'Freelance / Contractor Policy',
    type: 'freelance',
    employerNiRate: 0,
    employerNiThreshold: 0,
    employerPensionRate: 0,
    employeeTaxNicRate: 0,
    employeePensionRate: 0,
    studentLoanActive: false,
    studentLoanRate: 0,
    studentLoanThreshold: 0,
    dailyRateDefault: 350,
    expectedDaysPerMonth: 21.67,
    paymentDayOfMonth: 25,
    payeSlabs: [],
    employeeNiSlabs: [],
    employerNiSlabs: []
  },
  {
    id: 'policy-india-ft',
    name: 'FT India Employee Policy',
    type: 'custom',
    employerNiRate: 12.0,
    employerNiThreshold: 15000,
    employerPensionRate: 0,
    employeeTaxNicRate: 15.0,
    employeePensionRate: 12.0,
    studentLoanActive: false,
    studentLoanRate: 0,
    studentLoanThreshold: 0,
    dailyRateDefault: 0,
    expectedDaysPerMonth: 21.67,
    paymentDayOfMonth: 25,
    payeSlabs: [
      { minAmount: 0, maxAmount: 25000, rate: 0 },
      { minAmount: 25000, maxAmount: 50000, rate: 5 },
      { minAmount: 50000, maxAmount: 75000, rate: 10 },
      { minAmount: 75000, maxAmount: 100000, rate: 15 },
      { minAmount: 100000, maxAmount: 125000, rate: 20 },
      { minAmount: 125000, maxAmount: 150000, rate: 25 },
      { minAmount: 150000, maxAmount: 999999999, rate: 30 }
    ],
    employeeNiSlabs: [],
    employerNiSlabs: []
  }
];
