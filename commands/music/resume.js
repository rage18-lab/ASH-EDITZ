const { EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'resume',
    description:('Play the track'),
    voiceChannel: true,

    async execute({ inter }) {
        const queue = useQueue(inter.guild);
        if (!queue) return inter.editReply({ content: await Translate(`No music currently playing... try again ? <❌>`) });

        if (queue.node.isPlaying()) return inter.editReply({ content: await Translate(`The track is already running... try again ? <❌>`) })

        const success = queue.node.resume();

        const resumeEmbed = new EmbedBuilder()
            .setAuthor({ name: success ? await Translate(`Current music <${queue.currentTrack.title}> resumed <✅>`) : await Translate(`Unable to resume playback right now. Please try again in a moment <❌>`) })
            .setColor('#2f3136')

        return inter.editReply({ embeds: [resumeEmbed] });
    }
}
