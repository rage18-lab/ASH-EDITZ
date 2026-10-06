const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "playerEmpty",
  run: async (client, player) => {
    const guild = client.guilds.cache.get(player.guildId);
    if (!guild) return;

    const guildPrefix = client.db.prefixes.get(player.guildId);
    const prefix = guildPrefix?.prefix || client.prefix;

    try {
      await client.rest
        .put(`/channels/${player.voiceChannelId}/voice-status`, {
          body: { status: `use **${prefix}play** to add songs` },
        })
        .catch(() => {});
    } catch (_) {}

    if (player.data?.get("playerEmptyProcessed")) {
      return;
    }
    player.data?.set("playerEmptyProcessed", true);

    player.data
      ?.get("message")
      ?.delete()
      .catch(() => null);

    if (player.queue && player.queue.previous) {
      player.queue.previous = [];
    }

    const TwoFourSeven = client.db.twofourseven.get(player.guildId);
    const is247Enabled = !!TwoFourSeven;

    if (is247Enabled) {
      return;
    }

    // If autoplay is enabled, don't disconnect
    const autoplay = player.data?.get("autoplay");
    if (autoplay) {
      return;
    }

    const vchannel = guild.channels.cache.get(player.voiceChannelId);

    if (vchannel) {
      const existingTimeout = player.data.get("disconnectTimeout");
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const disconnectTimeout = setTimeout(async () => {
        const currentTwoFourSeven = client.db.twofourseven.get(player.guildId);
        if (currentTwoFourSeven) {
          return;
        }

        // Re-check autoplay at the time the timeout fires
        const currentAutoplay = player.data?.get("autoplay");
        if (currentAutoplay) {
          player.data.delete("disconnectTimeout");
          return;
        }

        if ((!player.queue || player.queue.size === 0) && !player.playing && !player.paused) {
          const embed = new EmbedBuilder()
            .setColor(client.config.color || "#00D4FF")
            .setTitle(`${client.emoji?.info || "ℹ️"} Queue Ended`)
            .setDescription("Disconnected from voice channel due to inactivity.");

          client.channels.cache.get(player.textChannelId)?.send({
            embeds: [embed]
          }).catch(() => null);

          const currentPlayer = client.manager.players.get(player.guildId);
          if (currentPlayer && currentPlayer.state !== "DESTROYED") {
            player.destroy().catch(() => null);
          }
        }

        player.data.delete("disconnectTimeout");
      }, 60000);

      player.data.set("disconnectTimeout", disconnectTimeout);
    }
  },
};
