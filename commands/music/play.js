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

        try {
            if (isYouTube || isSpotify || isURL) {
                // Direct URL — search with AUTO so the right extractor handles it
                const res = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (res?.tracks?.length) {
                    track = res.tracks[0];

                    // Spotify tracks need bridging to YouTube for actual streaming
                    if (track.source === 'spotify' || track.source === 'apple_music') {
                        track = await bridgeToYouTube(player, track, inter.member);
                    }
                }
            } else {
                // Text search — search YouTube directly via our custom extractor
                const ytRes = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                    // ytsearch: prefix routes to CustomYouTubeExtractor
                });

                // Try YouTube first (our custom extractor)
                const ytDirect = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (ytDirect?.tracks?.length) {
                    track = ytDirect.tracks[0];
                } else if (ytRes?.tracks?.length) {
                    track = ytRes.tracks[0];
                    // Bridge Spotify metadata tracks to YouTube streams
                    if (track.source === 'spotify' || track.source === 'apple_music') {
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
                    .setAuthor({ name: '❌  No results found' })
                    .setDescription(
                        `Could not find **"${song}"**.\n\n` +
                        `**Tips:**\n` +
                        `• Try full name + artist: \`Blinding Lights The Weeknd\`\n` +
                        `• Paste a direct YouTube or Spotify link\n` +
                        `• Use \`/search\` to browse results`
                    )
                    .setColor('#ED4245')]
            });
        }

        console.log(`[Play] "${song}" → [${track.source}] ${track.title} by ${track.author}`);

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
            queue.addTrack(track);
            if (!wasPlaying) await queue.node.play();

            const srcIcon = track.source === 'spotify'     ? '🟢 Spotify'
                          : track.source === 'apple_music' ? '🍎 Apple Music'
                          : track.source === 'youtube'     ? '🔴 YouTube'
                          : '🎵 Auto';

            if (!wasPlaying) {
                return inter.editReply({
                    embeds: [new EmbedBuilder()
                        .setAuthor({
                            name: '▶️  Starting Playback',
                            iconURL: client.user.displayAvatarURL({ size: 64 })
                        })
                        .setThumbnail(track.thumbnail || null)
                        .setDescription(
                            `> 🎵  **[${track.title}](${track.url})**\n` +
                            `> 🎤  by **${track.author}** • \`${track.duration}\`\n` +
                            `> 📡  Source: ${srcIcon}`
                        )
                        .setColor('#57F287')]
                });
            }

            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({
                        name: '✅  Added to Queue',
                        iconURL: client.user.displayAvatarURL({ size: 64 })
                    })
                    .setTitle(track.title.length > 256 ? track.title.substring(0, 253) + '...' : track.title)
                    .setURL(track.url)
                    .setThumbnail(track.thumbnail || null)
                    .setDescription(
                        `> 👤  **Artist:** ${track.author}\n` +
                        `> ⏱  **Duration:** \`${track.duration}\`\n` +
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
