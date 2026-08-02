const { prefix } = require("../../config.js");
const { ActivityType, REST, Routes, PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "clientReady",
  run: async (client) => {
    client.logger.log(`${client.user.username} is now online.`, "ready");

    const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
    const rebootData = client.db.reboot.getAll()[0];
    if (rebootData) {
      client.db.reboot.delete(rebootData.id);
      const channel = client.channels.cache.get(rebootData.channelId);
      if (channel) {
        try {
          const msg = await channel.messages.fetch(rebootData.messageId);
          if (msg) {
            const restartedContainer = new ContainerBuilder()
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.check} Bot has been successfully restarted.**`))

            await msg.edit({
              components: [restartedContainer],
              flags: MessageFlags.IsComponentsV2
            });
          }
        } catch (e) { }
      }
    }



    client.logger.log(
      `Ready on ${client.guilds.cache.size} servers, for a total of ${client.users.cache.size} users`,
      "ready",
    );

    for (const guild of client.guilds.cache.values()) {
    }

    if (client.slashCommands.size > 0) {
      const rest = new REST({ version: "10" }).setToken(client.token);
      try {
        const commands = Array.from(client.slashCommands.values()).map((cmd) => {
          const commandData = {
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
          };

          if (cmd.owner) {
            commandData.default_member_permissions = "8";
            commandData.dm_permission = false;
          } else if (cmd.userPerms && cmd.userPerms.length > 0) {
            const { PermissionsBitField } = require("discord.js");
            try {
              commandData.default_member_permissions = PermissionsBitField.resolve(cmd.userPerms).toString();
            } catch (e) {
              console.error(`Error resolving perms for ${cmd.name}:`, e);
            }
          }

          return commandData;
        });

        let deployCommands = commands;
        if (deployCommands.length > 100) {
          console.warn(`WARNING: Exceeded Discord's 100 global slash command limit. Only deploying the first 100.`);
          deployCommands = deployCommands.slice(0, 100);
        }

        client.logger.log(`Deploying ${deployCommands.length} slash commands...`, "cmd");

        await rest.put(Routes.applicationCommands(client.user.id), {
          body: deployCommands,
        });

        client.logger.log(`Successfully deployed ${deployCommands.length} slash commands.`, "cmd");
      } catch (error) {
        console.error("Error deploying slash commands:", error);
      }
    } else {
      console.log("\n⚠️ WARNING: No slash commands to deploy! client.slashCommands.size = 0\n");
    }



  },
};
