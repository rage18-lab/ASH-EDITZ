const { EmbedBuilder } = require('discord.js');
const { useMainPlayer, QueryType } = require('discord-player');
const { rankSearchResults } = require('../../utils/popularity');

// ── Neon/Cyberpunk palette ───────────────────────────────────────────────────
const NEON_PINK   = '#FF2D78';
const NEON_CYAN   = '#00F5FF';
const NEON_YELLOW = '#FFE600';
const NEON_RED    = '#FF2056';

// Patterns that indicate a track is NOT a proper song
const BAD_PATTERNS = /1\s*hour|10\s*hour|1hr|10hr|full\s*album|loop|compilation|reaction|gameplay|podcast|tik\s*tok|tiktok|edit|shorts|parody|karaoke|instrumental|nightcore|slowed|reverb/i;

/**
 * Strip noise from a track title (brackets, common filler words).
 */
function cleanTitle(raw) {
    return (raw || '')
        .replace(/[\(\[\{].*?[\)\]\}]/g, '')
        .replace(/official|music|video|audio|lyric|lyrics|hd|4k|remastered|mv|full|ft\.?|feat\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Build a priority-ordered list of search queries.
 * Ordered from MOST related → LEAST related:
 *   Tier 1 → Same artist's other popular songs (most related)
 *   Tier 2 → Track-specific "similar to" queries
 *   Tier 3 → Broader genre/vibe queries
 */
function buildAutoplayQueries(track) {
    const title  = cleanTitle(track.title);
    const author = (track.author || '').replace(/\s*-\s*Topic$/i, '').trim();

    return [
        // ── Tier 1: Same artist (most related) ──────────────────────────────
        `${author} popular songs`,
        `${author} best songs`,
        `${author} top hits`,
        `${author} songs`,

        // ── Tier 2: Similar to this specific track ───────────────────────────
        `songs similar to ${title} ${author}`,
        `if you like ${title} listen to`,
        `${title} ${author} similar`,

        // ── Tier 3: Broader genre/vibe ───────────────────────────────────────
        `${author} official audio`,
        `${author} new songs`,
    ];
}

/**
 * Try to search using YouTube first, fallback to Spotify.
 */
async function searchWithFallback(player, query) {
    const engines = [
        QueryType.YOUTUBE_SEARCH,
        QueryType.SPOTIFY_SEARCH,
    ];
    for (const engine of engines) {
        try {
            const res = await player.search(query, { searchEngine: engine });
            if (res?.tracks?.length) return res.tracks;
        } catch (_) {
            // try next engine
        }
    }
    return [];
}

module.exports = (queue) => {
    (async () => {
        // ── Guard: only run autoplay if enabled ─────────────────────────────
        const guildId    = queue.guild?.id;
        const is247      = global.client?.tfStates?.get(guildId) === true;
        const isAutoplay =
            queue.repeatMode === 2 ||                                        // QueueRepeatMode.AUTOPLAY
            queue.metadata?.autoplay ||
            global.client?.autoplayStates?.get(guildId) === true;

        const lastTrack = queue.metadata?.lastTrack;

        if (isAutoplay && lastTrack) {
            const player = useMainPlayer();

            // Build the history set to avoid repeating tracks
            const playedHistory = Array.isArray(queue.metadata?.playedHistory)
                ? [...queue.metadata.playedHistory]
                : [];
            if (lastTrack.url && !playedHistory.includes(lastTrack.url)) {
                playedHistory.push(lastTrack.url);
            }
            const historySet = new Set(playedHistory);

            const queries = buildAutoplayQueries(lastTrack);
            let picked    = null;

            for (const query of queries) {
                if (picked) break;

                const tracks = await searchWithFallback(player, query);
                if (!tracks.length) continue;

                // Filter out bad/already-played candidates
                const candidates = tracks.filter(t => {
                    if (historySet.has(t.url))       return false;
                    if (BAD_PATTERNS.test(t.title))  return false;
                    const dur = t.durationMS || 0;
                    if (dur > 600_000 || dur < 30_000) return false; // 30s–10min
                    return true;
                });

                if (!candidates.length) continue;

                // Rank by relevance + popularity, then pick randomly from top-5 for variety
                const ranked = rankSearchResults(candidates, query);
                const pool   = ranked.slice(0, 5);
                picked       = pool[Math.floor(Math.random() * pool.length)];
            }

            if (picked) {
                playedHistory.push(picked.url);
                // Keep history bounded
                const trimmedHistory = playedHistory.slice(-50);

                queue.setMetadata({
                    ...queue.metadata,
                    playedHistory: trimmedHistory,
                });

                queue.addTrack(picked);
                await queue.node.play();

                const author = (lastTrack.author || '').replace(/\s*-\s*Topic$/i, '').trim();

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: '◈  A U T O P L A Y',
                        iconURL: global.client.user.displayAvatarURL({ size: 64 })
                    })
                    .setTitle(picked.title.length > 256 ? picked.title.substring(0, 253) + '...' : picked.title)
                    .setURL(picked.url)
                    .setThumbnail(picked.thumbnail || null)
                    .setDescription(
                        `┌─────────────────────────────────\n` +
                        `│  🎤  **${picked.author}**\n` +
                        `│  ⏱  \`${picked.duration}\`\n` +
                        `│  🎵  *Because you listened to:*\n` +
                        `│       **${lastTrack.title}** — ${author}\n` +
                        `│  📼  **${trimmedHistory.length}** tracks played so far\n` +
                        `└─────────────────────────────────`
                    )
                    .setColor(NEON_CYAN)
                    .setFooter({ text: '⚡ Use /autoplay to toggle off anytime  •  Hot Pursuit' })
                    .setTimestamp();

                queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
                return;
            }

            // All queries exhausted — no valid candidate found
            const failEmbed = new EmbedBuilder()
                .setAuthor({ name: '⚠️  Autoplay — No Related Track Found' })
                .setDescription(
                    `> Could not find a song related to **${lastTrack.title}**.\n` +
                    '> Use `/play` to add something manually.\n' +
                    '> Use `/autoplay` to toggle off when done.'
                )
                .setColor(NEON_YELLOW)
                .setTimestamp();
            queue.metadata.channel.send({ embeds: [failEmbed] }).catch(() => {});
            return;
        }

        // ── 24/7 mode: stay silently in VC (no queue-end message, no leave) ─
        if (is247) {
            const vcId = queue.channel?.id;
            if (vcId) global.client.tfStates.set(`${guildId}_vc`, vcId);
            const idleEmbed = new EmbedBuilder()
                .setAuthor({
                    name: '🌐  24/7 — Idle',
                    iconURL: global.client.user.displayAvatarURL({ size: 64 })
                })
                .setDescription(
                    '> 🎵  Queue finished — bot is staying in the channel.\n' +
                    '> ▶️  Use `/play` to add more songs anytime.\n' +
                    '> 💤  Use `/247` to disable 24/7 mode.'
                )
                .setColor('#00F5FF')
                .setFooter({ text: '⚡ 24/7 Active  •  Hot Pursuit' })
                .setTimestamp();
            queue.metadata.channel.send({ embeds: [idleEmbed] }).catch(() => {});
            return;
        }


        // ── Normal queue-end message ─────────────────────────────────────────
        const embed = new EmbedBuilder()
            .setAuthor({
                name: '◈  Q U E U E   F I N I S H E D',
                iconURL: global.client.user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                `\`\`\`\nThe queue has ended. What's next?\n\`\`\`` +
                '> 🎵  Use `/play` to add more music\n' +
                '> 🔄  Use `/autoplay` to auto-play related tracks\n' +
                '> 🔍  Use `/search` to browse popular songs'
            )
            .setColor(NEON_RED)
            .setFooter({ text: '⚡ Hot Pursuit  •  Music Bot' })
            .setTimestamp();

        queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
    })();
};
