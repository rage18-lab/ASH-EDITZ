const lastErrorTime = new Map();
const ERROR_THROTTLE_MS = 60000;

module.exports = {
  name: "error",
  run: async (client, node, error) => {
    const nodeName = node?.id || node?.name || "Node";
    const errObj = error || {};
    const errorKey = `${nodeName}_${errObj.code || errObj.message}`;
    const now = Date.now();
    const lastTime = lastErrorTime.get(errorKey) || 0;

    if (errObj.code === 'ETIMEDOUT' || errObj.message?.includes('ETIMEDOUT')) {
      if (now - lastTime < ERROR_THROTTLE_MS) return;
      lastErrorTime.set(errorKey, now);
      client.logger.log(`Lavalink "${nodeName}" connection timeout (will retry automatically)`, "warn");
      return;
    }

    client.logger.log(`Lavalink "${nodeName}" error: ${errObj.message || errObj}`, "error");

    if (errObj.message && errObj.message.includes('Session not found')) {
      client.logger.log(`Session lost for node "${nodeName}", cleaning up affected players...`, "warn");

      const players = [...client.manager.players.values()];
      for (const player of players) {
        try {
          if (player.node && (player.node.id === nodeName || player.node.name === nodeName)) {
            client.logger.log(`Cleaning up player for guild ${player.guildId} due to session loss`, "warn");
            try { await player.destroy(); } catch (_) {}
            if (client.voiceHealthMonitor) {
              client.voiceHealthMonitor.stopMonitoring(player.guildId);
            }
          }
        } catch (cleanupError) {
          client.logger.log(`Error cleaning up player ${player.guildId}: ${cleanupError.message}`, "error");
        }
      }
    }
  },
};
