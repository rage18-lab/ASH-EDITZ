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
    try {
      const own = await guild.fetchOwner().catch(() => null);

      // ── Who added the bot (from audit logs) ─────────────────────────────
      let inviter = "Unknown (Missing Permissions)";
      let inviterTag = "Unknown";
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 }).catch(() => null);
        if (auditLogs) {
          const logEntry = auditLogs.entries.find(a => a.target?.id === client.user.id);
          if (logEntry) {
            inviter = `\`${logEntry.executor.username}\` (${logEntry.executor.id})`;
            inviterTag = `${logEntry.executor.username} (${logEntry.executor.id})`;
          } else {
            inviter = "Unknown";
            inviterTag = "Unknown";
          }
        }
      } catch (e) {}

      // ── Generate server invite ───────────────────────────────────────────
      let inviteLink = "`No vanity URL`";
      let inviteLinkUrl = null;
      if (guild.vanityURLCode) {
        inviteLink = `[**Invite Link**](https://discord.gg/${guild.vanityURLCode})`;
        inviteLinkUrl = `https://discord.gg/${guild.vanityURLCode}`;
      } else {
        try {
          const channel = guild.channels.cache.find(
            c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has("CreateInstantInvite")
          );
          if (channel) {
            const invite = await channel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
            if (invite) {
              inviteLink = `[**Invite Link**](${invite.url})`;
              inviteLinkUrl = invite.url;
            }
          }
        } catch (e) {}
      }

      // ── Webhook log (only if URL is set) ────────────────────────────────
      if (guild_join) {
        try {
          const web = new WebhookClient({ url: guild_join });
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
          web.send({ embeds: [embed] }).catch(() => {});
        } catch (e) {}
      }

      // ── Rich DM notification to bot owner(s) ────────────────────────────
      if (config.ownerID && Array.isArray(config.ownerID)) {
        for (const id of config.ownerID) {
          try {
            const dev = await client.users.fetch(id).catch(() => null);
            if (!dev) {
              console.log(`[GuildCreate] Could not fetch owner user ${id}`);
              continue;
            }

            const headerDisplay = new TextDisplayBuilder()
              .setContent(`### 🎉 Bot Added to a New Server!`);

            const sep1 = new SeparatorBuilder();

            const serverInfo = new TextDisplayBuilder()
              .setContent(
                `**🏠 Server Name:** \`${guild.name}\`\n` +
                `**🆔 Server ID:** \`${guild.id}\`\n` +
                `**👑 Server Owner:** \`${own?.user?.username || "Unknown"}\` — \`${own?.user?.id || "N/A"}\`\n` +
                `**➕ Added By:** \`${inviterTag}\`\n` +
                `**👥 Members:** \`${guild.memberCount.toLocaleString()}\`\n` +
                `**📅 Server Created:** \`${moment.utc(guild.createdAt).format("DD MMM YYYY")}\`\n` +
                `**🌐 Server Invite:** ${inviteLinkUrl ? `[Click Here](${inviteLinkUrl})` : "`No invite available`"}\n` +
                `**📊 Total Servers Now:** \`${client.guilds.cache.size}\``
              );

            const sep2 = new SeparatorBuilder();

            const footerDisplay = new TextDisplayBuilder()
              .setContent(`-# ${moment.utc().format("DD MMM YYYY [at] HH:mm")} UTC`);

            const container = new ContainerBuilder()
              .addTextDisplayComponents(headerDisplay)
              .addSeparatorComponents(sep1)
              .addTextDisplayComponents(serverInfo)
              .addSeparatorComponents(sep2)
              .addTextDisplayComponents(footerDisplay);

            if (inviteLinkUrl) {
              const inviteBtn = new ButtonBuilder()
                .setLabel("Join Server")
                .setStyle(ButtonStyle.Link)
                .setURL(inviteLinkUrl);
              const row = new ActionRowBuilder().addComponents(inviteBtn);
              container.addActionRowComponents(row);
            }

            await dev.send({
              components: [container],
              flags: MessageFlags.IsComponentsV2
            }).catch((err) => {
              console.log(`[GuildCreate] Could not DM owner ${id}: ${err.message}`);
            });

            console.log(`[GuildCreate] DM sent to owner ${id} — bot joined: ${guild.name}`);
          } catch (e) {
            console.error(`[GuildCreate] Error sending DM to owner ${id}:`, e);
          }
        }
      }

      // ── Welcome DM to server owner ───────────────────────────────────────
      try {
        if (own && own.user) {
          const recipient = own.user;

          const welcomeHeader = new TextDisplayBuilder()
            .setContent(`### ${client.emoji.check} Thank you for choosing ${client.user.username}!`);

          const separator1 = new SeparatorBuilder();

          const infoDisplay = new TextDisplayBuilder()
            .setContent(
              `${client.user.username} has been successfully added to \`${guild.name}\`\n\n` +
              `You can report any issues at my **[Support Server](${support})** following the needed steps.`
            );

          const separator2 = new SeparatorBuilder();

          const supportButton = new ButtonBuilder()
            .setLabel("Support Server")
            .setStyle(ButtonStyle.Link)
            .setURL(support);

          const buttonRow = new ActionRowBuilder().addComponents(supportButton);

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
            console.log(`[GuildCreate] Could not send welcome DM to ${recipient.username}: ${err.message}`);
          });
        }
      } catch (error) {
        console.error("[GuildCreate] Error sending welcome DM:", error);
      }

    } catch (err) {
      console.error("[GuildCreate] Fatal error:", err);
    }
  },
};
