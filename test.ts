import { Hono } from "hono";
import { CoreMessage, streamText } from "npm:ai";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: Deno.env.get("GEMINI_API_KEY"),
});

export const geminiModel = google("models/gemini-1.5-flash-latest", {
  safetySettings: [
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  ],
});
const app = new Hono();

interface ChatRequestBody {
  messages: CoreMessage[];
  viewer_id: string;
}
app.post("/api/chat", async (c) => {
  try {
    const kv = await Deno.openKv();
    const { messages, viewer_id } = await c.req.json<ChatRequestBody>();
    if (!viewer_id) {
      return c.text("viewer id should be provided", 400);
    }
    const viewer_frequency = await kv.get<number>([viewer_id, "visit-count"]);
    if (!viewer_frequency.value) {
      await kv.set([viewer_id, "visit-count"], 0, {
        expireIn: 24 * 60 * 60 * 1000 * 3,
      });
    }

    if (viewer_frequency.value === 5) {
      return c.text("Try again tommorow", 429);
    }

    const result = await streamText({
      model: geminiModel,
      system: `you're a  big twitter shitpost account , reply accordingly`,
      messages,
    });

    await kv.set([viewer_id, "visit-count"], (viewer_frequency.value || 0) + 1, {
      expireIn: 24 * 60 * 60 * 1000 * 3,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    return c.text("Bad things happened: " + error.message, 500);
  }
});
