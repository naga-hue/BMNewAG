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

  // 1. Mock/Demo Fallback for Testing & Local local storage mode
  if (apiKey.startsWith('demo') || placementId.toLowerCase().includes('mock') || apiKey === 'YOUR_API_KEY') {
    console.log(`Recruitly Sync [MOCK]: Fetching placement ${placementId}`);
    
    // Generate realistic details based on placementId
    let candidate = "Sarah Jenkins";
    let client = "Strata Consulting Ltd";
    let fee = 14500;
    
    if (placementId.includes('2')) {
      candidate = "Alex Rivera";
      client = "Humres Contracting";
      fee = 9800;
    } else if (placementId.includes('3')) {
      candidate = "Denise Smith";
      client = "Totaco UK";
      fee = 22000;
    }

    return res.status(200).json({
      success: true,
      placementId: placementId,
      candidateName: candidate,
      clientCompany: client,
      grossBillAmount: fee,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      source: 'LinkedIn'
    });
  }

  // 2. Real API Request to Recruitly
  try {
    const url = `https://api.recruitly.io/api/nova/placements/${placementId}?apiKey=${apiKey}`;
    
    const result = await new Promise((resolve, reject) => {
      https.get(url, (apiRes) => {
        let body = '';
        apiRes.on('data', chunk => body += chunk);
        apiRes.on('end', () => {
          if (apiRes.statusCode === 200) {
            try {
              const resData = JSON.parse(body);
              // Resolve parsed object
              resolve({ statusCode: apiRes.statusCode, data: resData });
            } catch (e) {
              reject(new Error(`Failed to parse Recruitly response JSON: ${e.message}. Raw: ${body}`));
            }
          } else {
            resolve({ statusCode: apiRes.statusCode, rawBody: body });
          }
        });
      }).on('error', reject);
    });

    if (result.statusCode !== 200) {
      return res.status(result.statusCode).json({ 
        error: `Recruitly API returned status ${result.statusCode}: ${result.rawBody || 'No details'}`
      });
    }

    const raw = result.data;
    // Map fields dynamically based on common Recruitly Nova structures
    const candidateName = raw.candidate?.fullName || 
                         (raw.candidate?.firstName && raw.candidate?.lastName ? `${raw.candidate.firstName} ${raw.candidate.lastName}` : null) || 
                         raw.candidateName || 
                         raw.candidate?.name || 
                         'Unknown Candidate';

    const clientCompany = raw.organisation?.name || 
                         raw.client?.companyName || 
                         raw.clientCompany || 
                         raw.company?.name || 
                         'Unknown Client';

    const grossBillAmount = Number(raw.fee || raw.salary || raw.grossBillAmount || raw.value || 0);

    const startDate = raw.startDate?.split('T')[0] || 
                      raw.actualStartDate?.split('T')[0] || 
                      raw.startDate || 
                      '';

    const source = raw.source || 'Recruitly';

    return res.status(200).json({
      success: true,
      placementId: placementId,
      candidateName,
      clientCompany,
      grossBillAmount,
      startDate,
      source
    });

  } catch (error) {
    console.error("Recruitly Sync API error:", error);
    return res.status(500).json({ error: error.message || 'Failed to complete Recruitly sync request' });
  }
}
