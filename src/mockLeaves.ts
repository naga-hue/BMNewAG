export interface LeavePolicy {
  id: string;
  name: string;
  companyId: string;
  annualAllowance: number;
  sickAllowance: number;
  description?: string;
}

export interface Holiday {
  id: string;
  companyId: string;
  name: string;
  date: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string;
}

export const initialPolicies: LeavePolicy[] = [
  {
    id: "policy-1",
    name: "UK Standard 25-Day Policy",
    companyId: "comp-1",
    annualAllowance: 25,
    sickAllowance: 10,
    description: "Standard policy for UK full-time employees including 25 days annual leave."
  },
  {
    id: "policy-2",
    name: "US Standard 15-Day PTO",
    companyId: "comp-2",
    annualAllowance: 15,
    sickAllowance: 5,
    description: "Standard Paid Time Off policy for US personnel."
  },
  {
    id: "policy-3",
    name: "UAE Standard 30-Day Policy",
    companyId: "comp-3",
    annualAllowance: 30,
    sickAllowance: 15,
    description: "Standard commercial law policy for UAE employees (30 calendar days)."
  },
  {
    id: "policy-4",
    name: "India Standard 18-Day PL",
    companyId: "comp-4",
    annualAllowance: 18,
    sickAllowance: 12,
    description: "Privilege leave and sick leave allowances for India Offshore team."
  },
  {
    id: "policy-5",
    name: "UK Construction Worker Policy",
    companyId: "comp-5",
    annualAllowance: 20,
    sickAllowance: 8,
    description: "Policy for payroll contract staff in construction (20 days statutory)."
  }
];

export const initialHolidays: Holiday[] = [
  {
    id: "hol-1",
    companyId: "comp-1",
    name: "New Year's Day",
    date: "2026-01-01"
  },
  {
    id: "hol-2",
    companyId: "comp-1",
    name: "Good Friday",
    date: "2026-04-03"
  },
  {
    id: "hol-3",
    companyId: "comp-1",
    name: "Easter Monday",
    date: "2026-04-06"
  },
  {
    id: "hol-4",
    companyId: "comp-2",
    name: "New Year's Day",
    date: "2026-01-01"
  },
  {
    id: "hol-5",
    companyId: "comp-2",
    name: "Memorial Day",
    date: "2026-05-25"
  },
  {
    id: "hol-6",
    companyId: "comp-2",
    name: "Independence Day",
    date: "2026-07-04"
  },
  {
    id: "hol-7",
    companyId: "comp-3",
    name: "New Year's Day",
    date: "2026-01-01"
  },
  {
    id: "hol-8",
    companyId: "comp-3",
    name: "UAE National Day",
    date: "2026-12-02"
  },
  {
    id: "hol-9",
    companyId: "comp-4",
    name: "New Year's Day",
    date: "2026-01-01"
  },
  {
    id: "hol-10",
    companyId: "comp-4",
    name: "Republic Day",
    date: "2026-01-26"
  },
  {
    id: "hol-11",
    companyId: "comp-4",
    name: "Independence Day",
    date: "2026-08-15"
  },
  {
    id: "hol-12",
    companyId: "comp-1",
    name: "Christmas Day",
    date: "2026-12-25"
  },
  {
    id: "hol-13",
    companyId: "comp-5",
    name: "Christmas Day",
    date: "2026-12-25"
  }
];

export const initialLeaveRequests: LeaveRequest[] = [];
