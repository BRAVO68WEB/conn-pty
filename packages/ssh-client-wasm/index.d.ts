// Auto-generated TypeScript declarations for the WASM SSH client
export interface SshClientOptions {
  ws_url: string;
  username?: string;
  auth_token?: string;
}

export type Packet = string | Uint8Array | ArrayBuffer | unknown;
export type Transform = (data: Packet) => Packet;
export type Hook = (data: Packet) => void | Packet;

export class SshClient {
  constructor(options: SshClientOptions);

  // Built-in WebSocket connect
  connect_websocket(): void;

  // Custom transport: the send/close functions are provided by the caller
  register_custom_transport(send: (data: Packet) => void, close: () => void): void;

  // Hooks and transforms
  set_send_hook(hook: Hook): void;
  set_recv_hook(hook: Hook): void;
  set_transform_out(transform: Transform): void;
  set_transform_in(transform: Transform): void;

  // Incoming data handler for custom transports
  handle_incoming(payload: Packet): void;

  // Event callbacks
  on_output(cb: (text: string) => void): void;
  on_open(cb: () => void): void;
  on_close(cb: () => void): void;
  on_error(cb: () => void): void;

  // Send data
  send_text(data: string): void;
  send_bytes(data: Uint8Array | ArrayBuffer | number[]): void;

  // Terminal
  resize(cols: number, rows: number): void;

  // Authentication API (protocol-agnostic packets)
  set_password_auth(username: string, password: string): void;
  set_private_key_auth(username: string, privateKeyPem: string, passphrase?: string): void;

  // Close
  close(): void;
}