const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Per-user conversation history: Map<userId, Array<{role, content}>>
const userHistory = new Map();

const MAX_HISTORY = 10; // messages per user (not counting system prompt)

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a helpful, friendly, and witty AI assistant built into a Discord music bot called Hot Pursuit. " +
    "You can answer questions, chat, help with lyrics, recommend music, and more. " +
    "Keep your responses concise and suitable for Discord (no overly long paragraphs). " +
    "Use emojis occasionally to keep things fun. " +
    "If asked about music, songs, or artists, give thoughtful and engaging answers.",
};

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
    // Remove oldest pairs (user + assistant) from the front
    const excess = history.length - MAX_HISTORY;
    history.splice(0, excess);
  }
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

  // Append the new user message to history
  history.push({ role: "user", content: userMessage });

  const messages = [SYSTEM_PROMPT, ...history];

  const response = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages,
    max_tokens: 512,
    temperature: 0.8,
  });

  const reply =
    response.choices?.[0]?.message?.content?.trim() ??
    "Sorry, I couldn't generate a response right now. Please try again!";

  // Store the AI reply in history
  history.push({ role: "assistant", content: reply });
  trimHistory(userId);

  return reply;
}

/**
 * Clear conversation history for a user.
 * @param {string} userId
 */
function clearHistory(userId) {
  userHistory.delete(userId);
}

module.exports = { askAI, clearHistory };
