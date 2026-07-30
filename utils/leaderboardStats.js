const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'stats.json');

// Ensure file exists
if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({}));
}

function getStats() {
    try {
        const data = fs.readFileSync(STATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('Failed to save stats:', e);
    }
}

/**
 * Adds playtime (in milliseconds) to a user's stats
 */
function addPlaytime(userId, username, durationMs) {
    if (!userId || !durationMs) return;

    const stats = getStats();
    if (!stats[userId]) {
        stats[userId] = {
            username: username || 'Unknown',
            playtimeMs: 0,
            songsPlayed: 0
        };
    }

    stats[userId].username = username; // Update username in case it changed
    stats[userId].playtimeMs += durationMs;
    stats[userId].songsPlayed += 1;

    saveStats(stats);
}

/**
 * Gets the top listeners sorted by playtime
 */
function getTopListeners(limit = 10) {
    const stats = getStats();
    const arr = Object.entries(stats).map(([id, data]) => ({
        id,
        ...data
    }));

    // Sort descending by playtime
    arr.sort((a, b) => b.playtimeMs - a.playtimeMs);

    return arr.slice(0, limit);
}

module.exports = {
    addPlaytime,
    getTopListeners
};
