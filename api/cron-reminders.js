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

    logs.push("Fetching leave requests and leave policies from Firestore REST API...");
    const leaveRequestsList = await fetchCollection(projectId, 'leaveRequests') || [];
    const leavePoliciesList = await fetchCollection(projectId, 'leavePolicies') || [];

    // 2. Fetch Email Reminders Configuration Settings from Firestore REST
    logs.push("Fetching email reminders configuration settings...");
    const settings = await fetchDocument(projectId, 'settings', 'email_reminders') || {
      managementEmails: managementEmailsStr,
      alertManagers: true,
      alertCoworkers: false,
      sendToEmployee: true,
      alertManagementDayBefore: true,
      sendGreetingsDayOf: true
    };

    const alertManagementDayBefore = settings.alertManagementDayBefore !== false;
    const sendGreetingsDayOf = settings.sendGreetingsDayOf !== false;

    // 3. Refresh MS365 Token
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

    // Calculate UK timezone-safe today date string (YYYY-MM-DD) for leaves
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const formattedParts = formatter.formatToParts(today);
    const dd = formattedParts.find(p => p.type === 'day').value;
    const mm = formattedParts.find(p => p.type === 'month').value;
    const yyyy = formattedParts.find(p => p.type === 'year').value;
    const todayStr = `${yyyy}-${mm}-${dd}`;
    logs.push(`London date string for active leave checks: ${todayStr}`);

    const activeLeavesToday = leaveRequestsList.filter(req => {
      if (req.status !== 'approved') return false;
      return todayStr >= req.startDate && todayStr <= req.endDate;
    });
    logs.push(`Found ${activeLeavesToday.length} active approved leave requests for today.`);

    // 4. Process matches
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
      if (alertManagementDayBefore && (bdayMatchTomorrow || annivMatchTomorrow)) {
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

        // Compile recipient alert list
        const alertRecipients = [];

        // 1) Management emails from settings
        const configEmails = (settings.managementEmails || '')
          .split(',')
          .map(e => e.trim())
          .filter(Boolean);
        configEmails.forEach(e => {
          if (!alertRecipients.includes(e)) alertRecipients.push(e);
        });

        // 2) Direct Line/Reporting manager of the employee
        if (settings.alertManagers !== false) {
          const managerIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
          const dottedIds = s.dottedLineManagerIds || [];
          const allManagerIds = [...new Set([...managerIds, ...dottedIds])];

          allManagerIds.forEach(mId => {
            const mObj = activeStaff.find(member => member.id === mId);
            const mEmail = mObj?.businessEmail || mObj?.personalEmail;
            if (mEmail && !alertRecipients.includes(mEmail)) {
              alertRecipients.push(mEmail);
            }
          });
        }

        if (alertRecipients.length > 0) {
          logs.push(`Sending tomorrow's event management alert to: ${alertRecipients.join(', ')}`);
          try {
            await sendGraphEmailWithCC(accessToken, senderEmail, alertRecipients, [], subject, bodyText);
            // Log to Firestore sent_emails
            await saveSentEmailREST(projectId, {
              to: alertRecipients,
              subject: subject,
              body: bodyText,
              timestamp: new Date().toISOString(),
              triggerType: bdayMatchTomorrow ? 'cron-tomorrow-birthday' : 'cron-tomorrow-anniversary',
              sender: senderEmail
            });
          } catch (err) {
            logs.push(`[Error] Failed tomorrow's alert for ${s.fullName}: ${err.message}`);
          }
        }
      }

      // ----------------------------------------------------
      // ACTION B: Automated Wish Email (On the Day of Event)
      // ----------------------------------------------------
      if (sendGreetingsDayOf && (bdayMatchToday || annivMatchToday)) {
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

          // Find coworkers at the SAME company to CC if enabled
          let ccRecipients = [];
          if (settings.alertCoworkers === true) {
            const coworkers = activeStaff.filter(c => c.companyId === s.companyId && c.id !== s.id);
            ccRecipients = coworkers.map(c => c.businessEmail || c.personalEmail).filter(Boolean);
          }

          const toRecipients = [];
          if (settings.sendToEmployee !== false && celebratedEmail) {
            toRecipients.push(celebratedEmail);
          }

          if (toRecipients.length === 0 && ccRecipients.length === 0) {
            logs.push(`[Skip] No recipients configured for day-of wish for ${s.fullName}.`);
            continue;
          }

          logs.push(`Sending AI Wish email directly to: ${toRecipients.join(', ')} (CC: ${ccRecipients.length} coworkers at ${companyName})`);
          await sendGraphEmailWithCC(
            accessToken, 
            senderEmail, 
            toRecipients.length > 0 ? toRecipients : ccRecipients, 
            toRecipients.length > 0 ? ccRecipients : [], 
            wish.subject, 
            wish.body
          );

          // Log to Firestore sent_emails
          await saveSentEmailREST(projectId, {
            to: [...toRecipients, ...ccRecipients],
            subject: wish.subject,
            body: wish.body,
            timestamp: new Date().toISOString(),
            triggerType: bdayMatchToday ? 'cron-dayof-birthday' : 'cron-dayof-anniversary',
            sender: senderEmail
          });
        } catch (err) {
          logs.push(`[Error] Failed to process AI wish for ${s.fullName}: ${err.message}`);
        }
      }
    }

    // ----------------------------------------------------
    // ACTION C: Daily Leave Reminder Alerts
    // ----------------------------------------------------
    const alertLeaveStatus = settings.alertLeaveStatus !== false;
    if (alertLeaveStatus && activeLeavesToday.length > 0) {
      logs.push(`Processing daily leave reminders for ${activeLeavesToday.length} active leaves...`);

      // 1. Send complete table summary to directors / leaveManagementEmails
      const leaveRecipients = (settings.leaveManagementEmails || '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      if (leaveRecipients.length > 0) {
        let tableRows = '';
        activeLeavesToday.forEach(req => {
          const s = activeStaff.find(member => member.id === req.staffId);
          if (s) {
            const comp = companiesList.find(c => c.id === s.companyId);
            const compName = comp ? comp.name : 'Group Company';
            
            const policy = leavePoliciesList.find(p => p.id === s.leavePolicyId);
            const memberLeaves = leaveRequestsList.filter(r => r.staffId === s.id && r.status === 'approved');
            const annualTaken = memberLeaves.filter(r => r.leaveType === 'annual').reduce((sum, r) => sum + (parseFloat(r.totalDays) || 0), 0);
            const annualAllowed = resolveAnnualAllowance(s, policy);
            const annualRemaining = Math.max(0, annualAllowed - annualTaken);

            tableRows += `
              <tr style="border-bottom: 1px solid #cbd5e1;">
                <td style="padding: 10px; font-weight: bold; color: #1e293b;">${s.fullName}</td>
                <td style="padding: 10px; color: #475569;">${s.department || 'N/A'}</td>
                <td style="padding: 10px; color: #475569;">${compName}</td>
                <td style="padding: 10px; color: #0284c7; font-weight: 500;">${req.startDate}</td>
                <td style="padding: 10px; color: #0284c7; font-weight: 500;">${req.endDate}</td>
                <td style="padding: 10px; color: #475569; text-transform: capitalize;">${req.leaveType}</td>
                <td style="padding: 10px; text-align: center; color: #475569;">${annualAllowed} days</td>
                <td style="padding: 10px; text-align: center; font-weight: bold; color: ${annualRemaining < 5 ? '#ef4444' : '#10b981'};">${annualRemaining} days</td>
              </tr>
            `;
          }
        });

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; max-width: 800px;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">Daily Staff Absence & Leave Summary</h2>
            <p>Dear Management Team,</p>
            <p>Below is the summary of staff members who are currently on leave today (<strong>${todayStr}</strong>):</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
                  <th style="padding: 10px; color: #334155;">Employee Name</th>
                  <th style="padding: 10px; color: #334155;">Department</th>
                  <th style="padding: 10px; color: #334155;">Company</th>
                  <th style="padding: 10px; color: #334155;">Start Date</th>
                  <th style="padding: 10px; color: #334155;">End Date</th>
                  <th style="padding: 10px; color: #334155;">Leave Type</th>
                  <th style="padding: 10px; text-align: center; color: #334155;">Allocated</th>
                  <th style="padding: 10px; text-align: center; color: #334155;">Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            
            <p style="margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              This is an automated report generated by the Humres Admin Hub.
            </p>
          </div>
        `;

        logs.push(`Sending daily leaves table summary to directors: ${leaveRecipients.join(', ')}`);
        try {
          await sendGraphEmailWithCC(accessToken, senderEmail, leaveRecipients, [], `[Daily Absence Report] Staff on Leave - ${todayStr}`, htmlBody);
          await saveSentEmailREST(projectId, {
            to: leaveRecipients,
            subject: `[Daily Absence Report] Staff on Leave - ${todayStr}`,
            body: htmlBody,
            timestamp: new Date().toISOString(),
            triggerType: 'cron-daily-absences-report',
            sender: senderEmail
          });
        } catch (err) {
          logs.push(`[Error] Failed to send daily absence summary email: ${err.message}`);
        }
      }

      // 2. Alert reporting/line managers if enabled
      if (settings.alertLeaveManagers !== false) {
        for (const req of activeLeavesToday) {
          const s = activeStaff.find(member => member.id === req.staffId);
          if (s) {
            const managerIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
            const dottedIds = s.dottedLineManagerIds || [];
            const allManagerIds = [...new Set([...managerIds, ...dottedIds])];

            const managerEmails = [];
            allManagerIds.forEach(mId => {
              const mObj = activeStaff.find(member => member.id === mId);
              const mEmail = mObj?.businessEmail || mObj?.personalEmail;
              if (mEmail && !managerEmails.includes(mEmail)) {
                managerEmails.push(mEmail);
              }
            });

            if (managerEmails.length > 0) {
              const comp = companiesList.find(c => c.id === s.companyId);
              const compName = comp ? comp.name : 'Group Company';
              
              const policy = leavePoliciesList.find(p => p.id === s.leavePolicyId);
              const memberLeaves = leaveRequestsList.filter(r => r.staffId === s.id && r.status === 'approved');
              const annualTaken = memberLeaves.filter(r => r.leaveType === 'annual').reduce((sum, r) => sum + (parseFloat(r.totalDays) || 0), 0);
              const annualAllowed = resolveAnnualAllowance(s, policy);
              const annualRemaining = Math.max(0, annualAllowed - annualTaken);

              const managerHtml = `
                <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; max-width: 600px;">
                  <h3 style="color: #0f172a; border-bottom: 2px solid #f59e0b; padding-bottom: 6px;">Team Member Absence Notification</h3>
                  <p>Hi,</p>
                  <p>This is a reminder that your direct report, <strong>${s.fullName}</strong> (${s.jobTitle || 'Team Member'}), is on leave today (<strong>${todayStr}</strong>).</p>
                  
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 16px 0;">
                    <strong style="display: block; margin-bottom: 8px; color: #1e293b;">Absence Details:</strong>
                    <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6;">
                      <li><strong>Leave Type:</strong> <span style="text-transform: capitalize;">${req.leaveType}</span></li>
                      <li><strong>Duration:</strong> ${req.startDate} to ${req.endDate} (${req.totalDays} days)</li>
                      <li><strong>Current Allocated Leave:</strong> ${annualAllowed} days</li>
                      <li><strong>Current Leave Balance:</strong> ${annualRemaining} days remaining</li>
                      ${req.notes ? `<li><strong>Notes:</strong> ${req.notes}</li>` : ''}
                    </ul>
                  </div>

                  <p>Please adjust task assignments and team resource scheduling accordingly.</p>
                  <p>Best regards,<br>Humres Admin Hub</p>
                </div>
              `;

              logs.push(`Sending manager absence alert for ${s.fullName} to: ${managerEmails.join(', ')}`);
              try {
                await sendGraphEmailWithCC(accessToken, senderEmail, managerEmails, [], `[Absence Alert] Direct Report on Leave: ${s.fullName}`, managerHtml);
                await saveSentEmailREST(projectId, {
                  to: managerEmails,
                  subject: `[Absence Alert] Direct Report on Leave: ${s.fullName}`,
                  body: managerHtml,
                  timestamp: new Date().toISOString(),
                  triggerType: 'cron-manager-leave-alert',
                  sender: senderEmail
                });
              } catch (err) {
                logs.push(`[Error] Failed manager absence alert for ${s.fullName}: ${err.message}`);
              }
            }
          }
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

    const isHtml = bodyText.includes('<html>') || bodyText.includes('</div>') || bodyText.includes('</table>') || bodyText.includes('<br>');

    const emailPayload = JSON.stringify({
      message: {
        subject: subject,
        body: {
          contentType: isHtml ? 'HTML' : 'Text',
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

function fetchDocument(projectId, collectionName, documentId) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${documentId}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            const fields = data.fields || {};
            const obj = { id: data.name.split('/').pop() };
            for (const [key, val] of Object.entries(fields)) {
              if (val.stringValue !== undefined) obj[key] = val.stringValue;
              else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue, 10);
              else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
              else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
              else if (val.arrayValue !== undefined) {
                obj[key] = (val.arrayValue.values || []).map(v => v.stringValue || v.integerValue || v.doubleValue || v.booleanValue);
              }
            }
            resolve(obj);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

function saveSentEmailREST(projectId, emailLog) {
  return new Promise((resolve, reject) => {
    const fields = {};
    for (const [key, val] of Object.entries(emailLog)) {
      if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(v => ({ stringValue: String(v) }))
          }
        };
      } else if (typeof val === 'boolean') {
        fields[key] = { booleanValue: val };
      } else if (typeof val === 'number') {
        fields[key] = { doubleValue: val };
      } else {
        fields[key] = { stringValue: String(val) };
      }
    }

    const payload = JSON.stringify({ fields });
    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: `/v1/projects/${projectId}/databases/(default)/documents/sent_emails`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve();
        } else {
          reject(new Error(`Firestore save document failed: status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function resolveAnnualAllowance(member, policy) {
  if (!policy) return 20;
  if (policy.name?.toLowerCase().includes('global recruiters')) {
    if (!member.startDate) return 20;
    const parts = parseDateParts(member.startDate);
    if (!parts) return 20;

    const start = new Date(parts.year, parts.month, parts.day);
    const today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    const m = today.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
      years--;
    }
    const calculated = 20 + Math.max(0, years);
    return Math.min(25, calculated);
  }
  return parseInt(policy.annualAllowance, 10) || 20;
}
