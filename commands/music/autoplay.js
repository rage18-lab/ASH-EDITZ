const { EmbedBuilder } = require('discord.js');
const { useQueue, QueueRepeatMode } = require('discord-player');

module.exports = {
    name: 'autoplay',
    description: 'Toggle autoplay mode for this server',
    voiceChannel: false,

    async execute({ inter, client }) {
        if (!client.autoplayStates) {
            client.autoplayStates = new Map();
        }

        const guildId = inter.guild.id;
        const queue = useQueue(guildId);

        let newState;

        if (queue) {
            // Queue is active: toggle native QueueRepeatMode.AUTOPLAY
            const isCurrentlyAutoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;
            newState = !isCurrentlyAutoplay;

            if (newState) {
                queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
            } else {
                queue.setRepeatMode(QueueRepeatMode.OFF);
            }
        } else {
            // Queue is not active: toggle global guild state for when music starts
            const current = client.autoplayStates.get(guildId) ?? false;
            newState = !current;
        }

        client.autoplayStates.set(guildId, newState);

        const embed = new EmbedBuilder()
            .setAuthor({
                name: newState ? '🔄  Autoplay Enabled' : '⏹  Autoplay Disabled',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                newState
                    ? "Autoplay is now **ON**! When your queue ends, related tracks will automatically be added and played.\n\nUse `/autoplay` anytime to toggle it off."
                    : "Autoplay is now **OFF**. The bot will stop when the queue finishes.\n\nUse `/autoplay` anytime to toggle it back on."
            )
            .setColor(newState ? '#57F287' : '#ED4245')
            .setFooter({
                text: `Toggled by ${inter.member.displayName}`,
                iconURL: inter.member.displayAvatarURL()
            })
            .setTimestamp();

        return inter.editReply({ embeds: [embed] });
    }
};
