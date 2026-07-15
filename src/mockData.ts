import { Company } from './types';

export const initialCompanies: Company[] = [];

export interface Country {
  name: string;
  currency: string;
  symbol: string;
  taxLabel: string;
}

export const countries: Country[] = [
  { name: "United Kingdom", currency: "GBP", symbol: "£", taxLabel: "VAT Reg Number" },
  { name: "United States", currency: "USD", symbol: "$", taxLabel: "EIN / Tax ID" },
  { name: "United Arab Emirates", currency: "AED", symbol: "AED", taxLabel: "TRN (Tax Reg Number)" },
  { name: "India", currency: "INR", symbol: "₹", taxLabel: "GSTIN" },
  { name: "South Africa", currency: "ZAR", symbol: "R", taxLabel: "VAT Number" }
];
