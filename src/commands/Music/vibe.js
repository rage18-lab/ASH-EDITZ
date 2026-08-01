const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MessageFlags
} = require("discord.js");

// Curated vibe presets — each has a search query for Lavalink
const VIBES = {
  chill: {
    emoji: "😌",
    label: "Chill",
    description: "Relaxed, lo-fi, smooth jams",
    queries: [
      "lofi hip hop beats to study to",
      "chill vibes playlist",
      "ambient chill music",
      "lo-fi beats relaxing",
      "coffee shop music chill"
    ]
  },
  hype: {
    emoji: "🔥",
    label: "Hype",
    description: "High energy, EDM, trap bangers",
    queries: [
      "hype trap music 2024",
      "EDM festival mix",
      "gaming hype music",
      "high energy workout music",
      "bass drop EDM"
    ]
  },
  sad: {
    emoji: "🌧️",
    label: "Sad",
    description: "Emotional, melancholic, heartfelt",
    queries: [
      "sad songs playlist",
      "emotional piano music",
      "heartbreak songs 2024",
      "melancholic indie music",
      "sad acoustic covers"
    ]
  },
  party: {
    emoji: "🎉",
    label: "Party",
    description: "Dance, pop hits, club bangers",
    queries: [
      "party hits 2024",
      "dance pop playlist",
      "club hits remix",
      "pop party songs",
      "DJ mix party"
    ]
  },
  focus: {
    emoji: "🧠",
    label: "Focus",
    description: "Deep work, ambient, instrumental",
    queries: [
      "focus music deep work",
      "instrumental study music",
      "brain focus music",
      "ambient work music",
      "concentration music instrumental"
    ]
  },
  sleep: {
    emoji: "🌙",
    label: "Sleep",
    description: "Peaceful, calm, sleep sounds",
    queries: [
      "sleep music calm",
      "relaxing sleep sounds nature",
      "peaceful sleep instrumental",
      "meditation sleep music",
      "rain sounds for sleeping"
    ]
  }
};

module.exports = {
  name: "vibe",
  category: "Music",
  aliases: ["mood", "radio"],
  description: "Queue songs based on a vibe/mood — chill, hype, sad, party, focus or sleep.",
  inVoiceChannel: true,
  sameVoiceChannel: true,
  botPerms: ["Connect", "Speak"],

  slashOptions: [
    {
      name: "mood",
      description: "Choose your vibe",
      type: 3,
      required: true,
      choices: Object.keys(VIBES).map(key => ({
        name: `${VIBES[key].emoji} ${VIBES[key].label} — ${VIBES[key].description}`,
        value: key
      }))
    },
    {
      name: "songs",
      description: "How many songs to queue (1-10, default: 5)",
      type: 4,
      required: false,
      min_value: 1,
      max_value: 10
    }
  ],

  async slashExecute(interaction, client) {
    await interaction.deferReply();

    const moodKey = interaction.options.getString("mood");
    const songCount = interaction.options.getInteger("songs") || 5;
    const vibe = VIBES[moodKey];

    if (!vibe) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.cross} Invalid mood selected.**`);
      return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
    }

    const channel = interaction.member?.voice?.channel;
    if (!channel) {
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.warn} You need to be in a voice channel first.**`);
      return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
    }

    try {
      const { hasAvailableNodes } = require("../../utils/nodeUtils");
      if (!hasAvailableNodes(client.manager)) {
        const display = new TextDisplayBuilder()
          .setContent(`**${client.emoji.cross} Music server is unavailable. Please try again later.**`);
        return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
      }

      let player = client.manager.players.get(interaction.guildId);
      if (!player) {
        player = await client.manager.createPlayer({
          guildId: interaction.guildId,
          voiceId: channel.id,
          textId: interaction.channelId,
          volume: 80,
          deaf: true,
        });
      }

      // Pick random queries from the vibe list to search
      const shuffled = [...vibe.queries].sort(() => Math.random() - 0.5);
      const queriesToSearch = shuffled.slice(0, Math.min(songCount, vibe.queries.length));

      const addedTracks = [];
      const failedQueries = [];

      for (const query of queriesToSearch) {
        try {
          const result = await client.manager.search(query, {
            requester: interaction.user,
            engine: client.config.node_source || "ytmsearch"
          });

          if (result && result.tracks && result.tracks.length > 0) {
            // Pick a random track from results for variety
            const randomIndex = Math.floor(Math.random() * Math.min(5, result.tracks.length));
            const track = result.tracks[randomIndex];
            player.queue.add(track);
            addedTracks.push(track);
          } else {
            failedQueries.push(query);
          }
        } catch (err) {
          failedQueries.push(query);
        }
      }

      if (addedTracks.length === 0) {
        const display = new TextDisplayBuilder()
          .setContent(`**${client.emoji.cross} Couldn't find any songs for the \`${vibe.label}\` vibe. Try again later.**`);
        return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
      }

      if (!player.playing && !player.paused) {
        await player.play().catch(console.error);
      }

      // Build rich response
      const titleDisplay = new TextDisplayBuilder()
        .setContent(`### ${vibe.emoji} ${vibe.label} Vibe Activated`);

      const trackListText = addedTracks
        .map((t, i) => `\` ${i + 1} \` [${truncate(t.title, 35)}](${t.uri})`)
        .join("\n");

      const infoDisplay = new TextDisplayBuilder()
        .setContent(
          `${client.emoji.dot} **Mood:** \` ${vibe.label} \` • **Added:** \` ${addedTracks.length} songs \`\n` +
          `-# ${vibe.description}\n\n` +
          trackListText
        );

      const section = new SectionBuilder()
        .addTextDisplayComponents(titleDisplay, infoDisplay);

      const container = new ContainerBuilder()
        .addSectionComponents(section);

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

    } catch (error) {
      console.error("[Vibe] Error:", error);
      const display = new TextDisplayBuilder()
        .setContent(`**${client.emoji.cross} An error occurred: ${error.message}**`);
      return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
    }
  }
};

function truncate(str, max) {
  if (!str) return "Unknown";
  return str.length <= max ? str : str.substring(0, max) + "...";
}
