import { Placement } from '../../types';

export interface SplitMember {
  staffId: string;
  percentage: number;
}

export interface ExtendedPlacement extends Placement {
  invoiceNumber?: string;
  startDate?: string;
  scoredDate?: string;
  dnsDate?: string;
  source?: string;
  grossBillAmount?: number;
  dnsRebateAmount?: number;
  dnsAmount?: number;
  rebateAmount?: number;
  splits?: SplitMember[];
  commissionPaidMonth?: string;
  importKey?: string | null;
  
  // Credit control invoice details
  invoiceType?: 'direct' | 'simplicity';
  simplicityClientNo?: string;
  simplicityCreditLimit?: string;
  noaRequired?: boolean;
  consultantInvoiceReceived?: boolean;
  invoiceTriggerType?: 'start-date' | 'custom';
  invoiceTriggerCustomDate?: string;
  paymentTerms?: string;
  paymentTermsCustomDays?: string;
}

export const SOURCES = [
  "LinkedIn",
  "Job Board",
  "Internal Database",
  "Client Direct",
  "Headhunted",
  "Referral",
  "Other"
];

export const symbolMap = { 
  GBP: '£', 
  USD: '$', 
  AED: 'AED ', 
  INR: '₹', 
  ZAR: 'R' 
} as const;

export type CurrencyCode = keyof typeof symbolMap;

export const FACTORING_FEE_PERCENTAGE = 2.96; // 2.96% factoring fee
export const FACTORING_PAYOUT_RATIO = (100 - FACTORING_FEE_PERCENTAGE) / 100; // 0.9704 payout ratio
