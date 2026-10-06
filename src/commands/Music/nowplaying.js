const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { convertTime } = require("../../utils/convert.js");

function formatDuration(ms) {
  if (!ms || ms === 0) return "🔴 LIVE";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function cleanAuthor(author) {
  if (!author) return "Unknown Artist";
  return author.replace(/\s*-\s*Topic\s*$/i, "").trim();
}

function buildProgressBar(position, duration, barLen = 22) {
  if (!duration || duration === 0) return { bar: "─".repeat(barLen), pos: "Live", total: "∞" };
  const pct = Math.min(position / duration, 1);
  const filled = Math.round(barLen * pct);
  const bar = "━".repeat(Math.max(0, filled)) + "🔵" + "─".repeat(Math.max(0, barLen - filled));
  return { bar, pos: formatDuration(position), total: formatDuration(duration) };
}

function getPlatformEmoji(uri = "") {
  if (uri.includes("spotify.com"))    return "🟢";
  if (uri.includes("soundcloud.com")) return "🟠";
  if (uri.includes("deezer.com"))     return "💜";
  if (uri.includes("apple"))          return "🍎";
  return "🎵";
}

function getHQThumbnail(url) {
  if (!url) return null;
  if (url.includes("i.ytimg.com") || url.includes("img.youtube.com")) {
    const m = url.match(/vi\/([^/]+)\//);
    if (m?.[1]) return `https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg`;
  }
  return url;
}

module.exports = {
  name: "nowplaying",
  aliases: ["np"],
  category: "Music",
  description: "Show the current playing song with live progress",
  args: false,
  usage: "",
  userPerms: [],
  owner: false,
  player: true,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  slashOptions: [],

  async slashExecute(interaction, client) {
    const wrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      createdTimestamp: interaction.createdTimestamp,
      reply: async (opts) => {
        if (interaction.deferred) return interaction.editReply(opts);
        if (interaction.replied)  return interaction.followUp(opts);
        return interaction.reply(opts);
      },
    };
    return this.execute(wrapper, [], client, client.prefix);
  },

  async execute(message, args, client, prefix) {
    const player = client.manager.players.get(message.guild.id);

    if (!player?.queue?.current) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.cross} Nothing is playing right now.**`);
      const c = new ContainerBuilder().addTextDisplayComponents(display);
      return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }

    const track    = player.queue.current;
    const info     = track.info || track;
    const title    = info.title   || "Unknown Title";
    const uri      = info.uri     || info.url || "#";
    const author   = info.author  || "Unknown Artist";
    const duration = info.duration || info.length || track.length || 0;
    const artwork  = info.artworkUrl || info.thumbnail || info.image;
    const requester = track.requester;

    const platform = getPlatformEmoji(uri);
    const thumb    = getHQThumbnail(artwork);
    const loopMode = player.repeatMode || player.loop || "none";
    const loopTag  = loopMode === "track"  ? " • 🔂 Loop"
                   : loopMode === "queue"  ? " • 🔁 Queue Loop"
                   : "";
    const volume   = player.volume ?? 100;
    const queueLen = player.queue?.length ?? 0;

    const createContainer = () => {
      const pos  = player.position || 0;
      const { bar, pos: posStr, total } = buildProgressBar(pos, duration);

      const titleLine = new TextDisplayBuilder()
        .setContent(
          `### ${platform} [${title.slice(0, 50)}](${uri})\n` +
          `> 🎤 **${cleanAuthor(author)}**${loopTag}  •  🔊 ${volume}%  •  📋 ${queueLen} in queue`
        );

      const progressLine = new TextDisplayBuilder()
        .setContent(
          `\`${posStr}\` ${bar} \`${total}\`\n` +
          `> 👤 Requested by: **${requester?.username || "Unknown"}**`
        );

      const container = new ContainerBuilder();

      if (thumb) {
        const section = new SectionBuilder()
          .addTextDisplayComponents(titleLine, progressLine)
          .setThumbnailAccessory((t) => t.setURL(thumb));
        container.addSectionComponents(section);
      } else {
        container.addTextDisplayComponents(titleLine, progressLine);
      }

      return container;
    };

    const npmsg = await message.reply({
      components: [createContainer()],
      flags: MessageFlags.IsComponentsV2,
    });

    // ── Live update every 5s ──────────────────────────────────────────────
    const interval = setInterval(() => {
      if (!player?.playing || !npmsg) { clearInterval(interval); return; }
      npmsg.edit({ components: [createContainer()], flags: MessageFlags.IsComponentsV2 })
        .catch(() => clearInterval(interval));
    }, 5000);

    const cleanup = () => clearInterval(interval);

    const collector = npmsg.createMessageComponentCollector({ time: 300000 });
    collector.on("end", cleanup);

    const onEnd     = (p) => { if (p.guildId === message.guild.id) cleanup(); };
    const onStop    = (p) => { if (p.guildId === message.guild.id) cleanup(); };
    const onEmpty   = (p) => { if (p.guildId === message.guild.id) cleanup(); };
    const onDestroy = (p) => { if (p.guildId === message.guild.id) cleanup(); };

    client.manager.on("playerEnd",     onEnd);
    client.manager.on("playerStop",    onStop);
    client.manager.on("playerEmpty",   onEmpty);
    client.manager.on("playerDestroy", onDestroy);

    collector.once("end", () => {
      client.manager.off("playerEnd",     onEnd);
      client.manager.off("playerStop",    onStop);
      client.manager.off("playerEmpty",   onEmpty);
      client.manager.off("playerDestroy", onDestroy);
    });
  },
};
