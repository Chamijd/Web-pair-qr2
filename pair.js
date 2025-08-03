const express = require('express');
const fs = require('fs');
const pino = require("pino");
const { makeid } = require('./gen-id');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

const router = express.Router();

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;
  const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

  async function connectBot() {
    try {
      let sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) res.send({ code });
      }

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
          await delay(5000);

          // Simulate GitHub session URL
          const fakeGitHubSession = `https://github.com/Nethmika-LK/QUEEN-SHALA-D/blob/main/sessions/${sock.user.id}.json`;
          const sessionCode = `QUEEN-SHALA-MD=${fakeGitHubSession}`;

          const audioMsg = await sock.sendMessage(sock.user.id, {
            audio: { url: 'https://github.com/Nethmika-LK/QUEEN-SHALA-D/raw/main/audio.mp3' },
            mimetype: 'audio/mpeg',
            ptt: true
          });

          await sock.sendMessage(sock.user.id, {
            image: { url: 'https://i.ibb.co/PjvJxM9/20250717-093632.jpg' },
            caption: `👋 *Hello, I’m Queen Shala Bot*\n\n💾 *Session saved:* GitHub\n🔗 *Link:* ${fakeGitHubSession}\n👑 *Owner:* Nethmika\n📢 *Channel:* https://whatsapp.com/channel/0029Vb1WkmNJP2121yQ`,
            contextInfo: {
              externalAdReply: {
                title: "Queen Shala WhatsApp Bot",
                thumbnailUrl: 'https://i.ibb.co/PjvJxM9/20250717-093632.jpg',
                sourceUrl: 'https://whatsapp.com/channel/0029Vb1WkmNJP2121yQ',
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: audioMsg });

          await delay(10);
          sock.ws.close();
          removeFile(`./temp/${id}`);
          process.exit();
        }
      });
    } catch (err) {
      console.log("❌ Error:", err);
      removeFile(`./temp/${id}`);
      if (!res.headersSent) res.send({ code: "❗ Service Unavailable" });
    }
  }

  await connectBot();
});

module.exports = router;
