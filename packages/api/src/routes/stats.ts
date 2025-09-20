import { Hono } from "hono";
import { getServerCount } from "../services/servers.js";
import { getSessionCount } from "../services/sessions.js";
import { getCredentialCount } from "../services/credentials.js";

const app = new Hono();

app.get('/', async (c) => {
  return c.json({
    server_count: await getServerCount(),
    session_count: await getSessionCount(),
    credential_count: await getCredentialCount(),
  });
});

export default app;
