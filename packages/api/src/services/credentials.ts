import db from '../libs/db.js';
import { randomUUIDv7 } from 'bun';
import { Credential } from 'types/index.js';

export async function createCredential(credential: {
    identifier: string;
    type: string;
    user: string;
    password?: string;
    public_key?: string;
    private_key?: string;
    passphrase?: string;
}) {
    const {
        identifier,
        type,
        password = "",
        public_key = "",
        private_key = "",
        passphrase = "",
        user
    } = credential;

    const id = randomUUIDv7();
    
    const stmt = db.prepare('INSERT INTO credentials (id, identifier, type, user, password, public_key, private_key, passphrase) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, identifier, type, user, password, public_key, private_key, passphrase);
    
    return id;
}

export async function getCredential(id: string): Promise<Credential | null> {
    const stmt = db.prepare('SELECT * FROM credentials WHERE id = ?');
    const credential = stmt.get(id) as Credential | null;
    return credential;
}

export async function getCredentials(): Promise<Credential[]> {
    const stmt = db.prepare('SELECT * FROM credentials');
    const credentials = stmt.all() as Credential[];
    return credentials;
}

export async function updateCredential(id: string, credential: {
    identifier: string;
    type: string;
    user: string;
    password: string;
    public_key: string;
    private_key: string;
    passphrase: string;
}) {
    const {
        identifier,
        type,
        user,
        password,
        public_key,
        private_key,
        passphrase
    } = credential;
    
    const stmt = db.prepare('UPDATE credentials SET identifier = ?, type = ?, user = ?, password = ?, public_key = ?, private_key = ?, passphrase = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(identifier, type, user, password, public_key, private_key, passphrase, id);

    return id;
}

export async function deleteCredential(id: string) {
    const stmt = db.prepare('DELETE FROM credentials WHERE id = ?');
    stmt.run(id);
    return id;
}

export async function getCredentialCount(): Promise<number> {
    const stmt = db.prepare('SELECT COUNT(*) as value FROM credentials');
    const count = stmt.get() as {
        value: number;
    };
    return count.value;
}