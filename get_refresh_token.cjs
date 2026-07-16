const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const REDIRECT_URI = 'https://oauth.pstmn.io/v1/callback';

console.log("\n=== Microsoft 365 OAuth2 Refresh Token Generator ===\n");

rl.question('1. Enter your Application (Client) ID: ', (clientId) => {
  rl.question('2. Enter your Client Secret Value: ', (clientSecret) => {
    rl.question('3. Enter your Tenant ID (or press Enter to use "common"): ', (tenantId) => {
      
      const tenant = tenantId.trim() || 'common';
      const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize` +
        `?client_id=${clientId.trim()}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_mode=query` +
        `&scope=${encodeURIComponent('https://outlook.office.com/SMTP.Send offline_access')}` +
        `&state=12345`;

      console.log("\n=========================================================================");
      console.log("👉 ACTION REQUIRED: Copy the URL below and open it in your browser:");
      console.log("=========================================================================");
      console.log(authUrl);
      console.log("=========================================================================\n");
      console.log("Sign in with your groupadmin@globalrecruiters.ae account.");
      console.log("After signing in, your browser will redirect to Postman (it might say 'redirecting' or look blank).");
      
      rl.question('👉 Copy the ENTIRE redirected URL from your browser address bar and paste it here: ', (redirectedUrl) => {
        try {
          let code = '';
          if (redirectedUrl.includes('code=')) {
            // Parse URL parameters
            const match = redirectedUrl.match(/[?&]code=([^&]+)/);
            code = match ? decodeURIComponent(match[1]) : '';
          } else {
            code = redirectedUrl.trim();
          }

          if (!code) {
            console.error("❌ Error: Could not find 'code' parameter in the URL. Make sure to copy the entire browser address bar.");
            rl.close();
            return;
          }

          console.log("\nExchanging authorization code for tokens...");

          const postData = `client_id=${clientId.trim()}` +
            `&scope=${encodeURIComponent('https://outlook.office.com/SMTP.Send offline_access')}` +
            `&code=${code}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&grant_type=authorization_code` +
            `&client_secret=${encodeURIComponent(clientSecret.trim())}`;

          const options = {
            hostname: 'login.microsoftonline.com',
            port: 443,
            path: `/${tenant}/oauth2/v2.0/token`,
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
                if (data.error) {
                  console.error("\n❌ Microsoft Auth Error:", data.error_description || data.error);
                } else if (data.refresh_token) {
                  console.log("\n=========================================================================");
                  console.log("✅ SUCCESS! Your Refresh Token is generated:");
                  console.log("=========================================================================");
                  console.log(data.refresh_token);
                  console.log("=========================================================================");
                  console.log("\nYou can now copy this token and use it to configure your Firebase extension!");
                } else {
                  console.error("\n❌ Unexpected response from Microsoft:", data);
                }
              } catch (e) {
                console.error("\n❌ Failed to parse response body:", e.message);
                console.log("Raw response:", body);
              }
              rl.close();
            });
          });

          req.on('error', (e) => {
            console.error("\n❌ Network error requesting token:", e.message);
            rl.close();
          });

          req.write(postData);
          req.end();

        } catch (err) {
          console.error("\n❌ Error parsing input URL:", err.message);
          rl.close();
        }
      });
    });
  });
});
