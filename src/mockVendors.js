export const initialVendors = [
  {
    id: "vendor-1",
    name: "Microsoft Corporation",
    category: "Software License",
    contactEmail: "billing@microsoft.com",
    phone: "+1 (800) 642-7676",
    description: "Enterprise operating systems, productivity suites (Office 365), and Cloud services."
  },
  {
    id: "vendor-2",
    name: "LinkedIn Ireland",
    category: "Software License",
    contactEmail: "recruiter-support@linkedin.com",
    phone: "+353 1 690 9000",
    description: "LinkedIn Recruiter Professional seats and job slots billing."
  },
  {
    id: "vendor-3",
    name: "Dialpad Inc.",
    category: "Telecom",
    contactEmail: "finance@dialpad.com",
    phone: "+1 (888) 835-2342",
    description: "Cloud telephone lines and contact center routing licenses."
  },
  {
    id: "vendor-4",
    name: "Workspace Properties Ltd",
    category: "Office Rental",
    contactEmail: "london-rentals@workspace.com",
    phone: "+44 (0) 20 7123 4567",
    description: "Landlord for UK central headquarters office spaces."
  },
  {
    id: "vendor-5",
    name: "OpenAI L.L.C.",
    category: "AI Service",
    contactEmail: "billing@openai.com",
    phone: "N/A",
    description: "ChatGPT Team and API usage licenses."
  }
];

export const initialContracts = [
  {
    id: "contract-1",
    vendorId: "vendor-1",
    companyId: "comp-1", // Humres UK
    name: "Microsoft 365 Business Basic",
    costInterval: "monthly",
    unitCost: 6.00,
    quantityPurchased: 55,
    currency: "GBP",
    taxRate: 20, // 20% UK VAT
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    renewalDate: "2026-12-31",
    paymentDueDate: "2026-07-05",
    paymentReminderDate: "2026-07-01",
    unusedCostTag: { companyId: "comp-1", department: "Operations" },
    documents: [
      { id: "vdoc-1", type: "contract", name: "M365_Enterprise_Agreement.pdf", uploadDate: "2026-01-01", fileSize: "1.2 MB" }
    ]
  },
  {
    id: "contract-2",
    vendorId: "vendor-2",
    companyId: "comp-1",
    name: "LinkedIn Recruiter Seats",
    costInterval: "monthly",
    unitCost: 120.00,
    quantityPurchased: 10,
    currency: "GBP",
    taxRate: 20, // 20% UK VAT
    startDate: "2026-02-01",
    endDate: "2027-01-31",
    renewalDate: "2027-01-31",
    paymentDueDate: "2026-07-15",
    paymentReminderDate: "2026-07-10",
    unusedCostTag: { companyId: "comp-1", department: "Recruitment" },
    documents: []
  },
  {
    id: "contract-3",
    vendorId: "vendor-4",
    companyId: "comp-1",
    name: "London Office Rental (Unit 4B)",
    costInterval: "monthly",
    unitCost: 4500.00,
    quantityPurchased: 1,
    currency: "GBP",
    taxRate: 20, // 20% UK VAT
    startDate: "2025-06-01",
    endDate: "2027-05-31",
    renewalDate: "2027-05-31",
    paymentDueDate: "2026-07-01", // Due soon/today in local time simulation
    paymentReminderDate: "2026-06-25",
    unusedCostTag: { companyId: "comp-1", department: "Operations" },
    documents: [
      { id: "vdoc-2", type: "contract", name: "London_HQ_Lease.pdf", uploadDate: "2025-06-01", fileSize: "3.4 MB" }
    ]
  },
  {
    id: "contract-4",
    vendorId: "vendor-4",
    companyId: "comp-2", // Humres US
    name: "Dallas Office Lease",
    costInterval: "monthly",
    unitCost: 6500.00,
    quantityPurchased: 1,
    currency: "USD",
    taxRate: 8.25, // Texas Sales Tax
    startDate: "2026-01-01",
    endDate: "2028-12-31",
    renewalDate: "2028-12-31",
    paymentDueDate: "2026-07-01",
    paymentReminderDate: "2026-06-25",
    unusedCostTag: { companyId: "comp-2", department: "Operations" },
    documents: []
  },
  {
    id: "contract-5",
    vendorId: "vendor-3",
    companyId: "comp-1",
    name: "Dialpad Telecom Lines",
    costInterval: "monthly",
    unitCost: 15.00,
    quantityPurchased: 20,
    currency: "GBP",
    taxRate: 20, // 20% UK VAT
    startDate: "2026-03-01",
    endDate: "2027-02-28",
    renewalDate: "2027-02-28",
    paymentDueDate: "2026-07-10",
    paymentReminderDate: "2026-07-05",
    unusedCostTag: { companyId: "comp-1", department: "Operations" },
    documents: []
  }
];

export const initialAssetAssignments = [
  {
    id: "ass-1",
    contractId: "contract-1", // M365
    staffId: "staff-1", // John Doe
    assignedDate: "2026-01-05"
  },
  {
    id: "ass-2",
    contractId: "contract-1",
    staffId: "staff-2", // Sarah Connor
    assignedDate: "2026-01-05"
  },
  {
    id: "ass-3",
    contractId: "contract-1",
    staffId: "staff-3", // Dwight
    assignedDate: "2026-01-05"
  },
  {
    id: "ass-4",
    contractId: "contract-1",
    staffId: "staff-6", // Amit Patel
    assignedDate: "2026-01-10"
  },
  {
    id: "ass-5",
    contractId: "contract-2", // LinkedIn
    staffId: "staff-1", // John Doe
    assignedDate: "2026-02-05"
  },
  {
    id: "ass-6",
    contractId: "contract-2",
    staffId: "staff-3", // Dwight
    assignedDate: "2026-02-05"
  },
  {
    id: "ass-7",
    contractId: "contract-5", // Dialpad
    staffId: "staff-1", // John Doe
    assignedDate: "2026-03-02"
  },
  {
    id: "ass-8",
    contractId: "contract-5",
    staffId: "staff-2", // Sarah Connor
    assignedDate: "2026-03-02"
  }
];
