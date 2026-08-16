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

      // Helper: strip noise from titles for duplicate-detection.
      // NOTE: intentionally keep "edit", "slowed", "reverb", "sped", "nightcore"
      // etc. because those describe genuinely different audio versions of a track.
      const extractCoreName = (title) => {
        let core = title.toLowerCase();
        core = core.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
        core = core.replace(
          /\b(official|video|lyric|lyrics|music video|full|hd|4k|8k|remaster|remastered)\b/gi,
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

      // ── Detect language/region of the current track ────────────────────
      // Tamil artists & keywords — used to keep autoplay in Tamil when detected
      const TAMIL_ARTISTS = new Set([
        // Composers / Music Directors
        "a.r. rahman", "ar rahman", "a r rahman", "harris jayaraj", "anirudh ravichander",
        "anirudh", "yuvan shankar raja", "yuvan", "g.v. prakash kumar", "gv prakash",
        "d. imman", "d imman", "imman", "thaman s", "s. thaman", "sid sriram",
        "devi sri prasad", "dsp", "ilaiyaraaja", "ilayaraja", "james vasanthan",
        "santhosh narayanan", "leon james", "sam c.s.", "sam cs",
        // Singers
        "spb", "s.p. balasubrahmanyam", "sp balasubrahmanyam", "s.p. balasubrahmanyam",
        "k.s. chithra", "ks chithra", "shankar mahadevan", "haricharan", "velmurugan",
        "karthik singer", "vijay yesudas", "benny dayal", "tippu", "sathyaprakash",
        "nithyashree mahadevan", "kavitha krishnamurthy", "sadhana sargam",
        "shakthisree gopalan", "shweta mohan", "chinmayi", "vandana srinivasan",
        "pooja", "sunidhi chauhan (tamil)", "devan ekambaram", "udit narayan (tamil)",
        // Actors (who are also associated with Tamil music)
        "vijay", "ajith", "dhanush", "simbu", "sivakarthikeyan", "vijay sethupathi",
        "kamal haasan", "rajinikanth",
        // Bands / others
        "thaman", "yuvan shankar", "dharan kumar",
      ]);

      const TAMIL_KEYWORDS = [
        "tamil", "kollywood", "tamilsong", "inimel", "kadhal", "en", "nee", "oru",
        "vaa", "poda", "kannama", "marana", "mass", "kuthu", "vaadi", "thala",
        "thalapathy", "makkal selvan",
      ];

      const detectTamil = (artist, title) => {
        const a = artist.toLowerCase();
        const t = title.toLowerCase();
        if ([...TAMIL_ARTISTS].some(ta => a.includes(ta))) return true;
        if (TAMIL_KEYWORDS.some(kw => t.includes(kw) || a.includes(kw))) return true;
        return false;
      };

      const isTamil = detectTamil(cleanAuthor, cleanTitle);

      // Curated list of popular Tamil similar artists for autoplay variety
      const TAMIL_SIMILAR_ARTISTS = {
        "anirudh ravichander": ["yuvan shankar raja", "harris jayaraj", "gv prakash kumar", "d imman", "sid sriram"],
        "anirudh":             ["yuvan shankar raja", "harris jayaraj", "gv prakash kumar", "d imman", "sid sriram"],
        "yuvan shankar raja":  ["anirudh ravichander", "harris jayaraj", "gv prakash kumar", "d imman"],
        "harris jayaraj":      ["anirudh ravichander", "yuvan shankar raja", "a.r. rahman", "d imman"],
        "a.r. rahman":         ["harris jayaraj", "anirudh ravichander", "yuvan shankar raja", "ilaiyaraaja"],
        "ar rahman":           ["harris jayaraj", "anirudh ravichander", "yuvan shankar raja", "ilaiyaraaja"],
        "d imman":             ["anirudh ravichander", "yuvan shankar raja", "harris jayaraj", "gv prakash kumar"],
        "d. imman":            ["anirudh ravichander", "yuvan shankar raja", "harris jayaraj", "gv prakash kumar"],
        "gv prakash kumar":    ["anirudh ravichander", "yuvan shankar raja", "d imman", "harris jayaraj"],
        "ilaiyaraaja":         ["a.r. rahman", "harris jayaraj", "yuvan shankar raja"],
        "ilayaraja":           ["a.r. rahman", "harris jayaraj", "yuvan shankar raja"],
        "sid sriram":          ["anirudh ravichander", "a.r. rahman", "yuvan shankar raja"],
        "santhosh narayanan":  ["anirudh ravichander", "gv prakash kumar", "d imman"],
        "leon james":          ["anirudh ravichander", "gv prakash kumar", "harris jayaraj"],
        "sam cs":              ["anirudh ravichander", "gv prakash kumar", "santhosh narayanan"],
        "sam c.s.":            ["anirudh ravichander", "gv prakash kumar", "santhosh narayanan"],
        "thaman s":            ["anirudh ravichander", "harris jayaraj", "devi sri prasad"],
        "devi sri prasad":     ["anirudh ravichander", "thaman s", "harris jayaraj"],
        "dsp":                 ["anirudh ravichander", "thaman s", "harris jayaraj"],
      };

      const getTamilSimilarArtists = (artist) => {
        const key = artist.toLowerCase();
        // Exact match
        if (TAMIL_SIMILAR_ARTISTS[key]) return TAMIL_SIMILAR_ARTISTS[key];
        // Partial match
        for (const [k, v] of Object.entries(TAMIL_SIMILAR_ARTISTS)) {
          if (key.includes(k) || k.includes(key)) return v;
        }
        // Default: return top Tamil composers
        return ["anirudh ravichander", "yuvan shankar raja", "harris jayaraj", "gv prakash kumar", "d imman"];
      };

      // ── Build ordered recommendation list ─────────────────────────────
      // Priority order (popularity-first):
      //   1. Last.fm top tracks by the same artist  → most-played / most-liked
      //   2. Last.fm similar tracks (high match score) → relevant variety
      //   3. Top tracks of similar artists (Tamil-aware) → broader variety
      let recommendations = []; // [{ title, author }]

      // Language suffix to anchor searches to the right language
      const langSuffix = isTamil ? " Tamil" : "";

      try {
        const LastFM = require("../../utils/lastfm");
        const lastfm = new LastFM(client);

        // 1. Top tracks by the same artist first — these are the most popular/liked
        const ownTopTracks = await lastfm.getTopTracks(cleanAuthor, 10);
        for (const t of ownTopTracks) {
          if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
            recommendations.push(t);
          }
        }

        // 2. Similar tracks — high match score for relevance & variety
        const similar = await lastfm.getSimilarTracks(cleanAuthor, cleanTitle, 15);
        for (const t of similar) {
          if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
            recommendations.push(t);
          }
        }

        // 3. Top tracks from similar artists (Tamil-aware for Tamil tracks)
        let similarArtistNames;
        if (isTamil) {
          // Use curated Tamil similar artists to avoid Last.fm returning Hindi artists
          similarArtistNames = getTamilSimilarArtists(cleanAuthor);
        } else {
          similarArtistNames = await lastfm.getSimilarArtists(cleanAuthor, 5);
        }

        for (const artist of similarArtistNames) {
          const artistTopTracks = await lastfm.getTopTracks(artist, 5);
          for (const t of artistTopTracks) {
            if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
              recommendations.push(t);
            }
          }
          if (recommendations.length >= 25) break;
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
        // Append language suffix to anchor search in the right language (e.g., Tamil)
        nextTrack = await findTrack(`${rec.author} ${rec.title}${langSuffix}`);
        if (nextTrack) break;
      }

      // ── Final fallbacks ────────────────────────────────────────────────
      if (!nextTrack) {
        // Try: "<artist> popular Tamil songs" (or just popular songs for non-Tamil)
        nextTrack = await findTrack(`${cleanAuthor} popular${langSuffix} songs`);
      }
      if (!nextTrack && isTamil) {
        // Tamil-specific fallback: search for popular Tamil songs from a known Tamil artist
        const fallbackArtists = getTamilSimilarArtists(cleanAuthor);
        for (const fa of fallbackArtists) {
          nextTrack = await findTrack(`${fa} popular Tamil songs`);
          if (nextTrack) break;
        }
      }
      if (!nextTrack) {
        // Try: just the artist name with language suffix
        nextTrack = await findTrack(`${cleanAuthor}${langSuffix ? " " + langSuffix.trim() : ""}`);
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
