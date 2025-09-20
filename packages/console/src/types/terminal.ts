export interface TerminalMethods {
  connect: () => void;
  disconnect: () => void;
  clear: () => void;
  fit: () => void;
  isConnected: boolean;
  sshConnected: boolean;
}

export interface TerminalElement extends HTMLDivElement {
  terminalMethods?: TerminalMethods;
}