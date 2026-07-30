const { QueryType, useMainPlayer } = require('discord-player');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { formatPopularityBadge, rankSearchResults } = require('../../utils/popularity');

// Words that strongly indicate it's NOT the original track
const NOT_ORIGINAL = /\b(cover|covers|karaoke|instrumental|remix|tribute|reaction|parody|acoustic|nightcore|slowed|reverb|sped[\s_]?up|bass[\s_]?boost(?:ed)?|8d|daycore|lofi|lo[\s-]?fi|version by|as performed|sing(?:ing)?[\s_]?along|backing[\s_]?track|piano[\s_]?version|guitar[\s_]?cover|orchestral|choir|a[\s_]?cappella|acapella|mashup)\b/i;

module.exports = {
    name: 'play',
    description: 'Play the most popular matching song',
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description: 'Song name, YouTube/Spotify URL, etc.',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ inter, client }) {
        const player = useMainPlayer();
        const song   = inter.options.getString('song');
        const isURL  = /^https?:\/\//i.test(song);

        let rawTracks = [];

        if (isURL) {
            // ── Direct URL — just use AUTO ────────────────────────────────────
            try {
                const res = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                    ignoreCache: true
                });
                if (res?.tracks?.length) rawTracks.push(...res.tracks);
            } catch (e) {
                console.error('[Play] URL search error:', e.message);
            }
        } else {
            // ── 1. Spotify FIRST — only has official original tracks ────────────
            try {
                const spRes = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.SPOTIFY_SEARCH,
                    ignoreCache: true
                });
                if (spRes?.tracks?.length) rawTracks.push(...spRes.tracks);
            } catch (e) {
                console.warn('[Play] Spotify search failed:', e.message);
            }

            // ── 2. YouTube search (uses our CustomYouTubeExtractor via ytsearch: prefix) ─
            try {
                const ytRes = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                    ignoreCache: true
                });
                if (ytRes?.tracks?.length) rawTracks.push(...ytRes.tracks);
            } catch (_) {}

            // ── 3. AUTO fallback if still nothing ──────────────────────
            if (!rawTracks.length) {
                try {
                    const autoRes = await player.search(song, {
                        requestedBy: inter.member,
                        searchEngine: QueryType.AUTO,
                        ignoreCache: true
                    });
                    if (autoRes?.tracks?.length) rawTracks.push(...autoRes.tracks);
                } catch (e) {
                    console.warn('[Play] AUTO search failed:', e.message);
                }
            }
        }

        if (!rawTracks.length) {
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({ name: '❌  No match found' })
                    .setDescription(
                        `Could not find **"${song}"**.\n\n` +
                        `**Tips:**\n` +
                        `• Try the full song name + artist (e.g. \`Blinding Lights The Weeknd\`)\n` +
                        `• Paste a direct YouTube or Spotify URL\n` +
                        `• Try \`/search\` to browse results`
                    )
                    .setColor('#ED4245')]
            });
        }

        // ── Deduplicate ──────────────────────────────────────────────
        const uniqueMap = new Map();
        for (const t of rawTracks) {
            if (!uniqueMap.has(t.url)) uniqueMap.set(t.url, t);
        }
        let candidates = Array.from(uniqueMap.values());

        // ── Pre-filter: remove obvious covers/karaoke unless user asked for them ─
        const userWantsAlt = NOT_ORIGINAL.test(song);
        if (!userWantsAlt) {
            const filtered = candidates.filter(t => !NOT_ORIGINAL.test(t.title));
            if (filtered.length > 0) candidates = filtered; // keep originals if any exist
        }

        // ── Rank and pick top result ────────────────────────────────
        const ranked = rankSearchResults(candidates, song);
        let track = ranked[0];
        
        console.log(`[Play] User query: "${song}" | Candidates: ${candidates.length}`);
        console.log(`[Play] #1 Pick: [${track.source}] ${track.title} by ${track.author}`);

        // ── Fix: Bridge Spotify/AppleMusic tracks to direct YouTubei tracks ──────
        // discord-player's default Spotify bridge relies on youtube-ext (which is broken).
        // Resolving to a YoutubeiExtractor track ensures stream() works reliably.
        if (track.source === 'spotify' || track.source === 'apple_music') {
            try {
                const directSearch = await player.search(`${track.title} ${track.author}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.YOUTUBE_SEARCH,
                    ignoreCache: true
                });
                if (directSearch?.tracks?.length) {
                    console.log(`[Play] Converted ${track.source} track to direct YouTube track: ${directSearch.tracks[0].title}`);
                    track = directSearch.tracks[0];
                }
            } catch (e) {
                console.warn('[Play] Failed to resolve Spotify track to direct stream:', e.message);
            }
        }


        // ── Queue & play ──────────────────────────────────────────────────────
        try {
            const { QueueRepeatMode } = require('discord-player');
            let queue = player.nodes.get(inter.guild.id);
            const initialAutoplay = client.autoplayStates?.get(inter.guild.id) ?? false;

            if (!queue) {
                queue = player.nodes.create(inter.guild, {
                    metadata: {
                        channel: inter.channel,
                        autoplay: initialAutoplay,
                        lastTrack: null,
                        playedHistory: []
                    },
                    leaveOnEmpty:         client.config.opt.leaveOnEmpty,
                    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                    leaveOnEnd:           client.config.opt.leaveOnEnd,
                    leaveOnEndCooldown:   client.config.opt.leaveOnEndCooldown,
                    selfDeaf:  true,
                    volume:    client.config.opt.volume,
                    // ── Fix: increase timeout so streams don't abort ──────────
                    connectionTimeout: 30_000,
                    bufferingTimeout:  6_000,
                    noEmitInsert: false,
                });
                if (initialAutoplay) queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
            } else {
                if (initialAutoplay && queue.repeatMode !== QueueRepeatMode.AUTOPLAY) {
                    queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
                    queue.setMetadata({ ...queue.metadata, autoplay: true });
                }
            }

            if (!queue.connection) await queue.connect(inter.member.voice.channel);

            const wasPlaying = queue.isPlaying();
            queue.addTrack(track);
            if (!wasPlaying) await queue.node.play();

            const popBadge  = formatPopularityBadge(track);
            const badgeTag  = popBadge ? ` • \`${popBadge}\`` : '';
            const autoState = queue.metadata?.autoplay ?? initialAutoplay;
            const srcIcon   = track.source === 'spotify'    ? '🟢 Spotify'
                            : track.source === 'apple_music'? '🍎 Apple Music'
                            : track.source === 'youtube'    ? '🔴 YouTube'
                            : track.source || '🎵 Auto';

            if (!wasPlaying) {
                const startEmbed = new EmbedBuilder()
                    .setAuthor({
                        name: '▶️  Starting Playback',
                        iconURL: client.user.displayAvatarURL({ size: 64 })
                    })
                    .setDescription(`> 🎵  Now loading **[${track.title}](${track.url})**\n> 🎤  by **${track.author}** (\`${track.duration}\`) • ${srcIcon}`)
                    .setColor('#57F287');
                return inter.editReply({ embeds: [startEmbed] });
            }

            const queuePos = queue.tracks.size;
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: '✅  Added to Queue',
                    iconURL: client.user.displayAvatarURL({ size: 64 })
                })
                .setTitle(track.title.length > 256 ? track.title.substring(0, 253) + '...' : track.title)
                .setURL(track.url)
                .setThumbnail(track.thumbnail || null)
                .setDescription(
                    `> 👤  **Artist:** ${track.author}\n` +
                    `> ⏱  **Duration:** \`${track.duration}\`${badgeTag}\n` +
                    `> 🔄  **Autoplay:** ${autoState ? '✅ On' : '❌ Off'}\n` +
                    `> 📋  **Position in queue:** #${queuePos}`
                )
                .setColor('#57F287')
                .setFooter({
                    text: `Requested by ${inter.member.displayName} • ${srcIcon}`,
                    iconURL: inter.member.displayAvatarURL()
                })
                .setTimestamp();

            return inter.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[Play Error]', error);
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({ name: '❌  Could not play this track — try again' })
                    .setDescription(`\`${error.message}\``)
                    .setColor('#ED4245')]
            });
        }
    }
};
