require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const https = require('https');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
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
            console.log('Fetching stream...');
            https.get(format.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                console.log('Status Code:', res.statusCode);
                res.on('data', chunk => {
                    console.log('Received bytes:', chunk.length);
                    process.exit(0);
                });
            }).on('error', e => console.error(e));
        }
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
