module.exports = (queue, track) => {
    // Clean up synced lyrics thread
    if (queue.metadata?.lyricsThread) {
        queue.metadata.lyricsThread.delete().catch(() => {});
    }

    // Store last played track for autoplay reference
    if (track) {
        queue.setMetadata({
            ...queue.metadata,
            lyricsThread: null,
            lastTrack: track
        });
    } else {
        queue.setMetadata({
            ...queue.metadata,
            lyricsThread: null
        });
    }
};
