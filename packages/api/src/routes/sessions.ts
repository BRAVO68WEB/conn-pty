import { Hono } from "hono";
import { 
    createSession, 
    endSession, 
    getSession, 
    getSessions, 
    getActiveSessionsByServer,
    getSessionsByStatus, 
} from "../services/sessions.js";
import { SessionData } from "../types/index.js";

const app = new Hono();

// Create a new session
app.post('/', async (c) => {
    try {
        const sessionData: SessionData = await c.req.json();
        
        if (!sessionData.server_id) {
            return c.json({ error: 'server_id is required' }, 400);
        }
        
        const id = await createSession(sessionData);
        const session = await getSession(id);
        
        return c.json({ 
            success: true,
            session: session 
        });
    } catch (error) {
        console.error('Error creating session:', error);
        return c.json({ error: 'Failed to create session' }, 500);
    }
});

// End a session
app.post('/:id/end', async (c) => {
    try {
        const id = c.req.param('id');
        
        const existingSession = await getSession(id);
        if (!existingSession) {
            return c.json({ error: 'Session not found' }, 404);
        }
        
        await endSession(id);
        const updatedSession = await getSession(id);
        
        return c.json({ 
            success: true,
            session: updatedSession 
        });
    } catch (error) {
        console.error('Error ending session:', error);
        return c.json({ error: 'Failed to end session' }, 500);
    }
});

// Get a specific session
app.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const session = await getSession(id);
        
        if (!session) {
            return c.json({ error: 'Session not found' }, 404);
        }
        
        return c.json({ 
            success: true,
            session: session 
        });
    } catch (error) {
        console.error('Error getting session:', error);
        return c.json({ error: 'Failed to get session' }, 500);
    }
});

// Get all sessions with optional filtering
app.get('/', async (c) => {
    try {
        const status = c.req.query('status') as 'pending' | 'active' | 'ended' | undefined;
        const server_id = c.req.query('server_id');
        
        let sessions;
        
        if (status) {
            sessions = await getSessionsByStatus(status);
        } else if (server_id) {
            sessions = await getActiveSessionsByServer(server_id);
        } else {
            sessions = await getSessions();
        }
        
        return c.json({ 
            success: true,
            sessions: sessions,
            count: sessions.length
        });
    } catch (error) {
        console.error('Error getting sessions:', error);
        return c.json({ error: 'Failed to get sessions' }, 500);
    }
});

export default app;
