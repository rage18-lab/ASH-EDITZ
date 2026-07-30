require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder 
} = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  getVoiceConnection,
  StreamType,
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN in environment variables.');
}
if (!clientId) {
  throw new Error('Missing CLIENT_ID in environment variables.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = createAudioPlayer();

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays audio from a YouTube URL')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The YouTube video URL')
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pauses the currently playing audio')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resumes paused audio')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops audio and leaves the voice channel')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

async function registerCommands() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const guild = interaction.guild;
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;

  if (!guild) {
    return interaction.reply({ content: 'This command must be used inside a server.', ephemeral: true });
  }

  if (commandName === 'play') {
    if (!voiceChannel) {
      return interaction.reply({ content: 'You must be in a voice channel to use this command!', ephemeral: true });
    }

    const url = interaction.options.getString('url');
    if (!ytdl.validateURL(url)) {
      return interaction.reply({ content: 'Please provide a valid YouTube URL!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      });

      const stream = ytdl(url, {
        filter: 'audioonly',
        highWaterMark: 1 << 25,
        quality: 'highestaudio',
      });

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });

      player.play(resource);
      connection.subscribe(player);

      const info = await ytdl.getBasicInfo(url);
      const title = info.videoDetails.title;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎶 Now Playing')
        .setDescription(`[${title}](${url})`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: 'There was an error trying to play that song.' });
    }
  }

  if (commandName === 'pause') {
    if (player.state.status === AudioPlayerStatus.Playing) {
      player.pause();
      return interaction.reply('⏸️ Playback paused.');
    }
    return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
  }

  if (commandName === 'resume') {
    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      return interaction.reply('▶️ Playback resumed.');
    }
    return interaction.reply({ content: 'Audio is not paused.', ephemeral: true });
  }

  if (commandName === 'stop') {
    const connection = getVoiceConnection(guild.id);
    if (connection) {
      player.stop();
      connection.destroy();
      return interaction.reply('⏹️ Stopped playback and left the voice channel.');
    }
    return interaction.reply({ content: 'I am not connected to a voice channel.', ephemeral: true });
  }
});

client.login(token);
