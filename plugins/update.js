
const { bwmxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');
const { database } = require('../config');
const { DataTypes } = require('sequelize');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// DB Model
const UpdateDB = database.define('bot_updates', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  current_hash: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'initial' },
  last_checked: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.ENUM('pending', 'updated', 'failed'), allowNull: false, defaultValue: 'updated' }
}, {
  timestamps: false,
  freezeTableName: true
});

// DB Ops
async function initializeUpdateDB() {
  await UpdateDB.sync();
  await UpdateDB.findOrCreate({
    where: { id: 1 },
    defaults: {
      current_hash: 'initial',
      last_checked: new Date(),
      status: 'updated'
    }
  });
}

async function getCurrentHash() {
  const record = await UpdateDB.findByPk(1);
  return record?.current_hash || 'initial';
}

async function setCurrentHash(hash) {
  return await UpdateDB.update({
    current_hash: hash,
    last_checked: new Date(),
    status: 'updated'
  }, { where: { id: 1 } });
}

// File Sync
async function syncFiles(source, target) {
  const preserve = ['app.json', 'settings.js', 'set.env'];
  const items = await fs.readdir(source);

  for (const item of items) {
    if (preserve.includes(item)) continue;
    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);
    const stat = await fs.lstat(srcPath);

    if (stat.isDirectory()) {
      await fs.ensureDir(destPath);
      await syncFiles(srcPath, destPath);
    } else {
      await fs.copy(srcPath, destPath);
    }
  }
}

// Update Command
bwmxmd({
  pattern: "update",
  aliases: ["upgrade", "sync"],
  description: "Update ISCE-BOT from remote repository",
  category: "System",
  filename: __filename,
  reaction: "🔄"
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner-only command");

  try {
    await reply("🔍 Checking for updates...");

    const repo = "ecnord/ISCE-BOT";
    const { data: commit } = await axios.get(
      XMD.EXTERNAL.GITHUB_API_COMMITS(repo),
      { timeout: 8000 }
    );

    const currentHash = await getCurrentHash();
    if (commit.sha === currentHash) {
      return reply("✅ Already running the latest version!");
    }

    await reply("⬇️ Downloading update...");
    const zipUrl = XMD.EXTERNAL.GITHUB_ZIP(repo, commit.sha);
    const zipPath = path.join(__dirname, '..', 'temp_update.zip');
    const writer = fs.createWriteStream(zipPath);

    const response = await axios({
      url: zipUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000
    });

    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await reply("📦 Extracting files...");
    const extractPath = path.join(__dirname, '..', 'temp_extract');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const extractedFolder = fs.readdirSync(extractPath)
      .find(name => name.startsWith('ISCE-BOT-'));
    const updateSrc = path.join(extractPath, extractedFolder);

    await reply("🔄 Applying update...");
    await syncFiles(updateSrc, path.join(__dirname, '..'));
    await setCurrentHash(commit.sha);

    await reply("✅ Update complete! Restarting...");
    fs.unlinkSync(zipPath);
    fs.removeSync(extractPath);
    process.exit(0);
  } catch (err) {
    console.error("❗ Update failed:", err);
    await reply(`❌ Update failed: ${err.message}`);
  }
});

// Init DB
initializeUpdateDB().catch(console.error);
