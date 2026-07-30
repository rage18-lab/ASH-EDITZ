const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyDummyKeyDummyKeyDummyKeyDummyKeyD');

try {
    const model1 = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: "This is a string prompt",
    });
    console.log("String works");
} catch(e) {
    console.log("String failed", e.message);
}

try {
    const model2 = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: { parts: [{ text: "This is an object prompt" }] },
    });
    console.log("Object works");
} catch(e) {
    console.log("Object failed", e.message);
}
