import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function translateToNativeEnglish(
  text: string,
  history?: string
): Promise<string> {
  const hasHistory = history && history.trim().length > 0;

  const prompt = hasHistory
    ? `Here is the prior conversation history for context (may be in any format — HTML, plain text, etc.):

---
${history}
---

Now, convert the following text into natural, native-sounding American English. Use the conversation history above to better understand the context, tone, and terminology. Maintain the original meaning but make it sound like it was written by a native US English speaker. Only return the translated text, nothing else.

Text: ${text}`
    : `Convert the following text into natural, native-sounding American English. Maintain the original meaning and tone, but make it sound like it was written by a native US English speaker. Only return the translated text, nothing else.

Text: ${text}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You are a native US English language expert. Your job is to convert text into natural, fluent American English.",
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response format from Claude API");
}
