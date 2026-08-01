const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require("discord.js");

const BASS_BANDS = [
  { band: 0, gain: 0.3 },
  { band: 1, gain: 0.25 },
  { band: 2, gain: 0.15 },
  { band: 3, gain: 0.05 },
  { band: 4, gain: 0.0 },
  { band: 5, gain: -0.05 },
  { band: 6, gain: -0.05 },
  { band: 7, gain: -0.05 },
  { band: 8, gain: -0.05 },
  { band: 9, gain: -0.05 },
  { band: 10, gain: -0.05 },
  { band: 11, gain: -0.05 },
  { band: 12, gain: -0.05 },
  { band: 13, gain: -0.05 },
  { band: 14, gain: -0.05 },
];

const FLAT_BANDS = Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0.0 }));

module.exports = {
  name: "bassboost",
  category: "Music",
  aliases: ["bb", "bass"],
  description: "Toggle bass boost audio filter on/off for the current player.",
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  slashOptions: [],

  async slashExecute(interaction, client) {
    const player = client.manager.players.get(interaction.guildId);

    if (!player || !player.queue.current) {
      const errorDisplay = new TextDisplayBuilder()
        .setContent(`**${client.emoji.warn} Nothing is currently playing.**`);
      const container = new ContainerBuilder().addTextDisplayComponents(errorDisplay);
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // Toggle state stored on player data
    const isBoosted = player.data?.get("bassBoostEnabled") || false;
    const newState = !isBoosted;

    try {
      // Apply or remove EQ bands via Shoukaku
      const bands = newState ? BASS_BANDS : FLAT_BANDS;
      await player.shoukaku.setEqualizer(bands);
      player.data?.set("bassBoostEnabled", newState);
    } catch (err) {
      console.error("[BassBoost] Failed to set equalizer:", err);
      const errorDisplay = new TextDisplayBuilder()
        .setContent(`**${client.emoji.cross} Failed to apply filter. Your Lavalink node may not support equalizer.**`);
      const container = new ContainerBuilder().addTextDisplayComponents(errorDisplay);
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const statusEmoji = newState ? "🔊" : "🔉";
    const statusText = newState ? "**ON**" : "**OFF**";

    const titleDisplay = new TextDisplayBuilder()
      .setContent(`### ${statusEmoji} Bass Boost ${statusText}`);

    const infoDisplay = new TextDisplayBuilder()
      .setContent(
        newState
          ? `-# Bass boost has been applied to the equalizer. Deep bass frequencies boosted by +30%.`
          : `-# Equalizer has been reset to flat. Audio is now playing at original quality.`
      );

    const section = new SectionBuilder()
      .addTextDisplayComponents(titleDisplay, infoDisplay);

    const toggleButton = new ButtonBuilder()
      .setCustomId("bassboost")
      .setLabel(newState ? "Turn Off Bass Boost" : "Turn On Bass Boost")
      .setStyle(newState ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(newState ? client.emoji.voldown?.replace(/<|>/g, "").split(":").pop() || "🔉" : "🔊");

    const buttonRow = new ActionRowBuilder().addComponents(toggleButton);

    const container = new ContainerBuilder()
      .addSectionComponents(section)
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(buttonRow);

    const replyMsg = await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    // Button collector for toggle
    if (replyMsg) {
      const collector = replyMsg.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id && i.customId === "bassboost",
        time: 120000
      });

      collector.on("collect", async (btnInteraction) => {
        if (!btnInteraction.member?.voice?.channel || btnInteraction.member.voice.channel.id !== player.voiceId) {
          return btnInteraction.reply({ content: `**${client.emoji.warn} You must be in the same voice channel.**`, ephemeral: true });
        }

        const currentState = player.data?.get("bassBoostEnabled") || false;
        const nextState = !currentState;
        const nextBands = nextState ? BASS_BANDS : FLAT_BANDS;

        try {
          await player.shoukaku.setEqualizer(nextBands);
          player.data?.set("bassBoostEnabled", nextState);
        } catch (err) {
          return btnInteraction.reply({ content: `**${client.emoji.cross} Failed to toggle filter.**`, ephemeral: true });
        }

        const nextEmoji = nextState ? "🔊" : "🔉";
        const nextStatusText = nextState ? "**ON**" : "**OFF**";

        const newTitle = new TextDisplayBuilder().setContent(`### ${nextEmoji} Bass Boost ${nextStatusText}`);
        const newInfo = new TextDisplayBuilder().setContent(
          nextState
            ? `-# Bass boost has been applied to the equalizer.`
            : `-# Equalizer has been reset to flat.`
        );
        const newSection = new SectionBuilder().addTextDisplayComponents(newTitle, newInfo);
        const newBtn = new ButtonBuilder()
          .setCustomId("bassboost")
          .setLabel(nextState ? "Turn Off Bass Boost" : "Turn On Bass Boost")
          .setStyle(nextState ? ButtonStyle.Danger : ButtonStyle.Success);
        const newRow = new ActionRowBuilder().addComponents(newBtn);
        const newContainer = new ContainerBuilder()
          .addSectionComponents(newSection)
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(newRow);

        await btnInteraction.update({ components: [newContainer], flags: MessageFlags.IsComponentsV2 });
      });

      collector.on("end", () => {
        // Disable the button when expired
        const disabledBtn = new ButtonBuilder()
          .setCustomId("bassboost")
          .setLabel("Bass Boost")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);
        const disabledRow = new ActionRowBuilder().addComponents(disabledBtn);
        replyMsg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      });
    }
  }
};
