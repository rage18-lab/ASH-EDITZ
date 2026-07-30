const { EmbedBuilder, InteractionType, MessageFlags } = require('discord.js');
const { useQueue } = require('discord-player');
const { Translate } = require('../../process_tools');

module.exports = async (client, inter) => {
    // Safely defer the reply — interaction may be expired or already handled
    try {
        await inter.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (e) {
        // Unknown interaction (10062) or already replied — silently ignore
        return;
    }

    if (inter.type === InteractionType.ApplicationCommand) {
        const DJ = client.config.opt.DJ;
        const command = client.commands.get(inter.commandName);

        const errorEmbed = new EmbedBuilder().setColor('#ff0000');

        if (!command) {
            errorEmbed.setDescription(await Translate('<❌> | Error! Please contact Developers!'));
            return inter.editReply({ embeds: [errorEmbed] });
        }

        if (command.permissions && !inter.member.permissions.has(command.permissions)) {
            errorEmbed.setDescription(await Translate(`<❌> | You do not have the proper permissions to execute this command`));
            return inter.editReply({ embeds: [errorEmbed] });
        }

        if (DJ.enabled && DJ.commands.includes(command.name) && !inter.member._roles.includes(inter.guild.roles.cache.find(x => x.name === DJ.roleName)?.id)) {
            errorEmbed.setDescription(await Translate(`<❌> | This command is reserved for members with <\`${DJ.roleName}\`> `));
            return inter.editReply({ embeds: [errorEmbed] });
        }

        if (command.voiceChannel) {
            if (!inter.member.voice.channel) {
                errorEmbed.setDescription(await Translate(`<❌> | You are not in a Voice Channel`));
                return inter.editReply({ embeds: [errorEmbed] });
            }

            if (inter.guild.members.me.voice.channel && inter.member.voice.channel.id !== inter.guild.members.me.voice.channel.id) {
                errorEmbed.setDescription(await Translate(`<❌> | You are not in the same Voice Channel`));
                return inter.editReply({ embeds: [errorEmbed] });
            }
        }

        try {
            await command.execute({ inter, client });
        } catch (error) {
            console.error('Command execution error:', error);
            errorEmbed.setDescription(await Translate(`<❌> | An unexpected error occurred while executing the command. Please try again.`));
            return inter.editReply({ embeds: [errorEmbed] }).catch(() => {});
        }

    } else if (inter.type === InteractionType.MessageComponent) {
        const customId = inter.customId;
        if (!customId) return;

        // Ignore internally-handled pagination buttons (managed by message collectors)
        const COLLECTOR_BUTTONS = ['lyrics_prev', 'lyrics_next', 'lyrics_page', 'lyrics_btn_prev', 'lyrics_btn_next', 'lyrics_btn_page'];
        if (COLLECTOR_BUTTONS.includes(customId)) return;

        const queue = useQueue(inter.guild);
        const path = `../../buttons/${customId}.js`;

        try {
            delete require.cache[require.resolve(path)];
            const button = require(path);
            if (button) return button({ client, inter, customId, queue });
        } catch (e) {
            console.warn(`Button handler not found: ${customId}`);
            return inter.editReply({ content: 'Button action not available.' }).catch(() => {});
        }
    }
}