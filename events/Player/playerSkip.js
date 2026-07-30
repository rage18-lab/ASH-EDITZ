const { EmbedBuilder } = require('discord.js');

module.exports = (queue, track) => {
    (async () => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: '⏭  Auto-Skipped',
                iconURL: global.client?.user?.displayAvatarURL({ size: 64 })
            })
            .setTitle(track.title)
            .setURL(track.url)
            .setThumbnail(track.thumbnail || null)
            .setDescription(
                `> 🎤  **${track.author}**\n` +
                '> ⚠️  There was an issue playing this track — automatically skipping.'
            )
            .setColor('#FFE600')
            .setFooter({ text: '⚡ Hot Pursuit  •  Music Bot' })
            .setTimestamp();

        queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
    })();
};
