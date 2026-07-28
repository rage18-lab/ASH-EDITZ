require('dotenv').config();

const { Player } = require('discord-player');
const { Client, GatewayIntentBits } = require('discord.js');
const {
    YouTubeExtractor,
    SpotifyExtractor,
    SoundCloudExtractor,
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

const player = new Player(client, client.config.opt.discordPlayer);

// Register all extractors (YouTube, Spotify, SoundCloud, Apple Music, Attachments)
(async () => {
    try {
        await player.extractors.register(YouTubeExtractor, {});
        console.log('✅ YouTubeExtractor loaded');
    } catch (e) { console.warn('⚠️ YouTubeExtractor failed:', e.message); }

    try {
        await player.extractors.register(SpotifyExtractor, {});
        console.log('✅ SpotifyExtractor loaded');
    } catch (e) { console.warn('⚠️ SpotifyExtractor failed:', e.message); }

    try {
        await player.extractors.register(SoundCloudExtractor, {});
        console.log('✅ SoundCloudExtractor loaded');
    } catch (e) { console.warn('⚠️ SoundCloudExtractor failed:', e.message); }

    try {
        await player.extractors.register(AppleMusicExtractor, {});
        console.log('✅ AppleMusicExtractor loaded');
    } catch (e) { console.warn('⚠️ AppleMusicExtractor failed:', e.message); }

    try {
        await player.extractors.register(AttachmentExtractor, {});
        console.log('✅ AttachmentExtractor loaded');
    } catch (e) { console.warn('⚠️ AttachmentExtractor failed:', e.message); }
})();

console.clear();
require('./loader');

client.login(client.config.app.token).catch(async (e) => {
    if (e.message === 'An invalid token was provided.') {
        require('./process_tools').throwConfigError('app', 'token', '\n\t   ❌ Invalid Token Provided! ❌ \n\tChange the token in the config file\n');
    } else {
        console.error('❌ An error occurred while trying to login to the bot! ❌ \n', e);
    }
});
