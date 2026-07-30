const { ApplicationCommandOptionType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', '..', 'mention_config.json');

function loadConfig() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
        catch (_) {}
    }
    return { botMessage: '👋 Hey! You pinged me? Use **/play** to add music to the queue!' };
}

function saveConfig(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
    name: 'setbotmessage',
    description: 'Set the custom message the bot sends when someone mentions it',
    permissions: PermissionsBitField.Flags.ManageGuild,
    options: [
        {
            name: 'message',
            description: 'The custom message to send when the bot is mentioned (leave empty to view current)',
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ],

    async execute({ inter, client }) {
        const ownerId = client.config.app.ownerId || process.env.OWNER_ID;
        const isOwner = inter.user.id === ownerId;

        // Only owner or admins can use this
        if (!isOwner && !inter.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setDescription('❌ Only the bot owner or server admins can use this command.')]
            });
        }

        const newMessage = inter.options.getString('message');
        const config     = loadConfig();

        // ── View current message ──────────────────────────────────────────────
        if (!newMessage) {
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#5865F2')
                    .setAuthor({ name: '⚙️  Bot Mention Message', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`**Current message:**\n${config.botMessage}`)
                    .setFooter({ text: 'Use /setbotmessage <message> to change it' })]
            });
        }

        // ── Update message ────────────────────────────────────────────────────
        config.botMessage = newMessage;
        saveConfig(config);

        return inter.editReply({
            embeds: [new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: '✅  Bot Mention Message Updated', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**New message:**\n${newMessage}`)
                .setFooter({ text: `Updated by ${inter.member.displayName}`, iconURL: inter.member.displayAvatarURL() })
                .setTimestamp()]
        });
    }
};
