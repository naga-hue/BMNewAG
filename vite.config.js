import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Expose env vars to process.env for the local API handler
  process.env.MS365_CLIENT_ID = env.MS365_CLIENT_ID;
  process.env.MS365_CLIENT_SECRET = env.MS365_CLIENT_SECRET;
  process.env.MS365_REFRESH_TOKEN = env.MS365_REFRESH_TOKEN;
  process.env.MS365_SENDER_EMAIL = env.MS365_SENDER_EMAIL;
  process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'local-api-sender',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url.startsWith('/api/send-email') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const parsedBody = JSON.parse(body);
                  const handler = (await import('./api/send-email.js')).default;
                  
                  const mockReq = {
                    method: 'POST',
                    body: parsedBody
                  };
                  const mockRes = {
                    setHeader: (k, v) => {},
                    status: (code) => ({
                      json: (data) => {
                        res.statusCode = code;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      },
                      end: () => {
                        res.statusCode = code;
                        res.end();
                      }
                    })
                  };
                  
                  await handler(mockReq, mockRes);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            } else if (req.url.startsWith('/api/generate-greeting') && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const parsedBody = JSON.parse(body);
                  const handler = (await import('./api/generate-greeting.js')).default;
                  
                  const mockReq = {
                    method: 'POST',
                    body: parsedBody
                  };
                  const mockRes = {
                    setHeader: (k, v) => {},
                    status: (code) => ({
                      json: (data) => {
                        res.statusCode = code;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(data));
                      },
                      end: () => {
                        res.statusCode = code;
                        res.end();
                      }
                    })
                  };
                  
                  await handler(mockReq, mockRes);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    build: {
      sourcemap: true,
      minify: false
    }
  };
})
