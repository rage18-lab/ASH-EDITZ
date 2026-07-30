const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.on('ready', async () => {
    console.log('Test bot ready.');
    try {
        const player = new Player(client, {
            skipFFmpeg: false, // Must be false for IOS client (mp4a)
        });
        await player.extractors.register(CustomYouTubeExtractor, {});
        
        console.log('Searching for the track...');
        const res = await player.search('https://youtu.be/c8zq4kAn_O0?si=7pAhnWO_4Q-dx3Ws');
        if (!res.tracks.length) {
            console.log('Track not found!');
            process.exit(1);
        }
        
        const track = res.tracks[0];
        console.log('Found:', track.title);
        
        console.log('Testing extraction...');
        const streamInfo = await track.extractor.stream(track);
        console.log('Stream info returned:', typeof streamInfo);
        
        // Let's actually test piping to ffmpeg
        const ffmpeg = require('ffmpeg-static');
        const { spawn } = require('child_process');
        
        console.log('Piping to FFmpeg...');
        const ffmpegProcess = spawn(ffmpeg, [
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ]);
        
        let bytesOut = 0;
        ffmpegProcess.stdout.on('data', (chunk) => {
            bytesOut += chunk.length;
        });
        
        ffmpegProcess.stderr.on('data', (err) => {
            // console.log('FFmpeg:', err.toString());
        });
        
        ffmpegProcess.on('close', (code) => {
            console.log('FFmpeg closed with code:', code);
            console.log('Total decoded bytes:', bytesOut);
            process.exit(0);
        });
        
        streamInfo.pipe(ffmpegProcess.stdin);
        
        setTimeout(() => {
            console.log('Ending test early after 10s...');
            console.log('Total decoded bytes so far:', bytesOut);
            ffmpegProcess.kill();
        }, 10000);
        
    } catch(e) {
        console.error('Test error:', e);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
