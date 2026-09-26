const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} = require("discord.js");
const { convertTime } = require("../../utils/convert.js");

module.exports = {
  name: "queuestats",
  category: "Music",
  aliases: ["qs", "qstats"],
  description: "Shows analytics and statistics for the current music queue.",
  player: true,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  slashOptions: [],

  async slashExecute(interaction, client) {
    const player = client.manager.players.get(interaction.guildId);

    if (!player) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.warn} No active player found for this server.**`);
      return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
    }

    const current = player.queue.current;
    const queue = player.queue;
    const allTracks = current ? [current, ...queue] : [...queue];

    if (allTracks.length === 0) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.warn} The queue is empty.**`);
      return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
    }

    // Total duration
    const totalMs = allTracks.reduce((sum, t) => sum + (t.length || t.duration || 0), 0);

    // Requester breakdown
    const requesterCount = {};
    for (const t of allTracks) {
      const name = t.requester?.username || "Unknown";
      requesterCount[name] = (requesterCount[name] || 0) + 1;
    }
    const topRequester = Object.entries(requesterCount).sort((a, b) => b[1] - a[1])[0];

    // Source breakdown
    const sourceCount = {};
    for (const t of allTracks) {
      const src = detectSource(t);
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    }

    // Average track length
    const avgMs = Math.floor(totalMs / allTracks.length);

    // Longest track
    const longest = allTracks.reduce((a, b) => ((a.length || 0) > (b.length || 0) ? a : b));

    const headerDisplay = new TextDisplayBuilder()
      .setContent(`### ${client.emoji.check} Queue Statistics`);

    const statsDisplay = new TextDisplayBuilder()
      .setContent(
        `${client.emoji.dot} **Total Tracks:** \` ${allTracks.length} \`\n` +
        `${client.emoji.dot} **Total Duration:** \` ${convertTime(totalMs)} \`\n` +
        `${client.emoji.dot} **Average Track Length:** \` ${convertTime(avgMs)} \`\n` +
        `${client.emoji.dot} **Top Requester:** \` ${topRequester[0]} (${topRequester[1]} songs) \``
      );

    const sourceLines = Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .map(([src, count]) => {
        const srcEmoji = getSourceEmoji(src, client);
        const pct = Math.round((count / allTracks.length) * 100);
        const bar = buildBar(pct);
        return `${srcEmoji} **${src}** \` ${count} tracks (${pct}%) \` ${bar}`;
      })
      .join("\n");

    const sourceDisplay = new TextDisplayBuilder()
      .setContent(`**Source Breakdown:**\n${sourceLines}`);

    const longestDisplay = new TextDisplayBuilder()
      .setContent(
        `${client.emoji.dot} **Longest Track:** [${truncate(longest.title, 30)}](${longest.uri}) — \` ${convertTime(longest.length || 0)} \``
      );

    const container = new ContainerBuilder()
      .addTextDisplayComponents(headerDisplay)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(statsDisplay)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(sourceDisplay)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(longestDisplay);

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
};

function detectSource(track) {
  const uri = (track.uri || track.url || "").toLowerCase();
  const sourceName = (track.sourceName || "").toLowerCase();
  if (uri.includes("spotify") || sourceName.includes("spotify")) return "Spotify";
  if (uri.includes("youtu") || sourceName.includes("youtube")) return "YouTube";
  if (uri.includes("music.youtube") || sourceName.includes("ytmusic")) return "YT Music";
  if (uri.includes("soundcloud") || sourceName.includes("soundcloud")) return "SoundCloud";
  if (uri.includes("deezer") || sourceName.includes("deezer")) return "Deezer";
  if (uri.includes("jiosaavn") || sourceName.includes("jiosaavn")) return "JioSaavn";
  return "Other";
}

function getSourceEmoji(source, client) {
  const map = {
    "Spotify": client.emoji.spotify || "🟢",
    "YouTube": client.emoji.youtube || "🔴",
    "YT Music": client.emoji.ytmusic || "🎵",
    "SoundCloud": client.emoji.soundcloud || "🟠",
    "Deezer": client.emoji.deezer || "🟣",
    "JioSaavn": client.emoji.jiosaavn || "🔵",
    "Other": client.emoji.dot || "⚫",
  };
  return map[source] || "🎵";
}

function buildBar(percent) {
  const filled = Math.round(percent / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function truncate(str, max) {
  if (!str) return "Unknown";
  return str.length <= max ? str : str.substring(0, max) + "...";
}

