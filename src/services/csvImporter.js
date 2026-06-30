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
    fullName: ['fullname', 'name', 'staffname', 'employee', 'personalfullname'],
    personalEmail: ['personalemail', 'email', 'personalemailaddress', 'personalemail', 'personalpersonalemail'],
    personalPhone: ['personalphone', 'phone', 'telephone', 'mobile', 'personalphone'],
    dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'personaldateofbirth'],
    address: ['address', 'homeaddress', 'livingaddress', 'residentialaddress', 'personaladdress'],
    companyName: ['employercompany', 'company', 'employer', 'companyname', 'employmentcompanyid'],
    department: ['department', 'dept', 'businessunit', 'division', 'employmentdepartment'],
    jobTitle: ['jobtitle', 'title', 'designation', 'role', 'employmentjobtitle', 'employmentrole'],
    startDate: ['officialstartdate', 'startdate', 'joiningdate', 'start', 'employmentstartdate'],
    salary: ['annualsalary', 'salary', 'basepay', 'remuneration', 'paydefaultsalaryamount'],
    currency: ['currency', 'cur', 'salcurrency', 'paysalarycurrency'],
    businessEmail: ['businessemail', 'workemail', 'corporateemail', 'businessworkemail'],
    businessPhone: ['businessphone', 'workphone', 'corporatephone', 'businessworkphone']
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

  // 1. Required fields checks with smart fallbacks
  if (!parsed.fullName) {
    errors.push("Full Name is required");
  }

  if (!parsed.personalEmail) {
    const fallbackEmail = parsed.fullName 
      ? `${parsed.fullName.toLowerCase().replace(/[^a-z]/g, '')}@humres.co.uk`
      : `staff-${index + 1}@humres.co.uk`;
    parsed.personalEmail = fallbackEmail;
    warnings.push(`Email missing; defaulted to "${fallbackEmail}"`);
  } else if (!/\S+@\S+\.\S+/.test(parsed.personalEmail)) {
    errors.push("Invalid Personal Email format");
  }

  if (!parsed.jobTitle) {
    parsed.jobTitle = "Consultant";
    warnings.push('Job Title missing; defaulted to "Consultant"');
  }

  if (!parsed.startDate) {
    const today = new Date().toISOString().split('T')[0];
    parsed.startDate = today;
    warnings.push(`Start Date missing; defaulted to today (${today})`);
  }

  // 2. Company Resolution (supports direct ID matching or name matching)
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
    // Try matching by ID first
    const matchById = companies.find(c => c.id === parsed.companyName);
    if (matchById) {
      resolvedCompanyId = matchById.id;
      parsed.companyName = matchById.name;
    } else {
      // Match by name
      const matchByName = companies.find(c => 
        c.name.trim().toLowerCase() === parsed.companyName.toLowerCase() ||
        c.name.trim().toLowerCase().includes(parsed.companyName.toLowerCase())
      );
      if (matchByName) {
        resolvedCompanyId = matchByName.id;
        parsed.companyName = matchByName.name;
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
    const clean = dStr.trim();
    if (clean.includes('/') || clean.includes('-')) {
      const parts = clean.split(/[\/\-]/);
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        }
        
        if (year < 100) {
          year = 2000 + year; // Convert 26 to 2026
        }
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        let yr = d.getFullYear();
        if (yr < 1970 && yr > 1900) {
          yr = yr + 100;
        }
        return `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
