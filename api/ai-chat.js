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

  const { prompt, systemContext, history } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'DeepSeek API Key is not configured in Vercel. Please add DEEPSEEK_API_KEY in your Vercel project environment variables.' 
    });
  }

  try {
    // Formulate system instructions
    const systemPrompt = `You are a helpful and intelligent AI Business Assistant inside the Humres Group Business Management System.
You are assisting a Super Admin. You have access to the real-time system context:

SYSTEM CONTEXT:
----------------------------------------
${JSON.stringify(systemContext, null, 2)}
----------------------------------------

INSTRUCTIONS:
1. Answer the user's question accurately using only the provided context.
2. If the user asks about outstanding payments/invoices, check the "outstandingInvoices" list. Give invoice numbers, outstanding amounts, and days overdue.
3. If they ask about client follow-ups or if someone chased a payment, read the "latestChaserNote" for that client's invoices.
4. If they ask about active leaves today, consult the "activeLeavesToday" list.
5. If they ask about contracts, read the "contracts" list.
6. Keep your answers brief, professional, well-formatted (using bullet points and bold styling where appropriate).
7. If data is not available, state it clearly.`;

    // Map message history
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    messages.push({ role: 'user', content: prompt });

    const payload = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.2
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
                resolve(contentText);
              } else {
                reject(new Error("No message content returned from DeepSeek choices"));
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

    return res.status(200).json({ response: result });
  } catch (error) {
    console.error("AI Chatbot error:", error);
    return res.status(500).json({ error: error.message || 'Failed to complete AI chat request' });
  }
}
