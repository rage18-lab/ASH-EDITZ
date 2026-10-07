const { LavalinkManager, ManagerUtils } = require("lavalink-client");

// Patch ManagerUtils to provide direct property access on built tracks for legacy compatibility
const origBuildTrack = ManagerUtils.prototype.buildTrack;
ManagerUtils.prototype.buildTrack = function (data, requester) {
  const r = origBuildTrack.call(this, data, requester);
  if (r && r.info) {
    Object.defineProperties(r, {
      title: { get() { return this.info?.title; }, set(v) { if (this.info) this.info.title = v; }, configurable: true },
      author: { get() { return this.info?.author; }, set(v) { if (this.info) this.info.author = v; }, configurable: true },
      uri: { get() { return this.info?.uri; }, set(v) { if (this.info) this.info.uri = v; }, configurable: true },
      length: { get() { return this.info?.duration || 0; }, set(v) { if (this.info) this.info.duration = v; }, configurable: true },
      duration: { get() { return this.info?.duration || 0; }, set(v) { if (this.info) this.info.duration = v; }, configurable: true },
      thumbnail: { get() { return this.info?.artworkUrl; }, set(v) { if (this.info) this.info.artworkUrl = v; }, configurable: true },
      identifier: { get() { return this.info?.identifier; }, set(v) { if (this.info) this.info.identifier = v; }, configurable: true },
      sourceName: { get() { return this.info?.sourceName; }, set(v) { if (this.info) this.info.sourceName = v; }, configurable: true },
    });
  }
  return r;
};

if (typeof ManagerUtils.prototype.buildUnresolvedTrack === "function") {
  const origBuildUnresolved = ManagerUtils.prototype.buildUnresolvedTrack;
  ManagerUtils.prototype.buildUnresolvedTrack = function (...args) {
    const r = origBuildUnresolved.apply(this, args);
    if (r && r.info) {
      Object.defineProperties(r, {
        title: { get() { return this.info?.title; }, set(v) { if (this.info) this.info.title = v; }, configurable: true },
        author: { get() { return this.info?.author; }, set(v) { if (this.info) this.info.author = v; }, configurable: true },
        uri: { get() { return this.info?.uri; }, set(v) { if (this.info) this.info.uri = v; }, configurable: true },
        length: { get() { return this.info?.duration || 0; }, set(v) { if (this.info) this.info.duration = v; }, configurable: true },
        duration: { get() { return this.info?.duration || 0; }, set(v) { if (this.info) this.info.duration = v; }, configurable: true },
        thumbnail: { get() { return this.info?.artworkUrl; }, set(v) { if (this.info) this.info.artworkUrl = v; }, configurable: true },
        identifier: { get() { return this.info?.identifier; }, set(v) { if (this.info) this.info.identifier = v; }, configurable: true },
        sourceName: { get() { return this.info?.sourceName; }, set(v) { if (this.info) this.info.sourceName = v; }, configurable: true },
      });
    }
    return r;
  };
}

const searchEngines = {
  DEEZER: "dzsearch",
  SPOTIFY: "spsearch",
  YOUTUBE: "ytsearch",
  JIO_SAAVAN: "jssearch",
  APPLE_MUSIC: "amsearch",
  YOUTUBE_MUSIC: "ytmsearch",
  GAANA: "gnsearch",
  SOUNDCLOUD: "scsearch"
};

const fallbackEngines = ["ytmsearch", "amsearch", "spsearch", "ytsearch"];

module.exports = function loadPlayerManager(client) {
  const nodes = client.config.nodes.map(node => ({
    ...node,
    ...client.config.node_options,
  }));

  const manager = new LavalinkManager({
    nodes,
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: client.user?.id || "000000000000000000",
      username: "Hot Pursuit",
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: client.config.node_source || "ytmsearch",
      volumeDecrementer: 1,
      useUnresolvedData: true,
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
      onEmptyQueue: {
        destroyAfterMs: undefined, // handled manually via queueEnd event
        autoPlayFunction: async (player, lastPlayedTrack) => {
          if (!player.data?.get("autoplay")) return;
          try {
            const handleAutoplay = require("../utils/autoplayHandler");
            await handleAutoplay(client, player, lastPlayedTrack);
          } catch (err) {
            console.error("[Autoplay] autoPlayFunction error:", err);
          }
        },
      },
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
  });

  manager.searchEngines = searchEngines;

  // Search function using LavalinkNode.search
  manager.search = async function (query, requesterOrOpts, options = {}) {
    if (!this.nodeManager?.nodes) return { loadType: "empty", tracks: [] };
    const node = [...this.nodeManager.nodes.values()].find(n => n.connected) ||
      [...this.nodeManager.nodes.values()][0];
    if (!node) return { loadType: "empty", tracks: [] };

    let requester, source;
    if (requesterOrOpts && typeof requesterOrOpts === "object" && !requesterOrOpts.id && (requesterOrOpts.requester !== undefined || requesterOrOpts.source !== undefined || requesterOrOpts.engine !== undefined)) {
      requester = requesterOrOpts.requester;
      source = requesterOrOpts.source || requesterOrOpts.engine || options.source;
    } else {
      requester = requesterOrOpts;
      source = (typeof query === "object" ? query.source : null) || options.source || options.engine;
    }

    let cleanQuery = (typeof query === "string" ? query : query.query || "").trim().replace(/[<>]/g, "");

    const ytIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const ytMatch = cleanQuery.match(ytIdRegex);
    const videoId = ytMatch ? ytMatch[1] : null;

    if (videoId) {
      cleanQuery = `https://www.youtube.com/watch?v=${videoId}`;
    }

    const isUrl = /^https?:\/\//.test(cleanQuery);

    if (isUrl) {
      try {
        const res = await node.search({ query: cleanQuery }, requester);
        if (res && res.loadType !== "empty" && res.loadType !== "error" && res.tracks?.length) {
          return res;
        }
      } catch (_) {}
    } else {
      const defaultEngine = client.config.node_source || "ytmsearch";
      const engineList = source
        ? [source, ...fallbackEngines.filter(e => e !== source)]
        : [...new Set([defaultEngine, ...fallbackEngines])];

      for (const engine of engineList) {
        if (!engine) continue;
        try {
          const res = await node.search({ query: cleanQuery, source: engine }, requester);
          if (res && res.loadType !== "empty" && res.loadType !== "error" && res.tracks?.length) {
            return res;
          }
        } catch (_) { continue; }
      }
    }

    return { loadType: "empty", tracks: [] };
  };

  // NOTE: Node-level events (connect/disconnect/error/reconnecting/reconnect) are
  // registered by loadNodes.js from events/Node/. We only register the manager-level
  // error here to avoid double-firing.
  manager.on("error", (player, error) => {
    console.error(`[LavalinkManager] Error:`, error);
  });

  // Guard: if a node is rate-limited (code 4000), disable auto-retry to
  // stop the reconnect storm that public nodes impose on free bots.
  manager.nodeManager.on("disconnect", (node, reason) => {
    if (reason?.code === 4000) {
      console.warn(`[Lavalink] Node "${node.id}" rate-limited (4000). Suppressing auto-reconnect for 2 minutes.`);
      node.options.retryAmount = 0; // stop lavalink-client from retrying immediately
      setTimeout(() => {
        node.options.retryAmount = client.config.node_options?.retryAmount ?? 5;
        console.log(`[Lavalink] Node "${node.id}" reconnect allowed again. Attempting...`);
        node.connect().catch(() => {});
      }, 2 * 60 * 1000); // wait 2 minutes before retrying
    }
  });

  // Bridge lavalink-client v2 events to legacy bot player events
  manager.on("trackStart", (player, track, payload) => {
    manager.emit("playerStart", player, track, payload);
  });

  manager.on("trackEnd", (player, track, payload) => {
    manager.emit("playerEnd", player, track, payload);
  });

  manager.on("queueEnd", (player, track, payload) => {
    manager.emit("playerEmpty", player, track, payload);
  });

  manager.on("trackError", (player, track, payload) => {
    manager.emit("playerError", player, "TrackLoadFailed", payload);
  });

  manager.on("trackStuck", (player, track, payload) => {
    manager.emit("playerError", player, "TrackStuckEvent", payload);
  });

  client.manager = manager;
  return manager;
};
