import express from 'express';
import baileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, delay } = baileys;
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Interface Graphique
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

                        if(data.code) {
                            resultBox.style.borderStyle = "solid";
                            resultBox.style.borderColor = "rgba(144, 83, 205, 0.4)";
                            statusText.innerHTML = \`
                                <span style="color: #a4b3cd; font-size: 12px;">VOTRE CODE DE PAIRAGE WHATSAPP :</span>
                                <div class="code-output">\${data.code}</div>
                                <span style="font-size: 12px; line-height: 1.4; display:block; margin-top:5px;">Ouvrez la notification WhatsApp sur votre téléphone et entrez ce code pour lier <b>MIRA-BOT-V1</b>.</span>
                            \`;
                        } else {
                            statusText.innerHTML = "<span style='color: #ff5b5b;'>Erreur : " + data.error + "</span>";
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

// Logique simplifiée au maximum pour éliminer tout bug Linux/Render
app.post('/pair', async (req, res) => {
    let phoneNumber = req.body.number;
    if (!phoneNumber) return res.status(400).json({ error: "Numéro manquant" });

    // Nettoyage forcé des anciens dossiers de sessions pour éviter les verrous système
    const sessionDir = path.join(__dirname, 'session_' + phoneNumber);
    if (fs.existsSync(sessionDir)) {
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch(e){}
    }

    try {
        // Initialisation de l'authentification multi-fichiers
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Configuration de base sans fioritures (évite le crash lié aux options avancées)
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }),
            browser: ["Mac OS", "Chrome", "124.0.0.0"]
        });

        // Demande directe du code de pairage après une attente de sécurité minimale
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                if (!res.headersSent) {
                    return res.json({ code: code });
                }
            } catch (err) {
                console.error("Erreur lors de la demande du code :", err);
                if (!res.headersSent) {
                    return res.json({ error: "WhatsApp refuse la demande. Vérifie le format du numéro." });
                }
            }
        }, 3000);

        // Capture de l'ouverture de session réussie
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;

            if (connection === 'open') {
                await delay(5000);
                try {
                    // Lecture sécurisée du creds.json généré
                    const credsPath = path.join(sessionDir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        const credsFile = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                        const sessionB64 = Buffer.from(JSON.stringify(credsFile)).toString('base64');
                        const finalSessionId = `Session_id_mira-bot:${sessionB64}`;

                        const successMessage = `╭───〔 🤖 MIRA 𝘽𝙊𝙏 〕───⬣\n│ ߷ *Etat* ➜ Connecté ✅\n│ ߷ *Préfixe* ➜ !\n│ ߷ *Mode* ➜ Public\n│ ߷ *Commandes* ➜ Multi-Device\n│ ߷ *Version* ➜ 1.0.0\n│ ߷ *Développeur*➜ anos \n╰──────────────⬣\n\nCopie ton ID de session ci-dessous pour le configurer sur ton bot :\n\n${finalSessionId}`;

                        await sock.sendMessage(sock.user.id, { text: successMessage });
                    }
                } catch (e) {
                    console.error("Erreur d'écriture/envoi de session :", e);
                }

                // Déconnexion et nettoyage propre
                await delay(2000);
                try { sock.logout(); } catch(e){}
                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch(e){}
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("Crash d'initialisation Baileys :", error);
        if (!res.headersSent) {
            res.json({ error: "Problème temporaire d'allocation des dossiers sur le serveur." });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Serveur MIRA-BOT-V1 prêt et allégé sur le port ${PORT}`);
});
