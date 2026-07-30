const { EmbedBuilder } = require('discord.js');
const { clearHistory } = require('../../utils/ai_chat');

module.exports = {
    name: 'clearchat',
    description: 'Clear your AI conversation history (fresh start)',

    async execute({ inter, client }) {
        clearHistory(inter.guild.id, inter.user.id);

        return inter.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: '🧹 Conversation Cleared', iconURL: client.user.displayAvatarURL() })
                .setDescription(`✅ Your AI chat history has been reset, **${inter.member.displayName}**!\nThe AI will start fresh with no memory of previous messages.`)
                .setFooter({ text: '🤖 Hot Pursuit AI • Powered by Gemini' })
                .setTimestamp()]
        });
    }
};
