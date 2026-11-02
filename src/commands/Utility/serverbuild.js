const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ChannelType,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require("discord.js");
const emoji = require("../../emojis");

// ──────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────
const TEMPLATES = {
    gaming: {
        label: "🎮 Gaming Server",
        description: "Roles, channels & emojis for a gaming community",
        roles: [
            { name: "Owner",      color: "#FF0000", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "Admin",      color: "#FF4500", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "Moderator",  color: "#FFA500", hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
            { name: "Pro Gamer",  color: "#FFD700", hoist: true, permissions: [] },
            { name: "Member",     color: "#00FF7F", hoist: false, permissions: [] },
            { name: "Muted",      color: "#808080", hoist: false, permissions: [] },
        ],
        categories: [
            {
                name: "📌 INFORMATION",
                channels: [
                    { name: "📜rules",         type: ChannelType.GuildText, topic: "Server rules and guidelines" },
                    { name: "📢announcements",  type: ChannelType.GuildText, topic: "Server announcements" },
                    { name: "🔖roles",          type: ChannelType.GuildText, topic: "Self-assignable roles" },
                ]
            },
            {
                name: "💬 GENERAL",
                channels: [
                    { name: "💬general",       type: ChannelType.GuildText,  topic: "General chat" },
                    { name: "🤖bot-commands",  type: ChannelType.GuildText,  topic: "Bot commands go here" },
                    { name: "📷media",         type: ChannelType.GuildText,  topic: "Share your media" },
                    { name: "🔊General VC",    type: ChannelType.GuildVoice },
                    { name: "🎮Gaming VC",     type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🎮 GAMING",
                channels: [
                    { name: "🎮game-discussion", type: ChannelType.GuildText, topic: "Discuss your favourite games" },
                    { name: "📋looking-for-group", type: ChannelType.GuildText, topic: "Find people to play with" },
                    { name: "🏆clips-and-highlights", type: ChannelType.GuildText, topic: "Share your best moments" },
                    { name: "🎯Squad 1",        type: ChannelType.GuildVoice },
                    { name: "🎯Squad 2",        type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🔧 STAFF",
                channels: [
                    { name: "🔧staff-chat",    type: ChannelType.GuildText, topic: "Staff only chat" },
                    { name: "📋staff-commands", type: ChannelType.GuildText, topic: "Staff bot commands" },
                    { name: "🎙Staff VC",       type: ChannelType.GuildVoice },
                ]
            }
        ],
        emojiNames: []
    },

    community: {
        label: "🌐 Community Server",
        description: "General-purpose community server layout",
        roles: [
            { name: "Owner",       color: "#FF0000", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "Admin",       color: "#E74C3C", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "Moderator",   color: "#E67E22", hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers] },
            { name: "Helper",      color: "#F1C40F", hoist: true, permissions: [] },
            { name: "Booster",     color: "#FF73FA", hoist: true, permissions: [] },
            { name: "Active",      color: "#2ECC71", hoist: true, permissions: [] },
            { name: "Member",      color: "#3498DB", hoist: false, permissions: [] },
            { name: "Muted",       color: "#95A5A6", hoist: false, permissions: [] },
        ],
        categories: [
            {
                name: "📌 WELCOME",
                channels: [
                    { name: "👋welcome",        type: ChannelType.GuildText, topic: "Welcome to the server!" },
                    { name: "📜rules",           type: ChannelType.GuildText, topic: "Please read before chatting" },
                    { name: "📢announcements",   type: ChannelType.GuildText, topic: "Important announcements" },
                    { name: "🔖self-roles",      type: ChannelType.GuildText, topic: "Assign yourself roles" },
                ]
            },
            {
                name: "💬 GENERAL",
                channels: [
                    { name: "💬general",         type: ChannelType.GuildText, topic: "General chat" },
                    { name: "😂memes",            type: ChannelType.GuildText, topic: "Post your memes" },
                    { name: "📷media",            type: ChannelType.GuildText, topic: "Share images and videos" },
                    { name: "🤖bot-commands",    type: ChannelType.GuildText, topic: "Bot commands" },
                    { name: "🔊Lounge",          type: ChannelType.GuildVoice },
                    { name: "🎵Music",           type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🌟 COMMUNITY",
                channels: [
                    { name: "💡suggestions",     type: ChannelType.GuildText, topic: "Share your ideas" },
                    { name: "🐛bug-reports",     type: ChannelType.GuildText, topic: "Report issues" },
                    { name: "🎉giveaways",       type: ChannelType.GuildText, topic: "Giveaway channel" },
                    { name: "📊polls",           type: ChannelType.GuildText, topic: "Community polls" },
                ]
            },
            {
                name: "🔧 STAFF",
                channels: [
                    { name: "🔧staff-chat",      type: ChannelType.GuildText, topic: "Staff only" },
                    { name: "📋mod-log",         type: ChannelType.GuildText, topic: "Moderation logs" },
                    { name: "🎙Staff VC",        type: ChannelType.GuildVoice },
                ]
            }
        ],
        emojiNames: []
    },

    music: {
        label: "🎵 Music Server",
        description: "A server built for music lovers",
        roles: [
            { name: "Owner",        color: "#FF0000", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "DJ",           color: "#9B59B6", hoist: true, permissions: [PermissionFlagsBits.ManageMessages] },
            { name: "Moderator",    color: "#3498DB", hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers] },
            { name: "Listener",     color: "#1ABC9C", hoist: true, permissions: [] },
            { name: "Member",       color: "#2ECC71", hoist: false, permissions: [] },
        ],
        categories: [
            {
                name: "🎵 INFORMATION",
                channels: [
                    { name: "📜rules",          type: ChannelType.GuildText, topic: "Server rules" },
                    { name: "📢announcements",  type: ChannelType.GuildText, topic: "Announcements" },
                    { name: "🎵now-playing",    type: ChannelType.GuildText, topic: "See what's playing" },
                ]
            },
            {
                name: "💬 CHAT",
                channels: [
                    { name: "💬general",        type: ChannelType.GuildText, topic: "General chat" },
                    { name: "🎵music-requests", type: ChannelType.GuildText, topic: "Request songs here" },
                    { name: "🎧music-discussion", type: ChannelType.GuildText, topic: "Discuss music" },
                    { name: "📋song-recommendations", type: ChannelType.GuildText, topic: "Recommend songs" },
                    { name: "🤖bot-commands",   type: ChannelType.GuildText, topic: "Bot commands" },
                ]
            },
            {
                name: "🎧 LISTENING",
                channels: [
                    { name: "🎵Main Stage",    type: ChannelType.GuildVoice },
                    { name: "🎶Chill Vibes",   type: ChannelType.GuildVoice },
                    { name: "🎸Rock Out",      type: ChannelType.GuildVoice },
                    { name: "🎹Jazz Lounge",   type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🔧 STAFF",
                channels: [
                    { name: "🔧staff-chat",    type: ChannelType.GuildText, topic: "Staff only" },
                    { name: "🎙Staff VC",      type: ChannelType.GuildVoice },
                ]
            }
        ],
        emojiNames: []
    },

    minimal: {
        label: "⚡ Minimal Setup",
        description: "A clean, minimal server with essential channels only",
        roles: [
            { name: "Owner",      color: "#FF0000", hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: "Moderator",  color: "#FFA500", hoist: true, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers] },
            { name: "Member",     color: "#00FF7F", hoist: false, permissions: [] },
        ],
        categories: [
            {
                name: "📌 INFO",
                channels: [
                    { name: "📜rules",          type: ChannelType.GuildText, topic: "Server rules" },
                    { name: "📢announcements",  type: ChannelType.GuildText, topic: "Announcements" },
                ]
            },
            {
                name: "💬 CHAT",
                channels: [
                    { name: "💬general",        type: ChannelType.GuildText, topic: "General chat" },
                    { name: "🤖bot-commands",   type: ChannelType.GuildText, topic: "Bot commands" },
                    { name: "🔊General VC",     type: ChannelType.GuildVoice },
                ]
            }
        ],
        emojiNames: []
    },

    anime: {
        label: "🌸 Anime Server",
        description: "A fully themed anime community server",
        roles: [
            { name: "👑 Hokage",        color: "#FF4500", hoist: true,  permissions: [PermissionFlagsBits.Administrator] },
            { name: "⚔️ Kage",          color: "#FF6347", hoist: true,  permissions: [PermissionFlagsBits.Administrator] },
            { name: "🛡️ Jonin",         color: "#FF8C00", hoist: true,  permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers] },
            { name: "🌀 Chunin",         color: "#FFA500", hoist: true,  permissions: [PermissionFlagsBits.ManageMessages] },
            { name: "🌸 Waifu Lover",    color: "#FF69B4", hoist: true,  permissions: [] },
            { name: "🔥 Senpai",         color: "#FF1493", hoist: true,  permissions: [] },
            { name: "✨ Kohai",          color: "#DA70D6", hoist: true,  permissions: [] },
            { name: "🌙 Otaku",          color: "#9370DB", hoist: true,  permissions: [] },
            { name: "📖 Genin",          color: "#7B68EE", hoist: false, permissions: [] },
            { name: "🔇 Silenced",       color: "#808080", hoist: false, permissions: [] },
        ],
        categories: [
            {
                name: "🌸 ｢ INFORMATION ｣",
                channels: [
                    { name: "📜server-rules",        type: ChannelType.GuildText, topic: "Please read the rules before entering the dojo!" },
                    { name: "📢announcements",        type: ChannelType.GuildText, topic: "Important server announcements" },
                    { name: "🔖self-roles",           type: ChannelType.GuildText, topic: "Pick your anime allegiance role here" },
                    { name: "🎌server-info",          type: ChannelType.GuildText, topic: "Everything you need to know about this server" },
                ]
            },
            {
                name: "⛩️ ｢ GENERAL ｣",
                channels: [
                    { name: "💬general-chat",         type: ChannelType.GuildText,  topic: "Talk about anything!" },
                    { name: "🌸introductions",        type: ChannelType.GuildText,  topic: "Introduce yourself, new Genin!" },
                    { name: "😂anime-memes",           type: ChannelType.GuildText,  topic: "Dank anime memes only" },
                    { name: "📷fan-art",              type: ChannelType.GuildText,  topic: "Share your anime fan art" },
                    { name: "🤖bot-commands",         type: ChannelType.GuildText,  topic: "Use bot commands here" },
                    { name: "🔊Weeb Lounge",          type: ChannelType.GuildVoice },
                    { name: "🎵Lo-fi Study",          type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🎌 ｢ ANIME TALK ｣",
                channels: [
                    { name: "📺anime-discussion",     type: ChannelType.GuildText,  topic: "Discuss your favourite anime" },
                    { name: "📖manga-discussion",     type: ChannelType.GuildText,  topic: "Talk about manga and light novels" },
                    { name: "🌟anime-recommendations",type: ChannelType.GuildText,  topic: "Recommend anime to fellow otakus" },
                    { name: "🔥currently-watching",  type: ChannelType.GuildText,  topic: "What are you watching this season?" },
                    { name: "🎭character-rankings",   type: ChannelType.GuildText,  topic: "Rank your favourite characters" },
                    { name: "💔unpopular-opinions",   type: ChannelType.GuildText,  topic: "Controversial anime takes" },
                    { name: "⚠️spoilers",             type: ChannelType.GuildText,  topic: "SPOILERS — Enter at your own risk!" },
                ]
            },
            {
                name: "🎮 ｢ FANDOM ZONES ｣",
                channels: [
                    { name: "🍥naruto-zone",          type: ChannelType.GuildText,  topic: "Believe it! Naruto fans unite" },
                    { name: "⚔️attack-on-titan",      type: ChannelType.GuildText,  topic: "Survey Corps reporting in" },
                    { name: "🌊demon-slayer",         type: ChannelType.GuildText,  topic: "Total Concentration Breathing!" },
                    { name: "💪my-hero-academia",     type: ChannelType.GuildText,  topic: "Plus Ultra! MHA discussion" },
                    { name: "☠️one-piece",             type: ChannelType.GuildText,  topic: "I'm gonna be King of the Pirates!" },
                    { name: "🐉dragon-ball",          type: ChannelType.GuildText,  topic: "Over 9000! Dragon Ball fans" },
                    { name: "🃏other-anime",          type: ChannelType.GuildText,  topic: "Everything else!" },
                ]
            },
            {
                name: "🎪 ｢ EVENTS & FUN ｣",
                channels: [
                    { name: "🎉giveaways",            type: ChannelType.GuildText,  topic: "Anime merch giveaways!" },
                    { name: "📊polls",                type: ChannelType.GuildText,  topic: "Vote on anime polls" },
                    { name: "🎌anime-of-the-week",   type: ChannelType.GuildText,  topic: "Weekly anime spotlight" },
                    { name: "🏆waifu-wars",           type: ChannelType.GuildText,  topic: "Who is best girl?" },
                    { name: "💡suggestions",          type: ChannelType.GuildText,  topic: "Suggest new server features" },
                    { name: "🎙Dub vs Sub Debate",   type: ChannelType.GuildVoice },
                    { name: "📺Watch Party",          type: ChannelType.GuildVoice },
                ]
            },
            {
                name: "🔧 ｢ STAFF DOJO ｣",
                channels: [
                    { name: "🔧staff-chat",           type: ChannelType.GuildText,  topic: "Staff only — Jonin and above" },
                    { name: "📋mod-log",              type: ChannelType.GuildText,  topic: "Moderation action log" },
                    { name: "📥member-reports",       type: ChannelType.GuildText,  topic: "User submitted reports" },
                    { name: "🎙Staff Dojo VC",        type: ChannelType.GuildVoice },
                ]
            }
        ],
        emojiNames: []
    }
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function makeProgressBar(done, total, width = 10) {
    const filled = Math.round((done / total) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}

function buildStatusEmbed(client, guild, author, phase, done, total, log, templateKey) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const bar = makeProgressBar(done, total);
    const template = TEMPLATES[templateKey];

    const lines = [
        `### ${client.emoji.load} Building \`${guild.name}\` — **${template?.label ?? templateKey}**`,
        `-# Requested by ${author.username}`,
        ``,
        `**Phase:** ${phase}`,
        `**Progress:** \`${bar}\` ${pct}% (${done}/${total})`,
        ``,
        `**Log:**`,
        ...log.slice(-8).map(l => `> ${l}`)
    ];

    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
}

function buildDoneEmbed(client, guild, author, stats, templateKey) {
    const template = TEMPLATES[templateKey];
    const lines = [
        `### ${client.emoji.check} Server Build Complete!`,
        `-# Requested by ${author.username}`,
        ``,
        `**Template:** ${template?.label ?? templateKey}`,
        ``,
        `**Created:**`,
        `> ${client.emoji.hastag} **Roles:** ${stats.roles}`,
        `> ${client.emoji.hastag} **Categories:** ${stats.categories}`,
        `> ${client.emoji.hastag} **Channels:** ${stats.channels}`,
        stats.emojis > 0 ? `> ${client.emoji.hastag} **Emojis:** ${stats.emojis}` : null,
        stats.errors > 0 ? `\n> ⚠️ **Errors:** ${stats.errors} (some items may have been skipped)` : null,
    ].filter(Boolean);

    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
}

// ──────────────────────────────────────────────
// Core builder
// ──────────────────────────────────────────────
async function runBuild(guild, templateKey, loadingMsg, client, author) {
    const template = TEMPLATES[templateKey];
    const log = [];
    const stats = { roles: 0, categories: 0, channels: 0, emojis: 0, errors: 0 };

    const totalRoles = template.roles.length;
    const totalCategories = template.categories.length;
    const totalChannels = template.categories.reduce((acc, c) => acc + c.channels.length, 0);
    const total = totalRoles + totalCategories + totalChannels;
    let done = 0;

    const update = async (phase) => {
        await loadingMsg.edit({
            components: [buildStatusEmbed(client, guild, author, phase, done, total, log, templateKey)],
            flags: MessageFlags.IsComponentsV2
        }).catch(() => {});
    };

    // ── 1. Roles ──────────────────────────────
    await update("Creating Roles…");
    for (const roleData of template.roles) {
        try {
            await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                permissions: roleData.permissions ?? [],
                reason: `Server Build — template: ${templateKey}`
            });
            stats.roles++;
            log.push(`✅ Role created: **${roleData.name}**`);
        } catch (err) {
            stats.errors++;
            log.push(`❌ Role failed: **${roleData.name}** — ${err.message}`);
        }
        done++;
        await update("Creating Roles…");
    }

    // ── 2. Categories & Channels ──────────────
    await update("Creating Channels…");
    for (const cat of template.categories) {
        let category;
        try {
            category = await guild.channels.create({
                name: cat.name,
                type: ChannelType.GuildCategory,
                reason: `Server Build — template: ${templateKey}`
            });
            stats.categories++;
            log.push(`✅ Category: **${cat.name}**`);
        } catch (err) {
            stats.errors++;
            log.push(`❌ Category failed: **${cat.name}** — ${err.message}`);
            done += cat.channels.length + 1;
            await update("Creating Channels…");
            continue;
        }
        done++;
        await update("Creating Channels…");

        for (const ch of cat.channels) {
            try {
                await guild.channels.create({
                    name: ch.name,
                    type: ch.type,
                    parent: category.id,
                    topic: ch.topic ?? undefined,
                    reason: `Server Build — template: ${templateKey}`
                });
                stats.channels++;
                log.push(`✅ Channel: **${ch.name}**`);
            } catch (err) {
                stats.errors++;
                log.push(`❌ Channel failed: **${ch.name}** — ${err.message}`);
            }
            done++;
            await update("Creating Channels…");
        }
    }

    // ── 3. Emojis (if any URLs provided) ─────
    if (template.emojiNames?.length > 0) {
        await update("Creating Emojis…");
        for (const e of template.emojiNames) {
            try {
                await guild.emojis.create({ attachment: e.url, name: e.name, reason: `Server Build — template: ${templateKey}` });
                stats.emojis++;
                log.push(`✅ Emoji: **${e.name}**`);
            } catch (err) {
                stats.errors++;
                log.push(`❌ Emoji failed: **${e.name}** — ${err.message}`);
            }
        }
    }

    // ── Done ──────────────────────────────────
    await loadingMsg.edit({
        components: [buildDoneEmbed(client, guild, author, stats, templateKey)],
        flags: MessageFlags.IsComponentsV2
    }).catch(() => {});
}

// ──────────────────────────────────────────────
// Command export
// ──────────────────────────────────────────────
module.exports = {
    name: "serverbuild",
    category: "Utility",
    description: "Build your server with channels, roles, and emojis from a template",
    aliases: ["build", "setup", "serversetup"],
    args: false,
    usage: "serverbuild [template]",
    permission: ["ADMINISTRATOR"],
    userPerms: [PermissionFlagsBits.Administrator],
    botPerms: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageEmojisAndStickers
    ],

    slashOptions: [
        {
            name: "template",
            description: "Which template to use",
            type: 3,  // STRING
            required: false,
            choices: Object.entries(TEMPLATES).map(([value, t]) => ({ name: t.label, value }))
        }
    ],

    async slashExecute(interaction, client) {
        const templateArg = interaction.options.getString("template");
        return module.exports.run(interaction, client, true, templateArg);
    },

    async execute(message, args, client) {
        const templateArg = args[0]?.toLowerCase() ?? null;
        return module.exports.run(message, client, false, templateArg);
    },

    async run(context, client, isSlash, templateArg) {
        const guild = context.guild;
        const author = isSlash ? context.user : context.author;

        // Permission check
        const member = isSlash ? context.member : context.member;
        if (!member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            const errContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.cross} **You need the \`Administrator\` permission to use this command.**`)
            );
            const opts = { components: [errContainer], flags: MessageFlags.IsComponentsV2 };
            return isSlash ? context.reply({ ...opts, ephemeral: true }) : context.reply(opts);
        }

        if (isSlash && !context.deferred) await context.deferReply();

        // ── If a direct template was passed, start immediately ──
        if (templateArg && TEMPLATES[templateArg]) {
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`build_confirm_${templateArg}`).setLabel("✅ Confirm & Build").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("build_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Secondary)
            );

            const t = TEMPLATES[templateArg];
            const totalChannels = t.categories.reduce((a, c) => a + c.channels.length, 0);
            const confirmContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${client.emoji.warn} Confirm Server Build\n` +
                    `-# Template: **${t.label}**\n\n` +
                    `This will create:\n` +
                    `> • **${t.roles.length}** roles\n` +
                    `> • **${t.categories.length}** categories\n` +
                    `> • **${totalChannels}** channels\n\n` +
                    `**This action cannot be undone!** Are you sure?`
                )
            );

            const msg = isSlash
                ? await context.editReply({ components: [confirmContainer, confirmRow], flags: MessageFlags.IsComponentsV2 })
                : await context.reply({ components: [confirmContainer, confirmRow], flags: MessageFlags.IsComponentsV2 });

            const collector = msg.createMessageComponentCollector({
                filter: i => i.user.id === author.id,
                time: 30_000,
                componentType: ComponentType.Button,
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "build_cancel") {
                    await i.update({
                        components: [new ContainerBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} **Build cancelled.**`)
                        )],
                        flags: MessageFlags.IsComponentsV2
                    });
                    return;
                }

                const tKey = i.customId.replace("build_confirm_", "");
                const loadingContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${client.emoji.load} **Starting server build…**`)
                );
                await i.update({ components: [loadingContainer], flags: MessageFlags.IsComponentsV2 });
                await runBuild(guild, tKey, msg, client, author);
            });

            collector.on("end", collected => {
                if (collected.size === 0) {
                    msg.edit({
                        components: [new ContainerBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} **Build timed out — no response.**`)
                        )],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            });

            return;
        }

        // ── Show template picker ──────────────────────────────────────────────
        const select = new StringSelectMenuBuilder()
            .setCustomId("template_select")
            .setPlaceholder("Choose a server template…")
            .addOptions(
                Object.entries(TEMPLATES).map(([value, t]) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(t.label)
                        .setDescription(t.description)
                        .setValue(value)
                )
            );

        const selectRow = new ActionRowBuilder().addComponents(select);

        const templateLines = Object.entries(TEMPLATES).map(([k, t]) => {
            const ch = t.categories.reduce((a, c) => a + c.channels.length, 0);
            return `> **${t.label}** — ${t.roles.length} roles • ${t.categories.length} categories • ${ch} channels`;
        });

        const pickerContainer = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `### ${client.emoji.hastag} Server Build — Template Picker\n` +
                `-# Requested by ${author.username}\n\n` +
                `Choose a template below to automatically populate your server with channels, roles, and more.\n\n` +
                `**Available Templates:**\n` +
                templateLines.join("\n")
            ))
            .addSeparatorComponents(new SeparatorBuilder());

        const msg = isSlash
            ? await context.editReply({ components: [pickerContainer, selectRow], flags: MessageFlags.IsComponentsV2 })
            : await context.reply({ components: [pickerContainer, selectRow], flags: MessageFlags.IsComponentsV2 });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === author.id,
            time: 60_000
        });

        let selectedKey = null;

        collector.on("collect", async i => {
            // ── Template selected ──
            if (i.customId === "template_select") {
                selectedKey = i.values[0];
                const t = TEMPLATES[selectedKey];
                const totalChannels = t.categories.reduce((a, c) => a + c.channels.length, 0);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("build_confirm").setLabel("✅ Confirm & Build").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("build_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("build_back").setLabel("◀ Back").setStyle(ButtonStyle.Primary)
                );

                await i.update({
                    components: [
                        new ContainerBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `### ${client.emoji.warn} Confirm Server Build\n` +
                                `-# Template: **${t.label}**\n\n` +
                                `This will create:\n` +
                                `> • **${t.roles.length}** roles\n` +
                                `> • **${t.categories.length}** categories\n` +
                                `> • **${totalChannels}** channels\n\n` +
                                `**This action cannot be undone!** Are you sure?`
                            )
                        ),
                        confirmRow
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ── Cancel ──
            if (i.customId === "build_cancel") {
                collector.stop("cancelled");
                await i.update({
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.cross} **Build cancelled.**`)
                    )],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ── Go back to picker ──
            if (i.customId === "build_back") {
                selectedKey = null;
                await i.update({
                    components: [pickerContainer, selectRow],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ── Confirm ──
            if (i.customId === "build_confirm") {
                collector.stop("confirmed");
                const loadingContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${client.emoji.load} **Starting server build…**`)
                );
                await i.update({ components: [loadingContainer], flags: MessageFlags.IsComponentsV2 });
                await runBuild(guild, selectedKey, msg, client, author);
            }
        });

        collector.on("end", (_, reason) => {
            if (reason === "time") {
                msg.edit({
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.cross} **Timed out — no template was selected.**`)
                    )],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
    }
};

