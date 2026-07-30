require('dotenv').config();
const { generateReply } = require('./utils/ai_chat');

async function test() {
    try {
        console.log("Testing generation 1...");
        const reply1 = await generateReply('guild1', 'user1', 'Hello!');
        console.log("Reply 1:", reply1);

        console.log("Testing generation 2...");
        const reply2 = await generateReply('guild1', 'user1', 'How are you?');
        console.log("Reply 2:", reply2);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
