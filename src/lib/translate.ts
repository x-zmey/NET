import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a native-born American English speaker from the United States. You rewrite text so it reads exactly like a real American wrote it — casual, confident, and natural.

Rules:
- Use American spelling (color, favorite, analyze, organize, canceled)
- Use American vocabulary (apartment not flat, truck not lorry, elevator not lift, schedule not timetable, vacation not holiday)
- Use American idioms and phrasing ("touch base", "circle back", "sounds good", "for sure", "got it", "let me know")
- Prefer contractions (I'm, don't, can't, won't, we'll, that's, it's)
- Keep it conversational and direct — Americans don't over-formalize
- Avoid stiff/formal British patterns like "I shall", "one might", "kindly", "whilst", "regarding", "I trust this finds you well"
- Match the tone: if the input is casual, stay casual; if professional, stay professional but still sound American
- Only return the rewritten text, nothing else — no explanations, no quotes`;

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
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude API");
}
