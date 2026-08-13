import handler from '../api/crm-lookup.js';

// Setup environment variables so firebase-admin initializes correctly
process.env.FIREBASE_PROJECT_ID = "humres-management-hub";
// Since we don't have private key here, we can set it to a mock or we can run inside the workspace where standard Vercel variables or local credentials are loaded.
// Wait! Let's see if we can use a mock request/response

const mockReq = {
  method: 'GET',
  query: {
    phone: '+447508255491' // Verity Gordon's number which matched
  }
};

const mockRes = {
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`Response Status: ${this.statusCode}`);
    console.log(`Response Data:`, JSON.stringify(data, null, 2));
  }
};

async function main() {
  console.log("Invoking local crm-lookup handler...");
  try {
    await handler(mockReq, mockRes);
  } catch (e) {
    console.error("Handler error:", e);
  }
}

main();
