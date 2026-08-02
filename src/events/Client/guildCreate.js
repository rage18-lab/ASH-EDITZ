const {
  WebhookClient,
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  AuditLogEvent
} = require("discord.js");
const config = require("../../config.js");
const {
  Webhooks: { guild_join },
  links: { support }
} = config;

const moment = require("moment");

module.exports = {
  name: "guildCreate",
  run: async (client, guild) => {
    const web = new WebhookClient({ url: guild_join });
    const own = await guild.fetchOwner().catch(() => null);

    let inviter = "Unknown (Missing Permissions)";
    try {
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
      if (auditLogs) {
        const logEntry = auditLogs.entries.find(a => a.target.id === client.user.id);
        if (logEntry) inviter = `\`${logEntry.executor.username}\` (${logEntry.executor.id})`;
        else inviter = "Unknown";
      }
    } catch (e) {}

    let inviteLink = `\`No vanity URL\``;
    if (guild.vanityURLCode) {
      inviteLink = `[**Invite Link**](https://discord.gg/${guild.vanityURLCode})`;
    } else {
      try {
        const channel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('CreateInstantInvite'));
        if (channel) {
          const invite = await channel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
          if (invite) inviteLink = `[**Invite Link**](${invite.url})`;
        }
      } catch (e) {}
    }

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setThumbnail(guild.iconURL({ size: 1024 }))
      .setDescription(
        `**${client.emoji.check} Joined a Guild**\n\n` +
        `**${client.emoji.dot} Server Name:** \`${guild.name}\` \n` +
        `**${client.emoji.dot} Server ID:** \`${guild.id}\` \n` +
        `**${client.emoji.dot} Server Owner:** \`${own?.user?.username || "Unknown"}\` (${own?.id || "N/A"}) \n` +
        `**${client.emoji.dot} Added By:** ${inviter} \n` +
        `**${client.emoji.dot} Member Count:** \`${guild.memberCount}\` Members \n` +
        `**${client.emoji.dot} Creation Date:** \`${moment.utc(guild.createdAt).format("DD/MMM/YYYY")}\` \n` +
        `**${client.emoji.dot} Guild Invite:** ${inviteLink} \n` +
        `**${client.emoji.dot} Total Servers:** \`${client.guilds.cache.size}\``
      )
      .setFooter({
        text: `Total Server Count [ ${client.guilds.cache.size} ]`,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    web.send({ embeds: [embed] }).catch(() => { });

    // Send notification to bot developers via DM
    if (config.ownerID && Array.isArray(config.ownerID)) {
      for (const id of config.ownerID) {
        try {
          client.users.fetch(id).then(dev => {
            if (dev) dev.send({ embeds: [embed] }).catch(() => {});
          }).catch(() => {});
        } catch (e) {}
      }
    }

    try {
      if (own && own.user) {
        const recipient = own.user;

        const welcomeHeader = new TextDisplayBuilder()
          .setContent(`### ${client.emoji.check} Thank you for choosing ${client.user.username}!`);

        const separator1 = new SeparatorBuilder();

        const infoDisplay = new TextDisplayBuilder()
          .setContent(
            `${client.user.username} has been successfully added to \`${guild.name}\`\n\n` +
            `You can report any issues at my **[Support Server](${support})** following the needed steps. You can also reach out to my **[Developers](${support})** if you want to know more about me.`
          );

        const separator2 = new SeparatorBuilder();

        const supportButton = new ButtonBuilder()
          .setLabel('Support Server')
          .setStyle(ButtonStyle.Link)
          .setURL(support);

        const buttonRow = new ActionRowBuilder()
          .addComponents(supportButton);

        const container = new ContainerBuilder()
          .addTextDisplayComponents(welcomeHeader)
          .addSeparatorComponents(separator1)
          .addTextDisplayComponents(infoDisplay)
          .addSeparatorComponents(separator2)
          .addActionRowComponents(buttonRow);

        await recipient.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        }).catch((err) => {
          console.log(`Could not send welcome DM to ${recipient.username}: ${err.message}`);
        });
      }
    } catch (error) {
      console.error('Error sending welcome DM:', error);
    }
  },
};
