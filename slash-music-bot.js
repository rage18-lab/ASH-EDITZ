require('dotenv').config();
const { 
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { Player, QueryType } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
  },
});
player.extractors.register(YoutubeiExtractor, {});

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or URL (YouTube/Spotify)')
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song').toJSON(),
  new SlashCommandBuilder().setName('queue').setDescription('Show current queue').toJSON(),
  new SlashCommandBuilder().setName('stop').setDescription('Stop music and disconnect').toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Slash commands registered successfully!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'You must be in a voice channel first!', ephemeral: true });
  }

  const { commandName } = interaction;

  if (commandName === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      let queue = player.nodes.get(interaction.guildId);
      if (!queue) {
        queue = player.nodes.create(interaction.guild, {
          metadata: {
            channel: interaction.channel,
          },
          leaveOnEnd: false,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 30000,
        });
      }

      if (!queue.connection) {
        console.log(`Connecting to voice channel ${voiceChannel.id}`);
        await queue.connect(voiceChannel);
      }

      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      });

      if (!searchResult || !searchResult.tracks.length) {
        return interaction.editReply({ content: `Could not find or play: **${query}**`, ephemeral: true });
      }

      queue.addTrack(searchResult.tracks[0]);

      if (!queue.isPlaying()) {
        await queue.node.play();
      }

      return interaction.editReply({ content: `🎶 Added **${searchResult.tracks[0].title}** to the queue!` });
    } catch (e) {
      console.error('Play command error:', e);
      return interaction.editReply({ content: `Could not find or play: **${query}**` });
    }
  }

  const queue = player.nodes.get(interaction.guildId);
  if (!queue || !queue.isPlaying()) {
    return interaction.reply({ content: 'There is no music playing right now!', ephemeral: true });
  }

  if (commandName === 'skip') {
    queue.node.skip();
    return interaction.reply('⏭️ Skipped current track!');
  }

  if (commandName === 'stop') {
    queue.delete();
    return interaction.reply('⏹️ Stopped music and cleared the queue.');
  }

  if (commandName === 'queue') {
    const currentTrack = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n');

    return interaction.reply(
      `**Currently Playing:** ${currentTrack?.title || 'None'}\n\n**Next Up:**\n${tracks || 'No more songs queued.'}`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
