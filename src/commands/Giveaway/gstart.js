const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
} = require('discord.js');

function parseDuration(str) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    const match = str.toLowerCase().match(/^(\d+)([smhdw])$/);
    return match ? parseInt(match[1]) * units[match[2]] : null;
}

// Build the giveaway embed text
function buildGwyText(emoji, data) {
    const endTimeUnix = Math.floor(data.endTime / 1000);
    const modeTag     = data.inviteWinner
        ? `\n${emoji.wickarrow} **Mode:** \`🏆 Most Invites Wins\``
        : '';
    const minTag      = data.minInvites > 0
        ? `\n${emoji.wickarrow} **Min Invites Required:** \`${data.minInvites}\``
        : '';

    return (
        `${emoji.wickarrow} **Prize:** \`${data.prize}\`\n` +
        `${emoji.wickarrow} **Winners:** \`${data.winnerCount}\`\n` +
        `${emoji.wickarrow} **Host:** <@${data.hostId}>\n` +
        `${emoji.wickarrow} **Ends:** <t:${endTimeUnix}:R> [<t:${endTimeUnix}:f>]` +
        modeTag + minTag +
        `\n\n-# React with ${emoji.gwy} to enter!`
    );
}

module.exports = {
    name: 'gstart',
    aliases: ['giveawaystart', 'gcreate'],
    description: 'Start a giveaway.',
    category: 'Giveaway',
    usage: 'gstart <duration> <winners> <prize> [minInvites:<N>] [inviteWinner]',
    example: 'gstart 10m 1 Nitro | gstart 1h 1 Nitro minInvites:5 | gstart 1h 1 Nitro inviteWinner',
    slashOptions: [
        { name: 'prize',         description: 'The prize for the giveaway',                      type: 3, required: true  },
        { name: 'duration',      description: 'The duration (e.g. 10m, 2h, 3d)',                 type: 3, required: true  },
        { name: 'winners',       description: 'The number of winners',                            type: 4, required: true  },
        { name: 'min_invites',   description: 'Min server invites required to enter (default 0)', type: 4, required: false },
        { name: 'invite_winner', description: 'The person with most invites wins instead of random draw', type: 5, required: false },
    ],
    userPerms: ['ManageChannels'],
    botPerms: ['EmbedLinks', 'SendMessages', 'AddReactions'],

    // ── Slash ──────────────────────────────────────────────────────────────────
    async slashExecute(interaction, client) {
        const isOwner = client.owners.includes(interaction.user.id);
        if (!interaction.member.permissions.has('ManageChannels') && !isOwner) {
            const display = new TextDisplayBuilder().setContent(`${client.emoji.warn} You need \`Manage Channels\` permissions to use this command.`);
            return interaction.reply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const prize        = interaction.options.getString('prize');
        const winners      = interaction.options.getInteger('winners');
        const durationStr  = interaction.options.getString('duration');
        const minInvites   = interaction.options.getInteger('min_invites') ?? 0;
        const inviteWinner = interaction.options.getBoolean('invite_winner') ?? false;
        const durationMs   = parseDuration(durationStr);

        if (!durationMs || isNaN(winners) || winners < 1) {
            const display = new TextDisplayBuilder().setContent(`${client.emoji.warn} Invalid arguments!`);
            return interaction.reply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ ephemeral: true });

        const gwData = {
            guildId: interaction.guild.id, channelId: interaction.channel.id,
            hostId: interaction.user.id, prize, winnerCount: winners,
            endTime: Date.now() + durationMs, minInvites, inviteWinner,
        };

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${client.emoji.gwy} Giveaway Started`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildGwyText(client.emoji, gwData)));

        const gMsg = await interaction.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
        await gMsg.react(`${client.emoji.gwy}`);

        client.db.giveaways.set(gMsg.id, {
            ...gwData, messageId: gMsg.id, participants: [], ended: false,
        });

        const okDisplay = new TextDisplayBuilder().setContent(`${client.emoji.check} Giveaway started!`);
        return interaction.editReply({ components: [new ContainerBuilder().addTextDisplayComponents(okDisplay)], flags: MessageFlags.IsComponentsV2 });
    },

    // ── Prefix ─────────────────────────────────────────────────────────────────
    // Usage: .gstart <duration> <winners> <prize> [minInvites:<N>] [inviteWinner]
    async execute(message, args, client) {
        const isOwner = client.owners.includes(message.author.id);
        if (!message.member.permissions.has('ManageChannels') && !isOwner) {
            const display = new TextDisplayBuilder().setContent(`${client.emoji.warn} You need \`Manage Channels\` permissions.`);
            return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
        }

        if (args.length >= 3) {
            const durationStr  = args[0];
            const winnersCount = parseInt(args[1]);
            const durationMs   = parseDuration(durationStr);

            // Extract flags: minInvites:<N> and inviteWinner from the remaining args
            const remaining    = args.slice(2);
            const minInvArg    = remaining.find(a => a.toLowerCase().startsWith('mininvites:'));
            const invWinFlag   = remaining.some(a => a.toLowerCase() === 'invitewinner');
            const minInvites   = minInvArg ? parseInt(minInvArg.split(':')[1]) || 0 : 0;
            const inviteWinner = invWinFlag;
            const prize        = remaining.filter(a => !a.toLowerCase().startsWith('mininvites:') && a.toLowerCase() !== 'invitewinner').join(' ');

            if (!durationMs || isNaN(winnersCount) || winnersCount < 1 || !prize) {
                const display = new TextDisplayBuilder().setContent(
                    `${client.emoji.warn} **Usage:** \`.gstart <duration> <winners> <prize> [minInvites:<N>] [inviteWinner]\`\n` +
                    `-# Examples:\n` +
                    `-# \`.gstart 1h 2 Nitro\`\n` +
                    `-# \`.gstart 1h 1 Nitro minInvites:5\` *(need 5+ invites to enter)*\n` +
                    `-# \`.gstart 1h 1 Nitro inviteWinner\` *(most invites wins)*`
                );
                return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 });
            }

            const gwData = {
                guildId: message.guild.id, channelId: message.channel.id,
                hostId: message.author.id, prize, winnerCount: winnersCount,
                endTime: Date.now() + durationMs, minInvites, inviteWinner,
            };

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${client.emoji.gwy} Giveaway Started`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildGwyText(client.emoji, gwData)));

            const giveawayMsg = await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
            await giveawayMsg.react(`${client.emoji.gwy}`);

            client.db.giveaways.set(giveawayMsg.id, {
                ...gwData, messageId: giveawayMsg.id, participants: [], ended: false,
            });
            return;
        }

        // No args — modal launcher button
        const startButton = new ButtonBuilder().setCustomId('gstart_launch').setLabel('Launch Giveaway').setStyle(ButtonStyle.Primary);
        const row         = new ActionRowBuilder().addComponents(startButton);
        const header      = new TextDisplayBuilder().setContent(`### Giveaway System\n-# Requested by ${message.author.username} · <t:${Math.floor(Date.now() / 1000)}:t>`);
        const separator   = new SeparatorBuilder();
        const info        = new TextDisplayBuilder().setContent(`Click the button below to open the giveaway setup form.`);

        await message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(header).addSeparatorComponents(separator).addTextDisplayComponents(info), row],
            flags: MessageFlags.IsComponentsV2,
        });
    },

    // ── Modal (button launch) ──────────────────────────────────────────────────
    async componentsV2(interaction, client) {
        const isOwner = client.owners.includes(interaction.user.id);
        if (!interaction.member.permissions.has('ManageChannels') && !isOwner) {
            const display = new TextDisplayBuilder().setContent(`${client.emoji.warn} You need \`Manage Channels\` permissions to use this.`);
            return interaction.reply({ components: [new ContainerBuilder().addTextDisplayComponents(display)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (interaction.customId === 'gstart_launch') {
            const modal = new ModalBuilder().setCustomId('giveaway_modal').setTitle('Create Giveaway');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('giveaway_prize').setLabel('Prize').setPlaceholder('Enter the prize').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('giveaway_duration').setLabel('Duration').setPlaceholder('e.g. 10m, 2h, 3d').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('giveaway_winners').setLabel('Winner Count').setPlaceholder('Number of winners').setStyle(TextInputStyle.Short).setValue('1').setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('giveaway_min_invites').setLabel('Min Invites to Enter (0 = none)').setPlaceholder('e.g. 5  (leave 0 for no requirement)').setStyle(TextInputStyle.Short).setValue('0').setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('giveaway_invite_winner').setLabel('Most Invites Wins? (yes/no)').setPlaceholder('Type yes for invite-based winner, no for random').setStyle(TextInputStyle.Short).setValue('no').setRequired(false)
                ),
            );

            await interaction.showModal(modal);
            try {
                const modalSubmit  = await interaction.awaitModalSubmit({ time: 60000, filter: (i) => i.customId === 'giveaway_modal' && i.user.id === interaction.user.id });
                const prize        = modalSubmit.fields.getTextInputValue('giveaway_prize');
                const durationStr  = modalSubmit.fields.getTextInputValue('giveaway_duration');
                const winnersStr   = modalSubmit.fields.getTextInputValue('giveaway_winners');
                const minInvStr    = modalSubmit.fields.getTextInputValue('giveaway_min_invites') || '0';
                const invWinStr    = modalSubmit.fields.getTextInputValue('giveaway_invite_winner') || 'no';
                const durationMs   = parseDuration(durationStr);
                const winnerCount  = parseInt(winnersStr);
                const minInvites   = Math.max(0, parseInt(minInvStr) || 0);
                const inviteWinner = invWinStr.trim().toLowerCase() === 'yes';

                if (!durationMs || isNaN(winnerCount) || winnerCount < 1) {
                    const errorDisplay = new TextDisplayBuilder().setContent(`${client.emoji.cross} Invalid input provided.`);
                    return modalSubmit.reply({ components: [new ContainerBuilder().addTextDisplayComponents(errorDisplay)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                }

                await modalSubmit.deferUpdate();

                const gwData = {
                    guildId: interaction.guild.id, channelId: interaction.channel.id,
                    hostId: interaction.user.id, prize, winnerCount,
                    endTime: Date.now() + durationMs, minInvites, inviteWinner,
                };

                const gContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${client.emoji.gwy} Giveaway Started`))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildGwyText(client.emoji, gwData)));

                const gMsg = await interaction.channel.send({ components: [gContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
                await gMsg.react(`${client.emoji.gwy}`);

                client.db.giveaways.set(gMsg.id, {
                    ...gwData, messageId: gMsg.id, participants: [], ended: false,
                });

                try { await interaction.message.delete(); } catch {}
            } catch {}
        }
    },
};
