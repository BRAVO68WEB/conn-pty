import { Context, Hono } from "hono"
import { setCookie } from "hono/cookie";
import { getLoginUrl, getToken } from "../libs/auth.js";
import authMiddleware from "../middleware/auth.js";

const app = new Hono();

app.get('/login', async (c) => {
    let url = await getLoginUrl();
    return c.redirect(url);
})

app.get('/callback', async (c: Context) => {
    let { code } = c.req.query();
    if (!code) {
        return c.text('Code not found', 400);
    }
    let tokenSet = await getToken(code);
    setCookie(c, 'access_token', tokenSet.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
    });
    return c.redirect("/console");
})

app.use('/me', authMiddleware);

app.get('/me', async (c: Context) => {
    let user = c.get('user');
    return c.json(user);
})

export default app;