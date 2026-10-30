const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require("discord.js");

const ms = require("ms");

// ─── Utility helpers ──────────────────────────────────────────────────────────

function parseTime(str) {
    try { const v = ms(str); return (v && v > 0) ? v : null; } catch { return null; }
}

function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function pickWinners(entrants, count) {
    const pool = [...entrants];
    const winners = [];
    while (winners.length < count && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
    }
    return winners;
}

// ─── Build the live giveaway message ─────────────────────────────────────────

function buildGiveawayComponents(gw, ended = false) {
    const endsAt = new Date(gw.endsAt);
    const now    = new Date();
    const diff   = endsAt - now;

    const timeStr = ended
        ? "🎉 **Giveaway Ended!**"
        : `⏰ Ends in **${fmtTime(Math.max(0, diff))}** (<t:${Math.floor(endsAt / 1000)}:R>)`;

    const winners = ended && gw.winners?.length
        ? `\n🏆 **Winner${gw.winners.length > 1 ? "s" : ""}:** ${gw.winners.map(id => `<@${id}>`).join(", ")}`
        : "";

    const entrantCount = Array.isArray(gw.entrants) ? gw.entrants.length : 0;

    const header = new TextDisplayBuilder().setContent(
        `## 🎊  ${gw.prize}\n` +
        `> ${timeStr}\n` +
        `> 👥 **${entrantCount}** entrant${entrantCount !== 1 ? "s" : ""}  •  🏅 **${gw.winners_count}** winner${gw.winners_count !== 1 ? "s" : ""}\n` +
        `> 🎟️ Hosted by <@${gw.hostedBy}>${winners}`
    );

    const sep = new SeparatorBuilder();

    const footer = new TextDisplayBuilder().setContent(
        ended
            ? `-# Giveaway ID: \`${gw.messageId}\``
            : `-# Click the button below to enter! • Giveaway ID: \`${gw.messageId ?? "pending"}\``
    );

    const container = new ContainerBuilder()
        .addTextDisplayComponents(header)
        .addSeparatorComponents(sep)
        .addTextDisplayComponents(footer);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`gw_enter_${gw.guildId}_${gw.messageId ?? "pending"}`)
            .setLabel(ended ? "Giveaway Ended" : "🎉  Enter Giveaway")
            .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(ended)
    );

    return { container, row };
}

// ─── Command definition ───────────────────────────────────────────────────────

module.exports = {
    name: "giveaway",
    aliases: ["gw"],
    category: "Utility",
    description: "Create and manage giveaways",
    args: true,
    usage: "giveaway <start|end|reroll|list|delete> [options]",
    userPerms: [],
    owner: false,
    player: false,
    inVoiceChannel: false,
    sameVoiceChannel: false,
    slashOptions: [
        {
            name: "start",
            description: "Start a new giveaway",
            type: 1,
            options: [
                { name: "duration",  description: "Duration (e.g. 1h, 30m, 2d)", type: 3, required: true },
                { name: "winners",   description: "Number of winners",            type: 4, required: true },
                { name: "prize",     description: "What is being given away",     type: 3, required: true },
                { name: "channel",   description: "Channel to host in",           type: 7, required: false },
            ],
        },
        {
            name: "end",
            description: "End a giveaway early",
            type: 1,
            options: [{ name: "message_id", description: "Giveaway message ID", type: 3, required: true }],
        },
        {
            name: "reroll",
            description: "Reroll winners of an ended giveaway",
            type: 1,
            options: [{ name: "message_id", description: "Giveaway message ID", type: 3, required: true }],
        },
        {
            name: "list",
            description: "List active giveaways in this server",
            type: 1,
        },
        {
            name: "delete",
            description: "Delete a giveaway",
            type: 1,
            options: [{ name: "message_id", description: "Giveaway message ID", type: 3, required: true }],
        },
    ],

    async slashExecute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        const wrapper = {
            guild:    interaction.guild,
            channel:  interaction.channel,
            author:   interaction.user,
            member:   interaction.member,
            reply:    async (opts) => {
                if (interaction.deferred || interaction.replied) return interaction.editReply(opts);
                return interaction.reply(opts);
            },
            followUp: (opts) => interaction.followUp(opts),
        };

        await interaction.deferReply({ ephemeral: true });

        if (sub === "start") {
            return this._startGiveaway(
                wrapper, client,
                interaction.options.getString("duration"),
                interaction.options.getInteger("winners"),
                interaction.options.getString("prize"),
                interaction.options.getChannel("channel") || interaction.channel
            );
        }
        if (sub === "end")    return this._endGiveaway(wrapper, client, interaction.options.getString("message_id"));
        if (sub === "reroll") return this._rerollGiveaway(wrapper, client, interaction.options.getString("message_id"));
        if (sub === "list")   return this._listGiveaways(wrapper, client);
        if (sub === "delete") return this._deleteGiveaway(wrapper, client, interaction.options.getString("message_id"));
    },

    async execute(message, args, client) {
        const sub  = (args[0] || "").toLowerCase();
        const perm = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

        if (!perm && sub !== "list") {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} You need **Manage Server** permission to manage giveaways.`)
            );
            return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === "start") {
            const duration     = args[1];
            const winnersCount = parseInt(args[2]);
            const prize        = args.slice(3).join(" ");

            if (!duration || isNaN(winnersCount) || !prize) {
                const c = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.cross} **Usage:** \`${client.prefix}giveaway start <duration> <winners> <prize>\`\n` +
                        `Example: \`${client.prefix}giveaway start 1h 2 Discord Nitro\``
                    )
                );
                return message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            }

            return this._startGiveaway(message, client, duration, winnersCount, prize, message.channel);
        }

        if (sub === "end")    return this._endGiveaway(message, client, args[1]);
        if (sub === "reroll") return this._rerollGiveaway(message, client, args[1]);
        if (sub === "list")   return this._listGiveaways(message, client);
        if (sub === "delete") return this._deleteGiveaway(message, client, args[1]);

        const helpContainer = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🎊 Giveaway Commands\n` +
                `\`${client.prefix}giveaway start <duration> <winners> <prize>\` — Start a giveaway\n` +
                `\`${client.prefix}giveaway end <messageId>\` — End a giveaway early\n` +
                `\`${client.prefix}giveaway reroll <messageId>\` — Reroll winners\n` +
                `\`${client.prefix}giveaway list\` — List active giveaways\n` +
                `\`${client.prefix}giveaway delete <messageId>\` — Delete a giveaway`
            )
        );
        return message.reply({ components: [helpContainer], flags: MessageFlags.IsComponentsV2 });
    },

    async _startGiveaway(ctx, client, durationStr, winnersCount, prize, targetChannel) {
        const duration = parseTime(durationStr);
        if (!duration) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Invalid duration. Examples: \`10m\`, \`1h\`, \`2d\``)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (!winnersCount || winnersCount < 1 || winnersCount > 20) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Winners must be between **1** and **20**.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (!prize?.trim()) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Please provide a prize.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const endsAt   = Date.now() + duration;
        const guildId  = ctx.guild.id;
        const hostedBy = ctx.author?.id || ctx.user?.id;

        const tempGw = { prize, endsAt, winners_count: winnersCount, hostedBy, entrants: [], winners: [], guildId, messageId: "pending" };
        const { container, row } = buildGiveawayComponents(tempGw, false);

        let gwMsg;
        try {
            gwMsg = await targetChannel.send({ components: [container, row], flags: MessageFlags.IsComponentsV2 });
        } catch {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} I can't send messages in ${targetChannel}.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        client.db.giveaways.create({
            guildId, channelId: targetChannel.id, messageId: gwMsg.id,
            prize, endsAt, winners_count: winnersCount, hostedBy,
            entrants: JSON.stringify([]), winners: JSON.stringify([]), ended: 0,
        });

        const realGw = { ...tempGw, messageId: gwMsg.id };
        const { container: rc, row: rr } = buildGiveawayComponents(realGw, false);
        await gwMsg.edit({ components: [rc, rr], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

        this._scheduleGiveaway(client, gwMsg.id, guildId, duration);

        const ok = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${client.emoji.check} Giveaway started in ${targetChannel}!\n` +
                `-# Prize: **${prize}** • Winners: **${winnersCount}** • Duration: **${fmtTime(duration)}**`
            )
        );
        return ctx.reply({ components: [ok], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async _endGiveaway(ctx, client, messageId) {
        if (!messageId) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Please provide the giveaway **message ID**.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const gw = client.db.giveaways.get(messageId);
        if (!gw || gw.guildId !== ctx.guild.id) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} No giveaway found with that ID in this server.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (gw.ended) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.warn} That giveaway has already ended.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        await this._finalizeGiveaway(client, messageId);
        const c = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${client.emoji.check} Giveaway \`${messageId}\` has been ended.`)
        );
        return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async _rerollGiveaway(ctx, client, messageId) {
        if (!messageId) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Please provide the giveaway **message ID**.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const gw = client.db.giveaways.get(messageId);
        if (!gw || gw.guildId !== ctx.guild.id) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} No giveaway found with that ID.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (!gw.ended) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.warn} That giveaway hasn't ended yet. Use \`end\` first.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const entrants = JSON.parse(gw.entrants || "[]");
        if (entrants.length === 0) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} No entrants to reroll from.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const newWinners = pickWinners(entrants, gw.winners_count ?? 1);
        client.db.giveaways.update(messageId, { winners: JSON.stringify(newWinners) });

        try {
            const ch  = await client.channels.fetch(gw.channelId).catch(() => null);
            const msg = ch ? await ch.messages.fetch(messageId).catch(() => null) : null;
            if (msg) {
                const updatedGw = { ...gw, winners: newWinners, entrants, ended: 1 };
                const { container: ec, row: er } = buildGiveawayComponents(updatedGw, true);
                await msg.edit({ components: [ec, er], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                await msg.channel.send({
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `🎉 **Giveaway Rerolled!**\nNew winner${newWinners.length > 1 ? "s" : ""}: ${newWinners.map(id => `<@${id}>`).join(", ")}\n**Prize:** ${gw.prize}`
                        )
                    )],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch {}

        const c = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${client.emoji.check} Rerolled! New winner${newWinners.length > 1 ? "s" : ""}: ${newWinners.map(id => `<@${id}>`).join(", ")}`
            )
        );
        return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async _listGiveaways(ctx, client) {
        const all    = client.db.giveaways.getByGuild(ctx.guild.id);
        const active = all.filter(g => !g.ended);

        if (active.length === 0) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.info} No active giveaways in this server.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const lines = active.map((g, i) => {
            const ts = Math.floor(new Date(g.endsAt) / 1000);
            return `**${i + 1}.** 🎊 **${g.prize}** • ends <t:${ts}:R> • ${g.winners_count} winner${g.winners_count !== 1 ? "s" : ""} • ID: \`${g.messageId}\``;
        });

        const c = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🎊 Active Giveaways (${active.length})\n${lines.join("\n")}`)
        );
        return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    },

    async _deleteGiveaway(ctx, client, messageId) {
        if (!messageId) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} Please provide the giveaway **message ID**.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        const gw = client.db.giveaways.get(messageId);
        if (!gw || gw.guildId !== ctx.guild.id) {
            const c = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} No giveaway found with that ID in this server.`)
            );
            return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        client.db.giveaways.delete(messageId);
        try {
            const ch  = await client.channels.fetch(gw.channelId).catch(() => null);
            const msg = ch ? await ch.messages.fetch(messageId).catch(() => null) : null;
            if (msg) await msg.delete().catch(() => {});
        } catch {}

        const c = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${client.emoji.check} Giveaway \`${messageId}\` deleted.`)
        );
        return ctx.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    _scheduleGiveaway(client, messageId, guildId, duration) {
        if (!client._gwTimers) client._gwTimers = new Map();
        const timer = setTimeout(() => this._finalizeGiveaway(client, messageId), duration);
        client._gwTimers.set(messageId, timer);
    },

    async _finalizeGiveaway(client, messageId) {
        const gw = client.db.giveaways.get(messageId);
        if (!gw || gw.ended) return;

        const entrants = JSON.parse(gw.entrants || "[]");
        const winners  = pickWinners(entrants, gw.winners_count ?? 1);

        client.db.giveaways.update(messageId, { ended: 1, winners: JSON.stringify(winners) });

        if (client._gwTimers?.has(messageId)) {
            clearTimeout(client._gwTimers.get(messageId));
            client._gwTimers.delete(messageId);
        }

        try {
            const ch  = await client.channels.fetch(gw.channelId).catch(() => null);
            const msg = ch ? await ch.messages.fetch(messageId).catch(() => null) : null;
            if (!msg) return;

            const { container: ec, row: er } = buildGiveawayComponents(
                { ...gw, entrants, winners, ended: 1 }, true
            );
            await msg.edit({ components: [ec, er], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

            const announceText = winners.length > 0
                ? `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(", ")}! You won **${gw.prize}**!`
                : `😔 No valid entrants for the giveaway of **${gw.prize}**.`;

            await msg.channel.send({
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(announceText)
                )],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (e) {
            console.error("[Giveaway] Failed to finalize:", e);
        }
    },
};
