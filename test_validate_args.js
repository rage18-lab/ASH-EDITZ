const { Client, GatewayIntentBits } = require('discord.js');
const { Player, QueryType, BaseExtractor } = require('discord-player');

class TestExt extends BaseExtractor {
    static identifier = 'test';
    async validate(query, type) {
        console.log("Validate args:", { query, type });
        return true;
    }
    async handle(query, context) {
        return this.createResponse(null, []);
    }
}

async function test() {
    const client = new Client({ intents: [] });
    const player = new Player(client);
    
    await player.extractors.register(TestExt, {});
    
    await player.search("hello adele", {
        searchEngine: QueryType.YOUTUBE_SEARCH
    });
    
    process.exit(0);
}
test();
