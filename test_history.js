const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI('DUMMY_KEY');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const history = [];
    const chat = model.startChat({ history });
    
    console.log("History before:", history.length);
    try {
        await chat.sendMessage("Hello");
    } catch (e) {
        // expect to fail due to dummy key
    }
    
    console.log("History after:", history.length);
    console.log("Chat internal history:", (await chat.getHistory()).length);
}

test();
