const { Innertube } = require('youtubei.js');

async function test() {
    const tube = await Innertube.create({ retrieve_player: false });
    const info = await tube.getBasicInfo('jNQXAC9IVRw', { client: 'IOS' });
    
    console.log("Basic info related?", !!info.related_videos, !!info.watch_next_feed);
    
    try {
        const fullInfo = await tube.getInfo('jNQXAC9IVRw');
        console.log("Full info related?", fullInfo.watch_next_feed?.length > 0);
        console.log(fullInfo.watch_next_feed.slice(0, 2).map(v => v.title?.text));
    } catch (e) {
        console.log("Error full info:", e.message);
    }
    
    process.exit(0);
}
test();
