require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client);

(async () => {
    try {
        await player.extractors.register(CustomYouTubeExtractor, {});
        const res = await player.search('Never Gonna Give You Up', { searchEngine: 'youtubeSearch' });
        const extractor = player.extractors.get('com.custom.youtube');
        
        const videoId = extractor._extractVideoId(res.tracks[0].url);
        const tube = await require('youtubei.js').Innertube.create({ retrieve_player: false });
        const info = await tube.getBasicInfo(videoId, { client: 'IOS' });
        const format = info.chooseFormat?.({ quality: 'best', format: 'mp4', type: 'audio' })
                || (info.formats || []).find(f => (f.mime_type || '').includes('audio') && f.url);
        
        if (format?.url) {
            console.log('Spawning ffmpeg...');
            const ffmpegPath = require('ffmpeg-static');
            const ffmpeg = spawn(ffmpegPath, [
                '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n',
                '-i', format.url,
                '-t', '5',
                '-f', 'null',
                '-'
            ]);
            
            ffmpeg.stderr.on('data', d => console.log('FFMPEG:', d.toString().trim()));
            ffmpeg.on('close', code => {
                console.log('FFmpeg exited with code', code);
                process.exit(code);
            });
        }
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
