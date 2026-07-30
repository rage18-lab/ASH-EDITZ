require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client, { skipFFmpeg: false });

player.events.on('playerError', (queue, error) => {
    console.log('PLAYER ERROR:', error);
});
player.events.on('error', (queue, error) => {
    console.log('QUEUE ERROR:', error);
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
        }
        
        // Mock ffmpeg creation exactly as discord-player does
        const { FFmpeg } = require('prism-media');
        console.log('Creating FFmpeg instance...');
        const transcoder = new FFmpeg({
            args: [
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
            ]
        });
        
        transcoder.on('error', (err) => console.log('FFMPEG ERROR:', err));
        
        stream.pipe(transcoder);
        
        transcoder.on('data', (chunk) => {
            console.log('FFmpeg transcoded chunk:', chunk.length);
            process.exit(0);
        });
        
        setTimeout(() => {
            console.log('Timeout waiting for FFmpeg');
            process.exit(1);
        }, 10000);
        
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
