import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Terminal as XTerminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { SshClient } from '@conn-pty/ssh-client-wasm';
import { AnimatePresence, motion } from 'framer-motion';

// WASM SSH client
let WasmSshClient: { new(opts: { ws_url: string }): SshClient } | null = null;

// wasm-pack's default export is an init function that returns a Promise of the wasm instance
type WasmInitFn = (module_or_path?: unknown) => Promise<unknown>;

(async () => {
  try {
    const mod = await import('@conn-pty/ssh-client-wasm');
    const initFn = (mod as { default?: WasmInitFn }).default;
    if (typeof initFn === 'function') {
      await initFn();
    }
    WasmSshClient = (mod as { SshClient?: { new(opts: { ws_url: string }): SshClient } }).SshClient || null;
    console.log('WASM SSH client loaded successfully');
  } catch (e) {
    console.warn('WASM SSH client failed to load, falling back to raw WS', e);
  }
})();

function brandTheme(): ITheme {
  return {
    background: '#0a0f1a',
    foreground: '#eaeaea',
    cursor: '#e5fe00',
    cursorAccent: '#0a0f1a',
    selectionBackground: '#2a2a2a',
    black: '#1e1e1e',
    red: '#ff5d5d',
    green: '#7bd88f',
    yellow: '#e5fe00',
    blue: '#6ea8ff',
    magenta: '#c792ea',
    cyan: '#7fdbff',
    white: '#d0d0d0',
    brightBlack: '#3a3a3a',
    brightRed: '#ff8787',
    brightGreen: '#a2f5b3',
    brightYellow: '#fff34d',
    brightBlue: '#98c1ff',
    brightMagenta: '#e1b8ff',
    brightCyan: '#b3ecff',
    brightWhite: '#ffffff',
  } as ITheme;
}

type ConnectPayload = {
  type: 'connect';
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export default function SSHDirect() {
  const [wsUrl, setWsUrl] = useState<string>(
    import.meta.env?.VITE_WS_URL ?? 'ws://localhost:3000/ws/ssh'  
  );
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState<number>(22);
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [outputLog, setOutputLog] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const wasmClientRef = useRef<{
    send_text: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    close: () => void;
    on_output: (cb: (text: string) => void) => void;
    on_open: (cb: () => void) => void;
    on_close: (cb: () => void) => void;
    on_error: (cb: () => void) => void;
    connect_websocket: () => void;
  } | null>(null);

  const connectionPayload = useMemo<ConnectPayload>(() => {
    const payload: ConnectPayload = {
      type: 'connect',
      host,
      port,
      username,
    };
    if (password) payload.password = password;
    if (privateKey) payload.privateKey = privateKey;
    if (passphrase) payload.passphrase = passphrase;
    return payload;
  }, [host, port, username, password, privateKey, passphrase]);

  // Connection status label and dot color
  const statusLabel = connecting ? 'Connecting…' : connected ? 'Connected' : 'Disconnected';
  const statusDot = connecting ? 'bg-yellow-400' : connected ? 'bg-green-500' : 'bg-red-500';

  useEffect(() => {
    // init xterm once
    if (!containerRef.current || termRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily:
        "ui-monospace, Menlo, Monaco, 'MesloLGS NF', 'Fira Code', 'JetBrains Mono', monospace",
      allowTransparency: true,
      theme: brandTheme(),
      lineHeight: 1.1,
      letterSpacing: 0,
      convertEol: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    termRef.current = term;
    fitRef.current = fit;

    term.onData((d) => {
      // send input to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: d }));
      }
      // send via WASM client if active
      if (wasmClientRef.current) {
        try {
          wasmClientRef.current.send_text(JSON.stringify({ type: 'input', data: d }));
        } catch {
          // no-op
        }
      }
    });

    // open and fit after next frame to avoid zero-dimension container
    term.open(containerRef.current);
    requestAnimationFrame(() => {
      fit.fit();
      const cols = term.cols;
      const rows = term.rows;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
      if (wasmClientRef.current) {
        try { wasmClientRef.current.resize(cols, rows); } catch { /* no-op */ }
      }
    });

    // observe size
    const onResize = () => {
      fit.fit();
      const cols = term.cols;
      const rows = term.rows;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'resize', cols, rows })
        );
      }
      if (wasmClientRef.current) {
        try { wasmClientRef.current.resize(cols, rows); } catch {
          // no-op
        }
      }
    };
    roRef.current = new ResizeObserver(onResize);
    roRef.current.observe(containerRef.current);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      roRef.current?.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [connected]);

  const log = (s: string) => {
    setOutputLog((prev) => prev + s + '\n');
    termRef.current?.writeln(`\x1b[90m${s}\x1b[0m`);
  };

  const connectRawWs = () => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnecting(false);
      setConnected(true);
      log('WS connected, sending SSH connect request...');
      ws.send(JSON.stringify(connectionPayload));
      const t = termRef.current;
      if (t) {
        ws.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
      }
    };

    ws.onmessage = (ev) => {
      const data = ev.data;
      if (typeof data === 'string') {
        // could be JSON control or plain text stream
        try {
          const payload = JSON.parse(data) as { type?: string; status?: 'connected' | 'disconnected'; error?: string };
          if (payload?.type === 'ssh-status') {
            if (payload.status === 'connected') log('SSH connected.');
            if (payload.status === 'disconnected') log('SSH disconnected.');
            return;
          }
          if (payload?.type === 'ssh-error') {
            log(`Error: ${payload.error}`);
            return;
          }
          if (payload?.type === 'pong') {
            return;
          }
          // unknown JSON -> log
          log(String(data));
          return;
        } catch {
          termRef.current?.write(data);
          return;
        }
      }
      if (data instanceof ArrayBuffer) {
        termRef.current?.write(new TextDecoder().decode(new Uint8Array(data)));
      }
    };

    ws.onerror = () => {
      setConnecting(false);
      log('WebSocket error.');
    };

    ws.onclose = () => {
      setConnected(false);
      log('WS closed.');
    };
  };

  const connectWasm = async () => {
    if (!WasmSshClient) {
      connectRawWs();
      return;
    }
    try {
      const client = new WasmSshClient({ ws_url: wsUrl });
      wasmClientRef.current = client;

      // translate output into xterm writes
      client.on_output((text: string) => {
        try {
          const payload = JSON.parse(text) as { type?: string; status?: 'connected' | 'disconnected'; error?: string };
          if (payload?.type === 'ssh-status') {
            if (payload.status === 'connected') log('SSH connected.');
            if (payload.status === 'disconnected') log('SSH disconnected.');
            return;
          }
          if (payload?.type === 'ssh-error') {
            log(`Error: ${payload.error}`);
            return;
          }
          if (payload?.type === 'pong') {
            return;
          }
          log(text);
          return;
        } catch {
          termRef.current?.write(text);
        }
      });

      client.on_open(() => {
        setConnecting(false);
        setConnected(true);
        log('WASM WS connected, sending SSH connect request...');
        client.send_text(JSON.stringify(connectionPayload));
        const t = termRef.current;
        if (t) {
          client.resize(t.cols, t.rows);
        } else {
          setTimeout(() => {
            const tt = termRef.current;
            if (tt) client.resize(tt.cols, tt.rows);
          }, 50);
        }
      });

      client.on_close(() => {
        setConnected(false);
        log('WASM WS closed.');
      });

      client.on_error(() => {
        setConnecting(false);
        log('WASM WebSocket error.');
      });

      client.connect_websocket();
    } catch (err) {
      log('Failed to initialize WASM SSH client, falling back to raw WS.');
      connectRawWs();
    }
  };

  const handleConnect = () => {
    if (!termRef.current) return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    try { wasmClientRef.current?.close(); } catch {
      // no-op
    }
    wasmClientRef.current = null;

    setConnecting(true);
    void connectWasm();
  };

  const handleDisconnect = () => {
    wsRef.current?.send(JSON.stringify({ type: 'disconnect' }));
    wsRef.current?.close();
    try { wasmClientRef.current?.send_text(JSON.stringify({ type: 'disconnect' })); } catch {
      // no-op
    }
    try { wasmClientRef.current?.close(); } catch {
      // no-op
    }
    setConnected(false);
  };

  const handleClear = () => {
    termRef.current?.clear();
    setOutputLog('');
  };

  return (
    <div className="p-4 h-[calc(100vh-2rem)] flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Direct SSH (WASM-enabled)</CardTitle>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <span className={cn('inline-block w-2 h-2 rounded-full', statusDot, connecting && 'animate-pulse')} />
              <span>{statusLabel}</span>
              <span className="mx-2 text-muted-foreground">•</span>
              <span className="font-mono">{host}:{port}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleConnect} disabled={connecting || connected}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
            <Button variant="secondary" onClick={handleDisconnect} disabled={!connected}>Disconnect</Button>
            <Button variant="outline" onClick={handleClear}>Clear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence initial={false}>
            {!connected && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
              >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="ws">WS URL</Label>
                    <Input id="ws" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="ws://localhost:3000/ws/ssh" />
                  </div>
                  <div>
                    <Label htmlFor="host">Host</Label>
                    <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.10" />
                  </div>
                  <div>
                    <Label htmlFor="port">Port</Label>
                    <Input id="port" type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value || '22', 10))} />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="optional if using key" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="privateKey">Private Key (PEM)</Label>
                      <Textarea id="privateKey" rows={4} value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
                    </div>
                    <div>
                      <Label htmlFor="passphrase">Passphrase</Label>
                      <Input id="passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="if key is encrypted" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <AnimatePresence>
        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="flex-1 min-h-[300px]">
              <CardContent className="p-2 h-full">
                <div
                  ref={containerRef}
                  className={cn('w-full h-full bg-background rounded-md border overflow-hidden shadow-sm')}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {connected && (
        <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
          {outputLog}
        </div>
      )}
    </div>
  );
}