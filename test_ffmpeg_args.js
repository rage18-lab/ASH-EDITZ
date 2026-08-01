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

// Mock createStream to see ffmpeg args
const { FFMPEG_ARGS } = require('discord-player');
console.log('Default FFmpeg Args:', FFMPEG_ARGS);
