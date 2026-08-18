import https from 'https';

export default async function handler(req, res) {
  // Allow Vercel Cron or manual query parameter secret for testing
  const cronSecret = process.env.CRON_SECRET || 'humres-cron-secret-123';
  const requestSecret = req.query.secret;
  const isCron = req.headers['x-vercel-cron'] === '1';

  if (!isCron && requestSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized invocation. Secret is mismatch.' });
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'humres-management-hub';
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const clientId = process.env.MS365_CLIENT_ID;
  const clientSecret = process.env.MS365_CLIENT_SECRET;
  const refreshToken = process.env.MS365_REFRESH_TOKEN;
  const senderEmail = process.env.MS365_SENDER_EMAIL || 'groupadmin@globalrecruiters.ae';
  
  // Management emails: multiple comma separated email strings
  const managementEmailsStr = process.env.MANAGEMENT_REMINDER_EMAILS || 'groupadmin@globalrecruiters.ae';
  const managementEmails = managementEmailsStr.split(',').map(s => s.trim()).filter(Boolean);

  if (!projectId) {
    return res.status(500).json({ error: 'VITE_FIREBASE_PROJECT_ID is not configured.' });
  }
  if (!deepseekKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured.' });
  }
  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({ error: 'Microsoft 365 OAuth2 environment variables are missing.' });
  }

  const logs = [];
  try {
    // 1. Fetch staff and companies from Firestore REST endpoint
    logs.push("Fetching active staff directory from Firestore REST API...");
    const rawStaffList = await fetchCollection(projectId, 'staff');
    const companiesList = await fetchCollection(projectId, 'companies');

    const activeStaff = rawStaffList.filter(s => s.status !== 'exited');
    logs.push(`Found ${activeStaff.length} active staff members and ${companiesList.length} companies.`);

    // 2. Refresh MS365 Token
    logs.push("Refreshing Microsoft 365 Outlook connection access token...");
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);

    // Dates for matching
    const today = new Date();
    const tdMonth = today.getMonth(); // 0-11
    const tdDay = today.getDate();    // 1-31

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmMonth = tomorrow.getMonth();
    const tmDay = tomorrow.getDate();

    logs.push(`Running search for Today (${tdMonth + 1}/${tdDay}) and Tomorrow (${tmMonth + 1}/${tmDay})...`);

    // 3. Process matches
    for (const s of activeStaff) {
      const company = companiesList.find(c => c.id === s.companyId);
      const companyName = company?.name || 'Group Company';

      // Parse Birthday using timezone-safe parser
      let bdayMatchToday = false;
      let bdayMatchTomorrow = false;
      let bdayAge = 0;
      if (s.dateOfBirth) {
        const parts = parseDateParts(s.dateOfBirth);
        if (parts) {
          if (parts.month === tdMonth && parts.day === tdDay) {
            bdayMatchToday = true;
            bdayAge = today.getFullYear() - parts.year;
          }
          if (parts.month === tmMonth && parts.day === tmDay) {
            bdayMatchTomorrow = true;
            bdayAge = tomorrow.getFullYear() - parts.year;
          }
        }
      }

      // Parse Anniversary using timezone-safe parser
      let annivMatchToday = false;
      let annivMatchTomorrow = false;
      let annivYears = 0;
      if (s.startDate) {
        const parts = parseDateParts(s.startDate);
        if (parts) {
          if (parts.month === tdMonth && parts.day === tdDay) {
            annivYears = today.getFullYear() - parts.year;
            if (annivYears > 0) annivMatchToday = true;
          }
          if (parts.month === tmMonth && parts.day === tmDay) {
            annivYears = tomorrow.getFullYear() - parts.year;
            if (annivYears > 0) annivMatchTomorrow = true;
          }
        }
      }

      const celebratedEmail = s.businessEmail || s.personalEmail;

      // ----------------------------------------------------
      // ACTION A: Management Prep Reminders (1 Day Before)
      // ----------------------------------------------------
      if (bdayMatchTomorrow || annivMatchTomorrow) {
        const eventLabel = bdayMatchTomorrow 
          ? `Birthday (turning ${bdayAge})` 
          : `Work Anniversary (${annivYears} Years)`;
        
        const subject = `[Management Alert] Tomorrow: ${s.fullName}'s ${eventLabel}`;
        const bodyText = `Hi Management Team,

This is an automated reminder that tomorrow is ${s.fullName}'s ${eventLabel}.
Please prepare greetings, gifts, or celebration updates accordingly.

Employee Details:
- Name: ${s.fullName}
- Department: ${s.department || 'N/A'}
- Company: ${companyName}
- Date: ${tomorrow.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}

Best regards,
Humres Admin Hub`;

        logs.push(`Sending management reminder alert for tomorrow's event to: ${managementEmails.join(', ')}`);
        await sendGraphEmailWithCC(accessToken, senderEmail, managementEmails, [], subject, bodyText);
      }

      // ----------------------------------------------------
      // ACTION B: Automated Wish Email (On the Day of Event)
      // ----------------------------------------------------
      if (bdayMatchToday || annivMatchToday) {
        const eventType = bdayMatchToday ? 'birthday' : 'anniversary';
        logs.push(`Generating AI celebration greeting for ${s.fullName} (${eventType}) via DeepSeek...`);
        
        try {
          const wish = await generateGreetingAI(
            s.fullName, 
            s.jobTitle, 
            companyName, 
            eventType, 
            s.startDate, 
            deepseekKey
          );

          // Find coworkers at the SAME company to CC
          const coworkers = activeStaff.filter(
            c => c.companyId === s.companyId && c.id !== s.id
          );
          const coworkerEmails = coworkers
            .map(c => c.businessEmail || c.personalEmail)
            .filter(Boolean);

          if (!celebratedEmail) {
            logs.push(`[Error] Staff ${s.fullName} has no email configured. Skipped automated wish email.`);
            continue;
          }

          logs.push(`Sending AI Wish email directly to celebrated staff: ${celebratedEmail} (CC: ${coworkerEmails.length} coworkers at ${companyName})`);
          await sendGraphEmailWithCC(
            accessToken, 
            senderEmail, 
            [celebratedEmail], 
            coworkerEmails, 
            wish.subject, 
            wish.body
          );
        } catch (err) {
          logs.push(`[Error] Failed to process AI wish for ${s.fullName}: ${err.message}`);
        }
      }
    }

    logs.push("Cron execution finished successfully.");
    return res.status(200).json({ success: true, logs });

  } catch (error) {
    console.error("Cron Handler Failed:", error);
    return res.status(500).json({ error: error.message || 'Cron execution failed', logs });
  }
}

// REST helper to fetch Firestore collections dependency-free
function fetchCollection(projectId, collectionName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=1000`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            const docs = (data.documents || []).map(doc => {
              const fields = doc.fields || {};
              const obj = { id: doc.name.split('/').pop() };
              for (const [key, val] of Object.entries(fields)) {
                if (val.stringValue !== undefined) obj[key] = val.stringValue;
                else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue, 10);
                else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
                else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
                else if (val.arrayValue !== undefined) {
                  obj[key] = (val.arrayValue.values || []).map(v => v.stringValue || v.integerValue || v.doubleValue || v.booleanValue);
                }
              }
              return obj;
            });
            resolve(docs);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Firestore REST API status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function refreshAccessToken(clientId, clientSecret, refreshToken) {
  return new Promise((resolve, reject) => {
    const postData = `client_id=${clientId}` +
      `&scope=${encodeURIComponent('https://graph.microsoft.com/.default offline_access')}` +
      `&grant_type=refresh_token` +
      `&refresh_token=${refreshToken}` +
      `&client_secret=${encodeURIComponent(clientSecret)}`;

    const options = {
      hostname: 'login.microsoftonline.com',
      port: 443,
      path: '/common/oauth2/v2.0/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) {
            resolve(data.access_token);
          } else {
            reject(new Error(`OAuth2 Refresh Failed: ${data.error_description || data.error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse OAuth2 token response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sendGraphEmailWithCC(accessToken, senderEmail, toEmails, ccEmails, subject, bodyText) {
  return new Promise((resolve, reject) => {
    const toRecipients = toEmails.map(email => ({
      emailAddress: { address: email }
    }));
    const ccRecipients = ccEmails.map(email => ({
      emailAddress: { address: email }
    }));

    const emailPayload = JSON.stringify({
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: bodyText
        },
        toRecipients,
        ccRecipients
      },
      saveToSentItems: 'true'
    });

    const options = {
      hostname: 'graph.microsoft.com',
      port: 443,
      path: `/v1.0/me/sendMail`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailPayload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Microsoft Graph API error (Status ${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(emailPayload);
    req.end();
  });
}

async function generateGreetingAI(employeeName, jobTitle, companyName, reminderType, startDate, apiKey) {
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

  return new Promise((resolve, reject) => {
    const apiReq = https.request(options, (apiRes) => {
      let body = '';
      apiRes.on('data', chunk => body += chunk);
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
            reject(new Error(`Failed to parse DeepSeek response: ${e.message}`));
          }
        } else {
          reject(new Error(`DeepSeek API returned status ${apiRes.statusCode}: ${body}`));
        }
      });
    });

    apiReq.on('error', reject);
    apiReq.write(payload);
    apiReq.end();
  });
}

function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // 0-indexed
    let day = parseInt(parts[2], 10);

    if (year < 1000) {
      // It's probably DD-MM-YYYY or DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
    return { year, month, day };
  }
  return null;
}
