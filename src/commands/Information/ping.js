const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const os = require("os");
const moment = require("moment");
require("moment-duration-format");

module.exports = {
  name: "ping",
  category: "Information",
  description: "Show bot status and ping",
  args: false,
  usage: "",
  aliases: ["pong", "status"],
  userPerms: [],
  owner: false,
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
    const ping = client.ws.ping;
    const isOnline = client.isReady() ? `Online ${client.emoji?.check || '✅'}` : `Offline ${client.emoji?.cross || '❌'}`;

    const duration = moment.duration(client.uptime).format(" D [days], H [hrs], m [mins], s [secs]");
    const nodeVersion = process.version;
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const titleDisplay = new TextDisplayBuilder()
      .setContent(`### 🏓 Pong!`);

    const sep = new SeparatorBuilder();

    const statsDisplay = new TextDisplayBuilder()
      .setContent(
        `**Bot Status:** ${isOnline}\n` +
        `**Websocket Ping:** \`${ping}ms\`\n` +
        `**Uptime:** \`${duration}\`\n` +
        `**Memory Usage:** \`${memoryUsage} MB\`\n` +
        `**Node.js:** \`${nodeVersion}\``
      );

    const container = new ContainerBuilder()
      .addTextDisplayComponents(titleDisplay)
      .addSeparatorComponents(sep)
      .addTextDisplayComponents(statsDisplay);

    return message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
