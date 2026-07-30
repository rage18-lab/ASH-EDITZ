/**
 * Shared lyrics fetcher used by commands/music/lyrics.js and buttons/lyrics.js
 *
 * Sources tried in order:
 *   1. LRCLIB (free, no key required)
 *   2. discord-player built-in lyrics extractor (Genius-backed)
 *
 * Returns: { title, artist, lyrics, source } or null
 */

/**
 * Strip noise from track titles before searching.
 */
function cleanTitle(raw) {
    return (raw || '')
        .replace(/[\(\[\{].*?[\)\]\}]/g, '')           // remove parenthetical noise
        .replace(/official|music|video|audio|lyric(s)?|hd|4k|remastered|mv|full|ft\.?|feat\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Attempt to fetch plain lyrics from LRCLIB.
 * Returns lyrics string or null.
 */
async function fromLrclib(title, author) {
    const ct    = cleanTitle(title);
    const queries = [
        `${author} ${ct}`,
        ct,
        title
    ];

    for (const q of queries) {
        if (!q || q.length < 2) continue;
        try {
            const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (!Array.isArray(data) || !data.length) continue;

            // Prefer entries that have plain lyrics
            const match = data.find(d => d.plainLyrics) || null;
            if (match?.plainLyrics) {
                return {
                    title:  match.trackName || title,
                    artist: match.artistName || author,
                    lyrics: match.plainLyrics,
                    source: 'LRCLIB'
                };
            }
        } catch (_) {}
    }
    return null;
}

/**
 * Attempt to fetch lyrics via discord-player's built-in extractor.
 * Returns lyrics object or null.
 */
async function fromDiscordPlayer(player, title, author) {
    try {
        const results = await player.lyrics.search({ q: `${author} ${cleanTitle(title)}` });
        const hit = results?.[0];
        if (hit?.plainLyrics) {
            return {
                title:  title,
                artist: hit.artistName || author,
                lyrics: hit.plainLyrics,
                source: 'Genius'
            };
        }
    } catch (_) {}

    // Second attempt: title only
    try {
        const results2 = await player.lyrics.search({ q: title });
        const hit2 = results2?.[0];
        if (hit2?.plainLyrics) {
            return {
                title:  title,
                artist: hit2.artistName || author,
                lyrics: hit2.plainLyrics,
                source: 'Genius'
            };
        }
    } catch (_) {}

    return null;
}

/**
 * Main entry point — tries LRCLIB first then discord-player.
 * @param {string} title
 * @param {string} author
 * @param {object} player - discord-player main player instance
 * @returns {Promise<{title, artist, lyrics, source}|null>}
 */
async function fetchLyrics(title, author, player) {
    const result = await fromLrclib(title, author);
    if (result) return result;
    if (player) return fromDiscordPlayer(player, title, author);
    return null;
}

/**
 * Split lyrics into pages of at most `maxLen` characters,
 * breaking on newlines where possible.
 * @param {string} lyrics
 * @param {number} maxLen
 * @returns {string[]}
 */
function paginateLyrics(lyrics, maxLen = 3900) {
    if (lyrics.length <= maxLen) return [lyrics];

    const pages = [];
    let remaining = lyrics;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            pages.push(remaining);
            break;
        }
        // Try to break at a newline close to maxLen
        let breakAt = remaining.lastIndexOf('\n', maxLen);
        if (breakAt < maxLen * 0.5) breakAt = maxLen; // no good newline, hard-break
        pages.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trimStart();
    }

    return pages;
}

module.exports = { fetchLyrics, paginateLyrics };
