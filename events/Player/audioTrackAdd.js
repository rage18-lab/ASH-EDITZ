const { EmbedBuilder } = require('discord.js');

module.exports = (queue, track) => {
    if (!client.config.app.extraMessages) return;

    const embed = new EmbedBuilder()
        .setAuthor({
            name: '＋  Added to Queue',
            iconURL: client.user.displayAvatarURL({ size: 64 })
        })
        .setTitle(track.title.length > 100 ? track.title.substring(0, 97) + '...' : track.title)
        .setURL(track.url)
        .setThumbnail(track.thumbnail || null)
        .setDescription(
            `> 🎤  **${track.author}**\n` +
            `> ⏱  \`${track.duration}\`\n` +
            `> 📋  Position **#${queue.tracks.size}** in queue`
        )
        .setColor('#00F5FF')
        .setFooter({ text: '⚡ Hot Pursuit  •  Music Bot' })
        .setTimestamp();

    queue.metadata.channel.send({ embeds: [embed] });
}