const { Innertube } = require('youtubei.js');

async function test() {
    const tube = await Innertube.create({ retrieve_player: false });
    
    try {
        const fullInfo = await tube.getInfo('jNQXAC9IVRw');
        const videos = fullInfo.watch_next_feed?.filter(v => v.type === 'CompactVideo' || v.type === 'Video') || [];
        console.log(videos.slice(0, 2).map(v => ({
            id: v.id,
            title: v.title?.text || v.title,
            author: v.author?.name || v.author,
            duration: v.duration?.seconds
        })));
    } catch (e) {
        console.log("Error full info:", e.message);
    }
    
    process.exit(0);
}
test();
