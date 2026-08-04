import https from 'https';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { placementId, apiKey } = req.body;

  if (!placementId) {
    return res.status(400).json({ error: 'Missing placementId' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing apiKey for the selected CRM tenant' });
  }

  // 1. Mock/Demo Fallback for Testing
  if (apiKey.startsWith('demo') || placementId.toLowerCase().includes('mock') || apiKey === 'YOUR_API_KEY') {
    console.log(`Recruitly Sync [MOCK]: Fetching placement ${placementId}`);
    
    let candidate = "Sarah Jenkins";
    let client = "Strata Consulting Ltd";
    let fee = 14500;
    let jobTitle = "Senior Operations Director - Finance";
    let salaryVal = 85000;
    
    if (placementId.includes('2')) {
      candidate = "Alex Rivera";
      client = "Humres Contracting";
      fee = 9800;
      jobTitle = "Contract Site Manager - Commercial Flooring";
      salaryVal = 62000;
    } else if (placementId.includes('3')) {
      candidate = "Denise Smith";
      client = "Totaco UK";
      fee = 22000;
      jobTitle = "Operations Director - Commercial Flooring";
      salaryVal = 100000;
    }

    return res.status(200).json({
      success: true,
      placementId: placementId,
      candidateName: candidate,
      clientCompany: client,
      companyId: "mock-company-id-123",
      jobTitle: jobTitle,
      placementDate: new Date().toISOString().split('T')[0],
      grossBillAmount: fee,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      salary: salaryVal,
      source: 'LinkedIn',
      recruiterName: 'Candyce Dawes',
      jobContactName: 'Noel Prendivillie',
      jobContactEmail: 'noel@floorform.com',
      jobContactPhone: '+44353862222240',
      jobContactTitle: 'Group Operations Manager',
      companyEmail: 'sales@floorform.com',
      companyPhone: '02837517800'
    });
  }

  // 2. Real API Integration
  try {
    const placementUrl = `https://api.recruitly.io/api/nova/placements/${placementId}?apiKey=${apiKey}`;
    
    const placementResult = await fetchJson(placementUrl);
    if (!placementResult || !placementResult.success) {
      return res.status(404).json({ error: `Placement ID "${placementId}" not found or API request failed.` });
    }

    const raw = placementResult.data || {};
    const candidateName = raw.candidateName || 
                         raw.candidate?.fullName || 
                         (raw.candidate?.firstName && raw.candidate?.lastName ? `${raw.candidate.firstName} ${raw.candidate.lastName}` : null) || 
                         raw.candidate?.name || 
                         'Unknown Candidate';

    const clientCompany = raw.companyName ||
                         raw.organisation?.name || 
                         raw.client?.companyName || 
                         raw.clientCompany || 
                         raw.company?.name || 
                         'Unknown Client';

    const grossBillAmount = Number(raw.fee || raw.salary || raw.grossBillAmount || raw.value || 0);
    const salary = Number(raw.salary || 0);

    // Date parsing helper
    const formatToISODate = (dateStr) => {
      if (!dateStr) return '';
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      const dateOnly = dateStr.split(' ')[0];
      if (dateOnly.includes('/')) {
        const parts = dateOnly.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          if (year.length === 4) {
            return `${year}-${month}-${day}`;
          }
        }
      }
      return dateOnly;
    };

    const startDate = formatToISODate(raw.startDate || raw.actualStartDate);
    const placementDate = formatToISODate(raw.placementDate || raw.createdOn);
    const source = raw.source || 'Recruitly';
    const recruiterName = raw.ownerName || raw.recruiterName || raw.user?.name || '';
    const companyId = raw.companyId || '';
    const jobId = raw.jobId || '';
    const jobTitle = raw.jobName || '';

    // Initialize job/contact metadata placeholders
    let jobContactName = '';
    let jobContactEmail = '';
    let jobContactPhone = '';
    let jobContactTitle = '';
    let companyEmail = '';
    let companyPhone = '';

    // A. Sub-fetch Job details
    if (jobId) {
      try {
        const jobUrl = `https://api.recruitly.io/api/nova/jobs/${jobId}?apiKey=${apiKey}`;
        const jobResult = await fetchJson(jobUrl);
        if (jobResult && jobResult.success && jobResult.data) {
          const jobData = jobResult.data;
          const contactId = jobData.contactId;
          jobContactName = jobData.contactName || '';

          // B. Sub-fetch Contact details
          if (contactId) {
            try {
              const contactUrl = `https://api.recruitly.io/api/nova/contacts/${contactId}?apiKey=${apiKey}`;
              const contactResult = await fetchJson(contactUrl);
              if (contactResult && contactResult.success && contactResult.data) {
                const contactData = contactResult.data;
                jobContactEmail = contactData.email || '';
                jobContactPhone = contactData.mobile || contactData.workPhone || '';
                jobContactTitle = contactData.jobTitle || '';
              }
            } catch (err) {
              console.error(`Recruitly Contact sub-fetch error for ID ${contactId}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Recruitly Job sub-fetch error for ID ${jobId}:`, err);
      }
    }

    // C. Sub-fetch Company details
    if (companyId) {
      try {
        const companyUrl = `https://api.recruitly.io/api/nova/companies/${companyId}?apiKey=${apiKey}`;
        const companyResult = await fetchJson(companyUrl);
        if (companyResult && companyResult.success && companyResult.data) {
          const companyData = companyResult.data;
          companyEmail = companyData.email || '';
          companyPhone = companyData.phone || '';
        }
      } catch (err) {
        console.error(`Recruitly Company sub-fetch error for ID ${companyId}:`, err);
      }
    }

    return res.status(200).json({
      success: true,
      placementId: placementId,
      candidateName,
      clientCompany,
      companyId,
      jobTitle,
      placementDate,
      grossBillAmount,
      startDate,
      salary,
      source,
      recruiterName,
      jobContactName,
      jobContactEmail,
      jobContactPhone,
      jobContactTitle,
      companyEmail,
      companyPhone
    });

  } catch (error) {
    console.error("Recruitly Sync API error:", error);
    return res.status(500).json({ error: error.message || 'Failed to complete Recruitly sync request' });
  }
}

// REST HTTP get helper
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse json: ${e.message}`));
          }
        } else {
          resolve({ success: false, statusCode: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}
