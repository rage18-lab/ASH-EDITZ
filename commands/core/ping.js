const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Check the bot\'s latency and connection status',

    async execute({ client, inter }) {
        const wsLatency = Math.round(client.ws.ping);

        const getBar = (ms) => {
            if (ms < 100) return '🟢 Excellent';
            if (ms < 200) return '🟡 Good';
            if (ms < 400) return '🟠 Fair';
            return '🔴 Poor';
        };

        const embed = new EmbedBuilder()
            .setAuthor({
                name: '🛰️  Pong!',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                `> **WebSocket Latency:** \`${wsLatency}ms\` ${getBar(wsLatency)}\n` +
                `> **Uptime:** \`${formatUptime(client.uptime)}\``
            )
            .setColor(wsLatency < 200 ? '#57F287' : wsLatency < 400 ? '#FEE75C' : '#ED4245')
            .setFooter({ text: 'Hot Pursuit • Music Bot' })
            .setTimestamp();

        return inter.editReply({ content: null, embeds: [embed] });
    }
};

function formatUptime(ms) {
    if (!ms) return 'Unknown';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}