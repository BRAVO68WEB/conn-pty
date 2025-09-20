export type CredType = 'password' | 'private_key' | 'private_key_with_passphrase';

export interface Credential {
    readonly id: string;
    identifier: string;
    readonly type: CredType;
    user: string;
    password: string;
    public_key: string;
    private_key: string;
    passphrase: string;
    created_at: string;
    updated_at: string;
}

export interface Server {
    readonly id: string
    name: string
    host: string
    port: number
    cred_id: string
    user: string
    country_code: string
    last_ssh_on: string
    created_at: string
    updated_at: string
}

export interface SessionData {
    server_id: string;
    status?: 'pending' | 'active' | 'ended';
}

export interface Session {
    readonly id: string;
    server_id: string;
    socket_id?: string;
    status: 'pending' | 'active' | 'ended';
    started_at?: string;
    ended_at?: string;
    created_at: string;
    updated_at: string;
}