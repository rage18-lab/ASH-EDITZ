module.exports = {
  name: "disconnect",
  run: async (client, node, reason) => {
    const nodeName = node?.id || node?.name || "Lavalink Node";
    const code     = reason?.code;
    const msg      = reason?.reason || "No reason";

    if (code === 4000) {
      // Rate-limited by the public node — already handled in loadPlayerManager (2-min backoff)
      client.logger.log(
        `Lavalink "${nodeName}" rate-limited (4000). Bot will retry in 2 minutes. ` +
        `Tip: use a private Lavalink node to avoid this limit.`,
        "warn"
      );
      return;
    }

    client.logger.log(
      `Lavalink "${nodeName}" disconnected. Code: ${code || "?"}, Reason: ${msg}`,
      "warn"
    );
  },
};
