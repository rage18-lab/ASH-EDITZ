const { EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    name: '247',
    description: 'Toggle 24/7 mode — bot stays in the voice channel permanently',
    voiceChannel: false,

    async execute({ inter, client }) {
        // Ensure the state map exists
        if (!client.tfStates) client.tfStates = new Map();

        const guildId    = inter.guild.id;
        const queue      = useQueue(guildId);
        const current    = client.tfStates.get(guildId) ?? false;
        const newState   = !current;

        client.tfStates.set(guildId, newState);

        // If enabling 24/7, store the current voice channel so we can rejoin if kicked
        if (newState && queue) {
            const vcId = queue.channel?.id ?? inter.member.voice.channel?.id;
            if (vcId) client.tfStates.set(`${guildId}_vc`, vcId);
        }

        // If disabling 24/7 and no music is playing, delete the queue (leave VC)
        if (!newState && queue && !queue.isPlaying()) {
            queue.delete();
        }

        const embed = new EmbedBuilder()
            .setAuthor({
                name: newState ? '🌐  24/7 Mode Enabled' : '💤  24/7 Mode Disabled',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                newState
                    ? '> ✅  The bot will now **stay in the voice channel** 24/7.\n' +
                      '> 🔌  It will **not leave** when the channel is empty or the queue ends.\n' +
                      '> 🔄  If kicked, it will **automatically rejoin**.\n\n' +
                      '> Use `/247` again to disable.'
                    : '> ⏹  24/7 mode is now **OFF**.\n' +
                      '> 👋  The bot will leave when the channel is empty or the queue ends.\n\n' +
                      '> Use `/247` again to re-enable.'
            )
            .setColor(newState ? '#00F5FF' : '#FF2056')
            .setFooter({
                text: `⚡ Toggled by ${inter.member.displayName}  •  Hot Pursuit`,
                iconURL: inter.member.displayAvatarURL()
            })
            .setTimestamp();

        return inter.editReply({ embeds: [embed] });
    }
};
