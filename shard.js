const { spawnSync } = require('child_process');
const path = require('path');

// Test if better-sqlite3 loads successfully for the current Node.js version.
// If it fails (e.g. wrong ABI version or missing binary), we force a compile.
try {
  // We must instantiate it to force the native binding to load!
  new (require('better-sqlite3'))(':memory:');
} catch (e) {
  console.log('[Setup] better-sqlite3 failed to load. Recompiling for Node ' + process.version + '...');
  console.log('[Setup] Error was:', e.message.split('\n')[0]);
  
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
