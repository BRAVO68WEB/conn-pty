import { Hono } from "hono";

const app = new Hono();

import servers from './servers.js';
import sessions from './sessions.js';
import credentials from './credentials.js';
import auth from './auth.js';
import stats from './stats.js';

import authMiddleware from '../middleware/auth.js';

app.route('/auth', auth);

app.use('*', authMiddleware);

app.route('/servers', servers);
app.route('/sessions', sessions);
app.route('/credentials', credentials);
app.route('/stats', stats);

export default app;
