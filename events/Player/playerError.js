const { EmbedBuilder } = require('discord.js');

module.exports = (queue, error) => {
    (async () => {
        if (error && (error.message || String(error)).includes('IP discovery')) {
            console.warn('Ignored harmless IP discovery playerError:', error.message);
            return;
        }

        console.error('Error emitted from the player:', error);

        if (queue?.metadata?.channel) {
            const message = error?.message?.includes('aborted')
                ? 'The audio request was aborted. Please try again or use a different source.'
                : (error?.message || String(error));

            const embed = new EmbedBuilder()
                .setAuthor({
                    name: '⚠️  Playback Error',
                    iconURL: global.client?.user?.displayAvatarURL({ size: 64 })
                })
                .setDescription(
                    `> ❌  **${message}**\n` +
                    '> 💡  Try `/skip` to skip to the next track, or `/play` to add a new song.'
                )
                .setColor('#FF2056')
                .setFooter({ text: '⚡ Hot Pursuit  •  Music Bot' })
                .setTimestamp();

            queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
        }
    })()
}
