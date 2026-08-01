require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client);

(async () => {
    try {
        await player.extractors.register(CustomYouTubeExtractor, {});
        console.log('Registered CustomYouTubeExtractor');
        
        const res = await player.search('Never Gonna Give You Up', {
            searchEngine: 'youtubeSearch',
        });
        
        if (!res || !res.tracks.length) {
            console.log('No tracks found.');
            process.exit(1);
        }
        console.log('Found track:', res.tracks[0].title);
        
        // try to extract stream
        const extractor = player.extractors.get('com.custom.youtube');
        const stream = await extractor.stream(res.tracks[0]);
        console.log('Stream extracted successfully:', typeof stream);
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
