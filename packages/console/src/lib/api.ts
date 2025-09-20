// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Backend types (from API package)
type BackendCredType = 'password' | 'private_key' | 'private_key_with_passphrase';

interface BackendCredential {
  id: string;
  identifier: string;
  type: BackendCredType;
  user: string;
  password: string;
  public_key: string;
  private_key: string;
  passphrase: string;
  created_at: string;
  updated_at: string;
}

interface BackendServer {
  id: string;
  name: string;
  host: string;
  port: number;
  cred_id: string;
  user: string;
  country_code: string;
  last_ssh_on: string;
  created_at: string;
  updated_at: string;
}

interface BackendSession {
  id: string;
  server_id: string;
  socket_id?: string;
  status: 'pending' | 'active' | 'ended';
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

// Frontend types (UI facing)
export type CredentialType = 'password' | 'ssh_key' | 'private_key' | 'private_key_with_passphrase' | 'key';

export interface Server {
  id: string;
  name: string;
  hostname: string; // maps to backend host
  port: number;
  username: string; // maps to backend user
  description?: string; // not stored backend, UI convenience
  credential_id: string; // maps to backend cred_id
  country_code?: string;
  last_ssh_on?: string;
  created_at: string;
  updated_at: string;
}

export interface Credential {
  id: string;
  name: string; // maps to backend identifier
  type: CredentialType;
  username: string; // maps to backend user
  password?: string;
  public_key?: string;
  private_key?: string;
  passphrase?: string;
  description?: string; // UI convenience only
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  server_id: string;
  socket_id?: string | null;
  status: 'pending' | 'active' | 'ended';
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateServerRequest {
  name: string;
  hostname: string;
  port: number;
  username: string;
  description?: string;
  credential_id: string;
}

export interface UpdateServerRequest {
  name?: string;
  hostname?: string;
  port?: number;
  username?: string;
  description?: string;
  credential_id?: string;
}

export interface CreateCredentialRequest {
  name: string;
  type: CredentialType;
  username: string;
  password?: string;
  public_key?: string;
  private_key?: string;
  passphrase?: string;
  description?: string;
}

export interface UpdateCredentialRequest {
  name?: string;
  type?: CredentialType;
  username?: string;
  password?: string;
  public_key?: string;
  private_key?: string;
  passphrase?: string;
  description?: string;
}

export interface CreateSessionRequest {
  server_id: string;
}

// Mapping helpers
const mapBackendServerToUI = (s: BackendServer): Server => ({
  id: s.id,
  name: s.name,
  hostname: s.host,
  port: s.port,
  username: s.user,
  description: undefined,
  credential_id: s.cred_id,
  country_code: s.country_code,
  last_ssh_on: s.last_ssh_on,
  created_at: s.created_at,
  updated_at: s.updated_at,
});

const mapUIServerToBackendCreate = (s: CreateServerRequest) => ({
  name: s.name,
  host: s.hostname,
  port: s.port,
  cred_id: s.credential_id,
  user: s.username,
  country_code: '', // default until UI captures this
});

const mapUIServerToBackendUpdate = (s: UpdateServerRequest) => ({
  name: s.name,
  host: s.hostname,
  port: s.port,
  cred_id: s.credential_id,
  user: s.username,
  // optional fields omitted if undefined
});

const mapUICredentialTypeToBackend = (type: CredentialType, passphrase?: string): BackendCredType => {
  const normalized = (type === 'key' || type === 'ssh_key') ? 'private_key' : type;
  if (normalized === 'private_key' && passphrase && passphrase.length > 0) {
    return 'private_key_with_passphrase';
  }
  return normalized as BackendCredType;
};

const mapBackendCredentialToUI = (c: BackendCredential): Credential => ({
  id: c.id,
  name: c.identifier,
  // prefer ssh_key label in UI when public key present
  type: c.public_key ? 'ssh_key' : (c.type as CredentialType),
  username: c.user,
  password: c.password || undefined,
  public_key: c.public_key || undefined,
  private_key: c.private_key || undefined,
  passphrase: c.passphrase || undefined,
  created_at: c.created_at,
  updated_at: c.updated_at,
});

const mapUICredentialToBackendCreate = (c: CreateCredentialRequest) => ({
  identifier: c.name,
  type: mapUICredentialTypeToBackend(c.type, c.passphrase),
  user: c.username,
  password: c.password,
  public_key: c.public_key,
  private_key: c.private_key,
  passphrase: c.passphrase,
});

const mapUICredentialToBackendUpdate = (c: UpdateCredentialRequest) => ({
  identifier: c.name ?? '',
  type: mapUICredentialTypeToBackend(c.type ?? 'password', c.passphrase),
  user: c.username ?? '',
  password: c.password ?? '',
  public_key: c.public_key ?? '',
  private_key: c.private_key ?? '',
  passphrase: c.passphrase ?? '',
});

// API Error class
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Base API client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorData;
        
        try {
          errorData = await response.json();
          errorMessage = (errorData as { message: string }).message || errorMessage;
        } catch {
          // If response is not JSON, use status text
        }
        
        throw new ApiError(errorMessage, response.status, errorData);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return {} as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  // Server endpoints
  async getServers(): Promise<{ servers: Server[] }> {
    const res = await this.request<{ servers: BackendServer[] }>('/servers');
    return { servers: res.servers.map(mapBackendServerToUI) };
  }

  async getServer(id: string): Promise<{ server: Server }> {
    const res = await this.request<{ server: BackendServer }>(`/servers/${id}`);
    return { server: mapBackendServerToUI(res.server) };
  }

  async createServer(data: CreateServerRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>("/servers", {
      method: 'POST',
      body: JSON.stringify(mapUIServerToBackendCreate(data)),
    });
  }

  async updateServer(id: string, data: UpdateServerRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mapUIServerToBackendUpdate(data)),
    });
  }

  async deleteServer(id: string): Promise<void> {
    await this.request<{ id: string }>(`/servers/${id}`, {
      method: 'DELETE',
    });
  }

  // Credential endpoints
  async getCredentials(): Promise<{ credentials: Credential[] }> {
    const res = await this.request<{ credentials: BackendCredential[] }>('/credentials');
    return { credentials: res.credentials.map(mapBackendCredentialToUI) };
  }

  async getCredential(id: string): Promise<{ credential: Credential }> {
    const res = await this.request<{ credential: BackendCredential }>(`/credentials/${id}`);
    return { credential: mapBackendCredentialToUI(res.credential) };
  }

  async createCredential(data: CreateCredentialRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>('/credentials', {
      method: 'POST',
      body: JSON.stringify(mapUICredentialToBackendCreate(data)),
    });
  }


  // Credential utilities
  async generateCredentialMaterial(payload: { type: 'password' | 'ssh-rsa' | 'ssh-ed25519' }): Promise<{ password?: string; public_key?: string; private_key?: string; public_key_pem?: string }> {
    return this.request<{ password?: string; public_key?: string; private_key?: string; public_key_pem?: string }>(
      '/credentials/util/generate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  async updateCredential(id: string, data: UpdateCredentialRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mapUICredentialToBackendUpdate(data)),
    });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.request<{ id: string }>(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }

  // Session endpoints
  async getSessions(): Promise<{ sessions: Session[]; count?: number; success?: boolean }> {
    return this.request<{ sessions: Session[]; count?: number; success?: boolean }>('/sessions');
  }

  async getSession(id: string): Promise<{ session: Session; success?: boolean }> {
    return this.request<{ session: Session; success?: boolean }>(`/sessions/${id}`);
  }

  async createSession(data: CreateSessionRequest): Promise<{ session: Session; success?: boolean }> {
    return this.request<{ session: Session; success?: boolean }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async endSession(id: string): Promise<void> {
    await this.request<{ success: boolean; session: Session }>(`/sessions/${id}/end`, {
      method: 'POST',
    });
  }

  // Terminal URL helper
  getTerminalUrl(sessionId: string): string {
    return `${this.baseUrl}/terminal?session_id=${sessionId}`;
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export individual service functions for easier use
export const serversApi = {
  getAll: () => apiClient.getServers(),
  getById: (id: string) => apiClient.getServer(id),
  create: (data: CreateServerRequest) => apiClient.createServer(data),
  update: (id: string, data: UpdateServerRequest) => apiClient.updateServer(id, data),
  delete: (id: string) => apiClient.deleteServer(id),
};

export const credentialsApi = {
  getAll: () => apiClient.getCredentials(),
  getById: (id: string) => apiClient.getCredential(id),
  create: (data: CreateCredentialRequest) => apiClient.createCredential(data),
  update: (id: string, data: UpdateCredentialRequest) => apiClient.updateCredential(id, data),
  delete: (id: string) => apiClient.deleteCredential(id),
  generate: (payload: { type: 'password' | 'ssh-rsa' | 'ssh-ed25519' }) => apiClient.generateCredentialMaterial(payload),
};

export const sessionsApi = {
  getAll: () => apiClient.getSessions(),
  create: (data: CreateSessionRequest) => apiClient.createSession(data),
  end: (id: string) => apiClient.endSession(id),
  getTerminalUrl: (sessionId: string) => apiClient.getTerminalUrl(sessionId),
};