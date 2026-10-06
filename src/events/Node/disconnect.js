module.exports = {
  name: "disconnect",
  run: async (client, node, reason) => {
    const nodeName = node?.id || node?.name || "Lavalink Node";
    client.logger.log(
      `Lavalink "${nodeName}" disconnected. Code: ${reason?.code || '?'}, Reason: ${reason?.reason || "No reason"}`,
      "warn"
    );
  },
};
