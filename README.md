# 🎵 ASH EDITZ — Discord Music Bot

A fully functional, feature-rich Discord music bot built with [discord.js](https://discord.js.org/) and [discord-player](https://discord-player.js.org/).

## ✨ Features

- 🎧 Play music from **YouTube**, **Spotify**, **SoundCloud** and more
- 📋 Full queue management (add, remove, skip, jump, shuffle)
- 🔁 Loop modes (track, queue, off)
- 🎚️ Volume control
- 🎤 Lyrics & Synced Lyrics support
- ⏩ Skip, Back, Pause/Resume controls
- 💾 Save tracks via DM
- 🔍 Search music interactively
- 🏓 Ping & Help commands
- 🎛️ Interactive music controller with buttons

## 🚀 Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Git](https://git-scm.com/)
- A Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

```bash
# Clone the repo
git clone https://github.com/rage18-lab/ASH-EDITZ.git
cd ASH-EDITZ

# Install dependencies
npm install

# Copy env example and fill in your values
cp .env.example .env
```

### Configure `.env`

```env
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here
OWNER_ID=your_discord_user_id_here
GUILD_ID=   # optional — leave blank for global commands
```

### Run the bot

```bash
npm start
```

## 🎮 Commands

| Command | Description |
|---|---|
| `/play` | Play a song or playlist |
| `/pause` | Pause the current track |
| `/resume` | Resume playback |
| `/skip` | Skip to the next track |
| `/back` | Go back to the previous track |
| `/stop` | Stop music and clear queue |
| `/queue` | View the current queue |
| `/nowplaying` | Show current track info |
| `/loop` | Toggle loop mode |
| `/volume` | Set the volume |
| `/shuffle` | Shuffle the queue |
| `/seek` | Seek to a position in the track |
| `/remove` | Remove a track from queue |
| `/jump` | Jump to a specific track |
| `/skipto` | Skip to a specific position |
| `/search` | Search and pick a track |
| `/lyrics` | Get lyrics for the current song |
| `/syncedlyrics` | Get synced lyrics |
| `/history` | View track history |
| `/save` | Save current track to DM |
| `/clear` | Clear the queue |
| `/controller` | Open music controller |
| `/filter` | Apply audio filters |
| `/playnext` | Add a track to play next |
| `/help` | Show all commands |
| `/ping` | Check bot latency |

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
