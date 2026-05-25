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

// Logger with more details
const logger = pino({ 
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Session path setup
const sessionPath = path.join(__dirname, 'session');

// ═════════════════════════════════════════════════════════════════
// ENSURE SESSION DIRECTORY EXISTS
// ═════════════════════════════════════════════════════════════════
async function ensureSessionDirectory() {
  try {
    await fs.mkdir(sessionPath, { recursive: true });
    console.log(`📁 Session directory: ${sessionPath}`);
    return true;
  } catch (error) {
    console.error('⚠️ Session error:', error.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// INITIALIZE WHATSAPP SOCKET
// ═════════════════════════════════════════════════════════════════
async function initializeSocket() {
  if (socket && socketReady.ready) {
    console.log('✓ Socket already ready');
    return socket;
  }

  if (socketInitializing) {
    console.log('⏳ Socket already initializing...');
    return null;
  }

  socketInitializing = true;
  console.log('\n🚀 Starting socket initialization...');

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    console.log('✓ Auth state loaded');

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['MIRA-BOT', 'Chrome', '125.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      emitOwnEventsOnReceive: false,
      shouldCacheMessages: false,
      generateHighQualityLinkPreview: false,
      retryRequestDelayMs: 100,
      maxRetries: 3
    });

    console.log('✓ Socket created');

    // Auto-save credentials
    socket.ev.on('creds.update', saveCreds);

    // Connection handler
    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('→ QR Code received');
      }

      if (connection === 'connecting') {
        console.log('→ Attempting connection...');
      }

      if (connection === 'open') {
        socketReady.ready = true;
        socketInitializing = false;
        console.log('✓ Socket CONNECTED');
        if (socket.user?.id) {
          console.log(`✓ User: ${socket.user.id}`);
        }
      }

      if (connection === 'close') {
        socketReady.ready = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`→ Connection closed (code: ${code})`);
        
        if (code !== DisconnectReason.loggedOut) {
          console.log('→ Will retry on next request');
          socket = null;
          socketInitializing = false;
        } else {
          console.log('→ Logged out');
          socket = null;
          socketInitializing = false;
        }
      }
    });

    socket.ev.on('connection.error', (error) => {
      console.error('✗ Connection error:', error?.message);
    });

    console.log('✓ Listeners registered\n');

  } catch (error) {
    socketInitializing = false;
    console.error('✗ Init error:', error.message);
    socket = null;
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════
// WAIT FOR SOCKET READY
// ═════════════════════════════════════════════════════════════════
async function waitForSocketReady(maxWait = 90000) {
  const start = Date.now();
  
  while (!socketReady.ready && (Date.now() - start) < maxWait) {
    await delay(500);
  }
  
  return socketReady.ready;
}

// ═════════════════════════════════════════════════════════════════
// FRONTEND
// ═════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MIRA-BOT-V1 • Pairage WhatsApp</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
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
          padding: 40px;
          border-radius: 28px;
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .icon {
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

        h1 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #fff 60%, #dcd0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle { font-size: 14px; color: #7e8ca4; margin-bottom: 25px; }

        .status {
          padding: 12px;
          background: rgba(91, 127, 255, 0.1);
          border: 1px solid rgba(91, 127, 255, 0.3);
          border-radius: 12px;
          font-size: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fbbf24;
          animation: pulse 2s infinite;
        }

        .dot.ready { background: #4ade80; animation: none; }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        label {
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #8fa0be;
          margin-bottom: 8px;
          display: block;
        }

        input {
          width: 100%;
          padding: 16px;
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
          background: linear-gradient(135deg, #5b7fff 0%, #9053cd 100%);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 15px;
          transition: 0.3s;
          box-shadow: 0 10px 20px rgba(114, 107, 243, 0.2);
        }

        button:hover:not(:disabled) { opacity: 0.95; transform: translateY(-1px); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .result {
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

        .code {
          font-size: 36px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 4px;
          margin: 12px 0;
          font-family: monospace;
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

        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg style="width:32px;height:32px;fill:none;stroke:#c8a2ff;stroke-width:2.5" viewBox="0 0 24 24">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </div>

        <h1>MIRA-BOT-V1</h1>
        <div class="subtitle">Code de Pairage WhatsApp</div>

        <div class="status">
          <div class="dot" id="dot"></div>
          <span id="label">Initialisation...</span>
        </div>

        <form id="form">
          <label>Numéro de téléphone</label>
          <input type="tel" id="phone" placeholder="25766486303" required>
          <button type="submit" id="btn" disabled>Générer le Code</button>
        </form>

        <div class="result" id="result">
          <div class="loader" id="loader"></div>
          <span id="text">En attente...</span>
        </div>
      </div>

      <script>
        async function updateStatus() {
          try {
            const res = await fetch('/health');
            const data = await res.json();
            const dot = document.getElementById('dot');
            const label = document.getElementById('label');
            const btn = document.getElementById('btn');
            
            if (data.socketReady) {
              dot.classList.add('ready');
              label.textContent = '✅ Prêt';
              btn.disabled = false;
              document.getElementById('text').textContent = 'Entrez votre numéro';
            } else {
              dot.classList.remove('ready');
              label.textContent = data.socketInitializing ? '🔌 Connexion...' : '⏳ Attente...';
              btn.disabled = true;
            }
          } catch (e) {
            document.getElementById('label').textContent = '❌ Erreur serveur';
          }
        }

        updateStatus();
        setInterval(updateStatus, 2000);

        document.getElementById('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const num = document.getElementById('phone').value.replace(/\\D/g, '');
          
          if (num.length < 10) {
            document.getElementById('text').textContent = '❌ Numéro invalide';
            return;
          }

          document.getElementById('btn').disabled = true;
          document.getElementById('loader').style.display = 'block';
          document.getElementById('text').style.display = 'none';

          try {
            const res = await fetch('/pair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: num })
            });
            const data = await res.json();

            document.getElementById('loader').style.display = 'none';
            document.getElementById('text').style.display = 'block';
            document.getElementById('btn').disabled = false;

            if (data.code) {
              document.getElementById('result').style.borderColor = 'rgba(144, 83, 205, 0.5)';
              document.getElementById('text').innerHTML = \`
                <span style="font-size:11px;color:#a4b3cd">CODE:</span>
                <div class="code">\${data.code}</div>
                <span style="font-size:11px;margin-top:8px">Entrez dans WhatsApp</span>
              \`;
            } else {
              document.getElementById('text').textContent = '❌ ' + (data.error || 'Erreur');
            }
          } catch (err) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('text').style.display = 'block';
            document.getElementById('btn').disabled = false;
            document.getElementById('text').textContent = '❌ Erreur connexion';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// ═════════════════════════════════════════════════════════════════
// PAIRING ENDPOINT
// ═════════════════════════════════════════════════════════════════
app.post('/pair', async (req, res) => {
  const phoneNumber = req.body.number;

  console.log('\n📱 Pairing request:', phoneNumber);

  if (!phoneNumber || !/^\d{10,}$/.test(phoneNumber)) {
    console.log('✗ Invalid number');
    return res.json({ error: 'Numéro invalide' });
  }

  try {
    // Initialize if needed
    if (!socket) {
      console.log('→ Socket needed, initializing...');
      await initializeSocket();
      await delay(1000);
    }

    // Wait for connection
    console.log('→ Waiting for socket to be ready...');
    const ready = await waitForSocketReady(90000);

    if (!ready) {
      console.log('✗ Socket NOT ready after 90s');
      return res.json({ error: 'WhatsApp n\'est pas connecté. Vérifiez Internet.' });
    }

    console.log('✓ Socket ready, requesting pairing code...');

    // Request pairing code
    let code;
    try {
      code = await socket.requestPairingCode(phoneNumber);
    } catch (err) {
      console.error('✗ Code request failed:', err.message);
      return res.json({ error: 'Impossible de générer le code.' });
    }

    console.log('✓ Code generated:', code);

    // Return immediately
    res.json({ code });

    // Send session ID after connection (background)
    setTimeout(() => {
      const handler = (update) => {
        if (update.connection === 'open') {
          console.log('→ User connected, sending session ID...');
          socket.ev.removeListener('connection.update', handler);
          
          try {
            const sessionId = Buffer.from(JSON.stringify({
              phoneNumber: socket.user?.id || 'unknown',
              timestamp: new Date().toISOString(),
              bot: 'MIRA-BOT-V1'
            })).toString('base64');

            socket.sendMessage(socket.user.id, { 
              text: `╭───────────────────⬣
│ 🤖 *MIRA BOT V1*
│ 
│ ✅ Connexion Réussie
│ Session ID:
│ \`\`\`
│ ${sessionId}
│ \`\`\`
│ 
│ 📱 WhatsApp Linked
│ ⚡ Opérationnel
╰───────────────────⬣` 
            }).then(() => console.log('✓ Session ID sent\n'))
              .catch(e => console.error('⚠ Send failed:', e.message));
          } catch (e) {
            console.error('⚠ Error:', e.message);
          }
        }
      };

      socket.ev.on('connection.update', handler);
      setTimeout(() => socket.ev.removeListener('connection.update', handler), 120000);
    }, 100);

  } catch (error) {
    console.error('✗ Error:', error.message);
    res.json({ error: 'Erreur serveur.' });
  }
});

// ═════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ 
    socketReady: socketReady.ready,
    socketInitializing: socketInitializing,
    uptime: process.uptime()
  });
});

// ═════════════════════════════════════════════════════════════════
// START SERVER
// ═════════════════════════════════════════════════════════════════
async function start() {
  try {
    await ensureSessionDirectory();

    app.listen(PORT, () => {
      console.log('\n╔═══════════════════════════════════════╗');
      console.log('║ 🚀 MIRA-BOT-V1 DÉMARRÉ');
      console.log(`║ 🌐 http://localhost:${PORT}`);
      console.log('╚═══════════════════════════════════════╝\n');
    });

    initializeSocket().catch(err => {
      console.error('⚠ Socket init failed:', err.message);
    });

  } catch (error) {
    console.error('❌ Fatal:', error.message);
    process.exit(1);
  }
}

start();

// ═════════════════════════════════════════════════════════════════
// SHUTDOWN
// ═════════════════════════════════════════════════════════════════
process.on('SIGTERM', () => {
  console.log('\n📛 Stopping...');
  if (socket) socket.end(new Error('Stopping'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📛 Interrupted...');
  if (socket) socket.end(new Error('Interrupted'));
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled:', reason);
});
