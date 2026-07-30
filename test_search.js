const { Client, GatewayIntentBits } = require('discord.js');
const { Player, QueryType } = require('discord-player');
const { config } = require('dotenv');
const { rankSearchResults } = require('./utils/popularity');
config();

const clientConfig = require('./config');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client, {
    ...clientConfig.opt.discordPlayer,
    probeTimeout: 30000,
    connectionTimeout: 30000,
    skipFFmpeg: false,
});

client.on('ready', async () => {
    console.log('Bot ready for search test');
    await player.extractors.loadMulti(require('@discord-player/extractor').DefaultExtractors);
    const { YoutubeiExtractor } = require('discord-player-youtubei');
    await player.extractors.register(YoutubeiExtractor, {});
    const song = 'back to friends';

    let rawTracks = [];

    // Spotify
    try {
        const spRes = await player.search(song, { searchEngine: QueryType.SPOTIFY_SEARCH });
        console.log('Spotify results:', spRes?.tracks?.length);
        if (spRes?.tracks?.length) {
            rawTracks.push(...spRes.tracks);
            spRes.tracks.slice(0, 3).forEach(t => console.log('SP:', t.title, 'by', t.author, t.url));
        }
    } catch (e) {
        console.error('SP error:', e.message);
    }

    // YouTube
    try {
        const ytRes = await player.search(song, { searchEngine: QueryType.YOUTUBE_SEARCH });
        console.log('YouTube results:', ytRes?.tracks?.length);
        if (ytRes?.tracks?.length) {
            rawTracks.push(...ytRes.tracks);
            ytRes.tracks.slice(0, 3).forEach(t => console.log('YT:', t.title, 'by', t.author, t.url));
        }
    } catch (e) {
        console.error('YT error:', e.message);
    }

    // SoundCloud
    try {
        const scRes = await player.search(song, { searchEngine: QueryType.SOUNDCLOUD_SEARCH });
        console.log('SoundCloud results:', scRes?.tracks?.length);
        if (scRes?.tracks?.length) {
            rawTracks.push(...scRes.tracks);
            scRes.tracks.slice(0, 3).forEach(t => console.log('SC:', t.title, 'by', t.author, t.url));
        }
    } catch (e) {
        console.error('SC error:', e.message);
    }

    console.log('\n--- After deduplication ---');
    const uniqueMap = new Map();
    for (const t of rawTracks) {
        if (!uniqueMap.has(t.url)) uniqueMap.set(t.url, t);
    }
    let candidates = Array.from(uniqueMap.values());
    console.log('Candidates:', candidates.length);

    console.log('\n--- Ranking ---');
    
    // Instead of using rankSearchResults which strips scores, let's copy its logic here briefly to see scores
    const cleanQ = song.toLowerCase().replace(/[^\w\s]/gi, ' ');
    const qWords = cleanQ.split(/\s+/).filter(w => w.length > 0);
    const { getTrackPopularity } = require('./utils/popularity');
    
    const scored = candidates.map((track, i) => {
        let score = (candidates.length - i) * 2;
        const pop = getTrackPopularity(track);
        score += pop;
        if (track.source === 'spotify') score += 150;
        
        const titleLower = (track.title || '').toLowerCase();
        const authorLower = (track.author || '').toLowerCase();
        const cleanTitle = titleLower.replace(/[^\w\s]/gi, ' ');
        const cleanAuthor = authorLower.replace(/[^\w\s]/gi, ' ');
        const combined = `${cleanTitle} ${cleanAuthor}`;
        
        const matchedCombined = qWords.filter(w => combined.includes(w)).length;
        score += (matchedCombined / Math.max(qWords.length, 1)) * 60;
        
        const matchedTitle = qWords.filter(w => cleanTitle.includes(w)).length;
        score += (matchedTitle / Math.max(qWords.length, 1)) * 40;
        
        if (cleanTitle === cleanQ) score += 80;
        else if (cleanTitle.includes(cleanQ)) score += 40;
        
        if (authorLower.endsWith('- topic') || authorLower.endsWith('vevo') || authorLower.includes('official')) score += 80;
        
        const OFFICIAL_KW = ['official audio', 'official music video', 'official video', 'official lyric video', 'lyric video', 'official', 'audio', 'original mix', 'original version'];
        for (const kw of OFFICIAL_KW) {
            if (titleLower.includes(kw)) { score += 25; break; }
        }
        
        return { track, score, pop };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    scored.slice(0, 5).forEach((t, i) => {
        console.log(`#${i+1} [${t.track.source}] ${t.track.title} - ${t.track.author} (Score: ${t.score.toFixed(2)} | Pop: ${t.pop.toFixed(2)})`);
    });

    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);