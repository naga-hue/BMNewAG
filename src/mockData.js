export const initialCompanies = [
  {
    id: "comp-1",
    name: "Humres Technical Recruitment Ltd",
    legalName: "Humres Technical Recruitment Limited",
    registrationNumber: "08239472",
    vatNumber: "GB123456789",
    country: "United Kingdom",
    registrationDate: "2012-10-12",
    hasInsurance: true,
    insurance: {
      provider: "AXA Commercial Insurance",
      policyNumber: "AXA-992-8812",
      coverageAmount: "£5,000,000",
      startDate: "2025-12-15",
      expiryDate: "2026-12-15"
    },
    pointOfContact: {
      name: "Jane Smith",
      role: "Operations Director",
      email: "j.smith@humres.co.uk",
      phone: "+44 7700 900077"
    },
    documents: [
      {
        id: "doc-1-1",
        type: "registration",
        name: "Certificate_of_Incorporation_08239472.pdf",
        uploadDate: "2025-01-10",
        fileSize: "1.2 MB",
        url: "#"
      },
      {
        id: "doc-1-2",
        type: "vat",
        name: "VAT_Certificate_GB123456789.pdf",
        uploadDate: "2025-01-10",
        fileSize: "450 KB",
        url: "#"
      },
      {
        id: "doc-1-3",
        type: "insurance",
        name: "Employers_Liability_AXA_2026.pdf",
        uploadDate: "2025-12-16",
        fileSize: "1.8 MB",
        url: "#"
      }
    ],
    complianceTasks: [
      {
        id: "task-1-1",
        name: "Q2 VAT Return Submission",
        category: "VAT",
        dueDate: "2026-07-07",
        recurrence: "quarterly",
        status: "pending",
        notes: "Quarterly VAT reporting for UK sales."
      },
      {
        id: "task-1-2",
        name: "HMRC Corporation Tax Filing",
        category: "HMRC",
        dueDate: "2026-09-30",
        recurrence: "annually",
        status: "pending",
        notes: "Accounts audit in progress with external accountants."
      },
      {
        id: "task-1-3",
        name: "Annual Accounts Filing (Companies House)",
        category: "annual-accounts",
        dueDate: "2026-12-31",
        recurrence: "annually",
        status: "pending",
        notes: "Standard Companies House annual confirmation statement."
      },
      {
        id: "task-1-4",
        name: "Q1 VAT Return Submission",
        category: "VAT",
        dueDate: "2026-04-07",
        recurrence: "quarterly",
        status: "completed",
        notes: "Filed and paid on time."
      }
    ],
    departments: [
      { name: "Recruitment", managerId: "staff-1" },
      { name: "Finance", managerId: "staff-2" },
      { name: "Operations", managerId: "" },
      { name: "HR", managerId: "" },
      { name: "Admin", managerId: "" }
    ],
    bankAccounts: [
      {
        id: "bank-1-1",
        bankName: "Barclays Corporate",
        accountName: "Humres Tech Rec Ltd - Operating",
        accountNumber: "20938812",
        sortCode: "20-45-12",
        currency: "GBP",
        notes: "Primary UK operations and billing account."
      },
      {
        id: "bank-1-2",
        bankName: "HSBC International",
        accountName: "Humres Tech Rec Ltd - USD Client",
        accountNumber: "450928123",
        sortCode: "40-02-50",
        currency: "USD",
        notes: "Used for billing North American clients directly in USD."
      }
    ],
    notes: "Primary UK operating company managing core technical engineering recruitment."
  },
  {
    id: "comp-2",
    name: "Humres US Executive Search LLC",
    legalName: "Humres US Executive Search LLC",
    registrationNumber: "LLC-2018-883",
    vatNumber: "36-1234567",
    country: "United States",
    registrationDate: "2018-04-20",
    hasInsurance: true,
    insurance: {
      provider: "Geico Business Express",
      policyNumber: "GIE-7722-12",
      coverageAmount: "$2,000,000",
      startDate: "2026-01-01",
      expiryDate: "2026-12-31"
    },
    pointOfContact: {
      name: "Mark Davis",
      role: "VP of Sales & Operations",
      email: "m.davis@humres-search.com",
      phone: "+1 202 555 0143"
    },
    documents: [
      {
        id: "doc-2-1",
        type: "registration",
        name: "Delaware_LLC_Articles_of_Organization.pdf",
        uploadDate: "2025-03-04",
        fileSize: "2.1 MB",
        url: "#"
      },
      {
        id: "doc-2-2",
        type: "insurance",
        name: "General_Liability_Geico_2026.pdf",
        uploadDate: "2026-01-02",
        fileSize: "1.4 MB",
        url: "#"
      }
    ],
    complianceTasks: [
      {
        id: "task-2-1",
        name: "Delaware Annual LLC Report",
        category: "annual-accounts",
        dueDate: "2026-06-01",
        recurrence: "annually",
        status: "completed",
        notes: "Delaware Franchise Tax paid."
      },
      {
        id: "task-2-2",
        name: "Q2 IRS Federal Tax Deposit",
        category: "HMRC",
        dueDate: "2026-07-15",
        recurrence: "quarterly",
        status: "pending",
        notes: "Quarterly estimated corporate tax payment."
      }
    ],
    departments: [
      { name: "Executive Search", managerId: "staff-4" },
      { name: "Sales & Marketing", managerId: "staff-3" },
      { name: "Finance", managerId: "" }
    ],
    bankAccounts: [
      {
        id: "bank-2-1",
        bankName: "JPMorgan Chase",
        accountName: "Humres US Exec Search - Main",
        accountNumber: "9902384772",
        sortCode: "021000021",
        currency: "USD",
        notes: "Main US checking account for revenue and local payroll."
      }
    ],
    notes: "Executive search entity focused on construction and commercial management positions in NY and TX."
  },
  {
    id: "comp-3",
    name: "Humres Gulf Recruitment LLC",
    legalName: "Humres Gulf Recruitment LLC",
    registrationNumber: "DXB-99831-H",
    vatNumber: "TRN-100293882700003",
    country: "United Arab Emirates",
    registrationDate: "2021-09-01",
    hasInsurance: true,
    insurance: {
      provider: "Oman Insurance Company",
      policyNumber: "OIC-8812-DXB",
      coverageAmount: "AED 10,000,000",
      startDate: "2025-09-01",
      expiryDate: "2026-08-31"
    },
    pointOfContact: {
      name: "Tariq Mahmood",
      role: "Managing Partner",
      email: "t.mahmood@humres.ae",
      phone: "+971 4 456 7890"
    },
    documents: [
      {
        id: "doc-3-1",
        type: "registration",
        name: "Dubai_Commercial_License.pdf",
        uploadDate: "2025-08-25",
        fileSize: "3.4 MB",
        url: "#"
      },
      {
        id: "doc-3-2",
        type: "vat",
        name: "TRN_Tax_Registration_Certificate.pdf",
        uploadDate: "2025-09-05",
        fileSize: "880 KB",
        url: "#"
      }
    ],
    complianceTasks: [
      {
        id: "task-3-1",
        name: "Dubai Commercial License Renewal",
        category: "license",
        dueDate: "2026-08-31",
        recurrence: "annually",
        status: "pending",
        notes: "Trade license and tenancy contract renewal details required."
      },
      {
        id: "task-3-2",
        name: "UAE FTA VAT Filing (Q2)",
        category: "VAT",
        dueDate: "2026-07-28",
        recurrence: "quarterly",
        status: "pending",
        notes: "Quarterly submission to Federal Tax Authority."
      }
    ],
    departments: [
      { name: "Recruitment", managerId: "staff-5" },
      { name: "Operations", managerId: "" },
      { name: "Client Relations", managerId: "" }
    ],
    bankAccounts: [
      {
        id: "bank-3-1",
        bankName: "Emirates NBD",
        accountName: "Humres Gulf Recruitment - AED",
        accountNumber: "10129388102",
        sortCode: "EBILAE2D",
        currency: "AED",
        notes: "Primary local currency AED trade account."
      },
      {
        id: "bank-3-2",
        bankName: "Emirates NBD",
        accountName: "Humres Gulf Recruitment - USD",
        accountNumber: "10129388205",
        sortCode: "EBILAE2D",
        currency: "USD",
        notes: "Offshore USD funding and client receipts account."
      }
    ],
    notes: "Dubai office covering recruitment needs across GCC region."
  },
  {
    id: "comp-4",
    name: "Humres India Offshore Solutions Pvt Ltd",
    legalName: "Humres India Offshore Solutions Private Limited",
    registrationNumber: "U74999MH2022PTC384910",
    vatNumber: "27AADCH4893K1Z9",
    country: "India",
    registrationDate: "2022-06-15",
    hasInsurance: true,
    insurance: {
      provider: "HDFC ERGO General Insurance",
      policyNumber: "HE-9001-IND",
      coverageAmount: "₹2,50,00,000",
      startDate: "2025-07-10",
      expiryDate: "2026-07-10"
    },
    pointOfContact: {
      name: "Priyanka Sharma",
      role: "Head of Offshore Operations",
      email: "p.sharma@humres.co.in",
      phone: "+91 22 6112 3456"
    },
    documents: [
      {
        id: "doc-4-1",
        type: "registration",
        name: "MCA_Certificate_of_Incorporation.pdf",
        uploadDate: "2025-06-20",
        fileSize: "2.8 MB",
        url: "#"
      }
    ],
    complianceTasks: [
      {
        id: "task-4-1",
        name: "GSTR-1 Monthly Return Filing",
        category: "VAT",
        dueDate: "2026-07-11",
        recurrence: "monthly",
        status: "pending",
        notes: "Monthly outbound invoicing reporting."
      },
      {
        id: "task-4-2",
        name: "MCA Form AOC-4 Filing (Financials)",
        category: "annual-accounts",
        dueDate: "2026-10-30",
        recurrence: "annually",
        status: "pending",
        notes: "Submission of audited balance sheets to Ministry of Corporate Affairs."
      },
      {
        id: "task-4-3",
        name: "GSTR-3B Monthly Filing (June)",
        category: "VAT",
        dueDate: "2026-07-20",
        recurrence: "monthly",
        status: "pending",
        notes: "Monthly consolidation and payment."
      }
    ],
    departments: [
      { name: "Sourcing", managerId: "staff-6" },
      { name: "Research", managerId: "staff-7" },
      { name: "HR", managerId: "" },
      { name: "Support & Admin", managerId: "" }
    ],
    bankAccounts: [
      {
        id: "bank-4-1",
        bankName: "ICICI Bank",
        accountName: "Humres India Offshore - Current",
        accountNumber: "000405001293",
        sortCode: "ICIC0000004",
        currency: "INR",
        notes: "Domestic current account for operations and employee salaries."
      },
      {
        id: "bank-4-2",
        bankName: "HDFC Bank",
        accountName: "Humres India Offshore - EEFC USD",
        accountNumber: "50200048392120",
        sortCode: "HDFC0000060",
        currency: "USD",
        notes: "Exchange Earners Foreign Currency (EEFC) account to receive USD from UK parent."
      }
    ],
    notes: "Operations center providing backend support, sourcing, and development resources for the group."
  },
  {
    id: "comp-5",
    name: "Humres Construction Services Ltd",
    legalName: "Humres Construction Services Limited",
    registrationNumber: "11983021",
    vatNumber: "",
    country: "United Kingdom",
    registrationDate: "2024-03-10",
    hasInsurance: false,
    insurance: null,
    pointOfContact: {
      name: "Jane Smith",
      role: "Operations Director",
      email: "j.smith@humres.co.uk",
      phone: "+44 7700 900077"
    },
    documents: [],
    complianceTasks: [
      {
        id: "task-5-1",
        name: "HMRC Corporation Tax Activation",
        category: "HMRC",
        dueDate: "2026-07-10",
        recurrence: "one-time",
        status: "pending",
        notes: "Must register for corporation tax within 3 months of trading start date."
      },
      {
        id: "task-5-2",
        name: "VAT Registration Setup",
        category: "VAT",
        dueDate: "2026-06-15",
        recurrence: "one-time",
        status: "pending",
        notes: "VAT threshold exceeded in construction staff division. OVERDUE."
      }
    ],
    departments: [
      { name: "Payroll Staffing", managerId: "staff-8" },
      { name: "Contract Operations", managerId: "" }
    ],
    bankAccounts: [
      {
        id: "bank-5-1",
        bankName: "Lloyds Bank",
        accountName: "Humres Construction - Payroll",
        accountNumber: "88930212",
        sortCode: "30-90-21",
        currency: "GBP",
        notes: "Dedicated account for weekly construction contract worker payroll."
      }
    ],
    notes: "A newer entity formed to handle contract/payroll staffing separately for construction workers."
  }
];

export const countries = [
  { name: "United Kingdom", currency: "GBP", symbol: "£", taxLabel: "VAT Reg Number" },
  { name: "United States", currency: "USD", symbol: "$", taxLabel: "EIN / Tax ID" },
  { name: "United Arab Emirates", currency: "AED", symbol: "AED", taxLabel: "TRN (Tax Reg Number)" },
  { name: "India", currency: "INR", symbol: "₹", taxLabel: "GSTIN" },
  { name: "South Africa", currency: "ZAR", symbol: "R", taxLabel: "SARS Tax Reference" }
];
