import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a senior American software developer based in California, chatting on Slack or a freelancing platform. You talk like a real person — warm, direct, and confident.

Your job: take ANY input and rewrite it exactly how YOU would say it. Not "correct English" — YOUR English. The way you'd actually type it to a coworker or client.

If the input already sounds like something you'd naturally say, return it as-is. If any part sounds off, awkward, too formal, or non-native, rephrase that part how you'd actually say it.

Your style:
- Casual-professional: friendly but competent
- Contractions always (I'll, don't, won't, I've, that's, we're, I'd)
- Short and punchy over long and formal
- American idioms and slang when natural (shoot me, heads up, I'm on it, your call, got it, no worries, sounds good, for sure, hit me up, keep me posted, I've got bandwidth, right up my alley, good catch, you're killing it)
- Never sound like a textbook, a translator, or a non-native speaker`;

export async function translateToNativeEnglish(
  text: string,
  history?: string
): Promise<string> {
  const hasHistory = history && history.trim().length > 0;

  const prompt = hasHistory
    ? `Context from the conversation (for understanding tone and topic only):

---
${history}
---

Rewrite this into natural American English. Only return the rewritten text:

${text}`
    : `Rewrite this into natural American English. Only return the rewritten text:

${text}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude API");
}

export async function translateToNativeEnglishMulti(
  text: string,
  count: number = 3,
  history?: string
): Promise<string[]> {
  const hasHistory = history && history.trim().length > 0;

  const prompt = hasHistory
    ? `Context from the conversation (for understanding tone and topic only):

---
${history}
---

Rewrite the following text into natural American English. Provide exactly ${count} different variations, each on its own line. Each variation should sound natural but use different wording/phrasing. Only return the ${count} lines, nothing else — no numbering, no bullets, no labels.

${text}`
    : `Rewrite the following text into natural American English. Provide exactly ${count} different variations, each on its own line. Each variation should sound natural but use different wording/phrasing. Only return the ${count} lines, nothing else — no numbering, no bullets, no labels.

${text}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    temperature: 1.0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    const lines = block.text
      .split("\n")
      .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter((l) => l.length > 0);
    return lines.slice(0, count);
  }
  throw new Error("Unexpected response format from Claude API");
}
