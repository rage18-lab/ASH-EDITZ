const { EmbedBuilder } = require('discord.js');

module.exports = (queue) => {
    if (queue.metadata.lyricsThread) {
        queue.metadata.lyricsThread.delete();
        queue.setMetadata({
            channel: queue.metadata.channel
        });
    }

    const guildId = queue.guild?.id;
    const is247   = global.client?.tfStates?.get(guildId) === true;
    const vcId    = global.client?.tfStates?.get(`${guildId}_vc`);

    // ── 24/7 mode: auto-rejoin the last voice channel ───────────────────────
    if (is247 && vcId) {
        setTimeout(async () => {
            try {
                const guild = global.client.guilds.cache.get(guildId);
                const vc    = guild?.channels.cache.get(vcId);
                if (!vc) return;

                const { joinVoiceChannel } = require('@discordjs/voice');
                joinVoiceChannel({
                    channelId: vc.id,
                    guildId:   guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeaf: true,
                });

                const rejoinEmbed = new EmbedBuilder()
                    .setAuthor({
                        name: '🌐  24/7 — Rejoined',
                        iconURL: global.client.user.displayAvatarURL({ size: 64 })
                    })
                    .setDescription(
                        `> 🔄  Rejoined **${vc.name}** automatically!\n` +
                        '> 🌐  24/7 mode is still active.\n' +
                        '> ▶️  Use `/play` to start music again.'
                    )
                    .setColor('#00F5FF')
                    .setFooter({ text: '⚡ 24/7 Active  •  Hot Pursuit' })
                    .setTimestamp();

                queue.metadata?.channel?.send({ embeds: [rejoinEmbed] }).catch(() => {});
            } catch (e) {
                console.error('[24/7 Rejoin Error]', e.message);
            }
        }, 3000); // Wait 3s before rejoining
        return;
    }

    // ── Normal disconnect message ────────────────────────────────────────────
    (async () => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: '⚡  Disconnected',
                iconURL: global.client?.user?.displayAvatarURL({ size: 64 })
            })
            .setDescription(
                '> 🔌  Disconnected from the voice channel.\n' +
                '> 🗑️  Queue has been cleared.'
            )
            .setColor('#FF2056')
            .setFooter({ text: 'Hot Pursuit  •  Music Bot' })
            .setTimestamp();

        queue.metadata.channel.send({ embeds: [embed] });
    })()
}

