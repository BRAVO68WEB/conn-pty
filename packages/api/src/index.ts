import { Hono } from 'hono'
import { showRoutes } from 'hono/dev'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

import routes from './routes/index.js';
import { createWsHandler } from './sockets/ws.js'

const app = new Hono({
  strict: false
})
  .basePath('/api')
  .use(logger())

const websocket = createWsHandler();

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/', routes);

showRoutes(app)

export default {
  port: Number(process.env.PORT || 3000),
  idleTimeout: 30,
  fetch(req: Request, server: Bun.Server) {
    const url = new URL(req.url);

    if (url.pathname.startsWith('/ws/ssh')) {
      const sessionId = url.searchParams.get('session_id') || url.searchParams.get('sessionId') || undefined;
      const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie') || '';
      const cookieMap = new Map<string, string>();
      for (const part of cookieHeader.split(';')) {
        const [k, v] = part.trim().split('=');
        if (k) cookieMap.set(k, decodeURIComponent(v || ''));
      }
      const cookies = {
        get(name: string) {
          return cookieMap.get(name);
        }
      } as unknown as Bun.CookieMap;

      const upgraded = server.upgrade(req, {
        data: {
          sessionId,
          url,
          cookies,
        },
      });
      if (upgraded) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    return app.fetch(req, server);
  },
  websocket,
}
