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

