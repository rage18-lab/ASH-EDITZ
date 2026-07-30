require('dotenv').config();

require('dotenv').config();

const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const {
    DefaultExtractors,
    SoundCloudExtractor,
    SpotifyExtractor,
    AppleMusicExtractor,
    AttachmentExtractor,
} = require('@discord-player/extractor');
const path = require('path');
const fs   = require('fs');

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
    ...client.config.opt.discordPlayer,
    // ── Fix: increase timeouts for slow SoundCloud/Spotify streams ───────────
    probeTimeout:      30_000,   // was 5s default — probe can be slow on SC
    connectionTimeout: 30_000,   // was 20s default
        // Use the value from config.js so MP4/AAC streams are transcoded when needed
        skipFFmpeg:        client.config.opt.discordPlayer?.skipFFmpeg ?? false,
});

(async () => {
    // ── 1. Load default extractors (Spotify, Apple Music, etc. without SoundCloud) ──
    try {
        const extractorsToLoad = DefaultExtractors.filter(ext => ext !== SoundCloudExtractor && ext?.name !== 'SoundCloudExtractor');
        await player.extractors.loadMulti(extractorsToLoad);
        console.log('✅ Default extractors loaded (Spotify, Apple Music, Vimeo, Attachment)');
    } catch (e) {
        console.warn('⚠️  DefaultExtractors failed:', e.message);

        // Manual fallback registration
        for (const [Ext, name] of [
            [SpotifyExtractor,     'Spotify'],
            [AppleMusicExtractor,  'Apple Music'],
            [AttachmentExtractor,  'Attachment'],
        ]) {
            try {
                await player.extractors.register(Ext, {});
                console.log(`✅ ${name}Extractor loaded`);
            } catch (e2) {
                console.warn(`⚠️  ${name}Extractor failed:`, e2.message);
            }
        }
    }

    // ── 2. Load Custom YouTube Extractor (uses youtubei.js directly, bypasses broken cipher) ──
    try {
        const { CustomYouTubeExtractor } = require('./extractors/CustomYouTubeExtractor');
        await player.extractors.register(CustomYouTubeExtractor, {});
        console.log('✅ CustomYouTubeExtractor loaded (direct youtubei.js, no cipher issues)');
    } catch (e) {
        console.warn('⚠️  CustomYouTubeExtractor failed:', e.message);
        // Fallback to discord-player-youtubei with IOS client (no cipher needed)
        try {
            const { YoutubeiExtractor } = require('discord-player-youtubei');
            await player.extractors.register(YoutubeiExtractor, {
                disablePlayer: false,           // keep player retrieval
                streamOptions: { useClient: 'IOS' },  // IOS gives direct URLs, no decipher
                ignoreSignInErrors: true,
            });
            console.log('✅ YoutubeiExtractor fallback loaded (IOS client)');
        } catch (e2) {
            console.warn('⚠️  All YouTube extractors failed. Bot will use SoundCloud only.');
        }
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
