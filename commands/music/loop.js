const { QueueRepeatMode, useQueue } = require('discord-player');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'loop',
    description: 'Toggle song, queue, or autoplay loop mode',
    voiceChannel: true,
    options: [
        {
            name: 'action',
            description: 'Loop action to perform',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Disable Loop', value: 'disable_loop' },
                { name: 'Song Loop', value: 'enable_loop_song' },
                { name: 'Queue Loop', value: 'enable_loop_queue' },
                { name: 'Autoplay', value: 'enable_autoplay' },
            ],
        }
    ],

    async execute({ inter }) {
        const queue = useQueue(inter.guild);

        if (!queue?.isPlaying()) {
            const errEmbed = new EmbedBuilder()
                .setAuthor({ name: '❌ No music currently playing' })
                .setColor('#ED4245');
            return inter.editReply({ embeds: [errEmbed] });
        }

        const choice = inter.options.getString('action');
        const embed = new EmbedBuilder().setColor('#5865F2');

        switch (choice) {
            case 'disable_loop': {
                queue.setRepeatMode(QueueRepeatMode.OFF);
                embed.setAuthor({ name: '⏹  Loop Disabled' })
                     .setDescription('Queue will play normally without repeating.')
                     .setColor('#ED4245');
                break;
            }
            case 'enable_loop_song': {
                queue.setRepeatMode(QueueRepeatMode.TRACK);
                embed.setAuthor({ name: '🔂  Single Song Loop Enabled' })
                     .setDescription(`Now repeating **${queue.currentTrack.title}** endlessly.`)
                     .setColor('#57F287');
                break;
            }
            case 'enable_loop_queue': {
                queue.setRepeatMode(QueueRepeatMode.QUEUE);
                embed.setAuthor({ name: '🔁  Queue Loop Enabled' })
                     .setDescription('The entire queue will be repeated continuously.')
                     .setColor('#57F287');
                break;
            }
            case 'enable_autoplay': {
                queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
                embed.setAuthor({ name: '🔄  Autoplay Enabled' })
                     .setDescription('The queue will automatically be populated with related songs!')
                     .setColor('#57F287');
                break;
            }
        }

        return inter.editReply({ embeds: [embed] });
    }
};