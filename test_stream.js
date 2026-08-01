require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client, {
    ytdlOptions: {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }
    }
});

(async () => {
    try {
        await player.extractors.register(CustomYouTubeExtractor, {});
        const res = await player.search('Never Gonna Give You Up', { searchEngine: 'youtubeSearch' });
        const extractor = player.extractors.get('com.custom.youtube');
        
        console.log('Testing stream extraction...');
        const stream = await extractor.stream(res.tracks[0]);
        console.log('Returned stream type:', typeof stream);
        if (stream && typeof stream === 'object') {
            console.log('Stream constructor:', stream.constructor.name);
            console.log('Keys:', Object.keys(stream).slice(0, 5));
        }
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();