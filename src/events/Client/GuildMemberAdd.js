const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "guildMemberAdd",
  run: async (client, member) => {
    if (!member || !member.guild) return;

    try {
      const autoRoleData = client.db.autorole.get(member.guild.id);
      if (autoRoleData && autoRoleData.roles.length > 0) {
        for (const roleId of autoRoleData.roles) {
          const role = member.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role).catch(() => { });
          }
        }
      }

    } catch (error) {
      console.error("Error in guildMemberAdd event:", error);
    }
  },
};

