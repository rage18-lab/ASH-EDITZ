const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const { useMainPlayer } = require('discord-player');
const { fetchLyrics, paginateLyrics } = require('../utils/lyrics');

/**
 * Lyrics button handler — triggered from the Now Playing message buttons.
 * Supports paginated lyrics with Prev / Next controls.
 */
module.exports = async ({ inter, queue, client }) => {
    const player = useMainPlayer();

    if (!queue?.isPlaying()) {
        return inter.editReply({
            embeds: [new EmbedBuilder()
                .setAuthor({ name: '❌  No music currently playing' })
                .setColor('#ED4245')]
        });
    }

    const currentTrack = queue.currentTrack;
    const lyricsResult = await fetchLyrics(currentTrack.title, currentTrack.author, player);

    if (!lyricsResult?.lyrics) {
        return inter.editReply({
            embeds: [new EmbedBuilder()
                .setAuthor({ name: '❌  No lyrics found' })
                .setDescription(
                    `Could not find lyrics for **${currentTrack.title}** by **${currentTrack.author}**.\n\n` +
                    `*Try again later or search with a cleaner song title.*`
                )
                .setColor('#ED4245')]
        });
    }

    const pages   = paginateLyrics(lyricsResult.lyrics);
    const total   = pages.length;
    let   current = 0;

    function buildEmbed(pageIdx) {
        const pageLabel = total > 1 ? ` (${pageIdx + 1} / ${total})` : '';
        return new EmbedBuilder()
            .setAuthor({
                name: `🎤  Lyrics — ${lyricsResult.artist}${pageLabel}`,
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setTitle(
                lyricsResult.title.length > 256
                    ? lyricsResult.title.substring(0, 253) + '...'
                    : lyricsResult.title
            )
            .setURL(currentTrack.url)
            .setThumbnail(currentTrack.thumbnail || null)
            .setDescription(pages[pageIdx])
            .setColor('#5865F2')
            .setFooter({
                text: `Requested by ${inter.member.displayName} • Source: ${lyricsResult.source}`,
                iconURL: inter.member.displayAvatarURL()
            })
            .setTimestamp();
    }

    // Single page — no buttons needed
    if (total === 1) {
        return inter.editReply({ embeds: [buildEmbed(0)] });
    }

    function buildRow(pageIdx) {
        const prev = new ButtonBuilder()
            .setCustomId('lyrics_btn_prev')
            .setLabel('◀  Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIdx === 0);

        const pageInfo = new ButtonBuilder()
            .setCustomId('lyrics_btn_page')
            .setLabel(`${pageIdx + 1} / ${total}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);

        const next = new ButtonBuilder()
            .setCustomId('lyrics_btn_next')
            .setLabel('Next  ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIdx === total - 1);

        return new ActionRowBuilder().addComponents(prev, pageInfo, next);
    }

    const reply = await inter.editReply({
        embeds: [buildEmbed(current)],
        components: [buildRow(current)]
    });

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: i =>
            (i.customId === 'lyrics_btn_prev' || i.customId === 'lyrics_btn_next') &&
            i.user.id === inter.user.id
    });

    collector.on('collect', async (btnInter) => {
        if (btnInter.customId === 'lyrics_btn_prev') current = Math.max(0, current - 1);
        if (btnInter.customId === 'lyrics_btn_next') current = Math.min(total - 1, current + 1);

        await btnInter.update({
            embeds: [buildEmbed(current)],
            components: [buildRow(current)]
        });
    });

    collector.on('end', async () => {
        await inter.editReply({ components: [] }).catch(() => {});
    });
};