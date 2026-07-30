const { ApplicationCommandOptionType, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { setAIChannel, removeAIChannel, getAIChannel } = require('../../utils/ai_chat');

module.exports = {
    name: 'setaichannel',
    description: 'Set or remove the AI chat channel for this server',
    permissions: PermissionsBitField.Flags.ManageChannels,
    options: [
        {
            name: 'channel',
            description: 'The channel to use for AI chat (leave empty to disable)',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildText],
            required: false,
        }
    ],

    async execute({ inter, client }) {
        const channel = inter.options.getChannel('channel');

        // ── Disable AI chat ──────────────────────────────────────────────────
        if (!channel) {
            const current = getAIChannel(inter.guild.id);
            if (!current) {
                return inter.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FFA500')
                        .setDescription('⚠️ AI chat is not enabled in this server. Use `/setaichannel #channel` to enable it.')]
                });
            }
            removeAIChannel(inter.guild.id);
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setAuthor({ name: '🤖 AI Chat Disabled', iconURL: client.user.displayAvatarURL() })
                    .setDescription('AI chat has been **disabled** for this server.\nUse `/setaichannel #channel` to re-enable it.')
                    .setTimestamp()]
            });
        }

        // ── Enable AI chat ───────────────────────────────────────────────────
        setAIChannel(inter.guild.id, channel.id);

        const apiKeySet = !!process.env.GEMINI_API_KEY;

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setAuthor({ name: '🤖 AI Chat Enabled', iconURL: client.user.displayAvatarURL() })
            .setDescription(
                `✅ **AI chat is now active in ${channel}!**\n\n` +
                `> Just type any message in that channel and I'll reply.\n` +
                `> I remember your conversation history — use \`/clearchat\` to reset it.\n\n` +
                (apiKeySet
                    ? '🟢 **Gemini API key is set — AI is ready!**'
                    : '🔴 **No Gemini API key found!**\nAdd `GEMINI_API_KEY=your_key` to `.env` and restart the bot.\nGet a free key at: https://aistudio.google.com/')
            )
            .setFooter({ text: `Set by ${inter.member.displayName}`, iconURL: inter.member.displayAvatarURL() })
            .setTimestamp();

        return inter.editReply({ embeds: [embed] });
    }
};
