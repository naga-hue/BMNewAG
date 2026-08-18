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

  const { employeeName, jobTitle, companyName, reminderType, startDate } = req.body;

  if (!employeeName || !reminderType) {
    return res.status(400).json({ error: 'Missing required fields: employeeName, reminderType' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'DeepSeek API Key is not configured in Vercel environment variables. Please add DEEPSEEK_API_KEY in your Vercel project settings.' 
    });
  }

  try {
    const prompt = `Generate a highly personalized, creative, and sincere ${reminderType === 'birthday' ? 'birthday greeting' : 'work anniversary celebration'} email for our colleague, ${employeeName}.
Job Title: ${jobTitle || 'Team Member'}
Company: ${companyName || 'Group Company'}
${reminderType === 'anniversary' && startDate ? `Joined on: ${startDate}` : ''}

Output the result strictly in JSON format with two keys: "subject" and "body".
CRITICAL instructions for the content:
1. Make the email body feel authentic, warm, and highly engaging. Do NOT use generic template formulas (like "Dear [Name], Happy birthday...").
2. Tailor it specifically to their name, job title, and company. Let the length be a natural, warm paragraph (approx 3-5 sentences) that sounds like it was written by a thoughtful colleague.
3. Keep the tone professional, friendly, and celebratory.
4. Keep the text clean without any markdown formatting or HTML codes. Do not include sign-off placeholders like "[Your Name]". Sign off naturally as "The Group Team" or "Your Colleagues at ${companyName}".`;

    const payload = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a warm, highly creative HR assistant. You draft custom, engaging, and non-generic birthday and work anniversary wishes for staff. You respond strictly in JSON format with keys "subject" and "body".'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const result = await new Promise((resolve, reject) => {
      const apiReq = https.request(options, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => { body += chunk; });
        apiRes.on('end', () => {
          if (apiRes.statusCode === 200) {
            try {
              const resData = JSON.parse(body);
              const contentText = resData.choices?.[0]?.message?.content;
              if (contentText) {
                resolve(JSON.parse(contentText));
              } else {
                reject(new Error("No content returned in DeepSeek choices"));
              }
            } catch (e) {
              reject(new Error(`Failed to parse DeepSeek response: ${e.message}. Raw: ${body}`));
            }
          } else {
            reject(new Error(`DeepSeek API returned status ${apiRes.statusCode}: ${body}`));
          }
        });
      });

      apiReq.on('error', (e) => reject(e));
      apiReq.write(payload);
      apiReq.end();
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error generating AI greeting:", error);
    return res.status(500).json({ error: error.message || 'Failed to generate AI greeting' });
  }
}
