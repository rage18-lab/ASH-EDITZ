/**
 * ai_chat.js — Core Gemini AI Chat Manager
 * Handles conversation history, generation, and channel config.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs   = require('fs');
const path = require('path');

const CONFIG_FILE   = path.join(__dirname, '..', 'ai_chat_config.json');
const MAX_HISTORY   = 20;   // max messages to keep per user (10 exchanges)

// ── Bot personality ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Hot Pursuit, a smart, witty, and friendly AI assistant built into a Discord music bot. 
Your personality:
- Friendly, fun, and slightly playful — like a cool friend
- You love music and often make music-related jokes or references when relevant
- You keep responses concise and Discord-friendly (avoid walls of text)
- You use occasional emojis but don't overdo it
- If someone asks you to play music, remind them to use the /play command
- You're knowledgeable about all topics but keep it chill
- Never break character or mention you are built on Gemini/Google

Remember: You're in a Discord server. Keep responses short and punchy unless the user needs detailed help.`;

// ── Config helpers ─────────────────────────────────────────────────────────
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
        catch (_) {}
    }
    return { channels: {}, enabled: true };
}

function saveConfig(data) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Conversation history (per user, per guild) ─────────────────────────────
const historyStore = new Map(); // key: `${guildId}:${userId}`

function getHistory(guildId, userId) {
    const key = `${guildId}:${userId}`;
    if (!historyStore.has(key)) historyStore.set(key, []);
    return historyStore.get(key);
}

function clearHistory(guildId, userId) {
    const key = `${guildId}:${userId}`;
    historyStore.set(key, []);
}

function pushHistory(guildId, userId, role, text) {
    const history = getHistory(guildId, userId);
    history.push({ role, parts: [{ text }] });
    // Trim to max length (keep pairs, remove oldest)
    while (history.length > MAX_HISTORY) history.splice(0, 2);
}

// ── Main generation function ───────────────────────────────────────────────
async function generateReply(guildId, userId, userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return "*AI Chat is not configured yet. The bot owner needs to add a valid Gemini API key in the `.env` file.*";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: SYSTEM_PROMPT,
    });

    const history = getHistory(guildId, userId);

    const chat = model.startChat({
        // Shallow copy so the SDK doesn't mutate our stored array twice
        history: [...history],
        generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.85,
        },
    });

    const result = await chat.sendMessage(userMessage);
    let response;
    try {
        response = result.response.text();
    } catch (e) {
        response = "*My response was blocked by safety filters or an error occurred.*";
    }

    // Save to history
    pushHistory(guildId, userId, 'user',  userMessage);
    pushHistory(guildId, userId, 'model', response);

    return response;
}

// ── Channel config helpers ─────────────────────────────────────────────────
function setAIChannel(guildId, channelId) {
    const config = loadConfig();
    if (!config.channels) config.channels = {};
    config.channels[guildId] = channelId;
    saveConfig(config);
}

function removeAIChannel(guildId) {
    const config = loadConfig();
    if (config.channels) delete config.channels[guildId];
    saveConfig(config);
}

function getAIChannel(guildId) {
    const config = loadConfig();
    return config.channels?.[guildId] || null;
}

module.exports = {
    generateReply,
    clearHistory,
    setAIChannel,
    removeAIChannel,
    getAIChannel,
};
