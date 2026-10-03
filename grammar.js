// ─────────────────────────────────────────────────────────────────────
// grammar.js — Closed Command Grammar & Voice Transcript Parser
// Fast deterministic intent classification for voice commands
// ─────────────────────────────────────────────────────────────────────

export const VOICE_GRAMMAR = {
  commands: [
    { intent: "SEARCH_JOBS", keywords: ["job", "jobs", "find jobs", "search jobs", "discover jobs", "serpapi"] },
    { intent: "COMPARE_JOBS", keywords: ["compare", "comparison", "matrix", "side by side", "versus", "vs"] },
    { intent: "APPLY_JOB", keywords: ["apply", "auto apply", "visual apply", "apply now", "browser apply"] },
    { intent: "BATCH_APPLY", keywords: ["batch", "apply all", "batch apply", "all top five"] },
    { intent: "SAVE_JOB", keywords: ["save", "bookmark", "save job"] },
    { intent: "VIEW_DETAILS", keywords: ["details", "view details", "cover letter", "resume bullets"] },
    { intent: "PROFILE_SETUP", keywords: ["profile", "setup profile", "my profile", "settings"] },
    { intent: "QUIT", keywords: ["exit", "quit", "stop", "close", "bye"] }
  ]
};

/**
 * Parses spoken transcript against closed command grammar
 * @param {string} transcript 
 * @returns {Object} Classified intent and confidence
 */
export function parseTranscript(transcript = "") {
  if (!transcript || typeof transcript !== "string") {
    return { intent: "UNKNOWN", raw: transcript, confidence: 0 };
  }

  const cleaned = transcript.toLowerCase().trim();

  for (const item of VOICE_GRAMMAR.commands) {
    if (item.keywords.some(kw => cleaned.includes(kw))) {
      return { intent: item.intent, raw: transcript, confidence: 0.95 };
    }
  }

  // Number selection (e.g. "number 2", "job 1", "three")
  const numMatch = cleaned.match(/\b(one|1|two|2|three|3|four|4|five|5)\b/);
  if (numMatch) {
    const wordToNum = { one: 1, "1": 1, two: 2, "2": 2, three: 3, "3": 3, four: 4, "4": 4, five: 5, "5": 5 };
    const selectedNum = wordToNum[numMatch[1]];
    return { intent: "SELECT_NUMBER", number: selectedNum, raw: transcript, confidence: 0.9 };
  }

  return { intent: "UNKNOWN", raw: transcript, confidence: 0.3 };
}
