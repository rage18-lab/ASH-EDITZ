const { QueryType, useMainPlayer } = require('discord-player');
const { 
    ApplicationCommandOptionType, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SectionBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    SeparatorBuilder, 
    MessageFlags 
} = require('discord.js');

module.exports = {
    name: 'play',
    description: 'Play a song from YouTube or Spotify',
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description: 'Song name, YouTube link, or Spotify link',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute({ inter, client }) {
        const player = useMainPlayer();
        const song = inter.options.getString('song').trim();
        const isURL = /^https?:\/\//i.test(song);
        const isSpotify = /open\.spotify\.com/i.test(song);
        const isYouTube = /youtu(be\.com|\.be)/i.test(song);

        // ── Resolve track ────────────────────────────────────────────────────
        let track = null;
        let playlist = null;

        try {
            if (isYouTube || isSpotify || isURL) {
                // Direct URL — search with AUTO so the right extractor handles it
                const res = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (res?.tracks?.length) {
                    track = res.tracks[0];
                    playlist = res.playlist;

                    // Bridge only the first track to guarantee immediate playback info
                    if (!playlist && (track.source === 'spotify' || track.source === 'apple_music')) {
                        track = await bridgeToYouTube(player, track, inter.member);
                    }
                }
            } else {
                // Text search — search YouTube directly via our custom extractor
                const ytRes = await player.search(song, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                const ytDirect = await player.search(`ytsearch:${song}`, {
                    requestedBy: inter.member,
                    searchEngine: QueryType.AUTO,
                });

                if (ytDirect?.tracks?.length) {
                    track = ytDirect.tracks[0];
                    playlist = ytDirect.playlist;
                } else if (ytRes?.tracks?.length) {
                    track = ytRes.tracks[0];
                    playlist = ytRes.playlist;
                    if (!playlist && (track.source === 'spotify' || track.source === 'apple_music')) {
                        track = await bridgeToYouTube(player, track, inter.member);
                    }
                }
            }
        } catch (e) {
            console.error('[Play] Search error:', e.message);
        }

        if (!track) {
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**❌ We couldn't find any results for "${song}".**\nPlease try another search term or paste a direct YouTube/Spotify link.`);
            const container = new ContainerBuilder().addTextDisplayComponents(errorDisplay);
            
            return inter.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        console.log(`[Play] "${song}" → [${track.source}] ${track.title} by ${track.author} (Playlist: ${!!playlist})`);

        // ── Queue & play ─────────────────────────────────────────────────────
        try {
            const { QueueRepeatMode } = require('discord-player');
            let queue = player.nodes.get(inter.guild.id);
            const autoplayEnabled = client.autoplayStates?.get(inter.guild.id) ?? false;

            if (!queue) {
                queue = player.nodes.create(inter.guild, {
                    metadata: {
                        channel:       inter.channel,
                        autoplay:      autoplayEnabled,
                        lastTrack:     null,
                        playedHistory: []
                    },
                    leaveOnEmpty:         client.config.opt.leaveOnEmpty,
                    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                    leaveOnEnd:           client.config.opt.leaveOnEnd,
                    leaveOnEndCooldown:   client.config.opt.leaveOnEndCooldown,
                    selfDeaf:             true,
                    volume:               client.config.opt.volume,
                    connectionTimeout:    30_000,
                });
                if (autoplayEnabled) queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
            }

            if (!queue.connection) {
                await queue.connect(inter.member.voice.channel);
            }

            const wasPlaying = queue.isPlaying();
            queue.addTrack(playlist ? playlist : track);
            
            if (!wasPlaying) await queue.node.play();

            const srcIcon = track.source === 'spotify'     ? '🟢 Spotify'
                          : track.source === 'apple_music' ? '🍎 Apple Music'
                          : track.source === 'youtube'     ? '🔴 YouTube'
                          : '🎵 Auto';
            
            const position = queue.tracks.size;

            const titleDisplay = new TextDisplayBuilder()
                .setContent(`### ✅ ${playlist ? 'Playlist Added' : 'Track Added'}`);

            const truncateTitle = (title, maxLength = 30) => {
                if (!title) return 'Unknown Title';
                if (title.length <= maxLength) return title;
                return title.substring(0, maxLength) + '...';
            };

            const infoDisplay = new TextDisplayBuilder()
                .setContent(
                    `[**${truncateTitle(playlist ? playlist.title : track.title, 35)}**](${playlist ? playlist.url : track.url}) by \` ${track.author} \`\n` +
                    (playlist ? `-# Tracks \` ${playlist.tracks.length} \` • By \` ${inter.user.username} \`` : `-# Position \` #${position} \` • Duration \` ${track.duration} \` • By \` ${inter.user.username} \``)
                );
            
            const section = new SectionBuilder()
                .addTextDisplayComponents(titleDisplay, infoDisplay);

            if (track.thumbnail) {
                section.setThumbnailAccessory((thumbnail) => thumbnail.setURL(track.thumbnail));
            }

            const container = new ContainerBuilder()
                .addSectionComponents(section);

            if (position > 0 && !playlist) {
                const removeButton = new ButtonBuilder()
                    .setCustomId(`remove_${track.id}_${position}`)
                    .setLabel('Remove')
                    .setStyle(ButtonStyle.Danger);

                const playNextButton = new ButtonBuilder()
                    .setCustomId(`playnext_${track.id}_${position}`)
                    .setLabel('Play Next')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(position === 1);

                const buttonRow = new ActionRowBuilder()
                    .addComponents(removeButton, playNextButton);

                container.addSeparatorComponents(new SeparatorBuilder());
                container.addActionRowComponents(buttonRow);
            }

            const replyMsg = await inter.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            if (position > 0 && !playlist && replyMsg) {
                const collector = replyMsg.createMessageComponentCollector({
                    filter: (i) => i.user.id === inter.user.id,
                    time: 300000
                });

                collector.on('collect', async (buttonInteraction) => {
                    if (!buttonInteraction.member.voice.channel || buttonInteraction.member.voice.channel.id !== queue.channel.id) {
                        return buttonInteraction.reply({ content: `**❌ You must be in my voice channel to use this.**`, ephemeral: true });
                    }

                    const parts = buttonInteraction.customId.split('_');
                    const action = parts[0];
                    const trackId = parts[1];

                    if (action === 'remove') {
                        try {
                            const trackToRemove = queue.tracks.toArray().find(t => t.id === trackId);
                            if (trackToRemove) {
                                queue.removeTrack(trackToRemove);
                                
                                const updatedDisplay = new TextDisplayBuilder()
                                    .setContent(`**✅ Removed [${truncateTitle(trackToRemove.title, 25)}](${trackToRemove.url}) from queue.**`);
                                const updatedContainer = new ContainerBuilder().addTextDisplayComponents(updatedDisplay);
                                
                                await buttonInteraction.deferUpdate().catch(() => {});
                                await buttonInteraction.message.edit({
                                    components: [updatedContainer],
                                    flags: MessageFlags.IsComponentsV2
                                }).catch(() => {});
                                buttonInteraction.message.actionTaken = true;
                            } else {
                                await buttonInteraction.reply({ content: `**❌ This track is no longer in the queue.**`, ephemeral: true });
                            }
                        } catch (err) {
                            console.error('Error removing track:', err);
                        }
                    } else if (action === 'playnext') {
                        try {
                            const trackToMoveIndex = queue.tracks.toArray().findIndex(t => t.id === trackId);
                            if (trackToMoveIndex !== -1) {
                                const trackToMove = queue.tracks.toArray()[trackToMoveIndex];
                                queue.node.move(trackToMove, 0);
                                
                                const updatedDisplay = new TextDisplayBuilder()
                                    .setContent(`**✅ Moved [${truncateTitle(trackToMove.title, 25)}](${trackToMove.url}) to next in queue.**`);
                                const updatedContainer = new ContainerBuilder().addTextDisplayComponents(updatedDisplay);
                                
                                await buttonInteraction.deferUpdate().catch(() => {});
                                await buttonInteraction.message.edit({
                                    components: [updatedContainer],
                                    flags: MessageFlags.IsComponentsV2
                                }).catch(() => {});
                                buttonInteraction.message.actionTaken = true;
                            } else {
                                await buttonInteraction.reply({ content: `**❌ This track is no longer in the queue.**`, ephemeral: true });
                            }
                        } catch (err) {
                            console.error('Error moving track:', err);
                        }
                    }
                });

                collector.on('end', () => {
                    if (replyMsg && !replyMsg.deleted && !replyMsg.actionTaken) {
                        const finalContainer = new ContainerBuilder().addSectionComponents(section);
                        replyMsg.edit({
                            components: [finalContainer],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => {});
                    }
                });
            }

            return;

        } catch (error) {
            console.error('[Play Error]', error);
            const errorDisplay = new TextDisplayBuilder()
                .setContent(`**❌ Playback failed — please try again**\n\`${error.message.substring(0, 200)}\``);
            const container = new ContainerBuilder().addTextDisplayComponents(errorDisplay);
            
            return inter.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};

/**
 * Bridge a Spotify/AppleMusic metadata track to a real YouTube stream.
 * Uses ytsearch: prefix to always hit our CustomYouTubeExtractor.
 */
async function bridgeToYouTube(player, track, member) {
    try {
        const query = `${track.title} ${track.author}`;
        const res = await player.search(`ytsearch:${query}`, {
            requestedBy: member,
            searchEngine: QueryType.AUTO,
        });
        if (res?.tracks?.length) {
            console.log(`[Play] Bridged "${track.title}" from ${track.source} → YouTube`);
            return res.tracks[0];
        }
    } catch (e) {
        console.warn('[Play] Bridge to YouTube failed:', e.message);
    }
    return track; // Fall back to original if bridge fails
}
