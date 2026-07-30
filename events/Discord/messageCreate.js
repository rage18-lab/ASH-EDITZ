const { EmbedBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const { generateReply, getAIChannel } = require('../../utils/ai_chat');

// Path to persist the bot's custom mention message
const DATA_FILE = path.join(__dirname, '..', '..', 'mention_config.json');

function loadConfig() {
    if (fs.existsSync(DATA_FILE)) {
        try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
        catch (_) {}
    }
    return { botMessage: '👋 Hey! You pinged me? Use **/play** to add music to the queue!' };
}

// Truncate long AI replies to fit Discord's 4096 embed limit
function truncate(text, max = 3800) {
    if (!text) return '*(no response)*';
    return text.length > max ? text.substring(0, max) + '\n\n*...truncated*' : text;
}

// Format AI markdown for Discord (bold, code blocks are already compatible)
function formatForDiscord(text) {
    return text
        .replace(/\*\*\*(.*?)\*\*\*/g, '**$1**')   // bold+italic → bold
        .replace(/#{1,6}\s?(.+)/g, '**$1**')        // headings → bold
        .trim();
}

module.exports = async (client, message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    const ownerId  = client.config.app.ownerId || process.env.OWNER_ID;
    const config   = loadConfig();
    const aiChannel = getAIChannel(message.guild.id);

    // ── 1. AI Chat Channel ──────────────────────────────────────────────────
    if (aiChannel && message.channel.id === aiChannel) {
        // Show typing indicator
        await message.channel.sendTyping().catch(() => {});

        const userInput = message.content.trim();
        if (!userInput || userInput.startsWith('/')) return; // ignore slash commands

        try {
            const reply = await generateReply(message.guild.id, message.author.id, userInput);
            const formatted = formatForDiscord(reply);

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({
                    name: `🤖 Hot Pursuit AI`,
                    iconURL: client.user.displayAvatarURL({ size: 64 })
                })
                .setDescription(truncate(formatted))
                .setFooter({
                    text: `Talking to ${message.author.displayName} • Powered by Gemini`,
                    iconURL: message.author.displayAvatarURL()
                });

            return message.reply({ embeds: [embed] });

        } catch (e) {
            console.error('[AI Chat Error]', e.message);

            const msg = e.message?.toLowerCase() || '';
            const errorMsg = e.message?.includes('GEMINI_API_KEY')
                ? '❌ No Gemini API key set! Ask the bot owner to add `GEMINI_API_KEY` to `.env`.'
                : (msg.includes('401') || msg.includes('unauthenticated') || msg.includes('invalid api key') || msg.includes('permission denied'))
                    ? '❌ Gemini API key is invalid or unauthorized. Check `GEMINI_API_KEY` in `.env` and ensure the key is active.'
                    : `❌ AI error: \`${e.message?.substring(0, 120)}\``;

            return message.reply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(errorMsg)]
            }).catch(() => {});
        }
    }

    // ── 2. Owner Mention Detection ──────────────────────────────────────────
    if (ownerId && ownerId !== 'xxx' && ownerId !== 'YOUR_DISCORD_USER_ID_HERE') {
        if (message.mentions.users.has(ownerId) && message.author.id !== ownerId) {
            const ownerMember = await message.guild.members.fetch(ownerId).catch(() => null);
            const ownerTag    = ownerMember?.displayName || 'my Sensei';

            const embed = new EmbedBuilder()
                .setColor('#F5A623')
                .setDescription(`🙏 Bro, you just tagged **${ownerTag}** — that's my **Sensei**! Show some respect 😤`)
                .setFooter({ text: `Triggered by ${message.author.displayName}`, iconURL: message.author.displayAvatarURL() });

            return message.reply({ embeds: [embed] });
        }
    }

    // ── 3. Bot Mention → Custom Message ────────────────────────────────────
    if (message.mentions.users.has(client.user.id)) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setDescription(config.botMessage)
            .setThumbnail(client.user.displayAvatarURL({ size: 128 }))
            .setFooter({
                text: `${client.user.username} • Music Bot`,
                iconURL: client.user.displayAvatarURL()
            });

        return message.reply({ embeds: [embed] });
    }
};
