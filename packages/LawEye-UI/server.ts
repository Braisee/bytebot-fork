import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import next from 'next';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '9993', 10);

const app = next({ dev, hostname, port });

app
  .prepare()
  .then(() => {
    const handle = app.getRequestHandler();
    const nextUpgradeHandler = app.getUpgradeHandler();
    const expressApp = express();

    // API proxy to LawEye backend
    const laweyeApiUrl = process.env.LAWEYE_API_URL || 'http://laweye:9992';
    
    const apiProxy = createProxyMiddleware({
      target: laweyeApiUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Remove /api prefix
      },
      ws: true, // Enable WebSocket proxying
    });

    expressApp.use('/api', apiProxy);

    // Handle all other requests with Next.js
    expressApp.all('*', (req, res) => handle(req, res));

    const server = createServer(expressApp);

    // Handle WebSocket upgrades
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(
        request.url!,
        `http://${request.headers.host}`,
      );

      // Proxy WebSocket connections to LawEye backend
      if (pathname?.startsWith('/api/') || pathname?.startsWith('/socket.io')) {
        // Rewrite path for socket.io
        if (pathname.startsWith('/api/socket.io')) {
          // Proxy to /socket.io on backend
          request.url = request.url!.replace('/api/socket.io', '/socket.io');
        }
        return apiProxy.upgrade(request, socket as any, head);
      }

      // Handle Next.js WebSocket upgrades
      nextUpgradeHandler(request, socket, head);
    });

    server.listen(port, hostname, () => {
      console.log(`> LawEye UI ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });

