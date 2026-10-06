const { EmbedBuilder } = require("discord.js");

// ── Tamil artists & keywords for language-anchored autoplay ────────────────
const TAMIL_ARTISTS = new Set([
  // Composers / Music Directors
  "a.r. rahman", "ar rahman", "a r rahman", "harris jayaraj", "anirudh ravichander",
  "anirudh", "yuvan shankar raja", "yuvan", "g.v. prakash kumar", "gv prakash",
  "d. imman", "d imman", "imman", "thaman s", "s. thaman", "sid sriram",
  "devi sri prasad", "dsp", "ilaiyaraaja", "ilayaraja", "james vasanthan",
  "santhosh narayanan", "leon james", "sam c.s.", "sam cs",
  // Singers
  "spb", "s.p. balasubrahmanyam", "sp balasubrahmanyam",
  "k.s. chithra", "ks chithra", "shankar mahadevan", "haricharan", "velmurugan",
  "karthik singer", "vijay yesudas", "benny dayal", "tippu", "sathyaprakash",
  "nithyashree mahadevan", "kavitha krishnamurthy", "sadhana sargam",
  "shakthisree gopalan", "shweta mohan", "chinmayi", "vandana srinivasan",
  "pooja", "sunidhi chauhan (tamil)", "devan ekambaram", "udit narayan (tamil)",
  // Actors
  "vijay", "ajith", "dhanush", "simbu", "sivakarthikeyan", "vijay sethupathi",
  "kamal haasan", "rajinikanth",
  "thaman", "yuvan shankar", "dharan kumar",
]);

const TAMIL_KEYWORDS = [
  "tamil", "kollywood", "tamilsong", "inimel", "kadhal", "en", "nee", "oru",
  "vaa", "poda", "kannama", "marana", "mass", "kuthu", "vaadi", "thala",
  "thalapathy", "makkal selvan",
];

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

function getTamilSimilarArtists(artist) {
  const key = (artist || "").toLowerCase();
  if (TAMIL_SIMILAR_ARTISTS[key]) return TAMIL_SIMILAR_ARTISTS[key];
  for (const [k, v] of Object.entries(TAMIL_SIMILAR_ARTISTS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return ["anirudh ravichander", "yuvan shankar raja", "harris jayaraj", "gv prakash kumar", "d imman"];
}

function detectTamil(artist, title) {
  const a = (artist || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if ([...TAMIL_ARTISTS].some(ta => a.includes(ta))) return true;
  if (TAMIL_KEYWORDS.some(kw => t.includes(kw) || a.includes(kw))) return true;
  return false;
}

const extractCoreName = (title) => {
  if (!title) return "";
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
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length > 3 && c2.length > 3 && (c1.includes(c2) || c2.includes(c1))) return true;
  const w1 = c1.split(" ").filter(w => w.length > 2);
  const w2 = c2.split(" ").filter(w => w.length > 2);
  if (!w1.length || !w2.length) return c1 === c2;
  const common = w1.filter(w => w2.includes(w));
  return common.length / Math.max(w1.length, w2.length) > 0.6;
};

module.exports = async function handleAutoplay(client, player, lastPlayedTrack) {
  try {
    const autoplay = player.data?.get("autoplay");
    if (!autoplay) return null;

    const track = lastPlayedTrack || player.queue?.current || player.queue?.previous?.[0];
    if (!track) return null;

    const rawAuthor = track.info?.author || track.author || "";
    const rawTitle = track.info?.title || track.title || "";
    const rawUri = track.info?.uri || track.uri || "";
    const rawIdentifier = track.info?.identifier || track.identifier || "";

    const cleanAuthor = rawAuthor.replace(/\s*-\s*Topic\s*$/i, "").trim();
    const cleanTitle = rawTitle.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();

    // ── Save to history ──────────────────────────────────────────────────────
    let history = player.data?.get("history") || [];
    if (history.length === 0 || history[history.length - 1]?.uri !== rawUri) {
      history.push({
        title: rawTitle,
        author: rawAuthor,
        uri: rawUri,
        length: track.info?.duration || track.length || 0,
        thumbnail: track.info?.artworkUrl || track.thumbnail,
        requester: track.requester,
        identifier: rawIdentifier,
        sourceName: track.info?.sourceName || track.sourceName
      });
      if (history.length > 25) history.shift();
      player.data?.set("history", history);
    }

    const isInHistory = (t) => {
      const tUri = t.info?.uri || t.uri;
      const tId = t.info?.identifier || t.identifier;
      const tTitle = t.info?.title || t.title;
      return history.some(
        h => h.uri === tUri || h.identifier === tId || isSimilarTitle(h.title, tTitle)
      );
    };

    const isCurrent = (t) => {
      const tUri = t.info?.uri || t.uri;
      const tId = t.info?.identifier || t.identifier;
      const tTitle = t.info?.title || t.title;
      return (
        tUri === rawUri ||
        tId === rawIdentifier ||
        isSimilarTitle(tTitle, rawTitle)
      );
    };

    const isTamil = detectTamil(cleanAuthor, cleanTitle);
    const langSuffix = isTamil ? " Tamil" : "";

    // ── Build recommendations ────────────────────────────────────────────────
    let recommendations = [];

    try {
      const LastFM = require("./lastfm");
      const lastfm = new LastFM(client);

      if (cleanAuthor) {
        // 1. Top tracks by the same artist
        const ownTopTracks = await lastfm.getTopTracks(cleanAuthor, 10);
        for (const t of ownTopTracks) {
          if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
            recommendations.push(t);
          }
        }

        // 2. Similar tracks
        if (cleanTitle) {
          const similar = await lastfm.getSimilarTracks(cleanAuthor, cleanTitle, 15);
          for (const t of similar) {
            if (!recommendations.some(r => isSimilarTitle(r.title, t.title) && r.author === t.author)) {
              recommendations.push(t);
            }
          }
        }

        // 3. Similar artists
        let similarArtistNames;
        if (isTamil) {
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
      }
    } catch (err) {
      console.error("[Autoplay] Last.fm fetch error:", err.message);
    }

    // ── Engine priority ──────────────────────────────────────────────────────
    let engines = ["ytmsearch", "ytsearch", "spsearch", "scsearch"];
    try {
      const userId = track.requester?.id || track.requester;
      if (userId && client.db?.userpreferences) {
        const userPref = client.db.userpreferences.get(userId);
        if (userPref?.musicSource) {
          engines = [userPref.musicSource, ...engines.filter(e => e !== userPref.musicSource)];
        }
      }
    } catch (_) {}

    const findTrack = async (searchQuery) => {
      for (const engine of engines.slice(0, 2)) {
        try {
          const result = await client.manager.search(searchQuery, { engine, requester: client.user });
          if (result?.tracks?.length) {
            const found = result.tracks.find(t => !isInHistory(t) && !isCurrent(t));
            if (found) return found;
          }
        } catch (_) { continue; }
      }
      return null;
    };

    // ── Search recommendations ───────────────────────────────────────────────
    let nextTrack = null;

    for (const rec of recommendations) {
      nextTrack = await findTrack(`${rec.author} ${rec.title}${langSuffix}`);
      if (nextTrack) break;
    }

    // Fallbacks
    if (!nextTrack && cleanAuthor) {
      nextTrack = await findTrack(`${cleanAuthor} popular${langSuffix} songs`);
    }
    if (!nextTrack && isTamil) {
      const fallbackArtists = getTamilSimilarArtists(cleanAuthor);
      for (const fa of fallbackArtists) {
        nextTrack = await findTrack(`${fa} popular Tamil songs`);
        if (nextTrack) break;
      }
    }
    if (!nextTrack && cleanAuthor) {
      nextTrack = await findTrack(`${cleanAuthor}${langSuffix ? " " + langSuffix.trim() : ""}`);
    }

    // ── Queue next track ─────────────────────────────────────────────────────
    if (nextTrack) {
      nextTrack.requester = client.user;
      player.queue.add(nextTrack);
      const trackTitle = nextTrack.info?.title || nextTrack.title || "Unknown Title";
      const trackArtist = nextTrack.info?.author || nextTrack.author || "Unknown Artist";
      console.log(`[Autoplay] Queued next track: "${trackTitle}" by "${trackArtist}" for guild ${player.guildId}`);
      return nextTrack;
    } else {
      console.log(`[Autoplay] No tracks found for guild ${player.guildId}, ending autoplay`);
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(client.config.color || "#00D4FF")
          .setDescription(`**${client.emoji?.info || "ℹ️"} Autoplay could not find any more similar tracks. Queue has ended.**`);
        channel.send({ embeds: [embed] }).catch(() => null);
      }
      player.data.set("autoplay", false);
      return null;
    }
  } catch (error) {
    console.error("[Autoplay] Handler Error:", error);
    return null;
  }
};
