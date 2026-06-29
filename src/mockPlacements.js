export const initialPlacements = [
  {
    id: "place-1",
    placementId: "PL-10001",
    invoiceNumber: "INV-2026-001",
    clientCompany: "Acme Corporation Ltd",
    candidateName: "Thomas Anderson",
    startDate: "2026-05-10", // Started in May 2026, evaluated in June 2026 Payroll
    scoredDate: "2026-04-20",
    dnsDate: null,
    status: "active",
    source: "LinkedIn",
    grossBillAmount: 12000.00,
    dnsRebateAmount: 0.00,
    netScoreValue: 12000.00,
    clientPaymentStatus: "paid", // Client paid invoice
    clientPaidDate: "2026-06-20", // Paid in June 2026 (current payroll cycle)
    splits: [
      { staffId: "staff-1", percentage: 100 } // John Doe gets 100% of £12k
    ],
    importKey: "batch-1"
  },
  {
    id: "place-2",
    placementId: "PL-10002",
    invoiceNumber: "INV-2026-002",
    clientCompany: "Wayne Enterprises",
    candidateName: "Bruce Banner",
    startDate: "2026-05-15", // Started in May 2026, evaluated in June 2026 Payroll
    scoredDate: "2026-04-25",
    dnsDate: null,
    status: "active",
    source: "Internal Database",
    grossBillAmount: 20000.00,
    dnsRebateAmount: 0.00,
    netScoreValue: 20000.00,
    clientPaymentStatus: "unpaid", // Client NOT paid yet
    clientPaidDate: null,
    splits: [
      { staffId: "staff-1", percentage: 50 },  // John Doe gets 50% = £10k (unpaid invoice, withheld commission)
      { staffId: "staff-3", percentage: 50 }   // Dwight gets 50% = £10k (unpaid, withheld)
    ],
    importKey: "batch-1"
  },
  {
    id: "place-3",
    placementId: "PL-10003",
    invoiceNumber: "INV-2026-003",
    clientCompany: "Initech Corp",
    candidateName: "Peter Gibbons",
    startDate: "2026-05-01",
    scoredDate: "2026-04-15",
    dnsDate: "2026-05-02",
    status: "dns",
    source: "Job Board",
    grossBillAmount: 12000.00,
    dnsRebateAmount: 12000.00,
    netScoreValue: 0.00,
    clientPaymentStatus: "unpaid",
    clientPaidDate: null,
    splits: [
      { staffId: "staff-1", percentage: 100 }
    ],
    importKey: "batch-1"
  },
  {
    id: "place-4",
    placementId: "PL-10004",
    invoiceNumber: "INV-2026-004",
    clientCompany: "Cyberdyne Systems",
    candidateName: "John Connor",
    startDate: "2026-05-20", // Started in May 2026
    scoredDate: "2026-04-10",
    dnsDate: null,
    status: "rebate",
    source: "LinkedIn",
    grossBillAmount: 15000.00,
    dnsRebateAmount: 5000.00,
    netScoreValue: 10000.00,
    clientPaymentStatus: "paid", // Paid by client
    clientPaidDate: "2026-06-24", // Settled in June 2026
    splits: [
      { staffId: "staff-2", percentage: 100 } // Sarah Connor gets 100% of £10k (paid)
    ],
    importKey: "batch-1"
  },
  {
    id: "place-5",
    placementId: "PL-10005",
    invoiceNumber: "INV-2026-005",
    clientCompany: "Stark Industries",
    candidateName: "Tony Stark",
    startDate: "2026-04-10", // Started in April 2026 (earlier cycle)
    scoredDate: "2026-03-20",
    dnsDate: null,
    status: "active",
    source: "Headhunted",
    grossBillAmount: 24000.00,
    dnsRebateAmount: 0.00,
    netScoreValue: 24000.00,
    clientPaymentStatus: "paid", // Was unpaid, but client settled now!
    clientPaidDate: "2026-06-15", // Paid in June 2026 (releases historical withhold)
    splits: [
      { staffId: "staff-1", percentage: 100 }
    ],
    importKey: "batch-1"
  }
];
