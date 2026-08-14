export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  sortCode?: string;
  currency: string;
}

export interface Company {
  id: string;
  name: string;
  departments?: string[];
  bankAccounts?: BankAccount[];
  recruitlyApiKey?: string;
  dialpadApiKey?: string;
}

export interface Staff {
  id: string;
  name?: string;
  fullName: string;
  companyId: string;
  department?: string;
  status?: string;
  role?: string;
  payrollPolicyId?: string;
  qandleEmail?: string;
  dialpadEmail?: string;
  recruitlyEmail?: string;
}

export interface Expense {
  id: string;
  date: string;
  plMonth: string;
  payee: string;
  nominalCode: string;
  amount: number;
  currency: string;
  taxRate?: number;
  description?: string;
  invoiceUrl?: string;
  recipientType?: string;
  recipientId?: string;
  allocationType?: string;
  allocationTarget?: string | string[];
  allocationMode?: string;
  manualAllocationShares?: Record<string, number>;
  linkedPlacementId?: string | null;
  bankCompanyId?: string;
  bankAccountId?: string;
  bankAccountRef?: string;
  linkedPayrollCellId?: string | null;
}

export interface Placement {
  id: string;
  placementId: string;
  candidateName: string;
  clientCompany: string;
  netScoreValue: number;
  clientPaymentStatus: string;
  clientPaidDate?: string;
  status?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
}

export interface NominalCode {
  id: string;
  code: string;
  type?: string;
}

export interface PayrollRecord {
  id: string;
  staffId: string;
  month: string;
  isReconciled: boolean;
  basicSalary: number;
  commission: number;
  employerNi: number;
  employerPension: number;
  employeeTaxNic: number;
  employeePension: number;
  notes?: string;
  linkedExpenseId?: string;
}

export interface CrmClientCompany {
  id: string;
  name: string;
  regNumber: string;
  address: string;
  contactName: string;
  contactEmail: string;
  accountsContactName: string;
  accountsContactEmail: string;
  phone: string;
  notes?: string;
}

export interface CrmCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  skills?: string;
  cvUrl?: string;
  cvName?: string;
  notes?: string;
}
