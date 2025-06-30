const express = require('express');
const fs = require('fs');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 Settings
const CONFIG = {
  PREFIX: '.',
  OWNER: '94773024361', // ඔබගේ WhatsApp අංකය
  BOT_NAME: 'CHAMA MD MINI BOT',
  SESSION_PATH: './session',
  MODE: 'public', // 'public' හෝ 'private'
  AUTO_FORWARD_TO_OWNER: true
};

// 🚀 Bot Setup
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_PATH);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS('Safari'),
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log(`✅ ${CONFIG.BOT_NAME} Connected!`);
      sock.sendMessage(CONFIG.OWNER + '@s.whatsapp.net', { 
        text: `*${CONFIG.BOT_NAME} Activated!*\n\n🤖 Bot is now online!\n🔧 Mode: ${CONFIG.MODE.toUpperCase()}` 
      });
    }
    if (connection === 'close') {
      if (lastDisconnect.error?.output?.statusCode !== 401) {
        console.log('🔄 Reconnecting...');
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const content = JSON.stringify(msg.message);
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const isCmd = text.startsWith(CONFIG.PREFIX);
    const cmd = isCmd ? text.slice(CONFIG.PREFIX.length).trim().split(' ')[0].toLowerCase() : '';
    const args = text.trim().split(/ +/).slice(1);
    const sender = msg.key.fromMe ? sock.user.id : (msg.key.participant || msg.key.remoteJid);
    const isGroup = from.endsWith('@g.us');
    const isOwner = sender.split('@')[0] === CONFIG.OWNER;

    // 🔒 Mode Check
    if (CONFIG.MODE === 'private' && !isOwner && !isGroup) {
      await sock.sendMessage(from, { 
        text: "🔒 This bot is in private mode. Only owner can use it." 
      });
      return;
    }

    // Helper Functions
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const sendImg = (buffer) => sock.sendMessage(from, { image: buffer }, { quoted: msg });

    // 📩 Auto Forward to Owner
    if (CONFIG.AUTO_FORWARD_TO_OWNER && !isOwner && !isGroup) {
      const senderNumber = sender.split('@')[0];
      await sock.sendMessage(
        CONFIG.OWNER + '@s.whatsapp.net', 
        {
          text: `📩 *New Message From:* ${senderNumber}\n\n` + 
                (msg.message.conversation || msg.message.extendedTextMessage?.text || '[Media Message]'),
          mentions: [sender]
        },
        { quoted: msg }
      );
      await reply("✅ Your message has been forwarded to the owner!");
    }

    // 📌 Basic Commands
    if (cmd === 'ping') {
      const start = Date.now();
      await reply('🏓 Pong!');
      const latency = Date.now() - start;
      await reply(`⚡ Latency: ${latency}ms`);
    }

    if (cmd === 'menu') {
      const menu = `
╭──❍ *${CONFIG.BOT_NAME} MENU*
│
├ ${CONFIG.PREFIX}ping - Check bot speed
├ ${CONFIG.PREFIX}menu - Show this menu
├ ${CONFIG.PREFIX}owner - Contact owner
├ ${CONFIG.PREFIX}sticker - Make sticker
├ ${CONFIG.PREFIX}groupinfo - Group details
├ ${CONFIG.PREFIX}mode - Check bot mode
│
╰──❍ *Owner: ${CONFIG.OWNER}* ❍
      `;
      await reply(menu);
    }

    if (cmd === 'owner') {
      await reply(`👑 Owner: https://wa.me/${CONFIG.OWNER}`);
    }

    // 🔧 Mode Command (Owner Only)
    if (cmd === 'mode' && isOwner) {
      const newMode = args[0]?.toLowerCase();
      if (newMode === 'public' || newMode === 'private') {
        CONFIG.MODE = newMode;
        await reply(`✅ Bot mode changed to: ${newMode.toUpperCase()}`);
      } else {
        await reply(`Current Mode: ${CONFIG.MODE.toUpperCase()}\nUsage: ${CONFIG.PREFIX}mode public/private`);
      }
    }

    // 🖼️ Sticker Command
    if (cmd === 'sticker' && (msg.message.imageMessage || msg.message.videoMessage)) {
      await reply('🔄 Creating sticker...');
      const buffer = await sock.downloadMediaMessage(msg);
      await sock.sendMessage(from, { 
        sticker: { url: buffer },
        mimetype: 'image/webp'
      }, { quoted: msg });
    }

    // 👥 Group Info
    if (cmd === 'groupinfo' && isGroup) {
      const metadata = await sock.groupMetadata(from);
      const info = `
╭──❍ *Group Info*
│
├ 📛 Name: ${metadata.subject}
├ 👥 Members: ${metadata.participants.length}
├ 🕵️‍♂️ Created: ${new Date(metadata.creation * 1000).toLocaleString()}
├ 👑 Owner: @${metadata.owner.split('@')[0]}
│
╰───────────────❍
      `;
      await reply(info);
    }

    // 🎲 Fun Commands
    if (cmd === 'joke') {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them!",
        "Parallel lines have so much in common... It's a shame they'll never meet."
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      await reply(`😂 Joke:\n\n"${joke}"`);
    }
  });
}

// 🖥️ Server
app.get('/', (req, res) => {
  res.send(`<h1>${CONFIG.BOT_NAME} is Running!</h1>`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startBot();
});
