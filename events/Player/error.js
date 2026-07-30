const { EmbedBuilder } = require('discord.js');
const { Translate } = require('../../process_tools');

module.exports = (queue, error) => {
    (async () => {
        if (error) {
            const msg = error.message || String(error);
            if (msg.includes('IP discovery') || msg.includes('aborted') || msg.includes('AbortError')) {
                console.warn('Ignored harmless internal player error:', msg);
                return;
            }
        }

        console.error('Error emitted from the Bot:', error);

        if (queue?.metadata?.channel) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: await Translate(`Music player error: <${error?.message || error}>`) })
                .setColor('#EE4B2B');

            queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
        }
    })()
}