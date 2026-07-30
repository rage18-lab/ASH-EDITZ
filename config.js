module.exports = {
    app: {
        token: process.env.DISCORD_TOKEN || 'xxx',
        applicationId: process.env.APPLICATION_ID || 'xxx',
        ownerId: process.env.OWNER_ID || 'xxx',
        playing: '🎵 Music for ASH EDITZ | /play',
        global: true,
        guild: process.env.GUILD_ID || 'xxx',
        extraMessages: false,
        loopMessage: false,
        lang: 'en',
        enableEmojis: true,
    },

    emojis:{
        'back': '⏪',
        'skip': '⏩',
        'ResumePause': '⏯️',
        'savetrack': '💾',
        'volumeUp': '🔊',
        'volumeDown': '🔉',
        'loop': '🔁',
    },

    opt: {
        DJ: {
            enabled: false,
            roleName: '',
            commands: []
        },
        Translate_Timeout: 10000,
        maxVol: 100,
        spotifyBridge: true,
        volume: 75,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 30000,
        discordPlayer: {
            // Increase connection timeout so slow SoundCloud streams don't abort
            connectionTimeout: 30000,
            // ⚠️ Must be FALSE — IOS client returns MP4/AAC which needs FFmpeg → Opus for Discord
            skipFFmpeg: false,
            ytdlOptions: {
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                // Longer timeouts for slow connections
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }
            }
        }
    }
};

