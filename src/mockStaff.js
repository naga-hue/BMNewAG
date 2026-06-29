export const initialStaff = [
  {
    id: "staff-1",
    fullName: "John Doe",
    personalEmail: "john.doe.personal@gmail.com",
    businessEmail: "j.doe@humres.co.uk",
    personalPhone: "+44 7700 900111",
    businessPhone: "+44 7700 900222",
    address: "12 Baker Street, London, NW1 6XE, UK",
    companyId: "comp-1", // Humres Technical Recruitment Ltd
    department: "Recruitment",
    salary: 62000,
    currency: "GBP",
    jobTitle: "Senior Recruitment Consultant",
    startDate: "2020-01-15",
    dateOfBirth: "1990-05-12",
    reportingManagerId: "staff-2", // reports to Sarah Connor
    documents: [
      {
        id: "sdoc-1-1",
        type: "appointment",
        name: "John_Doe_Appointment_Order_2020.pdf",
        uploadDate: "2020-01-10",
        fileSize: "1.5 MB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-2",
    fullName: "Sarah Connor",
    personalEmail: "sconnor@yahoo.com",
    businessEmail: "s.connor@humres.co.uk",
    personalPhone: "+44 7700 900333",
    businessPhone: "+44 7700 900444",
    address: "45 Cyberdyne Way, Manchester, M1 1ED, UK",
    companyId: "comp-1", // Humres Technical Recruitment Ltd
    department: "Finance",
    salary: 55000,
    currency: "GBP",
    jobTitle: "Finance Manager",
    startDate: "2021-03-10",
    dateOfBirth: "1985-09-22",
    reportingManagerId: "", // reports to Board
    documents: [
      {
        id: "sdoc-2-1",
        type: "appointment",
        name: "Sarah_Connor_Contract_Signed.pdf",
        uploadDate: "2021-03-01",
        fileSize: "2.1 MB",
        url: "#"
      },
      {
        id: "sdoc-2-2",
        type: "appraisal",
        name: "Appraisal_Letter_Connor_2025.pdf",
        uploadDate: "2025-12-20",
        fileSize: "420 KB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-3",
    fullName: "Michael Scott",
    personalEmail: "greatscotty@gmail.com",
    businessEmail: "m.scott@humres-search.com",
    personalPhone: "+1 570 555 0199",
    businessPhone: "+1 570 555 0100",
    address: "1725 Slough Avenue, Scranton, PA 18505, USA",
    companyId: "comp-2", // Humres US Executive Search LLC
    department: "Sales & Marketing",
    salary: 95000,
    currency: "USD",
    jobTitle: "Regional Managing Director",
    startDate: "2018-05-01",
    dateOfBirth: "1975-03-15",
    reportingManagerId: "", // reports to Board
    documents: [
      {
        id: "sdoc-3-1",
        type: "appointment",
        name: "Michael_Scott_Employment_Agreement.pdf",
        uploadDate: "2018-04-20",
        fileSize: "3.2 MB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-4",
    fullName: "Dwight Schrute",
    personalEmail: "beetfarmer@schrutefarms.com",
    businessEmail: "d.schrute@humres-search.com",
    personalPhone: "+1 570 555 0122",
    businessPhone: "+1 570 555 0123",
    address: "Route 6, Honesdale, PA 18431, USA",
    companyId: "comp-2", // Humres US Executive Search LLC
    department: "Executive Search",
    salary: 78000,
    currency: "USD",
    jobTitle: "Assistant to the Regional Director",
    startDate: "2019-02-12",
    dateOfBirth: "1980-01-20",
    reportingManagerId: "staff-3", // reports to Michael Scott
    documents: [
      {
        id: "sdoc-4-1",
        type: "appointment",
        name: "Schrute_Appointment_Order_Signed.pdf",
        uploadDate: "2019-02-10",
        fileSize: "1.8 MB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-5",
    fullName: "Fatima Al Maktoum",
    personalEmail: "fatima.al.m@hotmail.com",
    businessEmail: "f.maktoum@humres.ae",
    personalPhone: "+971 50 123 4567",
    businessPhone: "+971 4 456 7891",
    address: "Marina Heights, Tower A, Dubai Marina, UAE",
    companyId: "comp-3", // Humres Gulf Recruitment LLC
    department: "Recruitment",
    salary: 260000,
    currency: "AED",
    jobTitle: "Senior Executive Partner",
    startDate: "2021-10-01",
    dateOfBirth: "1988-04-30",
    reportingManagerId: "",
    documents: [
      {
        id: "sdoc-5-1",
        type: "appointment",
        name: "UAE_MOU_Fatima_Al_Maktoum_2021.pdf",
        uploadDate: "2021-09-25",
        fileSize: "2.5 MB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-6",
    fullName: "Amit Patel",
    personalEmail: "amit.patel93@gmail.com",
    businessEmail: "a.patel@humres.co.in",
    personalPhone: "+91 98200 12345",
    businessPhone: "+91 22 6112 3457",
    address: "B-402 Shanti Towers, Andheri West, Mumbai, 400053, India",
    companyId: "comp-4", // Humres India Offshore Solutions Pvt Ltd
    department: "Sourcing",
    salary: 1350000,
    currency: "INR",
    jobTitle: "Principal Sourcing Lead",
    startDate: "2022-07-01",
    dateOfBirth: "1993-11-05",
    reportingManagerId: "",
    documents: [
      {
        id: "sdoc-6-1",
        type: "appointment",
        name: "Amit_Patel_Offer_Letter_Offshore.pdf",
        uploadDate: "2022-06-25",
        fileSize: "1.1 MB",
        url: "#"
      },
      {
        id: "sdoc-6-2",
        type: "appraisal",
        name: "Amit_Patel_Increment_Letter_2025.pdf",
        uploadDate: "2025-07-01",
        fileSize: "390 KB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-7",
    fullName: "Priya Nair",
    personalEmail: "priyanair.res@gmail.com",
    businessEmail: "p.nair@humres.co.in",
    personalPhone: "+91 98200 54321",
    businessPhone: "+91 22 6112 3458",
    address: "702 Regency Crest, Powai, Mumbai, 400076, India",
    companyId: "comp-4", // Humres India Offshore Solutions Pvt Ltd
    department: "Research",
    salary: 850000,
    currency: "INR",
    jobTitle: "Senior Market Researcher",
    startDate: "2023-01-10",
    dateOfBirth: "1995-07-18",
    reportingManagerId: "staff-6", // reports to Amit Patel
    documents: [
      {
        id: "sdoc-7-1",
        type: "appointment",
        name: "Priya_Nair_Appointment_Order.pdf",
        uploadDate: "2023-01-05",
        fileSize: "1.2 MB",
        url: "#"
      }
    ]
  },
  {
    id: "staff-8",
    fullName: "Thomas Wright",
    personalEmail: "tommy.wright@outlook.com",
    businessEmail: "t.wright@humres.co.uk",
    personalPhone: "+44 7700 900555",
    businessPhone: "+44 7700 900666",
    address: "88 Willow Lane, Bristol, BS1 6LL, UK",
    companyId: "comp-5", // Humres Construction Services Ltd
    department: "Payroll Staffing",
    salary: 38000,
    currency: "GBP",
    jobTitle: "Payroll Support Administrator",
    startDate: "2024-04-01",
    dateOfBirth: "2001-08-14",
    reportingManagerId: "",
    documents: [
      {
        id: "sdoc-8-1",
        type: "appointment",
        name: "Thomas_Wright_Employment_Contract.pdf",
        uploadDate: "2024-03-25",
        fileSize: "1.7 MB",
        url: "#"
      }
    ]
  }
];
