const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { config } = require('dotenv');
config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client, {});

client.on('ready', async () => {
    console.log('Bot ready!');
    await player.extractors.loadMulti(require('@discord-player/extractor').DefaultExtractors);
    
    const { YoutubeiExtractor } = require('discord-player-youtubei');
    const playdl = require('play-dl');

    // Override the stream method to use play-dl instead of youtubei's broken decipher!
    const originalStream = YoutubeiExtractor.prototype.stream;
    YoutubeiExtractor.prototype.stream = async function(info) {
        console.log('[OVERRIDE] Using play-dl to stream:', info.url);
        try {
            const stream = await playdl.stream(info.url);
            return stream.stream;
        } catch(e) {
            console.error('[OVERRIDE] play-dl failed, falling back...', e.message);
            return originalStream.call(this, info);
        }
    };

    await player.extractors.register(YoutubeiExtractor, {});
    
    console.log('Searching...');
    const res = await player.search('https://www.youtube.com/watch?v=c8zq4kAn_O0', { searchEngine: 'youtube' });
    const track = res.tracks[0];
    console.log('Found:', track.title);
    
    try {
        console.log('Testing stream generation...');
        const stream = await track.extractor.stream(track);
        console.log('Stream type:', typeof stream);
        if (stream) {
            console.log('SUCCESS! Override worked.');
        }
    } catch(e) {
        console.error('FAILED:', e);
    }
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);