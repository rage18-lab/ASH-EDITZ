/**
 * CustomYouTubeExtractor.js
 * Uses youtubei.js with the IOS client to get direct stream URLs.
 * The IOS client bypasses YouTube's cipher/decipher requirement entirely,
 * returning plaintext audio URLs. FFmpeg (skipFFmpeg:false) decodes them to Opus.
 *
 * Cookies are loaded from yt_cookies.json for authenticated requests.
 */
const { BaseExtractor, Track } = require('discord-player');
const { Innertube }  = require('youtubei.js');
const fs   = require('fs');
const path = require('path');
const playdl = require('play-dl');
const ytDlp = require('youtube-dl-exec');

// Load cookies from yt_cookies.json if available
function loadCookie() {
    const cookiePath = path.join(__dirname, '..', 'yt_cookies.json');
    if (fs.existsSync(cookiePath)) {
        try {
            const { cookie } = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
            if (cookie) return cookie;
        } catch (e) {
            console.warn('[YT Extractor] Could not load cookies:', e.message);
        }
    }
    return undefined;
}

// Shared innertube instance (created once, reused)
let _innertube = null;
async function getInnertube() {
    if (_innertube) return _innertube;
    const cookie = loadCookie();
    _innertube = await Innertube.create({
        retrieve_player: false, // IOS client does not need player script
        cookie,
    });
    console.log('[YT Extractor] Innertube instance created (IOS client, no cipher needed)');
    return _innertube;
}

class CustomYouTubeExtractor extends BaseExtractor {
    static identifier = 'com.custom.youtube';

    // Higher priority than SoundCloud (1) so YouTube queries go here first
    get priority() { return 3; }

    async activate() {
        try {
            await getInnertube();
            console.log('[YT Extractor] Ready — using IOS client for cipher-free streaming');
        } catch (e) {
            console.warn('[YT Extractor] Innertube warm-up failed:', e.message);
        }
    }

    async validate(query, type) {
        if (typeof type === 'object' && type !== null) {
            type = type.type; // Extract type from context
        }
        return (
            type === 'youtubeSearch' ||
            type === 'youtubeVideo' ||
            type === 'youtubePlaylist' ||
            (type === 'autoSearch' && /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(query)) ||
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(query) ||
            query.startsWith('ytsearch:')
        );
    }

    async handle(query, context) {
        try {
            if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(query)) {
                return await this._handleUrl(query, context);
            } else {
                const searchQuery = query.replace(/^ytsearch:/, '').trim();
                return await this._handleSearch(searchQuery, context);
            }
        } catch (e) {
            this.debug('CustomYouTubeExtractor handle error: ' + e.message);
            return this.createResponse(null, []);
        }
    }

    async _handleUrl(url, context) {
        const tube    = await getInnertube();
        const videoId = this._extractVideoId(url);
        if (!videoId) throw new Error('Could not extract video ID from: ' + url);

        const info   = await tube.getBasicInfo(videoId, { client: 'IOS' });
        const basic  = info.basic_info;
        const duration = basic.duration || 0;

        const track = new Track(this.context.player, {
            title:       basic.title || 'Unknown',
            author:      basic.author || 'Unknown',
            url:         `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail:   basic.thumbnail?.[basic.thumbnail.length - 1]?.url || '',
            duration:    this._formatDuration(duration),
            durationMS:  duration * 1000,
            source:      'youtube',
            engine:      this,
            queryType:   context.type,
            metadata:    { videoId },
            requestedBy: context.requestedBy,
        });

        return this.createResponse(null, [track]);
    }

    async _handleSearch(query, context) {
        const tube = await getInnertube();
        const searchResults = await tube.search(query, { type: 'video' });
        const videos = searchResults.videos?.slice(0, 5) || [];

        const tracks = videos.map(video => {
            const videoId  = video.id;
            const duration = video.duration?.seconds || 0;
            return new Track(this.context.player, {
                title:       video.title?.text || 'Unknown',
                author:      video.author?.name || 'Unknown',
                url:         `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail:   video.thumbnails?.[0]?.url || '',
                duration:    this._formatDuration(duration),
                durationMS:  duration * 1000,
                source:      'youtube',
                engine:      this,
                queryType:   context.type,
                metadata:    { videoId },
                requestedBy: context.requestedBy,
            });
        });

        return this.createResponse(null, tracks);
    }

    async stream(track) {
        const videoId = track.metadata?.videoId || this._extractVideoId(track.url);
        if (!videoId) throw new Error('No video ID for track: ' + track.url);

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`[YT Extractor] Streaming via CustomYouTubeExtractor: ${track.title}`);

        // Primary method: Try youtubei getBasicInfo format URL
        try {
            const tube = await getInnertube();
            const info = await tube.getBasicInfo(videoId, { client: 'IOS' });
            
            // Prefer MP4 audio since it plays nicely with ffmpeg and discord
            const format = info.chooseFormat?.({ quality: 'best', format: 'mp4', type: 'audio' })
                || (info.formats || []).find(f => (f.mime_type || '').includes('audio') && f.url);

            if (format?.url) {
                console.log(`[YT Extractor] Streaming via youtubei direct URL (${format.mime_type})`);
                
                // Fetch the stream via https to send the correct User-Agent
                // ffmpeg gets blocked if we just pass the URL without headers
                const https = require('https');
                return new Promise((resolve, reject) => {
                    https.get(format.url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }, (res) => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(res); // IncomingMessage is a Readable stream
                        } else {
                            reject(new Error(`Failed to fetch direct stream, status code: ${res.statusCode}`));
                        }
                    }).on('error', reject);
                });
            }
        } catch (e) {
            console.warn('[YT Extractor] youtubei direct stream failed:', e.message);
        }

        // Secondary method: youtubei.js download() returns a Web ReadableStream via IOS client
        try {
            const tube = await getInnertube();
            const webStream = await tube.download(videoId, {
                type: 'audio',
                quality: 'best',
                client: 'IOS',
            });
            if (webStream) {
                const { PassThrough } = require('stream');
                const nodeStream = new PassThrough();
                const reader = webStream.getReader();
                (async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) { nodeStream.end(); break; }
                        nodeStream.write(Buffer.from(value));
                    }
                })().catch(err => nodeStream.destroy(err));

                console.log(`[YT Extractor] Streaming via youtubei.js download() (IOS client audio stream)`);
                return nodeStream;
            }
        } catch (e) {
            console.warn('[YT Extractor] youtubei download stream failed:', e.message);
        }



        // Fallback to play-dl for difficult URLs.
        try {
            console.log(`[YT Extractor] Falling back to play-dl for ${url}`);
            const streamInfo = await playdl.stream(url);
            if (streamInfo?.stream) {
                console.log('[YT Extractor] play-dl fallback succeeded.');
                return streamInfo.stream;
            }
            if (streamInfo?.url) {
                console.log('[YT Extractor] play-dl fallback returned direct URL.');
                return streamInfo.url;
            }
        } catch (e) {
            console.warn('[YT Extractor] play-dl fallback failed:', e.message);
        }

        // Last resort: youtube-dl-exec (yt-dlp) if installed and allowed.
        try {
            console.log(`[YT Extractor] Falling back to youtube-dl-exec for ${url}`);
            const ytdlpInfo = await ytDlp(url, {
                dumpSingleJson: true,
                format: 'bestaudio',
                noWarnings: true,
                callHome: false,
                noCheckCertificates: true,
                preferFreeFormats: true,
                sourceAddress: '0.0.0.0'
            });
            if (ytdlpInfo?.url) {
                console.log('[YT Extractor] youtube-dl-exec fallback succeeded.');
                return ytdlpInfo.url;
            }
        } catch (e) {
            console.warn('[YT Extractor] youtube-dl-exec fallback failed:', e.message);
        }

        throw new Error('Could not extract playable stream URL for ' + track.title);
    }

    async getRelatedTracks(track, history) {
        try {
            const tube = await getInnertube();
            const searchResults = await tube.search(track.author, { type: 'video' });
            let videos = searchResults.videos?.slice(0, 10) || [];
            
            // Filter out history and the current track
            const historyIds = history.map(t => t.metadata?.videoId || this._extractVideoId(t.url));
            const currentId = track.metadata?.videoId || this._extractVideoId(track.url);
            videos = videos.filter(v => v.id && !historyIds.includes(v.id) && v.id !== currentId);
            
            const tracks = videos.map(video => {
                const duration = video.duration?.seconds || 0;
                return new Track(this.context.player, {
                    title:       video.title?.text || 'Unknown',
                    author:      video.author?.name || 'Unknown',
                    url:         `https://www.youtube.com/watch?v=${video.id}`,
                    thumbnail:   video.thumbnails?.[0]?.url || '',
                    duration:    this._formatDuration(duration),
                    durationMS:  duration * 1000,
                    source:      'youtube',
                    engine:      this,
                    queryType:   'youtubeVideo',
                    metadata:    { videoId: video.id },
                    requestedBy: track.requestedBy,
                });
            });

            return this.createResponse(null, tracks);
        } catch (e) {
            console.error('[YT Extractor] getRelatedTracks error:', e.message);
            return this.createResponse(null, []);
        }
    }

    _extractVideoId(url) {
        const match = url?.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    _formatDuration(seconds) {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

module.exports = { CustomYouTubeExtractor };
