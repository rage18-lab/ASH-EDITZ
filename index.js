// ─── Shard Manager (runs when launched directly, not as a cluster child) ─────
if (!process.env.CLUSTER_MANAGER_MODE) {
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
  return; // stop here — children re-enter this file with CLUSTER_MANAGER_MODE set
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Cluster child entry point ────────────────────────────────────────────────
(async () => {
  require('dotenv').config();

  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');

  // ── Init database FIRST, before anything imports it ──────────────────────
  const { initDatabase } = require('./src/structures/Database');
  await initDatabase();

  // ── HTTP agent tuning ─────────────────────────────────────────────────────
  const { setGlobalDispatcher, Agent } = require('undici');
  setGlobalDispatcher(new Agent({
    connect:        { timeout: 60_000 },
    headersTimeout: 60_000,
    bodyTimeout:    60_000,
    pipelining:     1
  }));

  const { Collection } = require('discord.js');
  const MusicBot              = require('./src/structures/MusicClient');
  const initializeCleanup     = require('./src/events/Client/PremiumChecks');
  const Dokdo                 = require('dokdo');
  const config                = require('./src/config');

  const client = new MusicBot();
  module.exports = client;

  client.connect();

  client.Jsk = new Dokdo.Client(client, {
    aliases: ['dokdo', 'dok', 'jsk'],
    prefix:  [''],
    owners:  client.owners,
  });

  process.env.SHELL = process.platform === 'win32' ? 'powershell' : 'bash';

  const emojis  = require('./src/emojis');
  client.emoji  = emojis;

  client.on('messageCreate', (message) => {
    client.Jsk.run(message);
  });

  // ── Global error handlers ─────────────────────────────────────────────────
  process.on('unhandledRejection', (reason, p) => {
    console.log('[Unhandled Rejection]', reason, p);
  });

  process.on('uncaughtException',        (err, origin) => console.log('[Uncaught Exception]',         err, origin));
  process.on('uncaughtExceptionMonitor', (err, origin) => console.log('[Uncaught Exception Monitor]', err, origin));

  initializeCleanup(client);

})().catch((err) => {
  console.error('[Fatal] Bot failed to start:', err);
  process.exit(1);
});
