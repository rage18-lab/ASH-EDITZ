const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { readdirSync, existsSync } = require("fs");
const { ClusterClient, getInfo } = require("discord-hybrid-sharding");
const permissionHandler = require("../events/Client/PremiumChecks");

class MusicBot extends Client {
  constructor() {
    super({
      intents: 34803,
      partials: ["MESSAGE", "CHANNEL", "REACTION"],
      properties: {
        browser: "Discord Android",
      },
      allowedMentions: {
        parse: ["roles", "users", "everyone"],
        repliedUser: false,
      },
      shards: (() => { try { return getInfo().SHARD_LIST; } catch { return [0]; } })(),
      shardCount: (() => { try { return getInfo().TOTAL_SHARDS; } catch { return 1; } })(),
    });

    this.commands = new Collection();
    this.slashCommands = new Collection();
    this.config = require("../config.js");
    this.owners = this.config.ownerID;
    this.prefix = this.config.prefix;
    this.color = this.config.color;
    this.embedColor = this.config.color;
    this.button = require("../custom/button.js");
    this.embed = require("../custom/embed.js")(this.color);
    require("../custom/numformat")(this);
    this.aliases = new Collection();
    this.logger = require("../utils/logger.js");
    this.emoji = require("../emojis.js");
    this.cluster = new ClusterClient(this);
    if (!this.token) this.token = this.config.token;
    this.spamMap = new Map();
    this.cooldowns = new Collection();
    this.db = require("./Database"); // managers object, already populated by initDatabase()
    this.logger.log("[DB] SQLite Database Connected (sql.js)", "ready");

    permissionHandler(this);

    [
      "loadClients",
      "loadCommands",
    ].forEach((handler) => {
      require(`../loaders/${handler}`)(this);
    });
  }

  connect() {
    return super.login(this.token);
  }
}

module.exports = MusicBot;
