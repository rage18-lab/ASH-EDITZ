const { Innertube } = require('youtubei.js');

async function test() {
    const tube = await Innertube.create({ retrieve_player: false });
    
    try {
        const fullInfo = await tube.getInfo('jNQXAC9IVRw');
        console.log("Types:", fullInfo.watch_next_feed?.map(v => v.type));
    } catch (e) {
        console.log("Error full info:", e.message);
    }
    
    process.exit(0);
}
test();
