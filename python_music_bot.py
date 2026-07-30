import asyncio
import os
import discord
from discord.ext import commands
import yt_dlp

# Use the DISCORD_TOKEN environment variable, not a hardcoded token.
TOKEN = os.environ.get('DISCORD_TOKEN')
if not TOKEN:
    raise RuntimeError('DISCORD_TOKEN environment variable is not set')

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

ytdl_format_options = {
    'format': 'bestaudio/best',
    'outtmpl': '%(extractor)s-%(id)s-%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0',
}

ffmpeg_options = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn',
}

ytdl = yt_dlp.YoutubeDL(ytdl_format_options)

guild_queues = {}


class YTDLSource(discord.PCMVolumeTransformer):
    def __init__(self, source, *, data, volume=0.5):
        super().__init__(source, volume)
        self.data = data
        self.title = data.get('title')
        self.webpage_url = data.get('webpage_url')

    @classmethod
    async def from_url(cls, url, *, loop=None, stream=True):
        loop = loop or asyncio.get_event_loop()
        data = await loop.run_in_executor(None, lambda: ytdl.extract_info(url, download=not stream))

        if 'entries' in data:
            data = data['entries'][0]

        filename = data['url'] if stream else ytdl.prepare_filename(data)
        return cls(discord.FFmpegPCMAudio(filename, **ffmpeg_options), data=data)


async def ensure_voice(ctx):
    if ctx.author.voice is None or ctx.author.voice.channel is None:
        await ctx.reply('You need to join a voice channel first.', ephemeral=True)
        return None

    voice_channel = ctx.author.voice.channel
    voice_client = ctx.guild.voice_client

    if voice_client is None:
        voice_client = await voice_channel.connect()
    elif voice_client.channel.id != voice_channel.id:
        await voice_client.move_to(voice_channel)

    return voice_client


async def play_next(guild_id, ctx):
    queue = guild_queues.get(guild_id, [])
    if not queue:
        return

    next_url = queue.pop(0)
    source = await YTDLSource.from_url(next_url, loop=bot.loop, stream=True)
    voice_client = ctx.guild.voice_client

    if voice_client is None:
        return

    def after_play(error):
        if error:
            print(f'Error playing next track: {error}')
        bot.loop.create_task(play_next(guild_id, ctx))

    voice_client.play(source, after=after_play)


@bot.event
async def on_ready():
    print(f'Bot logged in as {bot.user} (ID: {bot.user.id})')
    print('Ready to play music!')


@bot.command(name='join')
async def join(ctx):
    voice_client = await ensure_voice(ctx)
    if voice_client:
        await ctx.reply(f'Joined {voice_client.channel.name}')


@bot.command(name='leave')
async def leave(ctx):
    voice_client = ctx.guild.voice_client
    if voice_client is None:
        await ctx.reply('I am not connected to a voice channel.')
        return

    await voice_client.disconnect()
    guild_queues.pop(ctx.guild.id, None)
    await ctx.reply('Disconnected from voice and cleared the queue.')


@bot.command(name='play')
async def play(ctx, *, query: str):
    voice_client = await ensure_voice(ctx)
    if voice_client is None:
        return

    queue = guild_queues.setdefault(ctx.guild.id, [])
    queue.append(query)

    if voice_client.is_playing() or voice_client.is_paused():
        await ctx.reply(f'Added to queue: **{query}**')
        return

    await ctx.reply(f'Loading: **{query}**')
    await play_next(ctx.guild.id, ctx)


@bot.command(name='pause')
async def pause(ctx):
    voice_client = ctx.guild.voice_client
    if voice_client is None or not voice_client.is_playing():
        await ctx.reply('Nothing is playing right now.')
        return

    voice_client.pause()
    await ctx.reply('Playback paused.')


@bot.command(name='resume')
async def resume(ctx):
    voice_client = ctx.guild.voice_client
    if voice_client is None or not voice_client.is_paused():
        await ctx.reply('Nothing is paused currently.')
        return

    voice_client.resume()
    await ctx.reply('Playback resumed.')


@bot.command(name='skip')
async def skip(ctx):
    voice_client = ctx.guild.voice_client
    if voice_client is None or not voice_client.is_playing():
        await ctx.reply('Nothing is playing to skip.')
        return

    voice_client.stop()
    await ctx.reply('Skipped current track.')


@bot.command(name='stop')
async def stop(ctx):
    voice_client = ctx.guild.voice_client
    if voice_client is None or not voice_client.is_playing():
        await ctx.reply('Nothing is playing right now.')
        return

    voice_client.stop()
    guild_queues.pop(ctx.guild.id, None)
    await ctx.reply('Stopped playback and cleared the queue.')


@bot.command(name='queue')
async def queue_list(ctx):
    queue = guild_queues.get(ctx.guild.id, [])
    if not queue:
        await ctx.reply('The queue is currently empty.')
        return

    text = '\n'.join(f'{index + 1}. {item}' for index, item in enumerate(queue))
    await ctx.reply(f'Current queue:\n{text}')


if __name__ == '__main__':
    bot.run(TOKEN)
