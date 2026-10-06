const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const MEDALS   = ["🥇", "🥈", "🥉"];
const RANKS    = ["👑", "⭐", "💫", "🔥", "🎵", "🎶", "🎤", "🎸", "🎺", "🎻"];
const BAR_LEN  = 12;

function buildBar(value, max) {
  if (!max || max === 0) return "░".repeat(BAR_LEN);
  const filled = Math.round((value / max) * BAR_LEN);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, BAR_LEN - filled));
}

function fmtNum(n) {
  return (n || 0).toLocaleString();
}

module.exports = {
  name: "lb",
  category: "Music",
  description: "Show the top music listeners leaderboard",
  args: false,
  usage: "",
  aliases: ["leaderboard", "topp", "musiclb", "toplisteners"],
  userPerms: [],
  owner: false,
  slashOptions: [],

  async slashExecute(interaction, client) {
    await interaction.deferReply();
    const wrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      reply: async (options) => interaction.editReply(options),
    };
    return this.execute(wrapper, [], client, client.prefix);
  },

  async execute(message, args, client, prefix) {
    let topUsers = [];
    try {
      topUsers = client.db.musicStats.getTopUsers(10);
    } catch (err) {
      console.error("[LB] fetch error:", err);
    }

    // ── Empty State ────────────────────────────────────────────────────────
    if (!topUsers || topUsers.length === 0) {
      const display = new TextDisplayBuilder()
        .setContent(
          `### 🏆 Music Leaderboard\n\n` +
          `${client.emoji.info || "ℹ️"} **No stats yet!**\n` +
          `> Use \`${prefix}play\` to start listening and climb the ranks!`
        );
      const container = new ContainerBuilder().addTextDisplayComponents(display);
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // ── Fetch totals ───────────────────────────────────────────────────────
    let totalSongsPlayed = 0;
    let totalUsers = 0;
    try {
      const all = client.db.musicStats.getTopUsers(10000);
      totalUsers = all.length;
      totalSongsPlayed = all.reduce((s, u) => s + (u.songsPlayed || 0), 0);
    } catch (_) {}

    // ── Fetch usernames concurrently ───────────────────────────────────────
    const fetchedUsers = await Promise.all(
      topUsers.map(entry =>
        client.users.fetch(entry.userId).catch(() => null)
      )
    );

    // ── Caller rank ────────────────────────────────────────────────────────
    let callerRank = null, callerSongs = 0;
    try {
      const authorId = message.author?.id;
      if (authorId) {
        const all = client.db.musicStats.getTopUsers(10000);
        const idx = all.findIndex(u => u.userId === authorId);
        if (idx !== -1) {
          callerRank  = idx + 1;
          callerSongs = all[idx].songsPlayed || 0;
        }
      }
    } catch (_) {}

    const maxSongs = topUsers[0]?.songsPlayed || 1;

    // ── Build player cards ─────────────────────────────────────────────────
    const lines = topUsers.map((entry, i) => {
      const user       = fetchedUsers[i];
      const username   = user?.username || "Unknown User";
      const medal      = MEDALS[i] || RANKS[i] || `\`#${i + 1}\``;
      const songs      = entry.songsPlayed || 0;
      const bar        = buildBar(songs, maxSongs);
      const isCaller   = entry.userId === (message.author?.id ?? "");
      const callerTag  = isCaller ? " ⭐ **You**" : "";
      const lastSong   = entry.lastSong
        ? `\n> └ 🎵 *${entry.lastSong.slice(0, 40)}${entry.lastSong.length > 40 ? "…" : ""}*`
        : "";

      return (
        `${medal} **${username}**${callerTag} — \`${fmtNum(songs)} plays\`\n` +
        `> \`${bar}\`${lastSong}`
      );
    });

    // ── Stats summary ──────────────────────────────────────────────────────
    const statsLine =
      `📊 **${fmtNum(totalSongsPlayed)}** total plays  •  ` +
      `👥 **${fmtNum(totalUsers)}** listeners  •  ` +
      `🏅 Top **${topUsers.length}** shown`;

    // ── Caller section ─────────────────────────────────────────────────────
    let callerLine = "";
    if (callerRank) {
      callerLine = `\n\n> 📍 **Your rank:** \`#${callerRank}\` with **${fmtNum(callerSongs)} plays**`;
    } else {
      callerLine = `\n\n> 📍 Play some music to appear on this board!`;
    }

    // ── Assemble container ─────────────────────────────────────────────────
    const headerDisplay = new TextDisplayBuilder()
      .setContent(`### 🏆 Music Leaderboard — Top Listeners\n${statsLine}`);

    const sep = new SeparatorBuilder();

    const listDisplay = new TextDisplayBuilder()
      .setContent(lines.join("\n\n") + callerLine);

    const footerDisplay = new TextDisplayBuilder()
      .setContent(
        `-# Requested by ${message.author?.username || "User"}  •  Updated just now`
      );

    const container = new ContainerBuilder()
      .addTextDisplayComponents(headerDisplay)
      .addSeparatorComponents(sep)
      .addTextDisplayComponents(listDisplay)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(footerDisplay);

    return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
