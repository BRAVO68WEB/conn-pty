import { Server } from 'types/index.js';
import db from '../libs/db.js';
import { randomUUIDv7 } from 'bun';

export async function createServer(server: {
    name: string;
    host: string;
    port: number;
    cred_id: string;
    user: string;
    country_code: string;
}) {
    const {
        name,
        host,
        port,
        cred_id,
        user,
        country_code
    } = server;

    const id = randomUUIDv7();

    const stmt = db.prepare('INSERT INTO servers (id, name, host, port, cred_id, user, country_code) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, host, port, cred_id, user, country_code);

    return id;
}

export async function getServer(id: string): Promise<Server | null> {
    const stmt = db.prepare('SELECT * FROM servers WHERE id = ?');
    const server = stmt.get(id) as Server | null;
    return server;
}

export async function deleteServer(id: string) {
    const stmt = db.prepare('DELETE FROM servers WHERE id = ?');
    stmt.run(id);
    return id;
}

export async function updateServer(id: string, server: {
    name?: string;
    host?: string;
    port?: number;
    cred_id?: string;
    user?: string;
    country_code?: string;
    last_ssh_on?: string;
}) {
    const {
        name,
        host,
        port,
        cred_id,
        user,
        country_code,
        last_ssh_on,
    } = server;

    const stmt = db.prepare('UPDATE servers SET name = ?, host = ?, port = ?, cred_id = ?, user = ?, country_code = ?, last_ssh_on = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(name ?? '', host ?? '', port ?? 0, cred_id ?? '', user ?? '', country_code ?? '', last_ssh_on ?? '', id);

    return id;
}

export async function getServers(): Promise<Server[]> {
    const stmt = db.prepare('SELECT * FROM servers');
    const servers = stmt.all() as Server[];
    return servers;
}

export async function getServerCount(): Promise<number> {
    const stmt = db.prepare('SELECT COUNT(*) as value FROM servers');
    const count = stmt.get() as {
        value: number;
    };
    return count.value;
}