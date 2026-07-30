const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    name: 'nowplaying',
    description: 'See what song is currently playing!',
    voiceChannel: true,

    async execute({ inter }) {
        const queue = useQueue(inter.guild);
        if (!queue?.isPlaying()) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: '❌  Nothing is playing right now' })
                .setColor('#ED4245');
            return inter.editReply({ embeds: [embed] });
        }

        const track    = queue.currentTrack;
        const progress = queue.node.createProgressBar();
        const methods  = ['❌ Off', '🔂 Track', '🔁 Queue'];
        const loopMode = methods[queue.repeatMode] || '❌ Off';
        const autoplay = queue.metadata?.autoplay ? '✅ On' : '❌ Off';
        const queueSize = queue.tracks.size;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: '🎵  Now Playing',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setTitle(track.title.length > 256 ? track.title.substring(0, 253) + '...' : track.title)
            .setURL(track.url)
            .setThumbnail(track.thumbnail)
            .setDescription(
                `${progress}\n\n` +
                `> 👤  **Artist:** ${track.author}\n` +
                `> ⏱  **Duration:** \`${track.duration}\`\n` +
                `> 🔊  **Volume:** \`${queue.node.volume}%\`\n` +
                `> 🔁  **Loop:** ${loopMode}  •  🔄 **Autoplay:** ${autoplay}\n` +
                `> 📋  **Queue:** ${queueSize} track${queueSize !== 1 ? 's' : ''} remaining\n` +
                `> 🎤  **Requested by:** ${track.requestedBy ?? 'Autoplay'}`
            )
            .setColor('#5865F2')
            .setFooter({
                text: 'Music comes first — Made with ❤️ by the Community',
                iconURL: inter.member.displayAvatarURL()
            })
            .setTimestamp();

        const emojis     = client.config?.emojis;
        const EmojiState = client.config.app.enableEmojis && emojis;

        const saveBtn = new ButtonBuilder()
            .setLabel(EmojiState ? emojis.savetrack : '💾  Save Track')
            .setCustomId('savetrack')
            .setStyle(ButtonStyle.Success);

        const volDown = new ButtonBuilder()
            .setLabel(EmojiState ? emojis.volumeDown : '🔉  Vol -')
            .setCustomId('volumedown')
            .setStyle(ButtonStyle.Secondary);

        const pauseResume = new ButtonBuilder()
            .setLabel(EmojiState ? emojis.ResumePause : '⏯  Pause/Resume')
            .setCustomId('resume&pause')
            .setStyle(ButtonStyle.Primary);

        const volUp = new ButtonBuilder()
            .setLabel(EmojiState ? emojis.volumeUp : '🔊  Vol +')
            .setCustomId('volumeup')
            .setStyle(ButtonStyle.Secondary);

        const loopBtn = new ButtonBuilder()
            .setLabel(EmojiState ? emojis.loop : '🔁  Loop')
            .setCustomId('loop')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(volDown, pauseResume, volUp, loopBtn, saveBtn);

        return inter.editReply({ embeds: [embed], components: [row] });
    }
};
