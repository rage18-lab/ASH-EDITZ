const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
    const genAI = new GoogleGenerativeAI('AIzaSyDummyKeyDummyKeyDummyKeyDummyKeyD');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const history = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi!' }] }
    ];
    
    try {
        const chat = model.startChat({ history });
        console.log("startChat successful");
        await chat.sendMessage("test");
    } catch (e) {
        console.error("Caught error:", e);
    }
}
run();
