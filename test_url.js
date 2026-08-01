require('dotenv').config();
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = new Player(client);

(async () => {
    try {
        await player.extractors.register(CustomYouTubeExtractor, {});
        
        const res = await player.search('Never Gonna Give You Up', { searchEngine: 'youtubeSearch' });
        
        const extractor = player.extractors.get('com.custom.youtube');
        
        // Mock method to just test fallback
        const videoId = extractor._extractVideoId(res.tracks[0].url);
        const tube = await require('youtubei.js').Innertube.create({ retrieve_player: false });
        const info = await tube.getBasicInfo(videoId, { client: 'IOS' });
        const format = info.chooseFormat?.({ quality: 'best', format: 'mp4', type: 'audio' })
                || (info.formats || []).find(f => (f.mime_type || '').includes('audio') && f.url);
        
        console.log('Direct URL found?', !!format?.url);
        if (format?.url) {
            console.log('URL length:', format.url.length);
        } else {
            console.log('Formats available:', info.formats?.map(f => f.mime_type));
        }
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
