import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal as XTerminal } from '@xterm/xterm';
import type { ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/lib/utils';

interface TerminalProps {
  sessionId: string;
  className?: string;
}

type SSHStatusPayload = { status?: 'connected' | 'disconnected'; sessionId?: string };
type SSHErrorPayload = { error?: string };

// Utilities to read CSS vars and build a cohesive xterm theme from brand palette
function parseHslTriplet(triplet: string): { h: number; s: number; l: number } | null {
  if (!triplet) return null;
  // expected like: "64 13% 14%"
  const m = triplet.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) {
  // s, l as 0-100
  const s1 = s / 100;
  const l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= h && h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (60 <= h && h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (120 <= h && h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (180 <= h && h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (240 <= h && h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return { r, g, b };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslTripletToHex(triplet: string, fallback: string) {
  const parsed = parseHslTriplet(triplet);
  if (!parsed) return fallback;
  return rgbToHex(hslToRgb(parsed));
}

function adjustLightness(triplet: string, delta: number, fallback: string) {
  const parsed = parseHslTriplet(triplet);
  if (!parsed) return fallback;
  const l = Math.max(0, Math.min(100, parsed.l + delta));
  return rgbToHex(hslToRgb({ h: parsed.h, s: parsed.s, l }));
}

function hexMix(a: string, b: string, weight = 0.5) {
  // weight toward a (0..1)
  const hexToRgb = (hex: string) => {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return { r, g, b };
  };
  const ar = hexToRgb(a), br = hexToRgb(b);
  const r = Math.round(ar.r * weight + br.r * (1 - weight));
  const g = Math.round(ar.g * weight + br.g * (1 - weight));
  const b2 = Math.round(ar.b * weight + br.b * (1 - weight));
  return rgbToHex({ r, g, b: b2 });
}

function getBrandTheme(): ITheme {
  // const cs = getComputedStyle(document.documentElement);
  const bgTriplet = '212,82%,9%'; // #041529
  const fgTriplet = '0 0% 100%'; // #ffffff
  const primaryTriplet = '68 100% 50%'; // #e5fe00

  const background = hslTripletToHex(bgTriplet, '#0b0b0b');
  const foreground = hslTripletToHex(fgTriplet, '#e5e5e5');
  const primary = hslTripletToHex(primaryTriplet, '#e5fe00');

  // Derive a tasteful ANSI palette based on brand hues
  const black = adjustLightness(bgTriplet, -2, '#1a1a1a');
  const brightBlack = adjustLightness(bgTriplet, 5, '#2a6a2a');

  // Use primary-derived yellow for yellow tones
  const yellow = primary;
  const brightYellow = adjustLightness(primaryTriplet, 10, '#fff34d');

  // Complementary accent set
  const red = '#ff5d5d';
  const brightRed = '#ff8787';
  const green = '#7bd88f';
  const brightGreen = '#a2f5b3';
  const blue = '#6ea8ff';
  const brightBlue = '#98c1ff';
  const magenta = '#c792ea';
  const brightMagenta = '#e1b8ff';
  const cyan = '#7fdbff';
  const brightCyan = '#b3ecff';
  const white = '#d0d0d0';
  const brightWhite = '#ffffff';

  const selectionBackground = hexMix(primary, background, 0.35);
  const cursor = primary;
  const cursorAccent = background;

  return {
    background,
    foreground,
    cursor,
    cursorAccent,
    selectionBackground,
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    brightBlack,
    brightRed,
    brightGreen,
    brightYellow,
    brightBlue,
    brightMagenta,
    brightCyan,
    brightWhite,
  } as ITheme;
}

export function Terminal({ sessionId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const moRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize terminal with dynamic, brand-aligned theme
    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "ui-monospace, Menlo, Monaco, 'MesloLGS NF', 'Fira Code', 'JetBrains Mono', monospace",
      theme: getBrandTheme(),
      allowTransparency: true,
      letterSpacing: 0,
      lineHeight: 1.1,
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Keep theme in sync if the app toggles themes (e.g., class changes on <html>)
    moRef.current = new MutationObserver(() => {
      const nextTheme: ITheme = getBrandTheme();
      term.options.theme = nextTheme;
    });
    moRef.current.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Connect Socket.IO
    const socket = io('/', {
      // Send session id on connection
      auth: { session_id: sessionId },
      transports: ['websocket'],
      path: '/socket.io',
      withCredentials: false,
    });

    socketRef.current = socket;

    const writeStatus = (msg: string) => term.writeln(`\x1b[90m${msg}\x1b[0m`);

    socket.on('connect', () => {
      writeStatus('Socket connected. Establishing SSH...');
      socket.emit('ssh-connect', {});
    });

    socket.on('ssh-status', (payload: SSHStatusPayload) => {
      if (payload?.status === 'connected') {
        writeStatus('SSH connected.');
      } else if (payload?.status === 'disconnected') {
        writeStatus('SSH disconnected.');
      }
    });

    socket.on('ssh-data', (data: string) => {
      term.write(data);
    });

    socket.on('ssh-error', (payload: SSHErrorPayload) => {
      writeStatus(`Error: ${payload?.error || 'Unknown error'}`);
    });

    socket.on('disconnect', () => {
      writeStatus('Socket disconnected.');
    });

    // Relay keyboard input
    term.onData((data) => {
      socket.emit('ssh-input', data);
    });

    // Fit on container resize (more reliable than only window resize)
    const onResize = () => {
      fit.fit();
      socket.emit('ssh-resize', { cols: term.cols, rows: term.rows });
    };
    roRef.current = new ResizeObserver(onResize);
    roRef.current.observe(containerRef.current);
    window.addEventListener('resize', onResize);

    // Initial status
    writeStatus(`Session ID: ${sessionId}`);

    return () => {
      window.removeEventListener('resize', onResize);
      roRef.current?.disconnect();
      moRef.current?.disconnect();
      socket.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full bg-background text-foreground rounded-md border overflow-hidden shadow-sm border-transparent',
        className,
      )}
    />
  );
}