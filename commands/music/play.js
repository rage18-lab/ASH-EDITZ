const { QueryType, useMainPlayer } = require('discord-player');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'play',
    description: 'Play a song from YouTube or Spotify',
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description: 'Song name, YouTube link, or Spotify link',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ inter, client }) {
        const player = useMainPlayer();
        const song   = inter.options.getString('song').trim();
        const isURL  = /^https?:\/\//i.test(song);
        const isSpotify = /open\.spotify\.com/i.test(song);
        const isYouTube = /youtu(be\.com|\.be)/i.test(song);

        // ── Resolve track ────────────────────────────────────────────────────
        let track = null;
        let playlist = null;

        try {
            if (isYouTube || isSpotify || isURL) {
                // Direct URL — search with AUTO so the right extractor handles it
                const res = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (res?.tracks?.length) {
                    track = res.tracks[0];
                    playlist = res.playlist;

                    // Bridge only the first track to guarantee immediate playback info
                    if (!playlist && (track.source === 'spotify' || track.source === 'apple_music')) {
                        track = await bridgeToYouTube(player, track, inter.member);
                    }
                }
            } else {
                // Text search — search YouTube directly via our custom extractor
                const ytRes = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                const ytDirect = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (ytDirect?.tracks?.length) {
                    track = ytDirect.tracks[0];
                    playlist = ytDirect.playlist;
                } else if (ytRes?.tracks?.length) {
                    track = ytRes.tracks[0];
                    playlist = ytRes.playlist;
                    if (!playlist && (track.source === 'spotify' || track.source === 'apple_music')) {
                        track = await bridgeToYouTube(player, track, inter.member);
                    }
                }
            }
        } catch (e) {
            console.error('[Play] Search error:', e.message);
        }

        if (!track) {
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({ name: '❌  No songs found' })
                    .setDescription(`We couldn't find any results for **${song}**.\nPlease try another search term or paste a direct YouTube/Spotify link.`)
                    .setColor('#ED4245')]
            });
        }

        console.log(`[Play] "${song}" → [${track.source}] ${track.title} by ${track.author} (Playlist: ${!!playlist})`);

        // ── Queue & play ─────────────────────────────────────────────────────
        try {
            const { QueueRepeatMode } = require('discord-player');
            let queue = player.nodes.get(inter.guild.id);
            const autoplayEnabled = client.autoplayStates?.get(inter.guild.id) ?? false;

            if (!queue) {
                queue = player.nodes.create(inter.guild, {
                    metadata: {
                        channel:       inter.channel,
                        autoplay:      autoplayEnabled,
                        lastTrack:     null,
                        playedHistory: []
                    },
                    leaveOnEmpty:         client.config.opt.leaveOnEmpty,
                    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                    leaveOnEnd:           client.config.opt.leaveOnEnd,
                    leaveOnEndCooldown:   client.config.opt.leaveOnEndCooldown,
                    selfDeaf:             true,
                    volume:               client.config.opt.volume,
                    connectionTimeout:    30_000,
                });
                if (autoplayEnabled) queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
            }

            if (!queue.connection) {
                await queue.connect(inter.member.voice.channel);
            }

            const wasPlaying = queue.isPlaying();
            queue.addTrack(playlist ? playlist : track);
            
            if (!wasPlaying) await queue.node.play();

            const srcIcon = track.source === 'spotify'     ? '🟢 Spotify'
                          : track.source === 'apple_music' ? '🍎 Apple Music'
                          : track.source === 'youtube'     ? '🔴 YouTube'
                          : '🎵 Auto';

            if (!wasPlaying) {
                return inter.editReply({
                    embeds: [new EmbedBuilder()
                        .setAuthor({
                            name: playlist ? `▶️  Starting Playlist: ${playlist.title}` : '▶️  Starting Playback',
                            iconURL: client.user.displayAvatarURL({ size: 64 })
                        })
                        .setThumbnail(track.thumbnail || null)
                        .setDescription(
                            `> 🎵  **[${track.title}](${track.url})**\n` +
                            `> 🎤  by **${track.author}** • \`${track.duration}\`\n` +
                            (playlist ? `> 📑  **Added ${playlist.tracks.length} tracks**\n` : '') +
                            `> 📡  Source: ${srcIcon}`
                        )
                        .setColor('#57F287')]
                });
            }

            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({
                        name: playlist ? `✅  Playlist Added to Queue` : '✅  Added to Queue',
                        iconURL: client.user.displayAvatarURL({ size: 64 })
                    })
                    .setTitle(playlist ? playlist.title : (track.title.length > 256 ? track.title.substring(0, 253) + '...' : track.title))
                    .setURL(playlist ? playlist.url : track.url)
                    .setThumbnail(track.thumbnail || null)
                    .setDescription(
                        (playlist ? `> 📑  **Tracks:** ${playlist.tracks.length}\n` : `> 👤  **Artist:** ${track.author}\n> ⏱  **Duration:** \`${track.duration}\`\n`) +
                        `> 🔄  **Autoplay:** ${autoplayEnabled ? '✅ On' : '❌ Off'}\n` +
                        `> 📋  **Position:** #${queue.tracks.size}`
                    )
                    .setColor('#57F287')
                    .setFooter({
                        text: `Requested by ${inter.member.displayName} • ${srcIcon}`,
                        iconURL: inter.member.displayAvatarURL()
                    })
                    .setTimestamp()]
            });

        } catch (error) {
            console.error('[Play Error]', error);
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({ name: '❌  Playback failed — please try again' })
                    .setDescription(`\`${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}\``)
                    .setColor('#ED4245')]
            });
        }
    }
};

/**
 * Bridge a Spotify/AppleMusic metadata track to a real YouTube stream.
 * Uses ytsearch: prefix to always hit our CustomYouTubeExtractor.
 */
async function bridgeToYouTube(player, track, member) {
    try {
        const query = `${track.title} ${track.author}`;
        const res = await player.search(`ytsearch:${query}`, {
            requestedBy: member,
            searchEngine: QueryType.AUTO,
        });
        if (res?.tracks?.length) {
            console.log(`[Play] Bridged "${track.title}" from ${track.source} → YouTube`);
            return res.tracks[0];
        }
    } catch (e) {
        console.warn('[Play] Bridge to YouTube failed:', e.message);
    }
    return track; // Fall back to original if bridge fails
}
