const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

function formatDuration(ms) {
  if (!ms || ms === 0) return "LIVE";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function generateProgressBar(position, duration, length = 25) {
  if (!duration) return { bar: "──────────────────────────○", pos: "LIVE" };
  const pct = Math.min(position / duration, 1);
  const filled = Math.floor(length * pct);
  const bar = "─".repeat(filled) + "○" + "─".repeat(length - filled);
  return { bar, pos: formatDuration(position) };
}

function cleanAuthor(author) {
  if (!author) return "Unknown";
  return author.replace(/\s*-\s*Topic\s*$/i, "").trim();
}

function buildControlPanel(client, player, track) {
  const { bar, pos } = generateProgressBar(player.position || 0, track.length);
  const dur = formatDuration(track.length);

  const loopMode = player.loop || "none";
  const loopLabel = loopMode === "track" ? "🔂 Track" : loopMode === "queue" ? "🔁 Queue" : "↩️ Off";
  const vol = player.volume ?? 100;

  // ── Info section ─────────────────────────────────────────
  const infoText = new TextDisplayBuilder().setContent(
    `### ${client.emoji.play} Now Playing\n` +
    `**[${track.title}](${track.uri})**\n` +
    `> **Artist:** ${cleanAuthor(track.author)}\n` +
    `> **Duration:** \`${pos} ${bar} ${dur}\`\n` +
    `> **Volume:** \`${vol}%\`  •  **Loop:** ${loopLabel}  •  **Queue:** \`${player.queue.size} track(s)\`\n` +
    `> **Requested by:** <@${track.requester?.id ?? track.requester}>`
  );

  const sep1 = new SeparatorBuilder();

  // ── Button rows ───────────────────────────────────────────
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ctrl_previous").setEmoji(client.emoji.previous).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(player.paused ? "ctrl_resume" : "ctrl_pause").setEmoji(player.paused ? client.emoji.play : client.emoji.pause).setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_skip").setEmoji(client.emoji.skip).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_shuffle").setEmoji(client.emoji.shuffle).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_stop").setEmoji(client.emoji.stop).setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ctrl_voldown").setEmoji(client.emoji.voldown).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_volup").setEmoji(client.emoji.volup).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_loop").setEmoji(client.emoji.loop).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_like").setEmoji(client.emoji.like).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ctrl_queue").setLabel("Queue").setStyle(ButtonStyle.Primary)
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(infoText)
    .addSeparatorComponents(sep1)
    .addActionRowComponents(row1)
    .addActionRowComponents(row2);

  return container;
}

module.exports = {
  name: "control",
  aliases: ["panel", "ctrl", "cp"],
  description: "Show the interactive music control panel.",
  category: "Music",
  args: false,
  usage: "",
  userPerms: [],
  owner: false,
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,

  slashOptions: [],

  async slashExecute(interaction, client) {
    const wrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      reply: async (opts) => {
        if (interaction.deferred) return interaction.editReply(opts);
        if (interaction.replied) return interaction.followUp(opts);
        return interaction.reply(opts);
      },
    };
    return this.execute(wrapper, [], client);
  },

  async execute(message, args, client) {
    const player = client.manager.players.get(message.guild.id);
    const track = player?.queue?.current;

    if (!track) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.cross} Nothing is playing right now.**`);
      const c = new ContainerBuilder().addTextDisplayComponents(display);
      return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }

    const container = buildControlPanel(client, player, track);

    const panel = await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    // ── Progress bar auto-update every 5s ─────────────────
    const interval = setInterval(async () => {
      const currentPlayer = client.manager.players.get(message.guild.id);
      const currentTrack = currentPlayer?.queue?.current;
      if (!currentPlayer || !currentTrack || !currentPlayer.playing) {
        clearInterval(interval);
        return;
      }
      try {
        const updatedContainer = buildControlPanel(client, currentPlayer, currentTrack);
        await panel.edit({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => clearInterval(interval));
      } catch { clearInterval(interval); }
    }, 5000);

    // ── Button interaction collector ───────────────────────
    const collector = panel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000, // 10 minutes
    });

    collector.on("collect", async (interaction) => {
      // Must be in same VC
      if (!interaction.member?.voice?.channelId || interaction.member.voice.channelId !== player.voiceId) {
        const d = new TextDisplayBuilder().setContent(`**${client.emoji.warn} Join the voice channel first!**`);
        const c = new ContainerBuilder().addTextDisplayComponents(d);
        return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }

      const p = client.manager.players.get(message.guild.id);
      if (!p) return interaction.deferUpdate().catch(() => null);

      try {
        switch (interaction.customId) {
          case "ctrl_pause":
            p.pause(true);
            break;
          case "ctrl_resume":
            p.pause(false);
            break;
          case "ctrl_skip":
            if (p.queue?.current) p.skip();
            break;
          case "ctrl_previous": {
            const history = p.data?.get("history") || [];
            if (!history.length) {
              const d = new TextDisplayBuilder().setContent(`**${client.emoji.info} No previous track in history.**`);
              const c = new ContainerBuilder().addTextDisplayComponents(d);
              return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }
            const last = history[history.length - 1];
            const result = await client.manager.search(last.uri, { requester: interaction.user }).catch(() => null);
            if (result?.tracks?.length) {
              p.queue.unshift(result.tracks[0]);
              history.pop();
              p.data?.set("history", history);
              p.skip();
            }
            break;
          }
          case "ctrl_shuffle":
            if (p.queue?.size > 0) p.queue.shuffle();
            break;
          case "ctrl_stop":
            p.queue?.clear();
            try { const { safeDestroyPlayer } = require("../../utils/playerUtils"); await safeDestroyPlayer(p); } catch { p.destroy().catch(() => null); }
            collector.stop();
            clearInterval(interval);
            return interaction.deferUpdate().catch(() => null);
          case "ctrl_voldown": {
            const newVol = Math.max((p.volume ?? 100) - 10, 0);
            p.setVolume(newVol);
            break;
          }
          case "ctrl_volup": {
            const newVol = Math.min((p.volume ?? 100) + 10, 100);
            p.setVolume(newVol);
            break;
          }
          case "ctrl_loop": {
            const modes = ["none", "track", "queue"];
            const current = modes.indexOf(p.loop || "none");
            const next = modes[(current + 1) % modes.length];
            if (p.setLoop) p.setLoop(next); else p.loop = next;
            break;
          }
          case "ctrl_like": {
            const ct = p.queue?.current;
            if (!ct) break;
            const songs = client.db.liked.get(interaction.user.id);
            if (songs.some(s => s.url === (ct.uri || ct.url))) {
              const d = new TextDisplayBuilder().setContent(`**${client.emoji.info} Already in favourites.**`);
              const c = new ContainerBuilder().addTextDisplayComponents(d);
              return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }
            songs.push({ title: ct.title, url: ct.uri || ct.url, duration: ct.length, thumbnail: ct.thumbnail, author: ct.author, addedAt: new Date().toISOString() });
            client.db.liked.set(interaction.user.id, songs);
            const d = new TextDisplayBuilder().setContent(`**${client.emoji.check} Added \`${ct.title}\` to favourites.**`);
            const c = new ContainerBuilder().addTextDisplayComponents(d);
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
          }
          case "ctrl_queue": {
            const queueList = p.queue.map((t, i) => `\`${i + 1}.\` [${t.title}](${t.uri})`).slice(0, 10).join("\n") || "Queue is empty.";
            const d = new TextDisplayBuilder().setContent(`### 🎵 Queue\n${queueList}`);
            const c = new ContainerBuilder().addTextDisplayComponents(d);
            return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
          }
        }

        // Refresh the panel after any action
        const updatedPlayer = client.manager.players.get(message.guild.id);
        const updatedTrack = updatedPlayer?.queue?.current;
        if (updatedPlayer && updatedTrack) {
          const updatedContainer = buildControlPanel(client, updatedPlayer, updatedTrack);
          await panel.edit({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        }

        await interaction.deferUpdate().catch(() => null);

      } catch (err) {
        console.error("[Control Panel] Button error:", err);
        await interaction.deferUpdate().catch(() => null);
      }
    });

    collector.on("end", () => {
      clearInterval(interval);
      // Remove buttons from the panel on expiry
      const expiredTrack = player?.queue?.current;
      if (expiredTrack) {
        const expiredInfo = new TextDisplayBuilder().setContent(
          `### ${client.emoji.info} Control panel expired.\nUse \`.control\` to open a new one.`
        );
        const expiredContainer = new ContainerBuilder().addTextDisplayComponents(expiredInfo);
        panel.edit({ components: [expiredContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
      }
    });
  },
};
