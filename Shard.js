const { execSync } = require('child_process');

// Ensure native modules are compiled for the current Node.js version.
// npm 11 blocks install scripts by default; this forces a rebuild if needed.
try {
  require('better-sqlite3');
} catch (e) {
  if (e.message && (e.message.includes('Could not locate the bindings file') || e.code === 'ERR_DLOPEN_FAILED')) {
    console.log('[Setup] Native modules missing — rebuilding for Node ' + process.version + '...');
    execSync('npm rebuild better-sqlite3', { stdio: 'inherit', cwd: __dirname });
    console.log('[Setup] Rebuild complete. Starting bot...');
  }
}

require('dotenv').config();
const config = require("./src/config");
const { ClusterManager } = require("discord-hybrid-sharding");

const manager = new ClusterManager("./index.js", {
  totalShards: "auto",
  shardsPerCluster: 1,
  mode: "process",
  token: config.token,
  respawn: true,
  restarts: {
    max: 5,
    interval: 1000,
  },
  execArgv: ["--no-warnings"],
});

manager.on("clusterCreate", (cluster) => {
  console.log(`[ShardManager] Launched cluster ${cluster.id}`);
});

manager.spawn({ timeout: -1 });
