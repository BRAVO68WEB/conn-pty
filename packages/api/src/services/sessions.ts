import { Session, SessionData } from 'types/index.js';
import db from '../libs/db.js';
import { randomUUIDv7 } from 'bun';

export async function createSession(sessionData: SessionData): Promise<string> {
    const {
        server_id,
        status = 'pending'
    } = sessionData;

    const id = randomUUIDv7();

    const stmt = db.prepare('INSERT INTO sessions (id, server_id, status) VALUES (?, ?, ?)');
    stmt.run(id, server_id, status);

    return id;
}

export async function activateSession(session_id: string, socket_id: string): Promise<void> {
    const stmt = db.prepare('UPDATE sessions SET socket_id = ?, status = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(socket_id, 'active', session_id);
}

export async function endSession(session_id: string): Promise<string> {
    const stmt = db.prepare('UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('ended', session_id);
    return session_id;
}

export async function getSession(session_id: string): Promise<Session | null> {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const session = stmt.get(session_id) as Session | undefined;
    return session || null;
}

export async function getSessions(): Promise<Session[]> {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    const sessions = stmt.all() as Session[];
    return sessions;
}

export async function getActiveSessionsByServer(server_id: string): Promise<Session[]> {
    const stmt = db.prepare('SELECT * FROM sessions WHERE server_id = ? AND status = ? ORDER BY created_at DESC');
    const sessions = stmt.all(server_id, 'active') as Session[];
    return sessions;
}

export async function getSessionsByStatus(status: 'pending' | 'active' | 'ended'): Promise<Session[]> {
    const stmt = db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY created_at DESC');
    const sessions = stmt.all(status) as Session[];
    return sessions;
}

export async function getSessionCount(): Promise<number> {
    const stmt = db.prepare('SELECT COUNT(*) as value FROM sessions');
    const count = stmt.get() as {
        value: number;
    };
    return count.value;
}
