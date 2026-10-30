const { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: count how many invite uses a user has in a guild
// ─────────────────────────────────────────────────────────────────────────────
async function getUserInviteCount(guild, userId) {
    try {
        const invites = await guild.invites.fetch();
        return invites
            .filter(inv => inv.inviter?.id === userId)
            .reduce((sum, inv) => sum + (inv.uses || 0), 0);
    } catch {
        return 0;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// End a giveaway: pick winners, edit the message, announce result
// ─────────────────────────────────────────────────────────────────────────────
async function endGiveaway(client, giveaway) {
    if (giveaway.ended) return;

    giveaway.ended = true;
    client.db.giveaways.set(giveaway.messageId, giveaway);

    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) return;

    const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    try {
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message) return;

        const winners = [];

        if (giveaway.participants.length > 0) {
            const validParticipants = giveaway.participants.filter(id => id !== giveaway.hostId);
            const participantsToUse = validParticipants.length > 0 ? validParticipants : giveaway.participants;

            // ── Invite-winner mode: pick who has the most server invites ────────
            if (giveaway.inviteWinner) {
                const inviteCounts = await Promise.all(
                    participantsToUse.map(async id => ({
                        id,
                        count: await getUserInviteCount(guild, id),
                    }))
                );

                // Sort descending by invite count
                inviteCounts.sort((a, b) => b.count - a.count);

                // Announce leaderboard in winner text
                const leaderboard = inviteCounts
                    .slice(0, Math.min(5, inviteCounts.length))
                    .map((p, i) => `**${i + 1}.** <@${p.id}> — \`${p.count}\` invite${p.count !== 1 ? 's' : ''}`)
                    .join('\n');

                winners.push(...inviteCounts.slice(0, giveaway.winnerCount).map(p => p.id));

                const winnerText = winners.length > 0
                    ? `${winners.map(w => `<@${w}>`).join(', ')}`
                    : 'No one qualified.';

                const hostUser = await client.users.fetch(giveaway.hostId).catch(() => null);

                const endHeader = new TextDisplayBuilder().setContent(`### ${client.emoji.gwy} Giveaway Ended — 🏆 Most Invites Won`);
                const endSep    = new SeparatorBuilder();
                const endInfo   = new TextDisplayBuilder().setContent(
                    `${client.emoji.wickarrow} **Prize:** \`${giveaway.prize}\`\n` +
                    `${client.emoji.wickarrow} **Host:** <@${giveaway.hostId}>\n` +
                    `${client.emoji.wickarrow} **Participants:** ${giveaway.participants.length}\n` +
                    `${client.emoji.wickarrow} **Winner${winners.length > 1 ? 's' : ''}:** ${winnerText}\n\n` +
                    `**Top Inviters:**\n${leaderboard || '*No invite data available.*'}`
                );

                const container = new ContainerBuilder()
                    .addTextDisplayComponents(endHeader)
                    .addSeparatorComponents(endSep)
                    .addTextDisplayComponents(endInfo);

                await message.edit({ components: [container], embeds: [], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
                await message.reactions.removeAll().catch(() => null);

                if (winners.length > 0) {
                    channel.send({ content: `${client.emoji.gwy} Congratulations ${winners.map(w => `<@${w}>`).join(', ')}, You won **\`${giveaway.prize}\`** with the most invites! Hosted by ${hostUser}!` });
                } else {
                    channel.send({ content: `The giveaway for **\`${giveaway.prize}\`** has ended, but no one qualified.` });
                }
                return;
            }

            // ── Normal random draw ──────────────────────────────────────────────
            const shuffled = [...participantsToUse].sort(() => 0.5 - Math.random());
            winners.push(...shuffled.slice(0, giveaway.winnerCount));
        }

        const winnerText = winners.length > 0
            ? `${winners.map(w => `<@${w}>`).join(', ')}`
            : 'No one entered the giveaway.';

        const hostUser = await client.users.fetch(giveaway.hostId).catch(() => null);

        const endHeader = new TextDisplayBuilder().setContent(`### ${client.emoji.gwy} Giveaway Ended`);
        const endSep    = new SeparatorBuilder();
        const endInfo   = new TextDisplayBuilder().setContent(
            `${client.emoji.wickarrow} **Prize:** \`${giveaway.prize}\`\n` +
            `${client.emoji.wickarrow} **Host:** <@${giveaway.hostId}>\n` +
            `${client.emoji.wickarrow} **Participants:** ${giveaway.participants.length}\n` +
            `${client.emoji.wickarrow} **Winners:** ${winnerText}`
        );

        const container = new ContainerBuilder()
            .addTextDisplayComponents(endHeader)
            .addSeparatorComponents(endSep)
            .addTextDisplayComponents(endInfo);

        await message.edit({ components: [container], embeds: [], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
        await message.reactions.removeAll().catch(() => null);

        if (winners.length > 0) {
            channel.send({ content: `${client.emoji.gwy} Congratulations ${winners.map(w => `<@${w}>`).join(', ')}, You won **\`${giveaway.prize}\`** hosted by ${hostUser}!` });
        } else {
            channel.send({ content: `The giveaway for **\`${giveaway.prize}\`** has ended, but no one joined.` });
        }
    } catch (err) {
        console.error('[Giveaway] Error ending giveaway:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reroll a single new winner from an ended giveaway
// ─────────────────────────────────────────────────────────────────────────────
async function rerollGiveaway(client, giveaway, channel) {
    if (!giveaway.ended)                   return "The giveaway hasn't ended yet!";
    if (giveaway.participants.length === 0) return "No one entered the giveaway!";

    const guild = client.guilds.cache.get(giveaway.guildId);

    // Invite-winner reroll: re-check invite counts
    if (giveaway.inviteWinner && guild) {
        const validParticipants = giveaway.participants.filter(id => id !== giveaway.hostId);
        const participantsToUse = validParticipants.length > 0 ? validParticipants : giveaway.participants;

        const inviteCounts = await Promise.all(
            participantsToUse.map(async id => ({
                id,
                count: await getUserInviteCount(guild, id),
            }))
        );
        inviteCounts.sort((a, b) => b.count - a.count);
        const winner = inviteCounts[0]?.id;
        if (!winner) return "Could not determine a winner.";
        channel.send({ content: `${client.emoji.gwy} Rerolled! <@${winner}> wins **\`${giveaway.prize}\`** with the most invites!` });
        return true;
    }

    // Normal random reroll
    const validParticipants = giveaway.participants.filter(id => id !== giveaway.hostId);
    const participantsToUse = validParticipants.length > 0 ? validParticipants : giveaway.participants;
    const winner            = participantsToUse[Math.floor(Math.random() * participantsToUse.length)];

    channel.send({ content: `${client.emoji.gwy} Congratulations <@${winner}>, You are the new winner of **\`${giveaway.prize}\`**!` });
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recover a giveaway from a message that was lost from the DB (after restart)
// ─────────────────────────────────────────────────────────────────────────────
async function recoverGiveaway(client, message) {
    try {
        const rawData = JSON.stringify(message.components);

        const prizeMatch   = rawData.match(/\*\*Prize:\*\* `(.*?)`/);
        const winnersMatch = rawData.match(/\*\*Winners:\*\* `(\d+)`/);
        const hostMatch    = rawData.match(/discord\.com\/users\/(\d+)/);
        const timeMatch    = rawData.match(/<t:(\d+):R>/);

        if (!prizeMatch || !winnersMatch || !hostMatch || !timeMatch) return null;

        const prize       = prizeMatch[1];
        const winnerCount = parseInt(winnersMatch[1]);
        const hostId      = hostMatch[1];
        const endTime     = parseInt(timeMatch[1]) * 1000;

        // Detect invite winner mode from message text
        const inviteWinner = rawData.includes('Most Invites Wins');
        const minInvMatch  = rawData.match(/Min Invites Required.*?`(\d+)`/);
        const minInvites   = minInvMatch ? parseInt(minInvMatch[1]) : 0;

        const emojiId = client.emoji.gwy.match(/:(\d+)>/)?.[1];
        if (!emojiId) return null;

        const reaction = message.reactions.cache.get(emojiId) ||
            message.reactions.cache.find(r => r.emoji.name === 'giveaway');

        let participants = [];
        if (reaction) {
            const users  = await reaction.users.fetch();
            participants = users.filter(u => !u.bot).map(u => u.id);
        }

        const giveawayData = {
            guildId: message.guildId, channelId: message.channelId, messageId: message.id,
            hostId, prize, winnerCount, endTime, participants, ended: false,
            minInvites, inviteWinner,
        };

        client.db.giveaways.set(message.id, giveawayData);
        return giveawayData;
    } catch (err) {
        console.error('[Giveaway] Error recovering giveaway:', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync giveaways for a guild after restart (scan recent messages)
// ─────────────────────────────────────────────────────────────────────────────
async function syncGiveaways(client, guild) {
    const channels = guild.channels.cache.filter(c => c.isTextBased());
    for (const channel of channels.values()) {
        try {
            const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
            if (!messages) continue;

            for (const message of messages.values()) {
                if (message.author.id !== client.user.id) continue;

                const rawData = JSON.stringify(message.components);
                if (!rawData || !rawData.includes('Giveaway Started')) continue;

                const exists = client.db.giveaways.get(message.id);
                if (exists) continue;

                const recovered = await recoverGiveaway(client, message);
                if (recovered) {
                    console.log(`[Giveaway Sync] Recovered giveaway ${recovered.messageId} in ${guild.name}`);
                    if (recovered.endTime <= Date.now()) {
                        await endGiveaway(client, recovered);
                    }
                }
            }
        } catch (e) {
            console.error(`[Giveaway Sync] Error in channel ${channel.id}:`, e);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Init: poll every 10s to auto-end expired giveaways
//       cleanup old ended giveaways every hour
// ─────────────────────────────────────────────────────────────────────────────
function init(client) {
    setInterval(async () => {
        try {
            const now             = Date.now();
            const activeGiveaways = client.db.giveaways.getExpired(now);
            for (const giveaway of activeGiveaways) {
                await endGiveaway(client, giveaway);
            }
        } catch (err) {
            console.error('[Giveaway] Check error:', err);
        }
    }, 10000);

    setInterval(async () => {
        try {
            const oneDayAgo = Date.now() - 86400000;
            const changes   = client.db.giveaways.deleteOldEnded(oneDayAgo);
            if (changes > 0) console.log(`[Giveaway Cleanup] Deleted ${changes} old giveaway(s)`);
        } catch (err) {
            console.error('[Giveaway] Cleanup error:', err);
        }
    }, 3600000);
}

module.exports = { init, endGiveaway, rerollGiveaway, recoverGiveaway, syncGiveaways, getUserInviteCount };
