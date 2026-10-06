const {
  WebhookClient,
  ComponentType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
} = require("discord.js");
const { player_create } = require("../../config").Webhooks;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function truncate(str, max = 40) {
  if (!str) return "Unknown";
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function getHQThumbnail(url) {
  if (!url) return null;
  if (url.includes("i.ytimg.com") || url.includes("img.youtube.com")) {
    const m = url.match(/vi\/([^/]+)\//);
    if (m?.[1]) return `https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg`;
  }
  return url;
}

function buildProgressBar(position, duration, barLen = 18) {
  if (!duration || duration === 0) return { bar: "▬".repeat(barLen), pos: "Live", total: "∞" };
  const pct = Math.min(position / duration, 1);
  const filled = Math.round(barLen * pct);
  const empty  = Math.max(0, barLen - filled);
  const bar    = "▰".repeat(filled) + "🔘" + "▱".repeat(empty);
  return { bar, pos: formatDuration(position), total: formatDuration(duration) };
}

function getPlatformInfo(uri = "") {
  if (uri.includes("spotify.com"))    return { emoji: "🟢", name: "Spotify",    color: 0x1DB954 };
  if (uri.includes("soundcloud.com")) return { emoji: "🟠", name: "SoundCloud", color: 0xFF5500 };
  if (uri.includes("deezer.com"))     return { emoji: "💜", name: "Deezer",     color: 0xA238FF };
  if (uri.includes("apple"))          return { emoji: "🍎", name: "Apple Music",color: 0xFC3C44 };
  return                               { emoji: "🎵", name: "YouTube",          color: 0x00D4FF };
}

function getLoopLabel(loopMode) {
  if (!loopMode || loopMode === "none") return null;
  if (loopMode === "track") return "🔂 Track";
  if (loopMode === "queue") return "🔁 Queue";
  return `🔁 ${loopMode}`;
}

function getVolumeBar(vol) {
  const blocks = Math.round((vol / 150) * 8);
  return "█".repeat(blocks) + "░".repeat(8 - blocks);
}

// ─── Button Rows ─────────────────────────────────────────────────────────────

function buildControlRow(client, paused) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np_previous")
      .setEmoji(client.emoji.previous)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(paused ? "np_resume" : "np_pause")
      .setEmoji(paused ? client.emoji.play : client.emoji.pause)
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("np_skip")
      .setEmoji(client.emoji.skip)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_like")
      .setEmoji(client.emoji.like)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_stop")
      .setEmoji(client.emoji.stop)
      .setStyle(ButtonStyle.Danger)
  );
}

function buildSecondaryRow(client, player) {
  const loopMode  = player.repeatMode || player.loop || "none";
  const isLooping = loopMode !== "none";
  const isShuffled = player.queue?.shuffled || false;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np_loop")
      .setLabel(loopMode === "track" ? "Loop: Track" : loopMode === "queue" ? "Loop: Queue" : "Loop")
      .setEmoji("🔁")
      .setStyle(isLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_shuffle")
      .setLabel(isShuffled ? "Shuffle: On" : "Shuffle")
      .setEmoji("🔀")
      .setStyle(isShuffled ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_voldown")
      .setEmoji(client.emoji.voldown)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_volup")
      .setEmoji(client.emoji.volup)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_queue")
      .setLabel("Queue")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ─── Now Playing Container ───────────────────────────────────────────────────

function buildNowPlayingContainer(client, track, player) {
  const info       = track.info || track;
  const title      = info.title   || "Unknown Title";
  const uri        = info.uri     || info.url || "#";
  const author     = info.author  || "Unknown Artist";
  const dur        = info.duration || info.length || 0;
  const artwork    = info.artworkUrl || info.thumbnail || info.image;
  const requester  = track.requester;
  const paused     = player?.paused || false;
  const position   = player?.position || 0;
  const volume     = player?.volume ?? 100;
  const queueCount = player?.queue?.length ?? 0;
  const loopMode   = player?.repeatMode || player?.loop || "none";
  const loopLabel  = getLoopLabel(loopMode);

  const { bar, pos, total } = buildProgressBar(position, dur);
  const platform            = getPlatformInfo(uri);
  const cleanThumb          = getHQThumbnail(artwork);
  const volBar              = getVolumeBar(volume);

  // Status line badges
  const statusParts = [];
  if (paused)    statusParts.push("⏸ **Paused**");
  if (loopLabel) statusParts.push(loopLabel);
  if (queueCount > 0) statusParts.push(`📋 ${queueCount} up next`);
  const statusLine = statusParts.length ? `\n-# ${statusParts.join("  ·  ")}` : "";

  // Title block
  const titleDisplay = new TextDisplayBuilder().setContent(
    `### ${platform.emoji} [${truncate(title, 48)}](${uri})` +
    `\n> 🎤 **${cleanAuthor(author)}**  ·  🏷️ *${platform.name}*` +
    statusLine
  );

  // Progress + meta block
  const infoDisplay = new TextDisplayBuilder().setContent(
    `\`${pos}\` ${bar} \`${total}\`\n` +
    `> 🔊 \`${volBar}\` **${volume}%**  ·  👤 [${requester?.username || "Unknown"}](https://discord.com/users/${requester?.id || "0"})`
  );

  const container = new ContainerBuilder();

  if (cleanThumb) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(titleDisplay, infoDisplay)
      .setThumbnailAccessory((t) => t.setURL(cleanThumb));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(titleDisplay, infoDisplay);
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildControlRow(client, paused));
  container.addActionRowComponents(buildSecondaryRow(client, player));

  return container;
}

// ─── Send / Update ───────────────────────────────────────────────────────────

async function sendNowPlaying(client, player, track) {
  try {
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return null;

    const container = buildNowPlayingContainer(client, track, player);
    try {
      const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
      player.data?.set("currentTrack", track);
      return message;
    } catch (e) {
      console.error("[NowPlaying] send error:", e.message);
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function updateNowPlayingButtons(client, player, paused) {
  try {
    const msg   = player.data?.get("message");
    if (!msg) return;
    const track = player.data?.get("currentTrack") || player.queue?.current;
    if (!track) return;

    const fakePl = Object.assign(Object.create(Object.getPrototypeOf(player)), player, { paused });
    const container = buildNowPlayingContainer(client, track, fakePl);
    await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  } catch (_) {}
}

// ─── Button Interaction Handler ──────────────────────────────────────────────

async function handleButtonInteraction(interaction, player, client) {
  try {
    switch (interaction.customId) {

      // ── Playback ──────────────────────────────────────────────────────────
      case "np_pause":
        if (player.paused) return interaction.deferUpdate();
        player.pause(true);
        await updateNowPlayingButtons(client, player, true);
        return interaction.deferUpdate();

      case "np_resume":
        if (!player.paused) return interaction.deferUpdate();
        player.pause(false);
        await updateNowPlayingButtons(client, player, false);
        return interaction.deferUpdate();

      case "np_skip":
        if (!player.queue?.current) return interaction.deferUpdate();
        player.skip();
        return interaction.deferUpdate();

      case "np_stop":
        player.queue?.clear();
        try { player.setLoop?.("none"); } catch (_) { player.loop = "none"; }
        const { safeDestroyPlayer } = require("../../utils/playerUtils");
        await safeDestroyPlayer(player);
        return interaction.deferUpdate();

      case "np_previous": {
        const history = player.data?.get("history") || [];
        if (!history.length) {
          return _ephemeralMsg(interaction, client, `${client.emoji.info} No previous track in history.`);
        }
        const prev = history[history.length - 1];
        try {
          const res = await client.manager.search(prev.uri, { requester: interaction.user });
          if (res?.tracks?.length) {
            player.queue.unshift(res.tracks[0]);
            history.pop();
            player.data?.set("history", history);
            player.skip();
          }
        } catch (_) {}
        return interaction.deferUpdate();
      }

      // ── Like ─────────────────────────────────────────────────────────────
      case "np_like": {
        const cur = player.queue?.current;
        if (!cur) return interaction.deferUpdate();
        try {
          const songs = client.db.liked.get(interaction.user.id) || [];
          const already = songs.some(s => s.url === (cur.uri || cur.url));
          if (already) {
            return _ephemeralMsg(interaction, client, `${client.emoji.info} Already in your favourites!`);
          }
          songs.push({
            title: cur.title, url: cur.uri || cur.url,
            duration: cur.length || cur.duration,
            thumbnail: cur.thumbnail || cur.artworkUrl || cur.image,
            author: cur.author, addedAt: new Date().toISOString()
          });
          client.db.liked.set(interaction.user.id, songs);
          return _ephemeralMsg(interaction, client, `${client.emoji.check} Added **${cur.title}** to your favourites!`);
        } catch (_) {
          return _ephemeralMsg(interaction, client, `${client.emoji.cross} Failed to save. Try again.`);
        }
      }

      // ── Loop ─────────────────────────────────────────────────────────────
      case "np_loop": {
        const modes = ["none", "track", "queue"];
        const cur   = player.repeatMode || player.loop || "none";
        const next  = modes[(modes.indexOf(cur) + 1) % modes.length];
        try { player.setRepeatMode?.(next) || (player.repeatMode = next); } catch (_) { player.loop = next; }
        const label = next === "none" ? "Loop disabled" : next === "track" ? "🔂 Looping this track" : "🔁 Looping the queue";
        await _ephemeralMsg(interaction, client, `${client.emoji.check} ${label}`);
        const track = player.data?.get("currentTrack") || player.queue?.current;
        if (track) {
          const msg = player.data?.get("message");
          if (msg) {
            const c = buildNowPlayingContainer(client, track, player);
            await msg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
          }
        }
        return;
      }

      // ── Shuffle ──────────────────────────────────────────────────────────
      case "np_shuffle": {
        if (player.queue?.shuffle) {
          player.queue.shuffle();
          await _ephemeralMsg(interaction, client, `${client.emoji.shuffle} Queue shuffled!`);
        } else {
          await _ephemeralMsg(interaction, client, `${client.emoji.info} Shuffle not supported on this player version.`);
        }
        return;
      }

      // ── Volume ───────────────────────────────────────────────────────────
      case "np_voldown": {
        const newVol = Math.max(0, (player.volume || 100) - 10);
        await player.setVolume(newVol);
        await _ephemeralMsg(interaction, client, `${client.emoji.voldown} Volume set to **${newVol}%**`);
        const track = player.data?.get("currentTrack") || player.queue?.current;
        if (track) {
          const msg = player.data?.get("message");
          if (msg) {
            const c = buildNowPlayingContainer(client, track, player);
            await msg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
          }
        }
        return;
      }
      case "np_volup": {
        const newVol = Math.min(150, (player.volume || 100) + 10);
        await player.setVolume(newVol);
        await _ephemeralMsg(interaction, client, `${client.emoji.volup} Volume set to **${newVol}%**`);
        const track = player.data?.get("currentTrack") || player.queue?.current;
        if (track) {
          const msg = player.data?.get("message");
          if (msg) {
            const c = buildNowPlayingContainer(client, track, player);
            await msg.edit({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
          }
        }
        return;
      }

      // ── Queue Peek ───────────────────────────────────────────────────────
      case "np_queue": {
        const q = player.queue;
        if (!q?.length) {
          return _ephemeralMsg(interaction, client, `${client.emoji.info} The queue is empty — add more songs!`);
        }
        const list = [...q].slice(0, 8).map((t, i) => {
          const plat = getPlatformInfo(t.uri || "");
          return `\`${String(i + 1).padStart(2, " ")}.\` ${plat.emoji} [${(t.title || "Unknown").slice(0, 38)}](${t.uri}) — \`${formatDuration(t.length)}\``;
        }).join("\n");
        const display = new TextDisplayBuilder().setContent(
          `### 📋 Up Next (${q.length} track${q.length !== 1 ? "s" : ""})\n${list}` +
          (q.length > 8 ? `\n-# … and ${q.length - 8} more` : "")
        );
        const c = new ContainerBuilder().addTextDisplayComponents(display);
        return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }

      default:
        return interaction.deferUpdate();
    }
  } catch (err) {
    console.error("[NowPlaying Button] Error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await _ephemeralMsg(interaction, client, `${client.emoji.cross} An error occurred.`).catch(() => {});
    }
  }
}

function _ephemeralMsg(interaction, client, text) {
  const display = new TextDisplayBuilder().setContent(`**${text}**`);
  const c = new ContainerBuilder().addTextDisplayComponents(display);
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
  }
  return interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
}

// ─── Collector ───────────────────────────────────────────────────────────────

function setupMessageCollector(client, player, message) {
  try {
    if (message._collectorActive) return;
    message._collectorActive = true;

    const track       = player.queue?.current;
    const trackLen    = track?.length || track?.duration || 0;
    const collectorTime = trackLen > 0 ? Math.max(trackLen + 30000, 30000) : 6 * 60 * 60 * 1000;

    const collector = message.createMessageComponentCollector({
      time: collectorTime,
      componentType: ComponentType.Button,
    });

    collector.on("collect", async (interaction) => {
      try {
        if (!interaction.member?.voice?.channelId || interaction.member.voice.channelId !== player.voiceChannelId) {
          return _ephemeralMsg(interaction, client, `${client.emoji.warn} You must be in my voice channel to use these controls.`);
        }
        await handleButtonInteraction(interaction, player, client);
      } catch (e) {
        if (!interaction.replied && !interaction.deferred) {
          await _ephemeralMsg(interaction, client, `${client.emoji.cross} An error occurred.`).catch(() => {});
        }
      }
    });

    collector.on("end", () => { message._collectorActive = false; });
  } catch (_) {}
}

// ─── Voice Status ────────────────────────────────────────────────────────────

async function updateVoiceStatus(client, player, track) {
  try {
    if (!player.voiceChannelId) return;
    if (player.state === "DESTROYED" || player.state === "DISCONNECTED") return;
    await client.rest
      .put(`/channels/${player.voiceChannelId}/voice-status`, {
        body: { status: `${client.emoji.dance} Playing ${track.title}` },
      })
      .catch((err) => console.error("[VoiceStatus]", err.message));
  } catch (err) {
    console.error("[VoiceStatus]", err.message);
  }
}

// ─── Main Event ──────────────────────────────────────────────────────────────

module.exports = {
  name: "playerStart",
  run: async (client, player, track) => {
    try {
      const guild = client.guilds.cache.get(player.guildId);
      if (!guild) return;

      if (!player.data?.get("playerStarted")) {
        player.data?.set("playerStarted", true);
        if (player_create) {
          const webhook = new WebhookClient({ url: player_create });
          const embed = new EmbedBuilder()
            .setColor(client.color)
            .setAuthor({ name: "Player Started", iconURL: client.user.displayAvatarURL() })
            .setDescription(`**Server:** \`${guild.name}\`\n**ID:** \`${player.guildId}\``);
          webhook.send({ embeds: [embed] }).catch(() => {});
        }
      }

      const currentTrack = track || player.queue?.current;
      if (currentTrack) {
        try {
          const rid = currentTrack.requester?.id;
          if (rid) client.db.musicStats.increment(rid, currentTrack.title || "");
        } catch (e) {
          console.error("[Stats]", e);
        }
        await handleTrackStart(client, player, currentTrack);
      }
    } catch (_) {}
  },
};

async function handleTrackStart(client, player, track) {
  try {
    if (!track) return;
    player.data?.delete("playerEmptyProcessed");

    const oldMessage = player.data?.get("message");
    if (oldMessage) {
      try { await oldMessage.delete(); } catch (_) {}
    }

    if (client.voiceHealthMonitor) client.voiceHealthMonitor.updateActivity(player.guildId);

    await updateVoiceStatus(client, player, track);

    const message = await sendNowPlaying(client, player, track);
    if (!message) return;

    player.data?.set("message", message);
    setupMessageCollector(client, player, message);
  } catch (err) {
    console.error("[HandleTrackStart]", err);
  }
}

module.exports.updateNowPlayingButtons = updateNowPlayingButtons;
module.exports.buildNowPlayingContainer = buildNowPlayingContainer;
