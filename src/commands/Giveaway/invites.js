const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
} = require('discord.js');

module.exports = {
    name: 'invites',
    aliases: ['ginvites', 'myinvites', 'invitecount'],
    description: 'Check how many server invites a user has (useful for invite-based giveaways).',
    category: 'Giveaway',
    usage: 'invites [user]',
    slashOptions: [
        {
            name: 'user',
            description: 'The user to check invites for (defaults to yourself)',
            type: 6,
            required: false,
        },
    ],
    userPerms: [],
    botPerms: ['ManageGuild'],

    async slashExecute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });
        const target = interaction.options.getUser('user') || interaction.user;
        const result = await getInviteStats(interaction.guild, target.id);
        const container = buildContainer(client.emoji, target, result);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },

    async execute(message, args, client) {
        let target = message.author;

        if (args[0]) {
            const mention = message.mentions.users.first();
            if (mention) {
                target = mention;
            } else {
                // Try by ID
                const fetched = await message.client.users.fetch(args[0]).catch(() => null);
                if (fetched) target = fetched;
            }
        }

        const result = await getInviteStats(message.guild, target.id);
        const container = buildContainer(client.emoji, target, result);
        return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch and aggregate all invite stats for a user in a guild
// ─────────────────────────────────────────────────────────────────────────────
async function getInviteStats(guild, userId) {
    try {
        const invites = await guild.invites.fetch();
        const userInvites = invites.filter(inv => inv.inviter?.id === userId);

        const totalUses   = userInvites.reduce((sum, inv) => sum + (inv.uses || 0), 0);
        const totalLinks  = userInvites.size;
        const activeLinks = userInvites.filter(inv => !inv.maxUses || inv.uses < inv.maxUses);

        // Top 5 most-used invite links
        const topLinks = [...userInvites.values()]
            .sort((a, b) => (b.uses || 0) - (a.uses || 0))
            .slice(0, 5)
            .map(inv => {
                const uses    = inv.uses || 0;
                const maxUses = inv.maxUses ? `/${inv.maxUses}` : '/∞';
                const expires = inv.expiresAt
                    ? `<t:${Math.floor(inv.expiresAt.getTime() / 1000)}:R>`
                    : 'Never';
                return `\`discord.gg/${inv.code}\` — **${uses}${maxUses}** uses · Expires: ${expires}`;
            });

        return { totalUses, totalLinks, activeLinks: activeLinks.size, topLinks };
    } catch {
        return { totalUses: 0, totalLinks: 0, activeLinks: 0, topLinks: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the ComponentsV2 display container
// ─────────────────────────────────────────────────────────────────────────────
function buildContainer(emoji, target, { totalUses, totalLinks, activeLinks, topLinks }) {
    const linksText = topLinks.length > 0
        ? topLinks.join('\n')
        : '*No invite links found.*';

    const info = new TextDisplayBuilder().setContent(
        `### ${emoji.gwy} Invite Stats — ${target.username}\n` +
        `${emoji.wickarrow} **Total Invites Used:** \`${totalUses}\`\n` +
        `${emoji.wickarrow} **Invite Links Created:** \`${totalLinks}\`\n` +
        `${emoji.wickarrow} **Active Links:** \`${activeLinks}\`\n`
    );

    const sep = new SeparatorBuilder();

    const links = new TextDisplayBuilder().setContent(
        `**Top Invite Links:**\n${linksText}`
    );

    return new ContainerBuilder()
        .addTextDisplayComponents(info)
        .addSeparatorComponents(sep)
        .addTextDisplayComponents(links);
}
