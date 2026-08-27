const Groq = require("groq-sdk");

// Per-user conversation history: Map<userId, Array<{role, content}>>
const userHistory = new Map();

const MAX_HISTORY = 10;

// Model priority list — only models confirmed available on this key
const MODELS = [
  "groq/compound",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a helpful, friendly, and witty AI assistant built into a Discord music bot called Hot Pursuit. " +
    "You can answer questions, chat, help with lyrics, recommend music, and more. " +
    "Keep your responses concise and suitable for Discord (no overly long paragraphs). " +
    "Use emojis occasionally to keep things fun. " +
    "If asked about music, songs, or artists, give thoughtful and engaging answers.",
};

// Lazy Groq client — initialised on first use so env vars are guaranteed to be loaded
let _groq = null;
function getGroq() {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not set in environment variables.");
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

/**
 * Get or initialise history for a user.
 * @param {string} userId
 * @returns {Array}
 */
function getHistory(userId) {
  if (!userHistory.has(userId)) {
    userHistory.set(userId, []);
  }
  return userHistory.get(userId);
}

/**
 * Trim history so it never exceeds MAX_HISTORY messages.
 * @param {string} userId
 */
function trimHistory(userId) {
  const history = userHistory.get(userId);
  if (history && history.length > MAX_HISTORY) {
    const excess = history.length - MAX_HISTORY;
    history.splice(0, excess);
  }
}

/**
 * Try Groq with each model in the priority list until one succeeds.
 * @param {Array} messages
 * @returns {Promise<string>}
 */
async function tryGroq(messages) {
  const groq = getGroq();
  let lastError;

  for (const model of MODELS) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 512,
        temperature: 0.8,
      });

      const content = response.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } catch (err) {
      lastError = err;
      console.warn(`[AI Chat] Model "${model}" failed: ${err.message}`);
      // If it's an auth error, no point trying other models
      if (err.status === 401) throw err;
    }
  }

  throw lastError || new Error("All Groq models failed.");
}

/**
 * Send a message to Groq and return the AI reply string.
 * Maintains per-user conversation history.
 *
 * @param {string} userId
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
async function askAI(userId, userMessage) {
  const history = getHistory(userId);

  // Append new user message
  history.push({ role: "user", content: userMessage });

  const messages = [SYSTEM_PROMPT, ...history];

  try {
    const reply = await tryGroq(messages);

    // Store the AI reply in history
    history.push({ role: "assistant", content: reply });
    trimHistory(userId);

    return reply;
  } catch (err) {
    // Remove the last user message from history on failure so it can be retried
    history.pop();
    console.error("[AI Chat] Fatal error:", err.message);
    throw err;
  }
}

/**
 * Clear conversation history for a user.
 * @param {string} userId
 */
function clearHistory(userId) {
  userHistory.delete(userId);
}

module.exports = { askAI, clearHistory };
