const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "autoplay",
  aliases: ["ap", "auto"],
  category: "Music",
  cooldown: 3,
  description: "Toggle autoplay mode",
  botPrams: ["EmbedLinks"],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  slashOptions: [],

  async slashExecute(interaction, client) {
    const interactionWrapper = {
      guild: interaction.guild,
      channel: interaction.channel,
      author: interaction.user,
      member: interaction.member,
      createdTimestamp: interaction.createdTimestamp,
      reply: async (options) => {
        if (interaction.deferred) {
          return await interaction.editReply(options);
        } else if (interaction.replied) {
          return await interaction.followUp(options);
        } else {
          return await interaction.reply(options);
        }
      },
    };

    const args = [];
    if (interaction.options) {
      const options = interaction.options.data;
      for (const option of options) {
        if (option.value !== undefined) {
          args.push(option.value.toString());
        }
      }
    }

    const prefix = client.prefix;
    return this.execute(interactionWrapper, args, client, prefix);
  },

  async execute(message, args, client, prefix) {
    const player = client.manager.players.get(message.guild.id);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor(client.config.color || "#00D4FF")
        .setDescription(`**${client.emoji?.warn || "⚠️"} There is no active music player in this server.**`);
      return message.reply({ embeds: [embed] });
    }

    const currentStatus = player.data.get("autoplay") || false;
    const newStatus = !currentStatus;
    player.data.set("autoplay", newStatus);

    const embed = new EmbedBuilder()
      .setColor(newStatus ? "#10B981" : "#EF4444")
      .setDescription(
        `**${newStatus ? (client.emoji?.check || "✅") : (client.emoji?.cross || "❌")} Autoplay has been \`${newStatus ? "Enabled" : "Disabled"}\`.**`
      );

    return message.reply({ embeds: [embed] });
  },
};
