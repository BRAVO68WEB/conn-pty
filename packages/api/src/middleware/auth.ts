import { getCookie, setCookie } from "hono/cookie";
import { Context, Next, MiddlewareHandler } from "hono";
import { whoAmI, tokenInfo, requestNewToken } from "../libs/auth.js";

const authMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
    try {
        const accessToken = getCookie(c, 'access_token');
        const refreshToken = getCookie(c, 'refresh_token');

        if (!accessToken) {
            return c.text('Access token not found', 400);
        }

        const user = await whoAmI(accessToken);
        c.set('user', user);
        c.set('access_token', accessToken);
        c.set('refresh_token', refreshToken);

        // Check if access token is expired
        const tokenInfoResponse = await tokenInfo(accessToken);

        // request a new token before 30 mins of expiration
        if (!tokenInfoResponse.exp || tokenInfoResponse.exp < Date.now() + 30 * 60 * 1000) {
            // Request new token using refresh token
            const newTokenSet = await requestNewToken(refreshToken!);
            const newExpires = new Date(Date.now() + newTokenSet.expires_in! * 1000);
            setCookie(c, 'access_token', newTokenSet.access_token, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                expires: newExpires,
            });
            setCookie(c, 'refresh_token', newTokenSet.refresh_token!, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                expires: newExpires,
            });
        }
        
        await next();
    }
    catch(err: unknown) {
        console.error('Auth middleware error:', err);
        return c.text('Unauthorized', 403);
    }
}

export default authMiddleware;