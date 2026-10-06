const { updateVoiceChannel } = require("../../utils/voiceConnect");
const handleAutoplay = require("../../utils/autoplayHandler");

module.exports = {
  name: "playerEnd",
  run: async (client, player, track) => {
    try {
      // ── Add finished track to history ──────────────────────────────────
      if (track) {
        let history = player.data?.get("history") || [];
        const rawUri = track.info?.uri || track.uri;
        if (history.length === 0 || history[history.length - 1]?.uri !== rawUri) {
          history.push({
            title: track.info?.title || track.title,
            author: track.info?.author || track.author,
            uri: rawUri,
            length: track.info?.duration || track.length || 0,
            thumbnail: track.info?.artworkUrl || track.thumbnail,
            requester: track.requester,
            identifier: track.info?.identifier || track.identifier,
            sourceName: track.info?.sourceName || track.sourceName
          });
          if (history.length > 25) history.shift();
          player.data?.set("history", history);
        }
      }

      player.data?.get("message")?.delete().catch(() => null);
      await updateVoiceChannel(client, player, true);

      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;

      // If there are queued tracks or already playing, do nothing
      if (player.queue && (player.queue.tracks?.length > 0 || player.queue.size > 0)) return;
      if (player.playing) return;

      const autoplay = player.data?.get("autoplay");
      if (!autoplay || !track) return;

      // Autoplay fallback in case autoPlayFunction didn't already fire
      const nextTrack = await handleAutoplay(client, player, track);
      if (nextTrack) {
        if (!player.playing && !player.paused) {
          await player.play().catch(() => null);
        }
      }
    } catch (error) {
      console.error("[playerEnd] Error:", error);
    }
  },
};
