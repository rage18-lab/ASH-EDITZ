require('dotenv').config();

const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const {
    SpotifyExtractor,
    AppleMusicExtractor,
    AttachmentExtractor,
} = require('@discord-player/extractor');

global.client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    allowedMentions: { parse: [] },
});

client.config = require('./config');

client.on('error', (err) => console.error('[Discord Client Error]', err.message));
process.on('unhandledRejection', (err) => console.error('[Unhandled Rejection]', err?.message ?? err));

const player = new Player(client, {
    skipFFmpeg: false,
    connectionTimeout: 30_000,
    probeTimeout: 30_000,
});

(async () => {
    // ── 1. Register Spotify extractor (metadata only — streams via YouTube bridge) ──
    for (const [Ext, name] of [
        [SpotifyExtractor,    'Spotify'],
        [AppleMusicExtractor, 'Apple Music'],
        [AttachmentExtractor, 'Attachment'],
    ]) {
        try {
            await player.extractors.register(Ext, {});
            console.log(`✅ ${name} extractor loaded`);
        } catch (e) {
            console.warn(`⚠️  ${name} extractor failed:`, e.message);
        }
    }

    // ── 2. Register Custom YouTube Extractor (IOS client — no cipher, direct URLs) ──
    try {
        const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
        await player.extractors.register(CustomYouTubeExtractor, {});
        console.log('✅ CustomYouTubeExtractor loaded (IOS client, direct stream URLs)');
    } catch (e) {
        console.error('❌ CustomYouTubeExtractor FAILED to load:', e.message);
    }

    require('./loader');

    client.login(client.config.app.token).catch(async (e) => {
        if (e.message === 'An invalid token was provided.') {
            require('./process_tools').throwConfigError('app', 'token', '\n\t   ❌ Invalid Token Provided! ❌ \n\tChange the token in the config file\n');
        } else {
            console.error('❌ An error occurred while trying to login to the bot! ❌ \n', e);
        }
    });
})();
