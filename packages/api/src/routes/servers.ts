import { Hono } from "hono";
import { 
    createServer,
    deleteServer,
    getServer,
    updateServer,
    getServers
} from "../services/servers.js";

const app = new Hono();

app.post('/', async (c) => {
    const server = await c.req.json();
    const id = await createServer(server);
    return c.json({ id });
});

app.get('/', async (c) => {
    const servers = await getServers();
    return c.json({ servers });
});

app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const server = await getServer(id);
    return c.json({ server });
});

app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const server = await c.req.json();
    await updateServer(id, server);
    return c.json({ id });
});

app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await deleteServer(id);
    return c.json({ id });
});

export default app;
