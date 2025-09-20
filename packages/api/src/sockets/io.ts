import { Server as Engine } from "@socket.io/bun-engine";
import { Server } from "socket.io";
import { Client, ConnectConfig } from "ssh2";
import { getSession, activateSession, endSession } from "../services/sessions.js";
import { getServer } from "../services/servers.js";
import { getCredential } from "../services/credentials.js";

const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

const engine = new Engine({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.bind(engine);

io.on("connection", async (socket) => {
  console.log('Client connected:', socket.id);

  // Debug handshake
  try {
    console.log('Handshake keys:', Object.keys(socket.handshake || {}));
    console.log('Handshake.query:', socket.handshake?.query);
    console.log('Handshake.auth:', (socket.handshake as any)?.auth);
    console.log('Handshake.headers:', (socket.handshake as any)?.headers);
  } catch {}

  // Determine session_id from handshake query or auth
  const q = socket.handshake.query as Record<string, unknown> | undefined;
  const auth = (socket.handshake).auth as Record<string, unknown> | undefined;
  let sessionId = (
    (q?.session_id as string) ||
    (q?.sessionId as string) ||
    (auth?.session_id as string) ||
    (auth?.sessionId as string) ||
    ''
  );
  
  console.log('Session ID from handshake:', sessionId);

  if (!sessionId) {
    console.error('Session ID not provided in handshake');
    socket.emit('ssh-error', { error: 'Session ID is required' });
    socket.disconnect();
    return;
  }

  // Validate session exists and is not ended
  const session = await getSession(sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    socket.emit('ssh-error', { error: 'Session not found' });
    socket.disconnect();
    return;
  }

  if (session.status === 'ended') {
    console.error('Session has already ended:', sessionId);
    socket.emit('ssh-error', { error: 'Session is not available for connection' });
    socket.disconnect();
    return;
  }

  // Activate or re-bind the session to this socket
  try {
    await activateSession(sessionId, socket.id);
    console.log('Session activated/bound:', sessionId);
  } catch (error) {
    console.error('Failed to activate session:', error);
    socket.emit('ssh-error', { error: 'Failed to activate session' });
    socket.disconnect();
    return;
  }
  
  let sshClient: Client | null = null;
  let sshStream: any = null;

  // Handle SSH connection request
  socket.on('ssh-connect', async (connectionData) => {
    try {
      // Get updated session data to access server information
      const currentSession = await getSession(sessionId);
      if (!currentSession) {
        socket.emit('ssh-error', { error: 'Session not found' });
        return;
      }

      const sessionData = await getSession(sessionId);

      if (!sessionData || sessionData.status == "ended") {
        socket.emit('ssh-error', { error: 'Server configuration not available' });
        return;
      }

      const serverData = await getServer(sessionData.server_id);
      if (!serverData) {
        socket.emit('ssh-error', { error: 'Server not found' });
        return;
      }

      const credentialData = await getCredential(serverData.cred_id);
      if (!credentialData) {
        socket.emit('ssh-error', { error: 'Credential not found' });
        return;
      }

      const config : ConnectConfig = {
        host: serverData.host,
        port: parseInt(serverData.port.toString()),
        username: serverData.user,
      } 

      if (credentialData.type === "password") {
        config.password = credentialData.password;
      } else if (credentialData.type === "private_key") {
        config.privateKey = credentialData.private_key;
      } else if (credentialData.type === "private_key_with_passphrase") {
        config.privateKey = credentialData.private_key;
        config.passphrase = credentialData.passphrase;
      }

      sshClient = new Client();
      
      sshClient.on('ready', () => {
        console.log('SSH connection established for session:', sessionId);
        socket.emit('ssh-status', { status: 'connected', sessionId });
        
        // Create shell session
        sshClient!.shell((err, stream) => {
          if (err) {
            console.error('Shell creation error:', err);
            socket.emit('ssh-error', { error: (err as Error).message });
            return;
          }
          
          sshStream = stream;
          
          // Handle data from SSH server
          stream.on('data', (data: Buffer) => {
            socket.emit('ssh-data', data.toString());
          });
          
          stream.on('close', async () => {
            console.log('SSH stream closed for session:', sessionId);
            socket.emit('ssh-status', { status: 'disconnected', sessionId });
            
            // End the session when SSH stream closes
            try {
              await endSession(sessionId);
            } catch (error) {
              console.error('Failed to end session:', error);
            }
          });
          
          stream.stderr.on('data', (data: Buffer) => {
            socket.emit('ssh-data', data.toString());
          });
        });
      });
      
      sshClient.on('error', async (err) => {
        console.error('SSH connection error for session:', sessionId, err);
        socket.emit('ssh-error', { error: (err as Error).message });
        
        // End the session on SSH error
        try {
          await endSession(sessionId);
        } catch (error) {
          console.error('Failed to end session:', error);
        }
      });
      
      sshClient.on('end', async () => {
        console.log('SSH connection ended for session:', sessionId);
        socket.emit('ssh-status', { status: 'disconnected', sessionId });
        
        // End the session when SSH connection ends
        try {
          await endSession(sessionId);
        } catch (error) {
          console.error('Failed to end session:', error);
        }
      });

      // Connect to SSH server
      sshClient.connect(config);
    } catch (error) {
      console.error('Error in ssh-connect handler:', error);
      socket.emit('ssh-error', { error: 'Failed to establish SSH connection' });
    }
  });
  
  // Handle terminal input from client
  socket.on('ssh-input', (data: string) => {
    if (sshStream) {
      sshStream.write(data);
    }
  });
  
  // Handle terminal resize
  socket.on('ssh-resize', (dimensions: { cols: number; rows: number }) => {
    if (sshStream) {
      sshStream.setWindow(dimensions.rows, dimensions.cols);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id, 'Session:', sessionId);
    
    // Clean up SSH connections
    if (sshStream) {
      sshStream.end();
    }
    if (sshClient) {
      sshClient.end();
    }
    
    // End the session
    try {
      await endSession(sessionId);
      console.log('Session ended on disconnect:', sessionId);
    } catch (error) {
      console.error('Failed to end session on disconnect:', error);
    }
  });
  
  // Handle manual SSH disconnect
  socket.on('ssh-disconnect', async () => {
    if (sshStream) {
      sshStream.end();
    }
    if (sshClient) {
      sshClient.end();
    }
    
    // End the session
    try {
      await endSession(sessionId);
      console.log('Session ended on manual disconnect:', sessionId);
    } catch (error) {
      console.error('Failed to end session on manual disconnect:', error);
    }
    
    socket.emit('ssh-status', { status: 'disconnected', sessionId });
  });
});

export { engine }