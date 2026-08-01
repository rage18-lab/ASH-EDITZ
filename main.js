require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

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

(async () => {
    require('./loader');

    client.login(client.config.app.token).catch(async (e) => {
        if (e.message === 'An invalid token was provided.') {
            require('./process_tools').throwConfigError('app', 'token', '\n\t   ❌ Invalid Token Provided! ❌ \n\tChange the token in the config file\n');
        } else {
            console.error('❌ An error occurred while trying to login to the bot! ❌ \n', e);
        }
    });
})();
