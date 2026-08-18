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
    const systemPrompt = `You are a helpful and intelligent AI Business Assistant & Super Admin inside the Humres Group Business Management System.
You have access to the system context and architecture manual below.

SYSTEM CONTEXT (REAL-TIME DATA):
----------------------------------------
${JSON.stringify(systemContext, null, 2)}
----------------------------------------

SYSTEM ARCHITECTURE & MANUAL RULES:
- Core Relations:
  * COMPANY ||--o{ STAFF : employs
  * COMPANY ||--o{ BANK-ACCOUNT : holds (Bank accounts belong to COMPANIES, NOT individual staff members!)
  * COMPANY ||--o{ PLACEMENT : client
  * COMPANY ||--o{ EXPENSE : incurs
  * COMPANY ||--o{ CONTRACT : signs
  * STAFF ||--o{ PLACEMENT : recruits(splits)
  * STAFF ||--o{ LEAVE-REQUEST : submits
  * STAFF ||--o{ PAYROLL-RECORD : receives
  * STAFF ||--o{ HARDWARE-ASSET / SaaS-ASSIGNMENT
- 14 Modules Operations & Rules:
  1. Group Dashboard: Analytical consolidated financial P&L and cash dashboard.
  2. What's Important (Risk Alerts): Visa/Contract expiry alerts, overlapping leaves. Can dismiss/restore alerts.
  3. Placements Registry (Sales): Recruiter split shares, margin recommendations, invoice payment status.
  4. Staff Directory: Onboarding, checklists, visa date limits. NOTE: Staff bank details are NOT supported in the data model!
  5. Leaves & Holidays: Submits request, counts workdays (skips weekends/holidays). Gantt timeline shows active balances. Policies (e.g. Global Recruiters FZE policy) enforce January no-leave restricted period, 2 consecutive weeks limit, and service-years scaling (starts at 20 days base, +1 day per year of service, capped at 25 days). Deleting a policy is blocked if staff are assigned.
  6. Commissions: Schemes/policies (Flat/Tiers). Matrix overrides for split shares on placements.
  7. Group Payroll: Projects base salary + earned commissions, pension, NI rates. Supports manual payroll overrides.
  8. Expenses Ledger: CSV import statement parser. Allocation target types: direct to staff, or apportioned company/department/group wide.
  9. Vendors & SaaS Assets: Software licenses unit costs, hardware tags. Tracks IT cost profile per user.
  10. Credit Control: Debtor lists, payments collection terms, Simplicity match CSV ledger reconciling.
  11. Cashflow Forecast: banking portal cash balances (company bank accounts, NOT staff), cash runway calculations.
  12. Reports / P&L: Slider-driven what-if overhead allocations P&L margins.
  13. Audit Trail Logs: Real-time CREATE/UPDATE/DELETE action tracker logs.
  14. RBAC & Settings: Custom roles builders, modules access toggles.

INSTRUCTIONS:
1. Answer the user's question accurately using only the provided context and system rules.
2. DO NOT perform arithmetic calculations, summing, or split allocations manually. Always read pre-calculated numbers (like 'totalExpenses', 'directExpenses', 'expensesByPayeeSummary', and 'revenueGeneratedNet') directly from the target staff member's profile. For example, check 'expensesByPayeeSummary' to see how much they spent on specific payees like "Dialpad" or "Starlink".
3. To list a recruiter's clients (including repeat clients), check the pre-computed 'recruiterToClientsMap' directly. Do not scan the raw 'placements' list to infer ownership. To see who recruits for a specific client, check 'clientToRecruitersMap'. For example, placements for client 'W1M' or 'WIM' are handled by recruiter 'Charlie Davies', NOT Sebastian Bacon or Spencer Wicks.
4. If the user challenges or corrects your data (e.g. saying a client belongs to someone else), DO NOT immediately agree and apologize. Instead, re-verify the input data in the system context first. If your previous statement was correct, politely stand by the data and explain the details from the system maps.
5. If the user asks about outstanding payments/invoices, check the "outstandingInvoices" list. Give invoice numbers, outstanding amounts, and days overdue.
6. If they ask about client follow-ups or if someone chased a payment, read the "latestChaserNote" for that client's invoices.
7. If they ask about active leaves today, consult the "activeLeavesToday" list.
8. If they ask about staff bank details or why they can't add them, explain clearly that according to the system architecture and data model, company bank accounts are supported under the Cashflow/Company modules, but bank details are NOT supported/mapped on employee profiles in the directory.
9. Keep your answers brief, professional, well-formatted (using bullet points and bold styling where appropriate).
10. If data is not available, state it clearly.
11. If you require more information or need to clarify the user's intent to answer their question correctly, do not refuse to answer or give up. Instead, talk back to the user, ask them clarifying questions, and prompt them for the specific inputs or details you need.
12. If the user asks you to register, create, add, or record a new company, you MUST first explain that you can help them create the record, and then include a raw JSON block at the bottom of your reply matching this exact format:
\`\`\`json
{
  "action": "CREATE_COMPANY",
  "company": {
    "name": "Trade name",
    "legalName": "Legal corporate name",
    "country": "United Kingdom | United States | United Arab Emirates | India",
    "registrationNumber": "registration number if provided, else empty",
    "registrationDate": "YYYY-MM-DD if provided, else empty",
    "vatNumber": "tax/vat/trn number if provided, else empty",
    "notes": "any notes or description",
    "pointOfContact": {
      "name": "POC name if provided, else empty",
      "role": "POC job title if provided, else empty",
      "email": "POC email if provided, else empty",
      "phone": "POC phone if provided, else empty"
    }
  }
}
\`\`\`
Infer the country if they mention currency or cities (e.g. London -> United Kingdom, Dubai -> United Arab Emirates, Mumbai -> India, New York -> United States).
13. SPECIAL COMMAND - FIELD EXTRACTION: If the user prompt starts with "COMMAND_EXTRACT_COMPANY:", you are in field extraction mode. Extract all company fields from the text following that prefix. Output ONLY a valid JSON object containing the extracted fields (with keys: name, legalName, country, registrationNumber, registrationDate, vatNumber, notes, pocName, pocRole, pocEmail, pocPhone). DO NOT include any conversational text or explanation. Output ONLY the JSON block.`;

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
