const Groq = require("groq-sdk");

// Per-user conversation history: Map<userId, Array<{role, content}>>
const userHistory = new Map();
const MAX_HISTORY = 10;

// Valid Groq-hosted model IDs — ordered by quality/reliability
// See: https://console.groq.com/docs/models
const MODELS = [
  "llama-3.3-70b-versatile",      // Best overall free Groq model
  "llama3-70b-8192",               // Reliable fallback
  "llama3-8b-8192",                // Fast & lightweight fallback
  "gemma2-9b-it",                  // Google Gemma fallback
  "mixtral-8x7b-32768",            // Mixtral as last resort
];

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a helpful, friendly, and witty AI assistant built into a Discord music bot called Hot Pursuit. " +
    "You can answer questions, chat, help with lyrics, recommend music, and more. " +
    "IMPORTANT: Keep your responses SHORT (under 400 characters). " +
    "Never use long paragraphs. Use emojis. Be fun and casual. " +
    "If asked about music, songs, or artists, give short engaging answers.",
};

// Lazy Groq client — initialised on first use so env vars are guaranteed loaded
let _groq = null;
function getGroq() {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not set in .env");
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

function getHistory(userId) {
  if (!userHistory.has(userId)) userHistory.set(userId, []);
  return userHistory.get(userId);
}

function trimHistory(userId) {
  const h = userHistory.get(userId);
  if (h && h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
}

/**
 * Strip <think>...</think> reasoning blocks that some models include.
 * Also trim leading/trailing whitespace.
 */
function stripReasoning(text) {
  if (!text) return text;
  // Remove <think>...</think> blocks (Qwen reasoning models use this)
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Try each model in order until one returns a usable reply.
 */
async function tryGroq(messages) {
  const groq = getGroq();
  let lastError;

  for (const model of MODELS) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 300,
        temperature: 0.8,
      });

      const raw = response.choices?.[0]?.message?.content ?? "";
      const content = stripReasoning(raw);

      // Skip if model returned nothing useful after stripping
      if (content && content.length > 2) return content;

    } catch (err) {
      lastError = err;
      console.warn(`[AI Chat] Model "${model}" failed (${err.status ?? "?"}): ${err.message?.slice(0, 80)}`);
      // Auth failure → no point trying others
      if (err.status === 401) throw err;
    }
  }

  throw lastError || new Error("All Groq models returned empty responses.");
}

/**
 * Ask the AI and return the reply, maintaining per-user history.
 * @param {string} userId
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
async function askAI(userId, userMessage) {
  const history = getHistory(userId);
  history.push({ role: "user", content: userMessage });

  try {
    const messages = [SYSTEM_PROMPT, ...history];
    const reply = await tryGroq(messages);

    history.push({ role: "assistant", content: reply });
    trimHistory(userId);

    return reply;
  } catch (err) {
    // Remove the failed user message from history so the user can retry
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
