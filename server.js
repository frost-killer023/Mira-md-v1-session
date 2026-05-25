import express from 'express';
import { default as makeWASocket, delay, useMultiFileAuthState } from '@whiskeysockets/baileys';
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

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL STABLE SOCKET INSTANCE (Prevent multiple instances)
// ═══════════════════════════════════════════════════════════════════════
let socket = null;
let socketInitializing = false;
const socketReady = { ready: false };

// Logger configuration
const logger = pino({ level: 'silent' });

// Ensure session directory exists
const sessionPath = path.join(__dirname, 'session');
await fs.mkdir(sessionPath, { recursive: true }).catch(() => {});

console.log(`📁 Session directory: ${sessionPath}`);

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZE STABLE SOCKET ON SERVER START
// ═══════════════════════════════════════════════════════════════════════
async function initializeSocket() {
  if (socket) {
    console.log('🔄 Socket already exists, skipping re-initialization');
    return socket;
  }

  if (socketInitializing) {
    console.log('⏳ Socket initialization already in progress...');
    // Wait for initialization to complete
    let attempts = 0;
    while (socketInitializing && attempts < 50) {
      await delay(100);
      attempts++;
    }
    return socket;
  }

  socketInitializing = true;
  console.log('🚀 Initializing WhatsApp socket...');

  try {
    // Load or create authentication state from file system
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    console.log('🔐 Auth state loaded from ./session');

    // Create socket instance
    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger,
      browser: ['MIRA-BOT', 'Chrome', '125.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      emitOwnEventsOnReceive: false
    });

    console.log('✅ Socket created successfully');

    // Auto-save credentials on update
    socket.ev.on('creds.update', saveCreds);
    console.log('💾 Credential auto-save enabled');

    // Handle connection updates
    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'connecting') {
        console.log('🔌 Connecting to WhatsApp...');
      }

      if (connection === 'open') {
        socketReady.ready = true;
        console.log('🟢 WhatsApp socket connected successfully');
        console.log(`👤 User JID: ${socket.user.id}`);
      }

      if (connection === 'close') {
        socketReady.ready = false;
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== 401;

        if (shouldReconnect) {
          console.log('🔄 Connection closed, attempting to reconnect...');
          setTimeout(() => {
            socket = null;
            initializeSocket();
          }, 3000);
        } else {
          console.log('❌ Connection closed: Logged out or invalid session');
          socket = null;
          socketInitializing = false;
        }
      }

      if (qr) {
        console.log('📲 QR Code generated (not needed for pairing code)');
      }
    });

    // Handle disconnections
    socket.ev.on('connection.error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    console.log('📡 Socket event listeners registered');
    socketInitializing = false;
    return socket;

  } catch (error) {
    socketInitializing = false;
    console.error('❌ Error initializing socket:', error.message);
    socket = null;
    throw error;
  }
}

// Start socket on server startup
initializeSocket().catch(err => {
  console.error('⚠️ Initial socket initialization failed:', err.message);
});

// ═══════════════════════════════════════════════════════════════════════
// FRONTEND - Glassmorphism UI (UNCHANGED)
// ═══════════════════════════════════════════════════════════════════════
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
          --bg-dark: #0a0e1a;
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
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }

        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
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
          margin: 0 auto 25px auto;
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
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #fff 60%, #dcd0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 14px;
          color: #7e8ca4;
          margin-bottom: 35px;
          font-weight: 400;
        }

        .input-label {
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #8fa0be;
          margin-bottom: 8px;
          display: block;
          padding-left: 4px;
        }

        input[type="text"] {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: #fff;
          font-size: 16px;
          box-sizing: border-box;
          margin-bottom: 20px;
          transition: 0.3s;
        }

        input[type="text"]:focus {
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
        }

        button:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(114, 107, 243, 0.3);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .result-box {
          margin-top: 30px;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 20px;
          font-size: 14px;
          color: #a4b3cd;
          background: rgba(0, 0, 0, 0.1);
          min-height: 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .code-output {
          font-size: 32px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 4px;
          margin: 10px 0;
          text-shadow: 0 0 20px rgba(255,255,255,0.4);
        }

        .loader {
          display: none;
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255,255,255,0.2);
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
        <div class="subtitle">Générateur de Code de Pairage</div>

        <form id="pairingForm">
          <label class="input-label">Numéro de téléphone</label>
          <input type="text" id="phoneNumber" placeholder="Ex: 25766486303" required>
          
          <button type="submit" id="submitBtn">
            <svg style="width:18px; height:18px; fill:currentColor;" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span id="btnText">Générer</span>
          </button>
        </form>

        <div class="result-box" id="resultBox">
          <div class="loader" id="loader"></div>
          <span id="statusText">Entrez votre numéro pour générer le code</span>
        </div>
      </div>

      <script>
        document.getElementById('pairingForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const num = document.getElementById('phoneNumber').value.replace(/[^0-9]/g, '');
          const loader = document.getElementById('loader');
          const statusText = document.getElementById('statusText');
          const submitBtn = document.getElementById('submitBtn');
          const btnText = document.getElementById('btnText');
          const resultBox = document.getElementById('resultBox');

          if (!num || num.length < 10) {
            statusText.innerHTML = "<span style='color: #ff5b5b;'>Entrez un numéro valide</span>";
            return;
          }

          submitBtn.disabled = true;
          loader.style.display = "block";
          statusText.style.display = "none";
          btnText.innerText = "Génération...";

          try {
            const response = await fetch('/pair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: num })
            });
            const data = await response.json();

            loader.style.display = "none";
            statusText.style.display = "block";
            submitBtn.disabled = false;
            btnText.innerText = "Générer";

            if (data.code) {
              resultBox.style.borderStyle = "solid";
              resultBox.style.borderColor = "rgba(144, 83, 205, 0.4)";
              statusText.innerHTML = \`
                <span style="color: #a4b3cd; font-size: 12px;">VOTRE CODE DE PAIRAGE WHATSAPP :</span>
                <div class="code-output">\${data.code}</div>
                <span style="font-size: 12px; line-height: 1.4; display:block; margin-top:5px;">Ouvrez la notification WhatsApp sur votre téléphone et entrez ce code pour lier votre compte.</span>
              \`;
            } else {
              statusText.innerHTML = "<span style='color: #ff5b5b;'>Erreur: " + (data.error || "Erreur inconnue") + "</span>";
            }
          } catch (err) {
            loader.style.display = "none";
            statusText.style.display = "block";
            submitBtn.disabled = false;
            btnText.innerText = "Générer";
            statusText.innerHTML = "<span style='color: #ff5b5b;'>Échec de connexion au serveur de pairage.</span>";
          }
        });
      </script>
    </body>
    </html>
  `);
});

// ═══════════════════════════════════════════════════════════════════════
// PAIRING CODE ENDPOINT - FIXED & STABLE
// ═══════════════════════════════════════════════════════════════════════
app.post('/pair', async (req, res) => {
  const phoneNumber = req.body.number;

  // Validate phone number
  if (!phoneNumber || !/^\d{10,}$/.test(phoneNumber)) {
    console.log('❌ Invalid phone number format:', phoneNumber);
    return res.status(400).json({ 
      error: 'Format invalide. Utilisez un numéro sans espaces ni caractères spéciaux.' 
    });
  }

  console.log(`📱 Pair request for number: ${phoneNumber}`);

  // Safety timeout: 35 seconds (Render takes ~10-15s for pairing)
  let responseSent = false;
  const timeoutId = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      console.log('⏱️ Pairing timeout after 35 seconds');
      return res.json({ error: 'Délai dépassé. Le serveur n\'a pas reçu le code WhatsApp.' });
    }
  }, 35000);

  try {
    // Ensure socket is initialized
    if (!socket) {
      console.log('🔧 Socket not ready, initializing...');
      await initializeSocket();
    }

    // Wait for socket to be ready (max 15 seconds)
    let waitCount = 0;
    while (!socketReady.ready && waitCount < 30) {
      await delay(500);
      waitCount++;
    }

    if (!socketReady.ready) {
      clearTimeout(timeoutId);
      responseSent = true;
      console.log('❌ Socket not ready after 15 seconds');
      return res.json({ error: 'Le service de pairage n\'est pas prêt. Réessayez dans 10 secondes.' });
    }

    console.log('✅ Socket ready, requesting pairing code...');

    // Request pairing code from WhatsApp
    const pairingCode = await socket.requestPairingCode(phoneNumber);
    
    clearTimeout(timeoutId);
    if (responseSent) return;
    responseSent = true;

    console.log(`✅ Pairing code generated: ${pairingCode}`);

    // Send pairing code to frontend
    res.json({ code: pairingCode });

    // Wait for connection after pairing code is accepted
    console.log('⏳ Waiting for WhatsApp connection confirmation...');
    
    let connectionConfirmed = false;
    const connectionTimeout = setTimeout(() => {
      if (!connectionConfirmed) {
        console.log('⚠️ Connection confirmation timeout');
      }
    }, 60000);

    // Listen for successful connection
    const handleConnection = async (update) => {
      const { connection } = update;

      if (connection === 'open' && !connectionConfirmed) {
        connectionConfirmed = true;
        clearTimeout(connectionTimeout);
        socket.ev.removeListener('connection.update', handleConnection);

        console.log('🟢 WhatsApp connection confirmed!');
        await delay(2000);

        try {
          // Generate Session ID from credentials
          const creds = socket.authState.creds;
          const sessionData = {
            phoneNumber: creds.me.id,
            timestamp: new Date().toISOString(),
            bot: 'MIRA-BOT-V1'
          };
          const sessionId = Buffer.from(JSON.stringify(sessionData)).toString('base64');

          // Send confirmation message
          const messageText = `╭───────────────────⬣
│ 🤖 *MIRA BOT V1*
│ 
│ ✅ Connexion Réussie
│ Session ID:
│ \`\`\`
│ \${sessionId}
│ \`\`\`
│ 
│ 📱 WhatsApp Linked Device Actif
│ ⚡ Système Opérationnel
╰───────────────────⬣`;

          await socket.sendMessage(socket.user.id, { text: messageText });
          console.log('✅ Confirmation message sent');

        } catch (error) {
          console.error('⚠️ Error sending confirmation message:', error.message);
        }

        // Don't logout - keep session active
        console.log('💾 Session saved and active');
      }
    };

    socket.ev.on('connection.update', handleConnection);

  } catch (error) {
    clearTimeout(timeoutId);
    if (!responseSent) {
      responseSent = true;
      console.error('❌ Pairing error:', error.message);

      // Return user-friendly error message
      let errorMessage = 'Erreur du service de pairage';
      
      if (error.message.includes('Invalid pairing code')) {
        errorMessage = 'Code de pairage invalide. Vérifiez que vous avez saisi le bon numéro.';
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        errorMessage = 'WhatsApp a mis trop de temps à répondre. Réessayez.';
      } else if (error.message.includes('connection') || error.message.includes('Connection')) {
        errorMessage = 'Impossible de se connecter à WhatsApp. Vérifiez votre connexion Internet.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Erreur réseau. Réessayez dans quelques secondes.';
      }

      res.json({ error: errorMessage });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🚀 MIRA-BOT-V1 SERVER STARTED');
  console.log(\`║  🌐 Port: \${PORT}\`);
  console.log('║  📱 WhatsApp Pairing System: READY');
  console.log('║  💾 Session Storage: ./session');
  console.log('║  🟢 Status: ONLINE');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, shutting down gracefully...');
  if (socket) {
    socket.end(new Error('Server shutting down'));
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, shutting down gracefully...');
  if (socket) {
    socket.end(new Error('Server shutting down'));
  }
  process.exit(0);
});
