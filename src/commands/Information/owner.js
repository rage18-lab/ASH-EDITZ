const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SlashCommandBuilder
} = require('discord.js');
const emoji = require('../../emojis');

module.exports = {
    name: 'owner',
    description: "Shows who owns this bot",
    category: 'Information',
    aliases: ['botowner', 'whoowner'],

    // Slash command definition
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Shows who owns this bot'),

    async execute(message, args, client) {
        const ownerTags = client.config.ownerID.map(id => `<@${id}>`).join(', ');

        const display = new TextDisplayBuilder()
            .setContent(
                `### 👑 Bot Owner\n\n` +
                `${emoji.blank}${emoji.wickarrow} The owner of this bot is: ${ownerTags}\n` +
                `${emoji.blank}${emoji.info || '📌'} They created and manage me. Show some respect! 🫡`
            );

        const container = new ContainerBuilder()
            .addTextDisplayComponents(display);

        return message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },

    // Slash command handler
    async interactionRun(interaction, client) {
        const ownerTags = client.config.ownerID.map(id => `<@${id}>`).join(', ');

        const display = new TextDisplayBuilder()
            .setContent(
                `### 👑 Bot Owner\n\n` +
                `${emoji.blank}${emoji.wickarrow} The owner of this bot is: ${ownerTags}\n` +
                `${emoji.blank}${emoji.info || '📌'} They created and manage me. Show some respect! 🫡`
            );

        const container = new ContainerBuilder()
            .addTextDisplayComponents(display);

        return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
