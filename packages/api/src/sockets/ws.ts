import type { WebSocketHandler, ServerWebSocket } from "bun";
import { Client, type ConnectConfig } from "ssh2";
import { getSession, activateSession, endSession } from "../services/sessions.js";
import { getServer } from "../services/servers.js";
import { getCredential } from "../services/credentials.js";
import { whoAmI } from "../libs/auth.js";

// Define the shape of contextual data attached during upgrade
interface WsData {
  sessionId?: string;
  url?: URL;
  cookies?: Bun.CookieMap;
  userId?: string | null;
  socketId?: string;
  sshClient?: Client | null;
  sshStream?: any;
}

// Utility to build SSH2 ConnectConfig from either session_id or direct connect options
async function buildConnectConfig(data: WsData, payload?: any): Promise<ConnectConfig | null> {
  // If session_id is provided via upgrade, resolve from DB
  if (data.sessionId) {
    const session = await getSession(data.sessionId);
    if (!session || session.status === "ended") return null;
    const serverData = await getServer(session.server_id);
    if (!serverData) return null;
    const credentialData = await getCredential(serverData.cred_id);
    if (!credentialData) return null;

    const config: ConnectConfig = {
      host: serverData.host,
      port: Number(serverData.port),
      username: serverData.user,
    };

    if (credentialData.type === "password") {
      config.password = credentialData.password;
    } else if (credentialData.type === "private_key") {
      config.privateKey = credentialData.private_key;
    } else if (credentialData.type === "private_key_with_passphrase") {
      config.privateKey = credentialData.private_key;
      config.passphrase = credentialData.passphrase;
    }

    return config;
  }

  // Otherwise, expect direct connect parameters in payload
  if (payload && payload.host && payload.port && payload.username) {
    const cfg: ConnectConfig = {
      host: String(payload.host),
      port: Number(payload.port),
      username: String(payload.username),
    };
    if (payload.password) cfg.password = String(payload.password);
    if (payload.privateKey) cfg.privateKey = String(payload.privateKey);
    if (payload.passphrase) cfg.passphrase = String(payload.passphrase);
    return cfg;
  }

  return null;
}

export function createWsHandler(): WebSocketHandler<WsData> {
  const websocket: WebSocketHandler<WsData> = {
    async open(ws: ServerWebSocket<WsData>) {
      // Assign a socketId for mapping
      ws.data.socketId = crypto.randomUUID();
      // Identify user from cookies (optional)
      try {
        const cookies = ws.data.cookies;
        const token = cookies?.get("access_token") || cookies?.get("AccessToken") || null;
        if (token) {
          const user = await whoAmI(token);
          ws.data.userId = (user as any)?.sub || (user as any)?.email || null;
        }
      } catch {}
    },

    async message(ws: ServerWebSocket<WsData>, message: string | ArrayBuffer | Uint8Array) {
      const data = ws.data;

      // Binary input -> write to shell
      if (typeof message !== "string") {
        const bytes = message instanceof Uint8Array ? message : new Uint8Array(message as ArrayBuffer);
        if (data.sshStream) {
          data.sshStream.write(Buffer.from(bytes));
        }
        return;
      }

      // Expect JSON messages for control
      let payload: any;
      try {
        payload = JSON.parse(message);
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON payload" }));
        return;
      }

      const t = String(payload.type || "");

      if (t === "connect") {
        // Build SSH config from session or direct payload
        const cfg = await buildConnectConfig(data, payload);
        if (!cfg) {
          ws.send(JSON.stringify({ type: "ssh-error", error: "Invalid session or connect params" }));
          return;
        }

        // Create SSH connection
        const sshClient = new Client();
        data.sshClient = sshClient;

        sshClient.on("ready", () => {
          ws.send(JSON.stringify({ type: "ssh-status", status: "connected", sessionId: data.sessionId }));
          sshClient.shell({ term: "xterm-256color" }, (err, stream) => {
             if (err) {
               ws.send(JSON.stringify({ type: "ssh-error", error: String((err as Error).message || err) }));
               return;
             }
             data.sshStream = stream;

             stream.on("data", (buf: Buffer) => {
               // Forward output to client as text
               ws.send(buf.toString());
             });

             stream.stderr.on("data", (buf: Buffer) => {
               ws.send(buf.toString());
             });

             stream.on("close", async () => {
               ws.send(JSON.stringify({ type: "ssh-status", status: "disconnected", sessionId: data.sessionId }));
               try {
                 if (data.sessionId) await endSession(data.sessionId);
               } catch {}
             });
           });
        });

        sshClient.on("error", async (err) => {
          ws.send(JSON.stringify({ type: "ssh-error", error: String((err as Error).message || err) }));
          try {
            if (data.sessionId) await endSession(data.sessionId);
          } catch {}
        });

        sshClient.on("end", async () => {
          ws.send(JSON.stringify({ type: "ssh-status", status: "disconnected", sessionId: data.sessionId }));
          try {
            if (data.sessionId) await endSession(data.sessionId);
          } catch {}
        });

        // Activate/bind session if present
        if (data.sessionId && data.socketId) {
          try {
            await activateSession(data.sessionId, data.socketId);
          } catch {}
        }

        // Connect
        try {
          sshClient.connect(cfg);
        } catch (err) {
          ws.send(JSON.stringify({ type: "ssh-error", error: String((err as Error).message || err) }));
        }

        return;
      }

      if (t === "input") {
        if (data.sshStream) {
          const str = String(payload.data || "");
          data.sshStream.write(str);
        }
        return;
      }

      if (t === "resize") {
        if (data.sshStream) {
          const cols = Number(payload.cols || 80);
          const rows = Number(payload.rows || 24);
          data.sshStream.setWindow(rows, cols);
        }
        return;
      }

      if (t === "disconnect") {
        if (data.sshStream) data.sshStream.end();
        if (data.sshClient) data.sshClient.end();
        try {
          if (data.sessionId) await endSession(data.sessionId);
        } catch {}
        ws.send(JSON.stringify({ type: "ssh-status", status: "disconnected", sessionId: data.sessionId }));
        return;
      }

      if (t === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
    },

    async close(ws: ServerWebSocket<WsData>) {
      const data = ws.data;
      try {
        if (data.sshStream) data.sshStream.end();
        if (data.sshClient) data.sshClient.end();
      } catch {}
      try {
        if (data.sessionId) await endSession(data.sessionId);
      } catch {}
    },
  };

  return websocket;
}