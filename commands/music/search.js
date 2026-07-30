const {
    ApplicationCommandOptionType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ComponentType
} = require('discord.js');
const { QueryType, useMainPlayer } = require('discord-player');
const { formatPopularityBadge, rankSearchResults } = require('../../utils/popularity');

module.exports = {
    name: 'search',
    description: 'Search top popular tracks on Spotify & YouTube',
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description: 'Song name or query to search for',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ client, inter }) {
        const player = useMainPlayer();
        const song   = inter.options.getString('song');

        let rawTracks = [];

        // ── 1. YouTube search ────────────────────────────────────────────────
        if (!/^https?:\/\//i.test(song)) {
            try {
                const ytRes = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO
                });
                if (ytRes?.tracks?.length) rawTracks.push(...ytRes.tracks);
            } catch (_) {}
        }

        // ── 2. Spotify (good metadata + popularity) ──────────────────────────
        try {
            const spRes = await player.search(song, {
                requestedBy: inter.member,
                searchEngine: QueryType.SPOTIFY_SEARCH
            });
            if (spRes?.tracks?.length) rawTracks.push(...spRes.tracks);
        } catch (_) {}

        // ── 3. YouTube optional fallback ─────────────────────────────────────
        if (!rawTracks.length) {
            try {
                const ytRes = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.YOUTUBE_SEARCH
                });
                if (ytRes?.tracks?.length) rawTracks.push(...ytRes.tracks);
            } catch (_) {}
        }

        if (!rawTracks.length) {
            return inter.editReply({
                embeds: [new EmbedBuilder()
                    .setAuthor({ name: '❌  No search results found' })
                    .setColor('#ED4245')]
            });
        }

        // ── 3. Deduplicate → rank → top 10 ──────────────────────────────────
        const uniqueMap = new Map();
        for (const t of rawTracks) {
            if (!uniqueMap.has(t.url)) uniqueMap.set(t.url, t);
        }
        const ranked = rankSearchResults(Array.from(uniqueMap.values()), song).slice(0, 10);

        // ── 4. Build dropdown options ────────────────────────────────────────
        const options = ranked.map((track, i) => {
            const popBadge = formatPopularityBadge(track);
            const badge    = popBadge ? ` • ${popBadge}` : '';
            return {
                label:       `${i + 1}. ${track.title}`.substring(0, 100),
                description: `${track.author} • ${track.duration}${badge}`.substring(0, 100),
                value:       i.toString(),
                emoji:       i === 0 ? '🏆' : (i < 3 ? '🔥' : '🎵')
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_track')
            .setPlaceholder('🔥 Most Popular Songs — Choose a track...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // ── 5. Search result embed ───────────────────────────────────────────
        const medals = ['🥇', '🥈', '🥉'];
        const listLines = ranked.map((t, idx) => {
            const popBadge = formatPopularityBadge(t);
            const badge    = popBadge ? ` · **${popBadge}**` : '';
            const icon     = medals[idx] || `**${idx + 1}.**`;
            return `${icon} [${t.title}](${t.url}) — \`${t.duration}\`${badge}\n` +
                   `   ↳ by **${t.author}**`;
        });

        const searchEmbed = new EmbedBuilder()
            .setAuthor({
                name: `🔍 Popular Results for "${song}"`,
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                listLines.join('\n') +
                '\n\n*Select a song from the dropdown menu below to play.*'
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Ranked by Spotify popularity & relevance • Selection active for 45 seconds' })
            .setTimestamp();

        const responseMsg = await inter.editReply({ embeds: [searchEmbed], components: [row] });

        // ── 6. Handle selection ──────────────────────────────────────────────
        const collector = responseMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 45_000
        });

        collector.on('collect', async (selectInter) => {
            if (selectInter.user.id !== inter.user.id) {
                return selectInter.reply({
                    content: '❌ Only the person who searched can pick a track.',
                    flags: 64
                });
            }

            await selectInter.deferUpdate();
            collector.stop('selected');

            const chosenIdx     = parseInt(selectInter.values[0], 10);
            const selectedTrack = ranked[chosenIdx];

            try {
                let queue = player.nodes.get(inter.guild.id);
                const autoplayState = client.autoplayStates?.get(inter.guild.id) ?? false;

                if (!queue) {
                    queue = player.nodes.create(inter.guild, {
                        metadata: {
                            channel: inter.channel,
                            autoplay: autoplayState,
                            lastTrack: null,
                            playedHistory: []
                        },
                        leaveOnEmpty:         client.config.opt.leaveOnEmpty,
                        leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                        leaveOnEnd:           client.config.opt.leaveOnEnd,
                        leaveOnEndCooldown:   client.config.opt.leaveOnEndCooldown,
                        selfDeaf: true,
                        volume:   client.config.opt.volume,
                    });

                    if (autoplayState) {
                        const { QueueRepeatMode } = require('discord-player');
                        queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
                    }
                }

                if (!queue.connection) await queue.connect(inter.member.voice.channel);

                queue.addTrack(selectedTrack);
                if (!queue.isPlaying()) await queue.node.play();

                const popBadge = formatPopularityBadge(selectedTrack);
                const badgeTag = popBadge ? ` · 🔥 \`${popBadge}\`` : '';
                const queuePos = queue.tracks.size;

                const successEmbed = new EmbedBuilder()
                    .setAuthor({
                        name: '✅  Track Added to Queue',
                        iconURL: client.user.displayAvatarURL({ size: 64 })
                    })
                    .setTitle(selectedTrack.title.length > 256 ? selectedTrack.title.substring(0, 253) + '...' : selectedTrack.title)
                    .setURL(selectedTrack.url)
                    .setThumbnail(selectedTrack.thumbnail || null)
                    .setDescription(
                        `> 👤  **Artist:** ${selectedTrack.author}\n` +
                        `> ⏱  **Duration:** \`${selectedTrack.duration}\`${badgeTag}\n` +
                        (queuePos > 1 ? `> 📋  **Position in queue:** #${queuePos}` : `> 🎵  **Playing now!**`)
                    )
                    .setColor('#57F287')
                    .setFooter({
                        text: `Requested by ${inter.member.displayName}`,
                        iconURL: inter.member.displayAvatarURL()
                    })
                    .setTimestamp();

                await inter.editReply({ embeds: [successEmbed], components: [] });

            } catch (err) {
                console.error('[Search Select Error]', err);
                await inter.editReply({
                    content: '❌ Failed to play the selected track.',
                    embeds: [],
                    components: []
                });
            }
        });

        collector.on('end', async (_, reason) => {
            if (reason !== 'selected') {
                const timeoutEmbed = new EmbedBuilder()
                    .setAuthor({ name: '⏱  Search timed out — no song was selected' })
                    .setColor('#ED4245');
                await inter.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    }
};
