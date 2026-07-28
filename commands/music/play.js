const { QueryType, useMainPlayer } = require('discord-player');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'play',
    description:("Play a song!"),
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description:('The song you want to play'),
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ inter, client }) {
        const player = useMainPlayer();

        const song = inter.options.getString('song');
        let res = await player.search(song, {
            requestedBy: inter.member,
            searchEngine: QueryType.AUTO
        });

        if (!res?.tracks.length) {
            res = await player.search(song, {
                requestedBy: inter.member,
                searchEngine: QueryType.SOUNDCLOUD_SEARCH
            });
        }

        let defaultEmbed = new EmbedBuilder().setColor('#2f3136');

        if (!res?.tracks.length) {
            defaultEmbed.setAuthor({ name: await Translate(`No results found... try again ? <❌>`) });
            return inter.editReply({ embeds: [defaultEmbed] });
        }

        try {
            const { track } = await player.play(inter.member.voice.channel, res.tracks[0], {
                nodeOptions: {
                    metadata: {
                        channel: inter.channel
                    },
                    volume: client.config.opt.volume,
                    leaveOnEmpty: client.config.opt.leaveOnEmpty,
                    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                    leaveOnEnd: client.config.opt.leaveOnEnd,
                    leaveOnEndCooldown: client.config.opt.leaveOnEndCooldown,
                    selfDeaf: true,
                    bufferingTimeout: 3000,
                }
            });

            defaultEmbed.setAuthor({ name: await Translate(`Loading <${track.title}> to the queue... <✅>`) });
            await inter.editReply({ embeds: [defaultEmbed] });
        } catch (error) {
            console.error(`Play error:`, error);
            defaultEmbed.setAuthor({ name: await Translate(`Could not play this track... try again ? <❌>`) });
            return inter.editReply({ embeds: [defaultEmbed] });
        }
    }
}
