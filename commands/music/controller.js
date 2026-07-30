const { ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'controller',
    description: 'Send music controller interface to a channel',
    voiceChannel: false,
    permissions: PermissionsBitField.Flags.ManageMessages,
    options: [
        {
            name: 'channel',
            description: 'The text channel you want to send it to',
            type: ApplicationCommandOptionType.Channel,
            required: true,
        }
    ],

    async execute({ inter, client }) {
        const channel = inter.options.getChannel('channel');
        if (channel.type !== ChannelType.GuildText) {
            return inter.editReply({ content: await Translate('You need to select a text channel! <❌>') });
        }

        const embed = new EmbedBuilder()
            .setAuthor({
                name: '🎛️  Music Controller Dashboard',
                iconURL: client.user.displayAvatarURL({ size: 64 })
            })
            .setTitle('Control music playback directly using the buttons below!')
            .setDescription(
                '> **Row 1:** `⏮ Back` • `⏯ Pause/Resume` • `⏭ Skip` • `⏹ Stop` • `💾 Save`\n' +
                '> **Row 2:** `🔉 Vol -` • `🔊 Vol +` • `🔀 Shuffle` • `🔁 Loop`\n' +
                '> **Row 3:** `🎤 Lyrics` • `📋 Queue` • `🎵 Now Playing`'
            )
            .setColor('#5865F2')
            .setFooter({ text: 'Music comes first — Made with ❤️ by the Community', iconURL: inter.guild.iconURL() })
            .setTimestamp();

        await inter.editReply({ content: `✅ Music controller sent to ${channel}` });

        const back = new ButtonBuilder().setLabel('⏮  Back').setCustomId('back').setStyle(ButtonStyle.Secondary);
        const resumepause = new ButtonBuilder().setLabel('⏯  Pause / Resume').setCustomId('resume&pause').setStyle(ButtonStyle.Primary);
        const skip = new ButtonBuilder().setLabel('⏭  Skip').setCustomId('skip').setStyle(ButtonStyle.Secondary);
        const stop = new ButtonBuilder().setLabel('⏹  Stop').setCustomId('stop').setStyle(ButtonStyle.Danger);
        const save = new ButtonBuilder().setLabel('💾  Save').setCustomId('savetrack').setStyle(ButtonStyle.Success);

        const volumedown = new ButtonBuilder().setLabel('🔉  Vol -').setCustomId('volumedown').setStyle(ButtonStyle.Secondary);
        const volumeup = new ButtonBuilder().setLabel('🔊  Vol +').setCustomId('volumeup').setStyle(ButtonStyle.Secondary);
        const shuffle = new ButtonBuilder().setLabel('🔀  Shuffle').setCustomId('shuffle').setStyle(ButtonStyle.Success);
        const loop = new ButtonBuilder().setLabel('🔁  Loop').setCustomId('loop').setStyle(ButtonStyle.Secondary);

        const lyrics = new ButtonBuilder().setLabel('🎤  Lyrics').setCustomId('lyrics').setStyle(ButtonStyle.Success);
        const queuebutton = new ButtonBuilder().setLabel('📋  Queue').setCustomId('queue').setStyle(ButtonStyle.Secondary);
        const np = new ButtonBuilder().setLabel('🎵  Now Playing').setCustomId('nowplaying').setStyle(ButtonStyle.Primary);

        const row1 = new ActionRowBuilder().addComponents(back, resumepause, skip, stop, save);
        const row2 = new ActionRowBuilder().addComponents(volumedown, volumeup, shuffle, loop);
        const row3 = new ActionRowBuilder().addComponents(lyrics, queuebutton, np);

        channel.send({ embeds: [embed], components: [row1, row2, row3] }).catch(() => {});
    }
};
