const { QueueRepeatMode } = require('discord-player');
const { EmbedBuilder } = require('discord.js');

module.exports = async ({ inter, queue }) => {
    if (!queue?.isPlaying()) {
        const errEmbed = new EmbedBuilder()
            .setAuthor({ name: '❌ No music currently playing' })
            .setColor('#ED4245');
        return inter.editReply({ embeds: [errEmbed] });
    }

    const modes = [
        { mode: QueueRepeatMode.OFF, name: 'Off ⏹', color: '#ED4245' },
        { mode: QueueRepeatMode.TRACK, name: 'Single Track 🔂', color: '#57F287' },
        { mode: QueueRepeatMode.QUEUE, name: 'Entire Queue 🔁', color: '#57F287' },
        { mode: QueueRepeatMode.AUTOPLAY, name: 'Autoplay 🔄', color: '#5865F2' }
    ];

    let nextModeIndex = (queue.repeatMode + 1) % modes.length;
    const nextObj = modes[nextModeIndex];

    queue.setRepeatMode(nextObj.mode);

    if (global.client?.autoplayStates) {
        global.client.autoplayStates.set(inter.guild.id, nextObj.mode === QueueRepeatMode.AUTOPLAY);
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: `🔁 Loop Mode: ${nextObj.name}` })
        .setColor(nextObj.color);

    return inter.editReply({ embeds: [embed] });
};