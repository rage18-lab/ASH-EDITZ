const yt = require('youtube-dl-exec');

async function test() {
    try {
        console.log("Testing yt-dlp...");
        const info = await yt('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
            dumpSingleJson: true,
            format: 'bestaudio',
            noWarnings: true,
            callHome: false
        });
        console.log("Success! URL:", info.url ? "Found" : "Not Found");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
