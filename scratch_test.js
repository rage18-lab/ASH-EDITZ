const { Innertube } = require('youtubei.js');
const { Readable, PassThrough } = require('stream');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function testFFmpeg() {
    const videoId = 'jNQXAC9IVRw';
    console.log('Testing FFmpeg transcoding of youtubei stream...');

    const tube = await Innertube.create({ retrieve_player: false });
    const webStream = await tube.download(videoId, { type: 'audio', quality: 'best', client: 'IOS' });

    // Convert to PassThrough node stream for maximum compatibility
    const nodeStream = new PassThrough();
    const reader = webStream.getReader();
    (async () => {
        while (true) {
            const { done, value } = await reader.read();
            if (done) { nodeStream.end(); break; }
            nodeStream.write(Buffer.from(value));
        }
    })().catch(err => nodeStream.destroy(err));

    const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    nodeStream.pipe(ffmpeg.stdin);

    let pcmBytes = 0;
    ffmpeg.stdout.on('data', chunk => { pcmBytes += chunk.length; });

    await new Promise(resolve => ffmpeg.on('close', resolve));
    console.log('FFmpeg transcoding SUCCESS! Produced PCM bytes:', pcmBytes);
    process.exit(0);
}

testFFmpeg();
