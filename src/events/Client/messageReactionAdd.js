const { Events } = require('discord.js');
const { getUserInviteCount } = require('../../utils/giveawayManager');

module.exports = {
    name: Events.MessageReactionAdd,
    run: async (client, reaction, user) => {
        if (user.bot) return;

        // Only track the giveaway emoji
        const gwEmojiId = client.emoji?.gwy?.match(/:(\d+)>/)?.[1];
        if (!gwEmojiId || reaction.emoji.id !== gwEmojiId) return;

        // Fetch partial reaction/message if needed
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }

        const giveaway = client.db.giveaways.get(reaction.message.id);
        if (!giveaway || giveaway.ended) return;

        // ── Minimum invite requirement check ──────────────────────────────────
        if (giveaway.minInvites > 0) {
            const guild      = client.guilds.cache.get(giveaway.guildId);
            const userCount  = guild ? await getUserInviteCount(guild, user.id) : 0;

            if (userCount < giveaway.minInvites) {
                // Remove their reaction silently and DM them
                await reaction.users.remove(user.id).catch(() => {});
                user.send({
                    content: `${client.emoji.cross} You need at least **${giveaway.minInvites}** server invite${giveaway.minInvites !== 1 ? 's' : ''} to enter the **\`${giveaway.prize}\`** giveaway. You currently have **${userCount}**.`,
                }).catch(() => {}); // User may have DMs off
                return;
            }
        }

        // Add as participant
        if (!giveaway.participants.includes(user.id)) {
            giveaway.participants.push(user.id);
            client.db.giveaways.set(reaction.message.id, giveaway);
        }
    },
};
