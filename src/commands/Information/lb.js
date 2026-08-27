const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");

const medals = ["🥇", "🥈", "🥉"];

module.exports = {
  name: "lb",
  category: "Information",
  description: "Show the music leaderboard — top users by songs played",
  args: false,
  usage: "",
  aliases: ["leaderboard", "topp", "musiclb"],
  userPerms: [],
  owner: false,
  slashOptions: [],

  async slashExecute(interaction, client) {
    await interaction.deferReply();
    const interactionWrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      reply: async (options) => interaction.editReply(options),
    };
    return this.execute(interactionWrapper, [], client, client.prefix);
  },

  async execute(message, args, client, prefix) {
    // Fetch top 10 users
    let topUsers = [];
    try {
      topUsers = client.db.musicStats.getTopUsers(10);
    } catch (err) {
      console.error("[LB] Failed to fetch leaderboard:", err);
    }

    if (!topUsers || topUsers.length === 0) {
      const emptyDisplay = new TextDisplayBuilder()
        .setContent(
          `### ${client.emoji.info} Music Leaderboard\n` +
          `> No songs have been played yet. Start playing music to appear on the leaderboard!`
        );
      const container = new ContainerBuilder().addTextDisplayComponents(emptyDisplay);
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // Resolve usernames from Discord
    const rows = [];
    for (let i = 0; i < topUsers.length; i++) {
      const entry = topUsers[i];
      let username = `Unknown User`;

      try {
        const user = await client.users.fetch(entry.userId).catch(() => null);
        if (user) username = user.username;
      } catch (_) {}

      const rank = i + 1;
      const medal = medals[i] ?? `**\`#${rank}\`**`;
      const isAuthor = entry.userId === (message.author?.id ?? "");
      const nameStr = isAuthor ? `**${username}** (You)` : `**${username}**`;
      const lastSong = entry.lastSong
        ? `\n${client.emoji.dot} Last: *${entry.lastSong.slice(0, 40)}${entry.lastSong.length > 40 ? "…" : ""}*`
        : "";

      rows.push(`${medal} ${nameStr} — ${client.emoji.hastag} \`${entry.songsPlayed}\` songs${lastSong}`);
    }

    // Find caller's own rank
    let callerRankText = "";
    try {
      const authorId = message.author?.id;
      if (authorId) {
        const allTop = client.db.musicStats.getTopUsers(1000);
        const callerIdx = allTop.findIndex((u) => u.userId === authorId);
        if (callerIdx >= 10 && callerIdx !== -1) {
          const callerEntry = allTop[callerIdx];
          callerRankText = `\n${client.emoji.arrowright} Your rank: **#${callerIdx + 1}** — \`${callerEntry.songsPlayed}\` songs played`;
        }
      }
    } catch (_) {}

    const titleDisplay = new TextDisplayBuilder()
      .setContent(`### ${client.emoji.hastag} Music Leaderboard — Top Listeners`);

    const sep = new SeparatorBuilder();

    const boardDisplay = new TextDisplayBuilder()
      .setContent(rows.join("\n") + callerRankText);

    const footerDisplay = new TextDisplayBuilder()
      .setContent(`-# ${client.emoji.info} Stats update every time a song starts playing.`);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(titleDisplay)
      .addSeparatorComponents(sep)
      .addTextDisplayComponents(boardDisplay)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(footerDisplay);

    return message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

