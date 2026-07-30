const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

// ── Neon/Cyberpunk color palette ─────────────────────────────────────────────
const NEON_PINK    = '#FF2D78';   // hot pink accent
const NEON_CYAN    = '#00F5FF';   // cyan highlight
const NEON_PURPLE  = '#BF5FFF';   // purple
const DARK_BG      = '#0D0D1A';   // near-black

const { addPlaytime } = require('../../utils/leaderboardStats');

module.exports = (queue, track) => {
    if (!client.config.app.loopMessage && queue.repeatMode !== 0) return;

    // Track playtime for leaderboard (only if requested by a user, not autoplay)
    if (track.requestedBy && track.durationMS) {
        addPlaytime(track.requestedBy.id, track.requestedBy.username, track.durationMS);
    }

    (async () => {
        const queueSize  = queue.tracks.size;
        const loopModes  = ['Off', '🔂 Track', '🔁 Queue'];
        const loopStatus = loopModes[queue.repeatMode] || 'Off';
        const autoplayOn = queue.metadata?.autoplay ?? false;

        // ── Progress bar (visual flair — static since Discord has no timers) ──
        const progressBar = '▰▰▰▰▰▱▱▱▱▱';

        const embed = new EmbedBuilder()
            .setAuthor({
                name: '◈  N O W   P L A Y I N G',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setTitle(track.title.length > 256 ? track.title.substring(0, 253) + '...' : track.title)
            .setURL(track.url)
            .setThumbnail(track.thumbnail || null)
            .setDescription(
                `\`\`\`\n${progressBar}  ${track.duration}\n\`\`\`` +
                `┌─────────────────────────────────\n` +
                `│  🎤  **${track.author}**\n` +
                `│  🔊  ${queue.channel?.name ?? 'Unknown'}\n` +
                `│  🔁  ${loopStatus}   •   🔄  Autoplay: ${autoplayOn ? '**ON**' : 'Off'}\n` +
                `│  📋  ${queueSize > 0 ? `**${queueSize}** track${queueSize !== 1 ? 's' : ''} up next` : 'Queue is empty'}\n` +
                `└─────────────────────────────────`
            )
            .setColor(NEON_PINK)
            .setFooter({
                text: `⚡ Requested by ${track.requestedBy?.username ?? 'Autoplay'}  •  Hot Pursuit`,
                iconURL: track.requestedBy?.displayAvatarURL({ size: 32 }) ?? client.user.displayAvatarURL()
            })
            .setTimestamp();

        // ── Row 1: Core Playback ─────────────────────────────────────────────
        const backBtn = new ButtonBuilder()
            .setLabel('⏮')
            .setCustomId('back')
            .setStyle(ButtonStyle.Secondary);

        const pauseResumeBtn = new ButtonBuilder()
            .setLabel('⏯  Pause / Resume')
            .setCustomId('resume&pause')
            .setStyle(ButtonStyle.Primary);

        const skipBtn = new ButtonBuilder()
            .setLabel('⏭')
            .setCustomId('skip')
            .setStyle(ButtonStyle.Secondary);

        const stopBtn = new ButtonBuilder()
            .setLabel('⏹  Stop')
            .setCustomId('stop')
            .setStyle(ButtonStyle.Danger);

        // ── Row 2: Features ──────────────────────────────────────────────────
        const loopBtn = new ButtonBuilder()
            .setLabel('🔁  Loop')
            .setCustomId('loop')
            .setStyle(ButtonStyle.Secondary);

        const lyricsBtn = new ButtonBuilder()
            .setLabel('🎤  Lyrics')
            .setCustomId('lyrics')
            .setStyle(ButtonStyle.Success);

        const queueBtn = new ButtonBuilder()
            .setLabel('📋  Queue')
            .setCustomId('queue')
            .setStyle(ButtonStyle.Secondary);

        const saveBtn = new ButtonBuilder()
            .setLabel('💾  Save')
            .setCustomId('savetrack')
            .setStyle(ButtonStyle.Success);

        const row1 = new ActionRowBuilder().addComponents(backBtn, pauseResumeBtn, skipBtn, stopBtn);
        const row2 = new ActionRowBuilder().addComponents(loopBtn, lyricsBtn, queueBtn, saveBtn);

        queue.metadata.channel.send({ embeds: [embed], components: [row1, row2] }).catch(() => {});
    })();
};
