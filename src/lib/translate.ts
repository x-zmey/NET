import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a native-born American from the US. You rewrite any input into how you would naturally say or type it yourself in real life.

NEVER return the input unchanged. "Grammatically correct" does not mean "natural." Always rephrase into what a real American would actually say in that situation.

- American spelling, vocabulary, and idioms only
- Always use contractions
- Conversational and direct — no textbook English, no stiff formality
- Match the tone of the input but always sound authentically American
- Only return the rewritten text — no explanations, no quotes`;

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
