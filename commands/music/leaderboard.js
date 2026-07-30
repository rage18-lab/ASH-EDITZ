const { EmbedBuilder } = require('discord.js');
const { getTopListeners } = require('../../utils/leaderboardStats');

const NEON_PINK   = '#FF2D78';
const NEON_CYAN   = '#00F5FF';
const DARK_BG     = '#0D0D1A';

module.exports = {
    name: 'leaderboard',
    description: 'Shows the top listeners who played the most music',
    voiceChannel: false,

    async execute({ inter, client }) {
        const topUsers = getTopListeners(10);

        if (!topUsers || topUsers.length === 0) {
            return inter.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(NEON_PINK)
                        .setDescription('◈ No one has played any music yet. Be the first!')
                ]
            });
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: '◈  M U S I C   L E A D E R B O A R D' })
            .setColor(NEON_CYAN)
            .setThumbnail(client.user.displayAvatarURL({ size: 128 }));

        let description = '┌─────────────────────────────────\n';

        topUsers.forEach((user, index) => {
            // Format time
            const totalMinutes = Math.floor(user.playtimeMs / 60000);
            let timeStr = '';
            if (totalMinutes >= 60) {
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                timeStr = `${hrs}h ${mins}m`;
            } else {
                timeStr = `${totalMinutes}m`;
            }

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            const username = user.username.length > 15 ? user.username.substring(0, 15) + '...' : user.username;
            
            description += `│ ${medal} **${username}**  —  ${timeStr}  *( ${user.songsPlayed} songs )*\n`;
        });

        description += '└─────────────────────────────────';
        embed.setDescription(description);

        return inter.editReply({ embeds: [embed] });
    },
};
