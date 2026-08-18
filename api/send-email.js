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

  const { recipient, subject, body } = req.body;

  if (!recipient || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: recipient, subject, body' });
  }

  // Parse recipients (handles single string, comma-separated string, or array)
  let toEmails = [];
  if (Array.isArray(recipient)) {
    toEmails = recipient;
  } else if (typeof recipient === 'string') {
    toEmails = recipient.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    return res.status(400).json({ error: 'Invalid recipient format. Must be string or array.' });
  }

  const clientId = process.env.MS365_CLIENT_ID;
  const clientSecret = process.env.MS365_CLIENT_SECRET;
  const refreshToken = process.env.MS365_REFRESH_TOKEN;
  const senderEmail = process.env.MS365_SENDER_EMAIL || 'groupadmin@globalrecruiters.ae';

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({ error: 'MS365 OAuth2 credentials are not configured in Vercel environment variables.' });
  }

  try {
    console.log("Refreshing Microsoft 365 OAuth2 Access Token...");
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);

    console.log(`Sending email via Microsoft Graph API to: ${toEmails.join(', ')}`);
    await sendGraphEmail(accessToken, senderEmail, toEmails, subject, body);

    // Log the sent email to Firestore
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'humres-management-hub';
    try {
      await saveSentEmailREST(projectId, {
        to: toEmails,
        subject: subject,
        body: body,
        timestamp: new Date().toISOString(),
        triggerType: req.body.triggerType || 'manual',
        sender: senderEmail
      });
      console.log("Sent email logged to Firestore successfully.");
    } catch (err) {
      console.error("Failed to log sent email to Firestore:", err);
    }

    console.log("Email sent successfully!");
    return res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
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
      res.on('data', (chunk) => { body += chunk; });
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

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function sendGraphEmail(accessToken, senderEmail, toEmails, subject, bodyText) {
  return new Promise((resolve, reject) => {
    const toRecipients = toEmails.map(email => ({
      emailAddress: { address: email }
    }));

    const emailPayload = JSON.stringify({
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: bodyText
        },
        toRecipients: toRecipients
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
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 200) {
          resolve();
        } else {
          try {
            const errData = JSON.parse(body);
            reject(new Error(`Microsoft Graph API error: ${errData.error?.message || body}`));
          } catch (e) {
            reject(new Error(`Microsoft Graph API error (Status ${res.statusCode}): ${body}`));
          }
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(emailPayload);
    req.end();
  });
}
