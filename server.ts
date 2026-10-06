/**
 * AssetMT - Express Full-Stack Server
 * Bridges Cloudflare Worker API & Vite Dev / Static SPA Middlewares
 */

import 'dotenv/config';
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import workerHandler from './worker/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();

  // Parse raw body for API routes to preserve binary uploads & json payloads
  app.use('/api', express.raw({ type: '*/*', limit: '50mb' }));

  // API router bridged to Cloudflare Worker handler
  app.all('/api/*', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const fullUrl = new URL(req.originalUrl || req.url, 'http://127.0.0.1:3000');

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined && key.toLowerCase() !== 'host') {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
      let body: Uint8Array | undefined = undefined;
      if (hasBody && req.body) {
        if (Buffer.isBuffer(req.body)) {
          body = new Uint8Array(req.body);
        } else if (typeof req.body === 'string') {
          body = new TextEncoder().encode(req.body);
        }
      }

      const webRequest = new Request(fullUrl.toString(), {
        method: req.method,
        headers,
        body: body as any,
        // @ts-ignore
        duplex: body ? 'half' : undefined,
      });

      const env = {
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
        ENVIRONMENT: isProd ? 'production' : 'development',
      };

      const workerResponse = await workerHandler.fetch(webRequest, env);

      res.status(workerResponse.status);
      workerResponse.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-length') {
          res.setHeader(key, val);
        }
      });

      const arrayBuf = await workerResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err: unknown) {
      console.error('[Server API Error]', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'SERVER_API_ERROR',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  if (!isProd) {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AssetMT Server] Running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server Bootstrap Failed]', err);
  process.exit(1);
});
