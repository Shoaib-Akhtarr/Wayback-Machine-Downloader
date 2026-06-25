import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'wayback-local-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.includes('/local-proxy')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const urlStr = urlObj.searchParams.get('url');
            if (!urlStr) return res.end('Missing URL');
            
            console.log(`[Proxy] Fetching: ${urlStr}`);
            
            try {
              const response = await fetch(urlStr, {
                headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': '*/*'
                }
              });

              if (!response.ok) {
                console.error(`[Proxy] Target returned ${response.status}: ${response.statusText}`);
                res.statusCode = response.status;
                return res.end(`Target error: ${response.statusText}`);
              }
              
              const contentType = response.headers.get('content-type');
              if (contentType) res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              
              const arrayBuffer = await response.arrayBuffer();
              console.log(`[Proxy] Success: ${urlStr} (${arrayBuffer.byteLength} bytes)`);
              res.end(Buffer.from(arrayBuffer));
            } catch (e: any) {
              console.error(`[Proxy] Error fetching ${urlStr}:`, e.message);
              res.statusCode = 500;
              res.end(`Local Proxy Error: ${e.message}`);
            }
          } else {
            next();
          }
        });
      }
    }
  ]
})
