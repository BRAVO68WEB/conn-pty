import { Hono } from 'hono'
import { showRoutes } from 'hono/dev'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

import routes from './routes/index.js';
import { engine } from './sockets/io.js'

const app = new Hono({
  strict: false
})
  .basePath('/api')
  .use(logger())

const { websocket } = engine.handler();

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/', routes);

showRoutes(app)

export default {
  port: 3000,
  idleTimeout: 30, // must be greater than the "pingInterval" option of the engine, which defaults to 25 seconds
  fetch(req: Request, server: Bun.Server) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/socket.io/")) {
      return engine.handleRequest(req, server);
    } else {
      return app.fetch(req, server);
    }
  },
  websocket
}
