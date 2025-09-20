import { Database } from "bun:sqlite"

const db = new Database('./data/db.sqlite')

// Create a table for servers
db.run(`
  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT,
    host TEXT,
    port INTEGER,
    cred_id TEXT,
    user TEXT,
    last_ssh_on TEXT,
    country_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create a table for credentials
db.run(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    identifier TEXT,
    type TEXT,
    user TEXT,
    password TEXT,
    public_key TEXT,
    private_key TEXT,
    passphrase TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create a table for sessions with proper status management
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    socket_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id)
  )
`);

// Create indexes for better performance
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_server_id ON sessions(server_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_socket_id ON sessions(socket_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`);

export default db