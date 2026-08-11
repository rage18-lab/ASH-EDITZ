const {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags
} = require("discord.js");

module.exports = {
  name: "playerException",
  run: async (client, player, reason) => {
    try {
      client.logger.log(
        `Player Exception: ${JSON.stringify(reason)}`,
        "error"
      );

      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;
      const channel = client.channels.cache.get(player.textId);
      const currentTrack = player.queue.current;

      if (reason.exception?.cause?.includes("ScriptExtractionException")) {
        if (currentTrack) {
          // Preserve edit-audio descriptors (slowed, reverb, nightcore, sped up, etc.)
          // in the search query so the correct version is found on alternate sources.
          const editKeywordMatch = currentTrack.title.match(
            /\b(slowed|reverb|nightcore|sped\s*up|speed\s*up|lofi|lo-fi|8d|bass\s*boost|pitched)\b/gi
          );
          const editSuffix = editKeywordMatch ? ` ${editKeywordMatch.join(" ")}` : "";
          const baseQuery = `${currentTrack.title} ${currentTrack.author}`;
          const editQuery = editSuffix
            ? `${currentTrack.author} ${currentTrack.title.replace(/\s*-\s*Topic\s*$/i, "").trim()}`
            : baseQuery;

          const searchEngines = ["ytmsearch", "ytsearch", "spsearch", "scsearch"];
          let searchResult = { tracks: [] };

          for (const engine of searchEngines) {
            const result = await client.manager.search(editQuery, {
              engine,
              requester: currentTrack.requester,
            }).catch(() => ({ tracks: [] }));

            if (result.tracks.length > 0) {
              searchResult = result;
              break;
            }
          }

          if (searchResult.tracks.length > 0) {
            if (channel) {
              const fallbackDisplay = new TextDisplayBuilder()
                .setContent(`**${client.emoji.warn} YouTube restricted → using alternative source!**`);

              const container = new ContainerBuilder()
                .addTextDisplayComponents(fallbackDisplay);

              channel
                .send({
                  components: [container],
                  flags: MessageFlags.IsComponentsV2
                })
                .catch(() => null);
            }

            player.queue.unshift(searchResult.tracks[0]);
            player.skip();
            return;
          }
        }

        if (channel) {
          const blockedDisplay = new TextDisplayBuilder()
            .setContent(
              `**${client.emoji.error} Couldn't play this track [YouTube blocked].**\n` +
              `**${client.emoji.info} Skipping...**`
            );

          const container = new ContainerBuilder()
            .addTextDisplayComponents(blockedDisplay);

          channel
            .send({
              components: [container],
              flags: MessageFlags.IsComponentsV2
            })
            .catch(() => null);
        }

        if (player.queue.length > 0) {
          player.skip();
        }
        return;
      }

      if (player && !player.destroyed) {
        if (channel) {
          const errorDisplay = new TextDisplayBuilder()
            .setContent(
              `**${client.emoji.warn} Playback error occurred.**\n` +
              `**${client.emoji.info} Skipping track...**`
            );

          const container = new ContainerBuilder()
            .addTextDisplayComponents(errorDisplay);

          channel
            .send({
              components: [container],
              flags: MessageFlags.IsComponentsV2
            })
            .catch(() => null);
        }

        // Always skip — even with an empty queue this triggers playerEnd which handles autoplay
        try {
          player.skip();
        } catch (e) {
          // If skip fails, destroy as last resort
          try {
            await player.destroy();
          } catch (destroyErr) {
            if (client.manager.players.has(player.guildId)) {
              client.manager.players.delete(player.guildId);
            }
            if (client.manager.shoukaku) {
              client.manager.shoukaku.leaveVoiceChannel(player.guildId).catch(() => null);
            }
          }
        }
      }
    } catch (err) {
      client.logger.log(
        `Error handling player exception: ${err.message}`,
        "error"
      );
    }
  },
};
