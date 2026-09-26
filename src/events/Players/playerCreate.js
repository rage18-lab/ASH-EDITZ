module.exports = {
  name: "playerCreate",

  run: async (client, player) => {
    const name = client.guilds.cache.get(player.guildId)?.name || 'Unknown';
    client.logger.log(`Player Create in ${name} [ ${player.guildId} ]`, "log");

    // --- Map-compatible shim for player.data ---
    // lavalink-client v2 uses a plain {} for player.data, but the codebase
    // calls .set() / .get() / .delete() / .clear() like a Map. This shim
    // patches player.data to support both Map-style methods and plain access.
    const _store = player.data ?? {};
    const dataShim = {
      set(key, value) { _store[key] = value; return this; },
      get(key) { return _store[key]; },
      delete(key) { delete _store[key]; },
      clear() { Object.keys(_store).forEach(k => delete _store[k]); },
      has(key) { return key in _store; },
    };
    // Also allow plain property access: player.data.foo
    player.data = new Proxy(dataShim, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return _store[prop];
      },
      set(target, prop, value) {
        _store[prop] = value;
        return true;
      }
    });
    // -------------------------------------------

    const guildPrefix = client.db.prefixes.get(player.guildId);
    const prefix = guildPrefix?.prefix || client.prefix;

    client.rest
      .put(`/channels/${player.voiceId}/voice-status`, {
        body: { status: `use **${prefix}play** to add songs` },
      })
      .catch(() => null);

    const guild = client.guilds.cache.get(player.guildId);
    if (!guild) return;

    if (client.voiceHealthMonitor) {
      client.voiceHealthMonitor.startMonitoring(player);
    }

    player.data.set("autoplay", true);
  },
};


