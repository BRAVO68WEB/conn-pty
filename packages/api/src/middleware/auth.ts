import { getCookie } from "hono/cookie";
import { Context, Next, MiddlewareHandler } from "hono";
import { whoAmI } from "../libs/auth.js";

const authMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
    try {
        const accessToken = getCookie(c, 'access_token');
        if (!accessToken) {
            return c.text('Access token not found', 400);
        }

        const user = await whoAmI(accessToken);
        c.set('user', user);
        await next();
    }
    catch(err: unknown) {
        console.error('Auth middleware error:', err);
        return c.text('Unauthorized', 500);
    }
}

export default authMiddleware;