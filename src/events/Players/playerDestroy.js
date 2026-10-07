const {
  WebhookClient,
  EmbedBuilder
} = require("discord.js");
const {
  Webhooks: { player_delete },
} = require("../../config.js");

module.exports = {
  name: "playerDestroy",
  run: async (client, player) => {
    try {
      player.destroyed = true;

      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;

      const name = guild.name;

      if (player.voiceChannelId) {
        try {
          await client.rest.put(`/channels/${player.voiceChannelId}/voice-status`, { body: { status: `` } });
        } catch (err) {}
      }

      // Only send webhook if a valid URL is configured
      if (player_delete && player_delete.startsWith("https://")) {
        try {
          const web1 = new WebhookClient({ url: player_delete });
          const embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({
              name: `Player Destroyed`,
              iconURL: client.user.displayAvatarURL(),
            })
            .setDescription(`**Id:** \`${guild.id}\`\n**Name:** \`${name ?? 'Unknown'}\``);
          await web1.send({ embeds: [embed] }).catch(() => null);
          web1.destroy();
        } catch (_) {}
      }

      client.logger.log(`Player Destroy in ${name ?? 'Unknown'} [ ${player.guildId} ]`, "log");

      // Safely delete the now-playing message
      const npMsg = player.data?.get("message");
      if (npMsg) {
        try { await npMsg.delete(); } catch (_) {}
      }

      if (player.queue && player.queue.previous) {
        player.queue.previous = [];
      }

      if (client.voiceHealthMonitor) {
        client.voiceHealthMonitor.stopMonitoring(player.guildId);
      }

      player.data?.clear();
    } catch (err) {
      client.logger.log(`Error in player destroy: ${err.message}`, "error");
    }
  },
};

