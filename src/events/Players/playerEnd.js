const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { updateVoiceChannel } = require("../../utils/voiceConnect");

module.exports = {
  name: "playerEnd",
  run: async (client, player, track) => {
    try {
      // ── Add finished track to history ──────────────────────────────────
      if (track) {
        let history = player.data?.get("history") || [];
        if (history.length === 0 || history[history.length - 1]?.uri !== track.uri) {
          history.push({
            title: track.title,
            author: track.author,
            uri: track.uri,
            length: track.length,
            thumbnail: track.thumbnail,
            requester: track.requester,
            identifier: track.identifier,
            sourceName: track.sourceName
          });
          if (history.length > 20) history.shift();
          player.data?.set("history", history);
        }
      }

      player.data.get("message")?.delete().catch(() => null);
      await updateVoiceChannel(client, player, true);

      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;

      // If there are queued tracks or already playing, do nothing
      if (player.queue && player.queue.size > 0) return;
      if (player.playing) return;

      const autoplay = player.data?.get("autoplay");
      if (!autoplay || !track) return;

      // ── AUTOPLAY: Find similar popular tracks ──────────────────────────
      const history = player.data?.get("history") || [];

      const cleanAuthor = track.author.replace(/\s*-\s*Topic\s*$/i, "").trim();
      const cleanTitle = track.title
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();

      // Helper: strip noise from titles for duplicate-detection
      const extractCoreName = (title) => {
        let core = title.toLowerCase();
        core = core.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
        core = core.replace(
          /official|video|audio|lyric|lyrics|music|song|full|hd|4k|8k|version|remix|edit|remaster/gi,
          ""
        );
        core = core.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
        return core;
      };

      const isSimilarTitle = (title1, title2) => {
        const c1 = extractCoreName(title1);
        const c2 = extractCoreName(title2);
        if (c1 === c2) return true;
        if (c1.length > 3 && c2.length > 3 && (c1.includes(c2) || c2.includes(c1))) return true;
        const w1 = c1.split(" ").filter(w => w.length > 2);
        const w2 = c2.split(" ").filter(w => w.length > 2);
        if (!w1.length || !w2.length) return c1 === c2;
        const common = w1.filter(w => w2.includes(w));
        return common.length / Math.max(w1.length, w2.length) > 0.6;
      };

      const isInHistory = (t) =>
        history.some(
          h => h.uri === t.uri || h.identifier === t.identifier || isSimilarTitle(h.title, t.title)
        );
      const isCurrent = (t) =>
        t.uri === track.uri ||
        t.identifier === track.identifier ||
        isSimilarTitle(t.title, track.title);

      // ── Build ordered recommendation list from Last.fm ─────────────────
      // Priority order:
      //   1. Last.fm similar tracks for this song (sorted by match score — highest first)
      //   2. Last.fm top tracks by the same artist (most popular first)
      //   3. Top tracks of similar artists
      let recommendations = []; // [{ title, author }]

      try {
        const LastFM = require("../../utils/lastfm");
        const lastfm = new LastFM(client);

        // 1. Similar tracks — keep in Last.fm order (already sorted by match desc)
        const similar = await lastfm.getSimilarTracks(cleanAuthor, cleanTitle, 15);
        if (similar.length > 0) {
          recommendations.push(...similar);
        }

        // 2. Top tracks by the same artist (popular songs people know)
        const ownTopTracks = await lastfm.getTopTracks(cleanAuthor, 10);
        for (const t of ownTopTracks) {
          if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
            recommendations.push(t);
          }
        }

        // 3. Top tracks from similar artists (for variety)
        if (recommendations.length < 10) {
          const similarArtists = await lastfm.getSimilarArtists(cleanAuthor, 5);
          for (const artist of similarArtists) {
            const artistTopTracks = await lastfm.getTopTracks(artist, 5);
            for (const t of artistTopTracks) {
              if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
                recommendations.push(t);
              }
            }
            if (recommendations.length >= 20) break;
          }
        }
      } catch (err) {
        console.error("[Autoplay] Last.fm error:", err.message);
      }

      // ── Search engine priority ─────────────────────────────────────────
      let engines = ["ytmsearch", "ytsearch", "spsearch", "scsearch"];
      try {
        const userId = track.requester?.id || track.requester;
        const userPref = client.db.userpreferences.get(userId);
        if (userPref?.musicSource) {
          engines = [userPref.musicSource, ...engines.filter(e => e !== userPref.musicSource)];
        }
      } catch (_) {}

      // Try to find a playable track for a query, skipping history
      const findTrack = async (query) => {
        for (const engine of engines.slice(0, 2)) {
          try {
            const result = await client.manager.search(query, { engine, requester: client.user });
            if (result?.tracks?.length) {
              const found = result.tracks.find(t => !isInHistory(t) && !isCurrent(t));
              if (found) return found;
            }
          } catch (_) { continue; }
        }
        return null;
      };

      // ── Search through recommendations in priority order ────────────────
      let nextTrack = null;

      for (const rec of recommendations) {
        nextTrack = await findTrack(`${rec.author} ${rec.title}`);
        if (nextTrack) break;
      }

      // ── Final fallbacks ────────────────────────────────────────────────
      if (!nextTrack) {
        // Try: "<artist> popular songs"
        nextTrack = await findTrack(`${cleanAuthor} popular songs`);
      }
      if (!nextTrack) {
        // Try: just the artist name
        nextTrack = await findTrack(cleanAuthor);
      }

      // ── Queue or give up ───────────────────────────────────────────────
      if (nextTrack) {
        player.queue.add(nextTrack);
        if (!player.playing && !player.paused) await player.play();
      } else {
        console.log(`[Autoplay] No tracks found for guild ${player.guildId}, ending autoplay`);
        const channel = client.channels.cache.get(player.textId);
        if (channel) {
          const display = new TextDisplayBuilder().setContent(
            `**${client.emoji.info} Autoplay could not find any more similar tracks. Queue has ended.**`
          );
          const container = new ContainerBuilder().addTextDisplayComponents(display);
          channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        }
        // Disable autoplay so playerEmpty can handle disconnect
        player.data.set("autoplay", false);
      }
    } catch (error) {
      console.error("[playerEnd] Error:", error);
    }
  },
};
