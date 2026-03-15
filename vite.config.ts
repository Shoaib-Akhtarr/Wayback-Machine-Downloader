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
          if (req.url?.startsWith('/local-proxy')) {
            const urlStr = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url');
            if (!urlStr) return res.end('Missing URL');
            
            try {
              const response = await fetch(urlStr, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
              });
              const contentType = response.headers.get('content-type');
              if (contentType) res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              
              const arrayBuffer = await response.arrayBuffer();
              res.end(Buffer.from(arrayBuffer));
            } catch (e) {
              res.statusCode = 500;
              res.end('Local Proxy Error');
            }
          } else {
            next();
          }
        });
      }
    }
  ]
})
