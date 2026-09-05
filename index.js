// ─── Shard Manager (runs when launched directly, not as a cluster child) ─────
if (!process.env.CLUSTER_MANAGER_MODE) {
  const { spawnSync } = require('child_process');
  const path = require('path');

  // Ensure better-sqlite3 native binary is compatible
  try {
    new (require('better-sqlite3'))(':memory:');
  } catch (e) {
    console.log('[Setup] better-sqlite3 failed to load. Recompiling...');
    const result = spawnSync('node-gyp', ['rebuild', '--release'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, 'node_modules', 'better-sqlite3'),
      shell: true,
    });
    if (result.status !== 0) {
      spawnSync('npm', ['rebuild', 'better-sqlite3'], { stdio: 'inherit', cwd: __dirname, shell: true });
    }
  }

  require('dotenv').config();
  const config = require('./src/config');
  const { ClusterManager } = require('discord-hybrid-sharding');

  const manager = new ClusterManager(__filename, {
    totalShards: 'auto',
    shardsPerCluster: 1,
    mode: 'process',
    token: config.token,
    respawn: true,
    restarts: { max: 5, interval: 1000 },
    execArgv: ['--no-warnings'],
  });

  manager.on('clusterCreate', (cluster) => {
    console.log(`[ShardManager] Launched cluster ${cluster.id}`);
  });

  manager.spawn({ timeout: -1 });
  return; // stop here — children will re-enter this file with CLUSTER_MANAGER_MODE set
}
// ─────────────────────────────────────────────────────────────────────────────


require('dotenv').config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");


const { setGlobalDispatcher, Agent } = require("undici");
setGlobalDispatcher(new Agent({
  connect: { timeout: 60_000 },
  headersTimeout: 60_000,
  bodyTimeout: 60_000,
  pipelining: 1
}));

const { Collection } = require("discord.js");
const MusicBot = require("./src/structures/MusicClient");
const initializeCleanup = require("./src/events/Client/PremiumChecks");
const Dokdo = require("dokdo");
const config = require("./src/config");

const client = new MusicBot();
module.exports = client;

client.connect();

client.Jsk = new Dokdo.Client(client, {
  aliases: ["dokdo", "dok", "jsk"],
  prefix: [''],
  owners: client.owners,
});

process.env.SHELL = process.platform === "win32" ? "powershell" : "bash";


const emojis = require("./src/emojis");
client.emoji = emojis;

client.on("messageCreate", (message) => {
  client.Jsk.run(message);
});

process.on("unhandledRejection", (reason, p) => {
  if (reason && (reason.code === 'UND_ERR_CONNECT_TIMEOUT' || (reason.message && reason.message.includes('fetch failed')))) {
    console.log("[Lavalink Error] Connection timeout or fetch failed. Node might be down.");
    return;
  }

  console.log("[Unhandled Rejection]", reason, p);

  if (reason && reason.message && reason.message.includes('Session not found')) {
    console.log("[Session Error] Lavalink session lost, attempting cleanup...");

    if (reason.path && typeof reason.path === 'string') {
      const guildIdMatch = reason.path.match(/\/players\/(\d+)/);
      if (guildIdMatch && guildIdMatch[1]) {
        const guildId = guildIdMatch[1];
        console.log(`[Session Error] Cleaning up player for guild ${guildId}`);

        try {
          if (client.manager && client.manager.players.has(guildId)) {
            client.manager.players.delete(guildId);
          }

          if (client.voiceHealthMonitor) {
            client.voiceHealthMonitor.stopMonitoring(guildId);
          }
        } catch (cleanupError) {
          console.error("[Session Error] Cleanup failed:", cleanupError);
        }
      }
    }
  }
});

process.on("uncaughtException", (err, origin) => {
  console.log("[Uncaught Exception]", err, origin);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log("[Uncaught Exception Monitor]", err, origin);
});

initializeCleanup(client);
