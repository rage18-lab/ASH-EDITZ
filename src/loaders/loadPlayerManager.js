const { LavalinkManager } = require("lavalink-client");

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
      },
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
  });

  manager.searchEngines = searchEngines;

  // Override search with fallback-engine logic
  const originalSearch = manager.search?.bind(manager);

  manager.search = async function (query, requesterOrOpts, options = {}) {
    if (!this.nodeManager?.nodes) return { loadType: "empty", tracks: [] };
    const node = [...this.nodeManager.nodes.values()].find(n => n.connected) ||
      [...this.nodeManager.nodes.values()][0];
    if (!node) return { loadType: "empty", tracks: [] };

    // Handle both call signatures:
    //   manager.search(query, requester, options)  ← direct calls
    //   manager.search(query, { requester, engine }) ← player.search() internals
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
    const isYouTube = cleanQuery.includes("youtube.com") || cleanQuery.includes("youtu.be") || cleanQuery.includes("music.youtube.com");

    if (isYouTube) {
      const strategies = videoId
        ? [cleanQuery, `ytsearch:${videoId}`, `ytmsearch:${videoId}`]
        : [cleanQuery, `ytsearch:${cleanQuery}`, `ytmsearch:${cleanQuery}`];

      for (const q of strategies) {
        const res = await node.rest.loadTracks(q).catch(() => null);
        if (res && res.loadType !== "empty" && res.loadType !== "error") {
          if (res.tracks?.length > 0) return processResult(res, requester);
        }
      }
    }

    if (!isUrl) {
      const engineList = source
        ? [source]
        : [...new Set([client.config.node_source || "ytmsearch", ...fallbackEngines])];

      for (const engine of engineList) {
        if (!engine) continue;
        const searchQuery = engine.includes(":") ? cleanQuery : `${engine}:${cleanQuery}`;
        const res = await node.rest.loadTracks(searchQuery).catch(() => null);
        if (res && res.loadType !== "empty" && res.loadType !== "error") {
          return processResult(res, requester);
        }
      }
    }

    // fallback to built-in
    if (originalSearch) {
      return originalSearch({ query: cleanQuery, source }, requester).catch(() => ({ loadType: "empty", tracks: [] }));
    }
    return { loadType: "empty", tracks: [] };
  };


  function processResult(res, requester) {
    if (!res) return { loadType: "empty", tracks: [] };
    // Stamp requester on each track
    if (res.tracks) {
      res.tracks = res.tracks.map(t => {
        t.requester = requester;
        return t;
      });
    }
    return res;
  }

  // Node-level events
  manager.nodeManager.on("connect", (node) =>
    console.log(`[Lavalink] Node "${node.id}" connected.`)
  );
  manager.nodeManager.on("error", (node, error) =>
    console.log(`[Lavalink] Node "${node.id}" error: ${error?.message || error}`)
  );
  manager.nodeManager.on("disconnect", (node, reason) =>
    console.log(`[Lavalink] Node "${node.id}" disconnected. Code: ${reason?.code || "?"}`)
  );
  manager.nodeManager.on("reconnecting", (node) =>
    console.log(`[Lavalink] Node "${node.id}" reconnecting...`)
  );
  manager.nodeManager.on("reconnect", (node) =>
    console.log(`[Lavalink] Node "${node.id}" reconnected.`)
  );

  manager.on("error", (player, error) => {
    console.error(`[LavalinkManager] Error:`, error);
  });

  client.manager = manager;
  return manager;
};
