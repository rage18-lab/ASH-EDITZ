const { readdirSync } = require("fs");
const { Collection } = require("discord.js");
const { useMainPlayer } = require("discord-player");
client.commands = new Collection();
const commandsArray = [];
const player = useMainPlayer();

const { Translate, GetTranslationModule } = require("./process_tools");

const discordEvents = readdirSync("./events/Discord/").filter((file) =>
  file.endsWith(".js")
);
const playerEvents = readdirSync("./events/Player/").filter((file) =>
  file.endsWith(".js")
);

GetTranslationModule().then(() => {
  console.log("| Translation Module Loaded |");

  for (const file of discordEvents) {
    const DiscordEvent = require(`./events/Discord/${file}`);
    const txtEvent = `< -> > [Loaded Discord Event] <${file.split(".")[0]}>`;
    parseLog(txtEvent);
    client.on(file.split(".")[0], DiscordEvent.bind(null, client));
    delete require.cache[require.resolve(`./events/Discord/${file}`)];
  }

  for (const file of playerEvents) {
    const PlayerEvent = require(`./events/Player/${file}`);
    const txtEvent = `< -> > [Loaded Player Event] <${file.split(".")[0]}>`;
    parseLog(txtEvent);
    player.events.on(file.split(".")[0], PlayerEvent.bind(null));
    delete require.cache[require.resolve(`./events/Player/${file}`)];
  }

  readdirSync("./commands/").forEach((dirs) => {
    const commands = readdirSync(`./commands/${dirs}`).filter((files) =>
      files.endsWith(".js")
    );

    for (const file of commands) {
      const command = require(`./commands/${dirs}/${file}`);
      if (command.name && command.description) {
        commandsArray.push(command);
        const txtEvent = `< -> > [Loaded Command] <${command.name.toLowerCase()}>`;
        parseLog(txtEvent);
        client.commands.set(command.name.toLowerCase(), command);
        delete require.cache[require.resolve(`./commands/${dirs}/${file}`)];
      } else {
        const txtEvent = `< -> > [Failed Command] <${command.name.toLowerCase()}>`;
        parseLog(txtEvent);}
    }
  });

  client.once("clientReady", async () => {
    try {
      if (client.config.app.global) {
        await client.application.commands.set(commandsArray);
        console.log('✅ Global commands registered');
      } else if (client.config.app.guild && client.config.app.guild !== 'xxx' && client.config.app.guild !== 'YOUR_GUILD_ID_HERE') {
        const guild = client.guilds.cache.get(client.config.app.guild) || await client.guilds.fetch(client.config.app.guild).catch(() => null);
        if (guild) {
          await guild.commands.set(commandsArray);
          console.log(`✅ Guild commands registered for ${guild.name} (${guild.id})`);
        } else {
          console.warn('Guild ID not found or inaccessible. Ensure the bot is in the guild and GUILD_ID is correct.');
        }
      } else {
        console.warn('Guild command registration skipped because app.global is false and GUILD_ID is not configured correctly.');
      }
    } catch (e) {
      console.error('Failed to register commands:', e);
    }
  });

  async function parseLog(txtEvent) {
    console.log(await Translate(txtEvent, null));
  }
});
