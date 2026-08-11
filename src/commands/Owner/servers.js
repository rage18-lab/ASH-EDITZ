const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");

// ─────────────────────────────────────────────
//  Owner-only command: servers
//  Lists every guild the bot is currently in.
//  Only bot owners (config.ownerID) can run it.
// ─────────────────────────────────────────────
module.exports = {
  name: "servers",
  category: "Owner",
  description: "Shows a list of all servers the bot is in. (Owner only)",
  botPerms: ["EmbedLinks"],
  args: false,
  usage: "",
  aliases: ["serverlist", "guilds"],
  userPerms: [],
  owner: true,   // ← messageCreate.js already blocks non-owners here
  cooldown: 5,

  // ── Slash ──────────────────────────────────
  slashOptions: [],
  async slashExecute(interaction, client) {
    // Wrap slash interaction so we can reuse execute()
    const wrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      reply: async (options) => {
        if (interaction.deferred) return interaction.editReply(options);
        if (interaction.replied) return interaction.followUp(options);
        return interaction.reply(options);
      },
    };
    return this.execute(wrapper, [], client, client.prefix);
  },

  // ── Prefix ─────────────────────────────────
  async execute(message, args, client, prefix) {
    /* Extra guard – only bot owners may use this command */
    if (!client.config.ownerID.includes(message.author.id)) return;

    const guilds = [...client.guilds.cache.values()];
    const totalGuilds = guilds.length;
    const totalMembers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    // ── Paginate: 15 servers per page ──────────
    const PAGE_SIZE = 15;
    const pages = [];
    for (let i = 0; i < guilds.length; i += PAGE_SIZE) {
      pages.push(guilds.slice(i, i + PAGE_SIZE));
    }

    // Build one message per page (send page 1, log the rest to console for now)
    const page = pages[0] || [];

    const headerDisplay = new TextDisplayBuilder().setContent(
      `${client.emoji.owner} **Bot Server List**\n` +
      `> Total Servers \`:\` **\`${totalGuilds}\`**\n` +
      `> Total Members \`:\` **\`${totalMembers}\`**`
    );

    const sep1 = new SeparatorBuilder();

    // Build the server list string
    const listLines = page.map((g, idx) => {
      const name   = g.name.length > 30 ? g.name.slice(0, 27) + "..." : g.name;
      const id     = g.id;
      const members = g.memberCount ?? "?";
      const owner  = g.ownerId ?? "Unknown";
      return (
        `**${idx + 1}.** \`${name}\`\n` +
        `> ID \`:\` \`${id}\` • Members \`:\` \`${members}\` • Owner \`:\` <@${owner}>`
      );
    }).join("\n\n");

    const listDisplay = new TextDisplayBuilder().setContent(
      listLines || "No servers found."
    );

    const sep2 = new SeparatorBuilder();

    const footerDisplay = new TextDisplayBuilder().setContent(
      `${client.emoji.info} Showing **${page.length}** of **${totalGuilds}** servers` +
      (pages.length > 1 ? ` • Page **1** / **${pages.length}**` : "")
    );

    const container = new ContainerBuilder()
      .addTextDisplayComponents(headerDisplay)
      .addSeparatorComponents(sep1)
      .addTextDisplayComponents(listDisplay)
      .addSeparatorComponents(sep2)
      .addTextDisplayComponents(footerDisplay);

    // Send remaining pages as follow-up DMs to the owner (keeps channels clean)
    const reply = await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    // If there are extra pages, DM them to the owner
    if (pages.length > 1) {
      try {
        const owner = await client.users.fetch(message.author.id);
        for (let p = 1; p < pages.length; p++) {
          const pageGuilds = pages[p];
          const pageLines = pageGuilds.map((g, idx) => {
            const name    = g.name.length > 30 ? g.name.slice(0, 27) + "..." : g.name;
            const members = g.memberCount ?? "?";
            const ownerId = g.ownerId ?? "Unknown";
            const globalIdx = p * PAGE_SIZE + idx + 1;
            return (
              `**${globalIdx}.** \`${name}\`\n` +
              `> ID \`:\` \`${g.id}\` • Members \`:\` \`${members}\` • Owner \`:\` <@${ownerId}>`
            );
          }).join("\n\n");

          const pageHeader = new TextDisplayBuilder().setContent(
            `${client.emoji.owner} **Server List — Page ${p + 1} / ${pages.length}**`
          );
          const pageSep = new SeparatorBuilder();
          const pageList = new TextDisplayBuilder().setContent(pageLines);

          const pageContainer = new ContainerBuilder()
            .addTextDisplayComponents(pageHeader)
            .addSeparatorComponents(pageSep)
            .addTextDisplayComponents(pageList);

          await owner.send({
            components: [pageContainer],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => null);
        }
      } catch (err) {
        console.error("[Servers CMD] Failed to DM extra pages:", err.message);
      }
    }

    return reply;
  },
};
