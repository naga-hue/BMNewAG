import { Company, Placement } from '../../types';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  AED: 'AED ',
  ZAR: 'R',
  INR: '₹'
};

export interface PaymentStatus {
  value: string;
  label: string;
  color: string;
}

export const PAYMENT_STATUSES: PaymentStatus[] = [
  { value: 'not-invoiced', label: 'Not Invoiced', color: '#94a3b8' },
  { value: 'invoice-uploaded', label: 'Invoice Uploaded', color: '#6366f1' },
  { value: 'sent-to-client', label: 'Sent to Client', color: '#0ea5e9' },
  { value: 'payment-expected', label: 'Payment Expected', color: '#d97706' },
  { value: 'part-paid', label: 'Part Paid', color: '#a855f7' },
  { value: 'paid', label: 'Paid', color: '#10b981' },
  { value: 'overdue', label: 'Overdue', color: '#ef4444' },
  { value: 'disputed', label: 'Disputed', color: '#f97316' },
  { value: 'legal', label: 'Legal', color: '#7f1d1d' },
  { value: 'written-off', label: 'Written Off', color: '#475569' },
  { value: 'dns-rebate', label: 'DNS / Rebate', color: '#b91c1c' }
];

export const getCurrencySymbol = (placement: Placement, companies: Company[]): string => {
  const matched = companies.find(c => c.id === placement.companyId);
  return CURRENCY_SYMBOLS[matched?.currency || 'GBP'] || '£';
};

export const calculateDaysOverdue = (dueDateStr: string | null | undefined, todayStr: string): number => {
  if (!dueDateStr) return 0;
  const today = new Date(todayStr);
  const due = new Date(dueDateStr);
  const diff = today.getTime() - due.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
};
