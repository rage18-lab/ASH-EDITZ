const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { convertTime } = require("../../utils/convert.js");

const PAGE_SIZE = 8;

function getPlatformEmoji(uri = "") {
  if (uri.includes("spotify.com"))   return "🟢";
  if (uri.includes("soundcloud.com")) return "🟠";
  if (uri.includes("deezer.com"))     return "💜";
  if (uri.includes("apple"))          return "🍎";
  return "🎵";
}

function buildQueueContainer(client, player, page, pages) {
  const queue   = player.queue;
  const current = queue.current;

  const totalMs = (current?.length || 0) +
    [...queue].reduce((s, t) => s + (t?.length || 0), 0);

  const start     = page * PAGE_SIZE;
  const pageItems = [...queue].slice(start, start + PAGE_SIZE);

  // ── Header ────────────────────────────────────────────────────────────────
  const loopMode = player.repeatMode || player.loop || "none";
  const loopTag  = loopMode === "track"  ? " • 🔂 Track"
                 : loopMode === "queue"  ? " • 🔁 Queue"
                 : "";
  const volTag   = ` • 🔊 ${player.volume ?? 100}%`;

  const headerDisplay = new TextDisplayBuilder()
    .setContent(
      `### 📋 Music Queue — ${player.guild?.name || "Server"}\n` +
      `> ${client.emoji.info} **${queue.length + 1}** track${queue.length !== 0 ? "s" : ""}  •  ` +
      `⏱ **${convertTime(totalMs)}** total${loopTag}${volTag}`
    );

  // ── Now Playing card ──────────────────────────────────────────────────────
  const np = current
    ? `**NOW PLAYING** ${getPlatformEmoji(current.uri || "")}\n` +
      `🎵 **[${(current.title || "Unknown").slice(0, 45)}](${current.uri})** — \`${convertTime(current.length || 0)}\`\n` +
      `> 👤 Requested by: ${current.requester?.username || "Unknown"}`
    : `*Nothing is currently playing.*`;

  const npDisplay = new TextDisplayBuilder().setContent(np);

  // ── Queue list ────────────────────────────────────────────────────────────
  let queueContent = "";
  if (pageItems.length === 0) {
    queueContent = "*Queue is empty — add more tracks!*";
  } else {
    queueContent = pageItems.map((track, i) => {
      const idx      = start + i + 1;
      const platform = getPlatformEmoji(track.uri || "");
      const title    = (track.title || "Unknown").slice(0, 42);
      const dur      = convertTime(track.length || 0);
      const requester = track.requester?.username || "?";
      return `**\`${String(idx).padStart(2, " ")}\`** ${platform} [${title}](${track.uri}) — \`${dur}\` • 👤 ${requester}`;
    }).join("\n");
  }

  const queueDisplay = new TextDisplayBuilder().setContent(queueContent);

  // ── Footer/page indicator ─────────────────────────────────────────────────
  const footerDisplay = new TextDisplayBuilder()
    .setContent(`-# Page ${page + 1} / ${Math.max(1, pages)}  •  Use the buttons below to navigate`);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(headerDisplay)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(npDisplay)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(queueDisplay)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(footerDisplay);

  return container;
}

function buildNavRow(page, pages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("q_first")
      .setLabel("⏮ First")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("q_prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("q_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pages - 1),
    new ButtonBuilder()
      .setCustomId("q_last")
      .setLabel("Last ⏭")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pages - 1),
    new ButtonBuilder()
      .setCustomId("q_close")
      .setLabel("✕ Close")
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  name: "queue",
  aliases: ["q"],
  category: "Music",
  description: "Show the server music queue",
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
      const container = new ContainerBuilder().addTextDisplayComponents(display);
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const queue = player.queue;
    const pages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
    let page    = 0;

    const buildComponents = (p) => {
      const container = buildQueueContainer(client, player, p, pages);
      const comps     = [container];
      if (pages > 1) comps.push(buildNavRow(p, pages));
      return comps;
    };

    const queueMsg = await message.channel.send({
      components: buildComponents(0),
      flags: MessageFlags.IsComponentsV2,
    });

    if (pages <= 1) return;

    const collector = queueMsg.createMessageComponentCollector({
      filter: (b) => {
        if (b.user.id === message.author.id) return true;
        const display = new TextDisplayBuilder()
          .setContent(`**${client.emoji.cross} Only ${message.author.tag} can control this queue panel.**`);
        const c = new ContainerBuilder().addTextDisplayComponents(display);
        b.reply({ components: [c], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => {});
        return false;
      },
      idle: 30000,
    });

    collector.on("collect", async (button) => {
      if (!button.deferred) await button.deferUpdate().catch(() => {});

      if      (button.customId === "q_first")  page = 0;
      else if (button.customId === "q_prev")   page = Math.max(0, page - 1);
      else if (button.customId === "q_next")   page = Math.min(pages - 1, page + 1);
      else if (button.customId === "q_last")   page = pages - 1;
      else if (button.customId === "q_close") {
        collector.stop();
        return queueMsg.delete().catch(() => {});
      }

      // Recompute pages in case queue changed
      const newPages = Math.max(1, Math.ceil(player.queue.length / PAGE_SIZE));
      page = Math.min(page, newPages - 1);

      await queueMsg.edit({
        components: buildComponents(page),
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    });

    collector.on("end", () => {
      // Remove nav buttons on timeout, keep the queue display
      const container = buildQueueContainer(client, player, page, pages);
      queueMsg.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    });
  },
};
