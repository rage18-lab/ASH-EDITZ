const { EmbedBuilder } = require('discord.js');

module.exports = (queue) => {
    if (!client.config.app.extraMessages) return;

    const embed = new EmbedBuilder()
        .setAuthor({
            name: '＋  Playlist Added to Queue',
            iconURL: client.user.displayAvatarURL({ size: 64 })
        })
        .setDescription(
            '> 🎵  All songs from the playlist have been added!\n' +
            `> 📋  **${queue.tracks.size}** tracks now in queue`
        )
        .setColor('#00F5FF')
        .setFooter({ text: '⚡ Hot Pursuit  •  Music Bot' })
        .setTimestamp();

    queue.metadata.channel.send({ embeds: [embed] });
}
