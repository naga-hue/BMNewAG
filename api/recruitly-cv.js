import https from 'https';

export default async function handler(req, res) {
  const { candidateId, apiKey } = req.query;

  if (!candidateId || !apiKey) {
    return res.status(400).json({ error: 'Missing candidateId or apiKey parameter' });
  }

  const url = `https://api.recruitly.io/api/candidatecv/download?apiKey=${apiKey}&candidateId=${candidateId}`;

  try {
    https.get(url, (crmRes) => {
      if (crmRes.statusCode === 200) {
        // Force PDF content type and inline disposition to render inside browser/iframe
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        crmRes.pipe(res);
      } else {
        res.status(crmRes.statusCode || 404).json({ error: `Recruitly CV not found (Status ${crmRes.statusCode})` });
      }
    }).on('error', (err) => {
      console.error('CV download proxy error:', err);
      res.status(500).json({ error: err.message });
    });
  } catch (error) {
    console.error('CV download handler error:', error);
    res.status(500).json({ error: error.message });
  }
}
