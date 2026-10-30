const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    run: async (client, reaction, user) => {
        if (user.bot) return;

        // Only track reactions matching the giveaway emoji
        const gwEmojiId = client.emoji?.gwy?.match(/:(\d+)>/)?.[1];
        if (!gwEmojiId || reaction.emoji.id !== gwEmojiId) return;

        // Fetch partial reaction/message if needed
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }

        const giveaway = client.db.giveaways.get(reaction.message.id);
        if (!giveaway || giveaway.ended) return;

        if (!giveaway.participants.includes(user.id)) {
            giveaway.participants.push(user.id);
            client.db.giveaways.set(reaction.message.id, giveaway);
        }
    },
};
