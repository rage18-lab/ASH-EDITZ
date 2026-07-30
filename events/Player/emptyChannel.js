const { EmbedBuilder } = require('discord.js');

module.exports = (queue) => {
    if (queue.metadata.lyricsThread) {
        queue.metadata.lyricsThread.delete();
        queue.setMetadata({
            channel: queue.metadata.channel
        });
    }

    const guildId  = queue.guild?.id;
    const is247    = global.client?.tfStates?.get(guildId) === true;

    // ── 24/7 mode: stay in VC, store last VC for rejoin ─────────────────────
    if (is247) {
        const vcId = queue.channel?.id;
        if (vcId) global.client.tfStates.set(`${guildId}_vc`, vcId);
        // Don't leave, don't send a message — just stay silently
        return;
    }

    (async () => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: '👻  Empty Voice Channel',
                iconURL: global.client?.user?.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                '> 🚶  Nobody is in the voice channel.\n' +
                '> 👋  Leaving and clearing the queue!'
            )
            .setColor('#FF2056')
            .setFooter({ text: 'Hot Pursuit  •  Music Bot' })
            .setTimestamp();

        queue.metadata.channel.send({ embeds: [embed] });
    })()
}

