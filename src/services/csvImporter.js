/**
 * CSV parsing and validation service for bulk importing staff roster profiles.
 * Supports double quotes around fields, comma escaping, and alias matching.
 */

export function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  
  return lines;
}

export function mapHeaders(headerRow) {
  const clean = headerRow.map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const map = {};
  
  const headerMappings = {
    fullName: ['fullname', 'name', 'staffname', 'employee'],
    personalEmail: ['personalemail', 'email', 'personalemailaddress'],
    personalPhone: ['personalphone', 'phone', 'telephone', 'mobile'],
    dateOfBirth: ['dateofbirth', 'dob', 'birthdate'],
    address: ['address', 'homeaddress', 'livingaddress', 'residentialaddress'],
    companyName: ['employercompany', 'company', 'employer', 'companyname'],
    department: ['department', 'dept', 'businessunit', 'division'],
    jobTitle: ['jobtitle', 'title', 'designation', 'role'],
    startDate: ['officialstartdate', 'startdate', 'joiningdate', 'start'],
    salary: ['annualsalary', 'salary', 'basepay', 'remuneration'],
    currency: ['currency', 'cur', 'salcurrency'],
    businessEmail: ['businessemail', 'workemail', 'corporateemail'],
    businessPhone: ['businessphone', 'workphone', 'corporatephone']
  };

  for (const [key, aliases] of Object.entries(headerMappings)) {
    const index = clean.findIndex(c => aliases.includes(c));
    if (index > -1) {
      map[key] = index;
    }
  }
  
  return map;
}

export function validateStaffRow(row, headerMap, companies, leavePolicies, index) {
  const getValue = (key) => {
    const idx = headerMap[key];
    return idx !== undefined && row[idx] ? row[idx].trim() : '';
  };

  const parsed = {
    fullName: getValue('fullName'),
    personalEmail: getValue('personalEmail'),
    personalPhone: getValue('personalPhone'),
    dateOfBirth: getValue('dateOfBirth'),
    address: getValue('address'),
    companyName: getValue('companyName'),
    department: getValue('department'),
    jobTitle: getValue('jobTitle'),
    startDate: getValue('startDate'),
    salary: getValue('salary'),
    currency: getValue('currency') || 'GBP',
    businessEmail: getValue('businessEmail'),
    businessPhone: getValue('businessPhone')
  };

  const errors = [];
  const warnings = [];

  // 1. Required fields checks
  if (!parsed.fullName) errors.push("Full Name is required");
  if (!parsed.personalEmail) {
    errors.push("Personal Email is required");
  } else if (!/\S+@\S+\.\S+/.test(parsed.personalEmail)) {
    errors.push("Invalid Personal Email format");
  }
  if (!parsed.jobTitle) errors.push("Job Title is required");
  if (!parsed.startDate) {
    errors.push("Official Start Date is required");
  }

  // 2. Company Resolution
  let resolvedCompanyId = '';
  if (!parsed.companyName) {
    const firstComp = companies[0];
    if (firstComp) {
      resolvedCompanyId = firstComp.id;
      warnings.push(`Company is empty; defaulted to "${firstComp.name}"`);
      parsed.companyName = firstComp.name;
    } else {
      errors.push("No companies registered in the system to assign");
    }
  } else {
    const match = companies.find(c => 
      c.name.trim().toLowerCase() === parsed.companyName.toLowerCase() ||
      c.name.trim().toLowerCase().includes(parsed.companyName.toLowerCase())
    );
    if (match) {
      resolvedCompanyId = match.id;
      parsed.companyName = match.name; // normalize name
    } else {
      const firstComp = companies[0];
      if (firstComp) {
        resolvedCompanyId = firstComp.id;
        warnings.push(`Company "${parsed.companyName}" not found; defaulted to "${firstComp.name}"`);
        parsed.companyName = firstComp.name;
      } else {
        errors.push(`Company "${parsed.companyName}" not found and no default available`);
      }
    }
  }

  // 3. Department Resolution
  let resolvedDept = parsed.department;
  if (resolvedCompanyId) {
    const comp = companies.find(c => c.id === resolvedCompanyId);
    const depts = comp ? (comp.departments || []).map(d => d.name || d) : [];
    if (!resolvedDept) {
      if (depts.length > 0) {
        resolvedDept = depts[0];
        warnings.push(`Department is empty; auto-assigned default "${depts[0]}"`);
      } else {
        resolvedDept = 'Admin';
        warnings.push("No departments defined; assigned to 'Admin'");
      }
    } else {
      const matchDept = depts.find(d => d.toLowerCase() === resolvedDept.toLowerCase());
      if (matchDept) {
        resolvedDept = matchDept; // normalize case
      } else {
        warnings.push(`Department "${resolvedDept}" is not in company profile; it will be registered`);
      }
    }
  }

  // 4. Leave Policy Allocation
  let resolvedLeavePolicyId = '';
  if (resolvedCompanyId) {
    const matchingPolicies = leavePolicies.filter(p => p.companyId === resolvedCompanyId);
    if (matchingPolicies.length > 0) {
      resolvedLeavePolicyId = matchingPolicies[0].id;
    } else {
      warnings.push("No Leave Policy matching company; needs manual assignment after import");
    }
  }

  // 5. Date Parsing and Formatting
  const parseDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      return dStr;
    }
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    return '';
  };

  const formattedDOB = parseDate(parsed.dateOfBirth);
  const formattedStart = parseDate(parsed.startDate);

  if (parsed.dateOfBirth && !formattedDOB) {
    warnings.push("Invalid Date of Birth format; cleared field");
  }
  if (!formattedStart) {
    errors.push("Official Start Date must be a valid date (DD/MM/YYYY or YYYY-MM-DD)");
  }

  // 6. Currency validation
  const validCurrencies = ['GBP', 'USD', 'AED', 'INR', 'ZAR'];
  let resolvedCurrency = parsed.currency.toUpperCase().trim();
  if (!validCurrencies.includes(resolvedCurrency)) {
    resolvedCurrency = 'GBP';
    warnings.push(`Invalid currency "${parsed.currency}"; defaulted to GBP`);
  }

  return {
    rowNumber: index + 1,
    data: {
      id: `staff-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      fullName: parsed.fullName,
      dateOfBirth: formattedDOB,
      address: parsed.address || 'Not Provided',
      personalEmail: parsed.personalEmail,
      personalPhone: parsed.personalPhone || 'Not Provided',
      companyId: resolvedCompanyId,
      companyName: parsed.companyName,
      department: resolvedDept,
      jobTitle: parsed.jobTitle,
      startDate: formattedStart,
      salary: parsed.salary ? parseFloat(parsed.salary) || '' : '',
      currency: resolvedCurrency,
      businessEmail: parsed.businessEmail || `${parsed.fullName.toLowerCase().replace(/[^a-z]/g, '')}@humres.co.uk`,
      businessPhone: parsed.businessPhone || parsed.personalPhone || 'Not Provided',
      leavePolicyId: resolvedLeavePolicyId,
      commissionPolicyId: '',
      reportingManagerId: '',
      documents: [],
      permissions: {
        role: 'Consultant / Recruiter',
        dataScope: 'self',
        allowedModules: ['directory', 'leaves', 'placements']
      }
    },
    errors,
    warnings
  };
}
