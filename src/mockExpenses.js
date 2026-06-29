export const initialNominalCodes = [
  { id: "7001", code: "7001 - Office Rentals & Leasing" },
  { id: "7002", code: "7002 - Software Licenses & SaaS" },
  { id: "7003", code: "7003 - Staff Payroll & Wages" },
  { id: "7004", code: "7004 - Freelancers & Subcontractors" },
  { id: "7005", code: "7005 - Office Supplies & Postage" },
  { id: "7006", code: "7006 - Travel & Entertainment Expenses" },
  { id: "7007", code: "7007 - Telecommunications & Internet" },
  { id: "7008", code: "7008 - Professional fees (Legal/Accounting)" },
  { id: "7009", code: "7009 - Tax & Regulatory Duties" },
  { id: "7010", code: "7010 - Bank Charges & Card Fees" }
];

export const initialExpenses = [
  {
    id: "exp-1",
    date: "2026-05-01",
    plMonth: "2026-05",
    payee: "Apex Property Holdings",
    nominalCode: "7001 - Office Rentals & Leasing",
    amount: 3500.00,
    currency: "GBP",
    taxRate: 20, // 20% VAT
    invoiceUrl: "#",
    allocationType: "company", // company, department, staff
    allocationTarget: "company-1", // Acme Corp
    description: "Office rent for headquarters (May 2026)"
  },
  {
    id: "exp-2",
    date: "2026-05-10",
    plMonth: "2026-05",
    payee: "LinkedIn Ireland",
    nominalCode: "7002 - Software Licenses & SaaS",
    amount: 1200.00,
    currency: "GBP",
    taxRate: 20,
    invoiceUrl: "#",
    allocationType: "staff", // allocated to specific staff members
    allocationTarget: ["staff-1", "staff-3"], // split between John Doe & Dwight
    description: "Recruiter Lite subscription (2 licenses)"
  },
  {
    id: "exp-3",
    date: "2026-05-15",
    plMonth: "2026-05",
    payee: "Dialpad Inc",
    nominalCode: "7007 - Telecommunications & Internet",
    amount: 450.00,
    currency: "USD",
    taxRate: 0,
    invoiceUrl: "#",
    allocationType: "department",
    allocationTarget: "Sales", // Sales department
    description: "Cloud telephony licenses for outbound dialing"
  },
  {
    id: "exp-4",
    date: "2026-05-22",
    plMonth: "2026-05",
    payee: "Jane Doe Consulting",
    nominalCode: "7004 - Freelancers & Subcontractors",
    amount: 1500.00,
    currency: "GBP",
    taxRate: 0,
    invoiceUrl: "#",
    allocationType: "staff",
    allocationTarget: ["staff-2"], // Sarah Connor
    description: "Freelance sourcing support on senior developer roles"
  }
];
