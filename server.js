import express from 'express';
import { default as makeWASocket, delay, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ═════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES
// ═════════════════════════════════════════════════════════════════
let socket = null;
let socketInitializing = false;
const socketReady = { ready: false };

// Logger configuration
const logger = pino({ level: 'silent' });

// Session path setup
const sessionPath = path.join(__dirname, 'session');

// ═════════════════════════════════════════════════════════════════
// ENSURE SESSION DIRECTORY EXISTS
// ═════════════════════════════════════════════════════════════════
async function ensureSessionDirectory() {
  try {
    await fs.mkdir(sessionPath, { recursive: true });
    console.log(`📁 Session directory ready: ${sessionPath}`);
    return true;
  } catch (error) {
    console.error('⚠️ Failed to create session directory:', error.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// INITIALIZE WHATSAPP SOCKET WITH PROPER CONNECTION HANDLING
// ═════════════════════════════════════════════════════════════════
async function initializeSocket() {
  if (socket && socketReady.ready) {
    console.log('🔄 Socket already ready, skipping re-initialization');
    return socket;
  }

  if (socketInitializing) {
    console.log('⏳ Socket initialization already in progress...');
    return null;
  }

  socketInitializing = true;
  console.log('🚀 Initializing WhatsApp socket...');

  try {
    // Load or create authentication state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    console.log('🔐 Auth state loaded');

    // Create socket with optimized config
    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger,
      browser: ['MIRA-BOT', 'Chrome', '125.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      emitOwnEventsOnReceive: false,
      shouldCacheMessages: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 100,
      maxRetries: 3,
      version: [2, 2333, 8]
    });

    console.log('✅ Socket created');

    // Save credentials when updated
    socket.ev.on('creds.update', saveCreds);

    // Track connection state
    let connectionTimeout;

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'connecting') {
        console.log('🔌 Connecting to WhatsApp...');
        // Reset timeout on each connection attempt
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionTimeout = setTimeout(() => {
          if (!socketReady.ready) {
            console.log('⏱️ Connection attempt timeout');
            socket.end(new Error('Connection timeout'));
          }
        }, 30000);
      }

      if (connection === 'open') {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        socketReady.ready = true;
        socketInitializing = false;
        console.log('🟢 WhatsApp socket connected!');
        if (socket.user && socket.user.id) {
          console.log(`👤 User: ${socket.user.id}`);
        }
      }

      if (connection === 'close') {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        socketReady.ready = false;
        
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log('🔄 Reconnecting...');
          socket = null;
          socketInitializing = false;
        } else {
          console.log('❌ Logged out');
          socket = null;
          socketInitializing = false;
        }
      }

      if (qr) {
        console.log('📲 QR Code available');
      }
    });

    // Handle errors
    socket.ev.on('connection.error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    console.log('📡 Event listeners registered');

  } catch (error) {
    socketInitializing = false;
    console.error('❌ Socket error:', error.message);
    socket = null;
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════
// WAIT FOR SOCKET READY
// ═════════════════════════════════════════════════════════════════
async function waitForSocketReady(maxWait = 90000) {
  const startTime = Date.now();
  
  while (!socketReady.ready && (Date.now() - startTime) < maxWait) {
    await delay(500);
  }
  
  return socketReady.ready;
}

// ═════════════════════════════════════════════════════════════════
// FRONTEND - STATUS UI
// ═════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MIRA-BOT-V1 • Code de Pairage</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --gradient-btn: linear-gradient(135deg, #5b7fff 0%, #9053cd 100%);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #090d1a;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(91, 127, 255, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(144, 83, 205, 0.15) 0%, transparent 45%);
          color: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }

        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 40px 30px;
          border-radius: 28px;
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .icon-container {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, rgba(91, 127, 255, 0.3) 0%, rgba(144, 83, 205, 0.3) 100%);
          border-radius: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 0 auto 25px;
          box-shadow: 0 8px 20px rgba(144, 83, 205, 0.2);
        }

        .icon-container svg {
          width: 32px;
          height: 32px;
          fill: none;
          stroke: #c8a2ff;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        h1 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #fff 60%, #dcd0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 14px;
          color: #7e8ca4;
          margin-bottom: 25px;
        }

        .status-box {
          padding: 12px 16px;
          background: rgba(91, 127, 255, 0.1);
          border: 1px solid rgba(91, 127, 255, 0.3);
          border-radius: 12px;
          font-size: 12px;
          color: #a4b3cd;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fbbf24;
          animation: pulse 2s infinite;
        }

        .status-dot.ready {
          background: #4ade80;
          animation: none;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .input-label {
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #8fa0be;
          margin-bottom: 8px;
          display: block;
          padding-left: 4px;
        }

        input {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: #fff;
          font-size: 16px;
          margin-bottom: 16px;
          transition: 0.3s;
        }

        input:focus {
          outline: none;
          border-color: #8063f5;
          background: rgba(255, 255, 255, 0.07);
          box-shadow: 0 0 15px rgba(128, 99, 245, 0.2);
        }

        button {
          width: 100%;
          padding: 16px;
          background: var(--gradient-btn);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          transition: 0.3s;
          box-shadow: 0 10px 20px rgba(114, 107, 243, 0.2);
          margin-bottom: 15px;
        }

        button:hover:not(:disabled) {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .result-box {
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 20px;
          font-size: 14px;
          color: #a4b3cd;
          background: rgba(0, 0, 0, 0.1);
          min-height: 50px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .code-output {
          font-size: 36px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 4px;
          margin: 12px 0;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
          font-family: 'Courier New', monospace;
        }

        .loader {
          display: none;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-container">
          <svg viewBox="0 0 24 24">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </div>

        <h1>MIRA-BOT-V1</h1>
        <div class="subtitle">Générateur de Code de Pairage WhatsApp</div>

        <div class="status-box">
          <div class="status-dot" id="statusDot"></div>
          <span id="statusLabel">Initialisation...</span>
        </div>

        <form id="pairingForm">
          <label class="input-label">Numéro de téléphone</label>
          <input type="text" id="phoneNumber" placeholder="25766486303" required>
          
          <button type="submit" id="submitBtn" disabled>
            <svg style="width:18px; height:18px; fill:currentColor;" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span id="btnText">Générer le Code</span>
          </button>
        </form>

        <div class="result-box" id="resultBox">
          <div class="loader" id="loader"></div>
          <span id="statusText">En attente du service...</span>
        </div>
      </div>

      <script>
        async function checkStatus() {
          try {
            const response = await fetch('/health');
            const data = await response.json();
            const dot = document.getElementById('statusDot');
            const label = document.getElementById('statusLabel');
            const btn = document.getElementById('submitBtn');
            
            if (data.socketReady) {
              dot.classList.add('ready');
              label.textContent = '✅ Service prêt';
              btn.disabled = false;
              document.getElementById('statusText').textContent = 'Entrez votre numéro';
            } else {
              dot.classList.remove('ready');
              label.textContent = data.socketInitializing ? '🔌 Connexion...' : '⏳ En attente...';
              btn.disabled = true;
            }
          } catch (err) {
            document.getElementById('statusLabel').textContent = '❌ Erreur serveur';
          }
        }

        checkStatus();
        setInterval(checkStatus, 2000);

        document.getElementById('pairingForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const num = document.getElementById('phoneNumber').value.replace(/[^0-9]/g, '');
          if (!num || num.length < 10) {
            document.getElementById('statusText').innerHTML = '<span style="color: #ff5b5b;">Numéro invalide!</span>';
            return;
          }

          document.getElementById('submitBtn').disabled = true;
          document.getElementById('loader').style.display = 'block';
          document.getElementById('statusText').style.display = 'none';
          document.getElementById('btnText').textContent = 'Génération...';

          try {
            const response = await fetch('/pair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: num })
            });
            const data = await response.json();

            document.getElementById('loader').style.display = 'none';
            document.getElementById('statusText').style.display = 'block';
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('btnText').textContent = 'Générer le Code';

            if (data.code) {
              const resultBox = document.getElementById('resultBox');
              resultBox.style.borderColor = 'rgba(144, 83, 205, 0.5)';
              document.getElementById('statusText').innerHTML = \`
                <span style="color: #a4b3cd; font-size: 11px;">CODE DE PAIRAGE:</span>
                <div class="code-output">\${data.code}</div>
                <span style="font-size: 11px; margin-top: 8px;">Entrez ce code dans WhatsApp</span>
              \`;
            } else {
              document.getElementById('statusText').innerHTML = '<span style="color: #ff5b5b;">' + (data.error || 'Erreur') + '</span>';
            }
          } catch (err) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('statusText').style.display = 'block';
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('btnText').textContent = 'Générer le Code';
            document.getElementById('statusText').innerHTML = '<span style="color: #ff5b5b;">Erreur de connexion</span>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// ═════════════════════════════════════════════════════════════════
// PAIRING CODE ENDPOINT
// ═════════════════════════════════════════════════════════════════
app.post('/pair', async (req, res) => {
  const phoneNumber = req.body.number;

  if (!phoneNumber || !/^\d{10,}$/.test(phoneNumber)) {
    return res.json({ error: 'Numéro invalide' });
  }

  console.log(`\n📱 Pairing request: ${phoneNumber}`);

  try {
    // Initialize socket if needed
    if (!socket) {
      console.log('→ Socket nécessaire, initialisation...');
      await initializeSocket();
    }

    // Wait for connection (max 90 seconds)
    console.log('→ Attente connexion WhatsApp...');
    const isReady = await waitForSocketReady(90000);

    if (!isReady) {
      console.log('✗ Socket non prêt après 90s');
      return res.json({ error: 'WhatsApp n\'a pas répondu. Vérifiez votre connexion Internet.' });
    }

    console.log('→ Socket connecté, demande du code...');

    // Request pairing code
    let pairingCode;
    try {
      pairingCode = await socket.requestPairingCode(phoneNumber);
    } catch (err) {
      console.error('✗ Code error:', err.message);
      return res.json({ error: 'Impossible de générer le code. Réessayez.' });
    }

    console.log(`✓ Code généré: ${pairingCode}\n`);

    // Return code immediately
    res.json({ code: pairingCode });

    // Handle post-pairing connection in background
    setTimeout(() => {
      const handlePostConnection = (update) => {
        const { connection } = update;
        
        if (connection === 'open') {
          console.log('→ Utilisateur connecté, envoi confirmation...');
          socket.ev.removeListener('connection.update', handlePostConnection);
          
          try {
            const sessionId = Buffer.from(
              JSON.stringify({
                phoneNumber: socket.user?.id || 'unknown',
                timestamp: new Date().toISOString(),
                bot: 'MIRA-BOT-V1'
              })
            ).toString('base64');

            const msg = `╭───────────────────⬣
│ 🤖 *MIRA BOT V1*
│ 
│ ✅ Connexion Réussie
│ Session ID:
│ \`\`\`
│ ${sessionId}
│ \`\`\`
│ 
│ 📱 WhatsApp Linked Device
│ ⚡ Système Opérationnel
╰───────────────────⬣`;

            socket.sendMessage(socket.user.id, { text: msg })
              .then(() => console.log('✓ Confirmation envoyée\n'))
              .catch(e => console.error('⚠ Envoi failed:', e.message));
          } catch (error) {
            console.error('⚠ Erreur confirmation:', error.message);
          }
        }
      };

      socket.ev.on('connection.update', handlePostConnection);
      
      setTimeout(() => {
        socket.ev.removeListener('connection.update', handlePostConnection);
      }, 120000);
    }, 100);

  } catch (error) {
    console.error('✗ Erreur:', error.message);
    res.json({ error: 'Erreur du service. Réessayez.' });
  }
});

// ═════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    socketReady: socketReady.ready,
    socketInitializing: socketInitializing,
    uptime: process.uptime()
  });
});

// ═════════════════════════════════════════════════════════════════
// START SERVER
// ═════════════════════════════════════════════════════════════════
async function startServer() {
  try {
    await ensureSessionDirectory();

    app.listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║  🚀 MIRA-BOT-V1 DÉMARRÉ');
      console.log(`║  🌐 Port: ${PORT}`);
      console.log('║  📱 WhatsApp Pairing System');
      console.log('║  💾 Session: ./session');
      console.log('╚════════════════════════════════════════╝\n');
    });

    // Start socket initialization
    initializeSocket().catch(err => {
      console.error('⚠ Socket init failed:', err.message);
    });

  } catch (error) {
    console.error('❌ Fatal:', error.message);
    process.exit(1);
  }
}

startServer();

// ═════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═════════════════════════════════════════════════════════════════
process.on('SIGTERM', () => {
  console.log('\n📛 Shutdown signal');
  if (socket) socket.end(new Error('Server stopping'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📛 Interrupt signal');
  if (socket) socket.end(new Error('Server stopping'));
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled:', reason);
});
