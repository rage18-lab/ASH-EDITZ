const { EmbedBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');
const os = require('os');

module.exports = {
    name: 'status',
    description: 'Show the bot\'s system status, resource usage, and player info',

    async execute({ client, inter }) {
        const player = useMainPlayer();

        // ── System info ──────────────────────────────────────────────────────
        const memUsed = process.memoryUsage();
        const heapUsedMB = (memUsed.heapUsed / 1024 / 1024).toFixed(1);
        const heapTotalMB = (memUsed.heapTotal / 1024 / 1024).toFixed(1);
        const rssMB = (memUsed.rss / 1024 / 1024).toFixed(1);

        const cpuLoad = os.loadavg()[0].toFixed(2);
        const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);

        // ── Discord info ─────────────────────────────────────────────────────
        const wsLatency = Math.round(client.ws.ping);
        const guildCount = client.guilds.cache.size;
        const uptime = formatUptime(client.uptime);

        // ── Player info ──────────────────────────────────────────────────────
        const queues = player.nodes.cache;
        const activeQueues = queues.filter(q => q.isPlaying()).size;
        const totalQueues = queues.size;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `⚡  ${client.user.username} — System Status`,
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .addFields(
                {
                    name: '🤖  Bot',
                    value:
                        `> **Uptime:** \`${uptime}\`\n` +
                        `> **Servers:** \`${guildCount}\`\n` +
                        `> **Latency:** \`${wsLatency}ms\` ${wsLatency < 150 ? '🟢' : wsLatency < 300 ? '🟡' : '🔴'}`,
                    inline: true
                },
                {
                    name: '🎵  Player',
                    value:
                        `> **Active Queues:** \`${activeQueues}\`\n` +
                        `> **Total Queues:** \`${totalQueues}\`\n` +
                        `> **Node.js:** \`${process.version}\``,
                    inline: true
                },
                {
                    name: '💾  Memory',
                    value:
                        `> **Heap Used:** \`${heapUsedMB} MB / ${heapTotalMB} MB\`\n` +
                        `> **RSS:** \`${rssMB} MB\`\n` +
                        `> **System:** \`${freeMemGB}GB free / ${totalMemGB}GB\``,
                    inline: false
                }
            )
            .setColor('#5865F2')
            .setFooter({ text: `discord-player v${require('discord-player/package.json').version} • Hot Pursuit` })
            .setTimestamp();

        return inter.editReply({ embeds: [embed] });
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
