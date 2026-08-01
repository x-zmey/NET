const PROXY_URL =
  process.env.CLAUDE_PROXY_URL || "https://x-zmey.duckdns.org/v1/chat";
const PROXY_TIMEOUT_MS = 180_000;

const SYSTEM_PROMPT = `You are a senior American software developer based in California, chatting on Slack or a freelancing platform. You talk like a real person — warm, direct, and confident.

Your job: take ANY input and rewrite it exactly how YOU would say it. Not "correct English" — YOUR English. The way you'd actually type it to a coworker or client.

If the input already sounds like something you'd naturally say, return it as-is. If any part sounds off, awkward, too formal, or non-native, rephrase that part how you'd actually say it.

Your style:
- Casual-professional: friendly but competent
- Contractions always (I'll, don't, won't, I've, that's, we're, I'd)
- Short and punchy over long and formal
- American idioms and slang when natural (shoot me, heads up, I'm on it, your call, got it, no worries, sounds good, for sure, hit me up, keep me posted, I've got bandwidth, right up my alley, good catch, you're killing it)
- Never sound like a textbook, a translator, or a non-native speaker
- CRITICAL: Only use plain ASCII characters. Never use em dashes (—), en dashes (–), curly quotes (" " ' '), ellipsis character (…), or any other Unicode fancy punctuation. Use regular hyphens (-), straight quotes (" '), and three dots (...) instead. Your output must look like it was typed on a normal keyboard.`;

// The proxy truncates the prompt at the first newline (it shells out to the
// Claude CLI without quoting), so everything must be collapsed onto one line.
// Verified: "Say A\nThen say B" returns only "A".
function flatten(s: string): string {
  return s.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

// The proxy exposes no separate system parameter, so the persona is prepended
// to every prompt and the task instructions follow it.
async function askClaude(prompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_PROXY_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_PROXY_API_KEY is not set.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: flatten(`${SYSTEM_PROMPT} --- ${prompt}`),
        ...(process.env.CLAUDE_PROXY_MODEL && {
          model: process.env.CLAUDE_PROXY_MODEL,
        }),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Claude proxy request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Claude proxy responded with ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }

  const data: unknown = await response.json();
  const text =
    typeof data === "object" && data !== null
      ? (data as { response?: unknown }).response
      : undefined;

  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Unexpected response format from Claude proxy");
  }

  return sanitize(text.trim());
}

export async function translateToNativeEnglish(
  text: string,
  history?: string
): Promise<string> {
  const hasHistory = history && history.trim().length > 0;

  // Newlines cannot survive the trip, so the text is delimited with markers
  // instead of blank lines to keep instructions and content distinguishable.
  const prompt = hasHistory
    ? `Context from the conversation (for understanding tone and topic only), between [CONTEXT] and [/CONTEXT]: [CONTEXT] ${flatten(history)} [/CONTEXT] Now rewrite the text between [TEXT] and [/TEXT] into natural American English. Only return the rewritten text, nothing else: [TEXT] ${flatten(text)} [/TEXT]`
    : `Rewrite the text between [TEXT] and [/TEXT] into natural American English. Only return the rewritten text, nothing else: [TEXT] ${flatten(text)} [/TEXT]`;

  return askClaude(prompt);
}

function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, "-")     // em dash -> hyphen
    .replace(/\u2013/g, "-")     // en dash -> hyphen
    .replace(/\u2018/g, "'")     // left single curly -> straight
    .replace(/\u2019/g, "'")     // right single curly -> straight
    .replace(/\u201C/g, '"')     // left double curly -> straight
    .replace(/\u201D/g, '"')     // right double curly -> straight
    .replace(/\u2026/g, "...")   // ellipsis -> three dots
    .replace(/\u2022/g, "-")    // bullet -> hyphen
    .replace(/\u00A0/g, " ");   // non-breaking space -> regular space
}

export async function translateToNativeEnglishMulti(
  text: string,
  count: number = 3,
  history?: string
): Promise<string[]> {
  const hasHistory = history && history.trim().length > 0;

  // The request must be one line, but the response may contain newlines, so
  // variants still come back one per line.
  const task = `Rewrite the text between [TEXT] and [/TEXT] into natural American English. Provide exactly ${count} different variations, each on its own line. Each variation should sound natural but use different wording/phrasing. Only return the ${count} lines, nothing else - no numbering, no bullets, no labels.`;

  const prompt = hasHistory
    ? `Context from the conversation (for understanding tone and topic only), between [CONTEXT] and [/CONTEXT]: [CONTEXT] ${flatten(history)} [/CONTEXT] ${task} [TEXT] ${flatten(text)} [/TEXT]`
    : `${task} [TEXT] ${flatten(text)} [/TEXT]`;

  const raw = await askClaude(prompt);

  // Strip list markers the model adds despite being told not to:
  // "1. ", "2) ", "- ", "* " (bullets already normalized to "-" by sanitize).
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[\.\)\-]|[-*])\s*/, "").trim())
    .filter((l) => l.length > 0);

  return lines.slice(0, count);
}
