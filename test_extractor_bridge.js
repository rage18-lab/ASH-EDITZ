const { Client, GatewayIntentBits } = require('discord.js');
const { Player, QueryType } = require('discord-player');
const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');

async function test() {
    const client = new Client({ intents: [] });
    const player = new Player(client);
    
    await player.extractors.register(CustomYouTubeExtractor, {});
    
    console.log("Searching with YOUTUBE_SEARCH...");
    const res = await player.search("hello adele", {
        searchEngine: QueryType.YOUTUBE_SEARCH
    });
    
    if (res.tracks.length > 0) {
        console.log("Found track via:", res.tracks[0].extractor?.identifier);
    } else {
        console.log("No tracks found!");
    }
    process.exit(0);
}
test();
