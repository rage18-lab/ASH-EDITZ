const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if better-sqlite3 native binary exists for the current Node version.
// We bypass npm entirely and call node-gyp directly to avoid npm 11's allowScripts block.
const bindingPath = path.join(__dirname, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(bindingPath)) {
  console.log('[Setup] better-sqlite3 binary missing. Compiling for Node ' + process.version + '...');
  const result = spawnSync('node-gyp', ['rebuild', '--release'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, 'node_modules', 'better-sqlite3'),
    shell: true
  });
  if (result.status === 0) {
    console.log('[Setup] Compile complete. Starting bot...');
  } else {
    console.error('[Setup] node-gyp failed. Trying npm rebuild as fallback...');
    spawnSync('npm', ['rebuild', 'better-sqlite3'], { stdio: 'inherit', cwd: __dirname, shell: true });
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
