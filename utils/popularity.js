/**
 * Shared popularity scoring helpers used by play.js, search.js and emptyQueue.js
 */

/**
 * Returns a numeric popularity score for a track.
 * - Spotify popularity field (0-100) → up to 150 pts
 * - YouTube view count (log scale)    → up to 120 pts
 * - SoundCloud playCount              → up to 120 pts
 */
function getTrackPopularity(track) {
    // 1. Spotify exact popularity metric (0-100)
    if (track.raw && typeof track.raw.popularity === 'number') {
        return track.raw.popularity * 1.5; // max 150
    }

    // 2. Play / view count
    let views = 0;
    if (typeof track.views === 'number' && track.views > 0) {
        views = track.views;
    } else if (track.raw) {
        if (typeof track.raw.views === 'number')           views = track.raw.views;
        else if (typeof track.raw.view_count === 'number') views = track.raw.view_count;
        else if (typeof track.raw.playCount === 'number')  views = track.raw.playCount;
        else if (typeof track.raw.views === 'string') {
            const parsed = parseInt(track.raw.views.replace(/[^\d]/g, ''), 10);
            if (!isNaN(parsed)) views = parsed;
        }
    }

    if (views > 0) {
        return Math.min(Math.log10(views + 1) * 12, 120);
    }

    return 0;
}

/**
 * Returns a human-readable popularity badge string, or null if no data.
 * e.g. "🔥 1.2B streams"  |  "🔥 Spotify 92% Pop"
 */
function formatPopularityBadge(track) {
    if (track.raw && typeof track.raw.popularity === 'number') {
        const pop = track.raw.popularity;
        if (pop >= 80) return `🔥 Spotify ${pop}% · Trending`;
        if (pop >= 60) return `🎵 Spotify ${pop}% Pop`;
        return `Spotify ${pop}% Pop`;
    }

    let views = 0;
    if (typeof track.views === 'number' && track.views > 0) {
        views = track.views;
    } else if (track.raw) {
        if (typeof track.raw.views === 'number')           views = track.raw.views;
        else if (typeof track.raw.view_count === 'number') views = track.raw.view_count;
        else if (typeof track.raw.views === 'string') {
            const parsed = parseInt(track.raw.views.replace(/[^\d]/g, ''), 10);
            if (!isNaN(parsed)) views = parsed;
        }
    }

    if (views >= 1_000_000_000) return `🔥 ${(views / 1_000_000_000).toFixed(1)}B streams`;
    if (views >= 1_000_000)     return `🔥 ${(views / 1_000_000).toFixed(1)}M streams`;
    if (views >= 1_000)         return `🎵 ${(views / 1_000).toFixed(1)}K streams`;
    return null;
}

/**
 * Sort/rank an array of tracks by relevance to `query` + popularity.
 * Returns the sorted array (does NOT mutate the input).
 */
function rankSearchResults(tracks, query) {
    if (!tracks || !tracks.length) return [];

    const qLower = query.toLowerCase().trim();
    // For direct URLs don't re-rank
    if (/^https?:\/\//i.test(qLower)) return tracks.slice();

    const cleanQ  = qLower.replace(/[^\w\s]/gi, ' ');
    const qWords  = cleanQ.split(/\s+/).filter(w => w.length > 0);

    // Did the user explicitly ask for a cover/remix/etc?
    const userWantsAlt = /\b(cover|remix|karaoke|acoustic|nightcore|slowed|instrumental|parody|lofi|8d)\b/i.test(qLower);

    // Keywords that mean it's NOT the original — big penalty
    const NOT_ORIGINAL_KW = [
        'cover', 'covers', 'karaoke', 'instrumental', 'remix', 'tribute',
        'reaction', 'parody', 'acoustic', 'nightcore', 'slowed', 'reverb',
        'sped up', 'bass boosted', '8d', 'daycore', 'lofi', 'lo-fi',
        'piano version', 'guitar cover', 'orchestral', 'choir', 'acapella',
        'a cappella', 'mashup', 'backing track', 'sing along', 'as performed by',
        'originally performed', 'version by', 'in the style of',
    ];

    // Keywords that signal it IS the official original release
    const OFFICIAL_KW = [
        'official audio', 'official music video', 'official video',
        'official lyric video', 'lyric video', 'official', 'audio',
        'original mix', 'original version',
    ];

    const scored = tracks.map((track, originalIndex) => {
        const titleLower  = (track.title  || '').toLowerCase();
        const authorLower = (track.author || '').toLowerCase();
        
        // Strip common "official" / "lyrics" tags from title before exact matching
        let baseTitle = titleLower
            .replace(/\((official.*?|lyrics?|audio|video|visualizer)\)/gi, '')
            .replace(/\[(official.*?|lyrics?|audio|video|visualizer)\]/gi, '')
            .replace(/\|.*/, '') // strip everything after a pipe |
            .split('-')[1] || titleLower; // try to take the part after 'Artist - Title' if present
            
        // If the split by '-' made it empty or weird, fallback to full title
        if (baseTitle.trim().length < 2) {
            baseTitle = titleLower
                .replace(/\((official.*?|lyrics?|audio|video|visualizer)\)/gi, '')
                .replace(/\[(official.*?|lyrics?|audio|video|visualizer)\]/gi, '');
        }

        const cleanTitle  = baseTitle.replace(/[^\w\s]/gi, ' ').trim();
        const cleanAuthor = authorLower.replace(/[^\w\s]/gi, ' ');
        const combined    = `${cleanTitle} ${cleanAuthor}`;

        // Base score — original order as a weak tiebreaker
        let score = (tracks.length - originalIndex) * 2;

        // ── 1. Popularity (Spotify 0-150, views log 0-120) ──────────────────
        score += getTrackPopularity(track);

        // ── 2. SPOTIFY source = guaranteed original — massive bonus ──────────
        if (track.source === 'spotify') score += 150;

        // ── 3. Query-word match ratio (combined title + author) ──────────────
        const matchedCombined = qWords.filter(w => combined.includes(w)).length;
        score += (matchedCombined / Math.max(qWords.length, 1)) * 60;

        // ── 4. Title-only match ratio ────────────────────────────────────────
        const matchedTitle = qWords.filter(w => cleanTitle.includes(w)).length;
        score += (matchedTitle / Math.max(qWords.length, 1)) * 40;

        // ── 5. Exact / substring title match ────────────────────────────────
        if (cleanTitle === cleanQ)            score += 80;
        else if (cleanTitle.includes(cleanQ)) score += 40;

        // ── 6. Verified / official channel bonus ─────────────────────────────
        if (
            authorLower.endsWith('- topic') ||
            authorLower.endsWith('vevo')    ||
            authorLower.includes('official')
        ) score += 80;

        // ── 7. Official keywords in title (only if user didn't ask for alt) ──
        if (!userWantsAlt) {
            for (const kw of OFFICIAL_KW) {
                if (titleLower.includes(kw)) { score += 25; break; }
            }
        }

        // ── 8. Non-original penalties (only if user didn't ask for them) ─────
        if (!userWantsAlt) {
            for (const kw of NOT_ORIGINAL_KW) {
                if (titleLower.includes(kw)) {
                    score -= 150; // heavy penalty — we really don't want these
                    break;
                }
            }
        }

        // ── 9. Penalty for overly long tracks (compilations, 1-hour loops) ──
        if (track.durationMS > 600_000) score -= 80;   // > 10 minutes
        if (track.durationMS < 30_000)  score -= 40;   // < 30 seconds

        return { track, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.track);
}

module.exports = { getTrackPopularity, formatPopularityBadge, rankSearchResults };
