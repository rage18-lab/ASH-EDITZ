const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { QueryType, useMainPlayer, useQueue } = require('discord-player');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'playnext',
    description:("Play a song right after this one"),
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description:('The song you want to play next'),
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ inter }) {
        const player = useMainPlayer();
        const queue = useQueue(inter.guild);

        if (!queue?.isPlaying()) return inter.editReply({ content: await Translate(`No music currently playing <${inter.member}>... try again ? <❌>`) });

        const song = inter.options.getString('song');
        const isURL  = /^https?:\/\//i.test(song);
        let track = null;

        try {
            if (isURL) {
                const res = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO
                });
                
                if (res.playlist) return inter.editReply({ content: await Translate(`This command does not support playlists <${inter.member}>... try again ? <❌>`) });
                
                if (res?.tracks?.length) {
                    track = res.tracks[0];
                    if (track.source === 'spotify' || track.source === 'apple_music') {
                        const bridgeRes = await player.search(`ytsearch:${track.title} ${track.author}`, {
                            requestedBy: inter.member,
                            searchEngine: QueryType.AUTO,
                        });
                        if (bridgeRes?.tracks?.length) track = bridgeRes.tracks[0];
                    }
                }
            } else {
                const res = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO
                });
                if (res?.tracks?.length) track = res.tracks[0];
            }
        } catch (e) {
            console.error('[PlayNext] Search error:', e);
        }

        if (!track) return inter.editReply({ content: await Translate(`No results found <${inter.member}>... try again ? <❌>`) });

        queue.insertTrack(track, 0);

        const playNextEmbed = new EmbedBuilder()
            .setAuthor({ name: await Translate(`Track has been inserted into the queue... it will play next <🎧>`) })
            .setColor('#2f3136');

        await inter.editReply({ embeds: [playNextEmbed] });
    }
}
