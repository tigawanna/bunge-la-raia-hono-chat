import "jsr:@std/dotenv/load";
import { Hono } from "hono";
import { createClient } from "jsr:@supabase/supabase-js@2.44.4";
import { chatWithVercelSDK } from "./helpers/chat-with.ts";
import { ipRateLimit, viewerRateLimit } from "./helpers/rate-limit.ts";
import { Database } from "./supabase/db-types.ts";
import { CoreMessage } from "npm:ai";
import { cors } from "hono/cors";


const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono caht server");
});

interface ChatRequestBody {
  messages: CoreMessage[];
  viewer_id: string;
  candidate_id: string;
  prompt: string;
}

app.post("/test/chat", (c) => {
  return c.json({ message: "candidate chat route" });
});

app.post("/test/stream", async (c) => {
  const body = await c.req.json();
  console.log("================= body ============", body);
  // const result = await vercelStreamText({
  //   model: geminiModel,
  //   prompt: "Invent a new holiday and describe its traditions.",

  //   onFinish({ text }) {
  //     // your own logic, e.g. for saving the chat history or recording usage
  //     console.log("================= stream completed ============", text);
  //   },
  // });
  // return result.toDataStreamResponse();
  return c.json({ message: "candidate chat route" });
});

app.get("/candidate/chat", (c) => {
  return c.json({ message: "candidate chat route" });
});

app.post("/candidate/chat", async (c) => {
  const kv = await Deno.openKv();
  await ipRateLimit({ c, kv });
  const { candidate_id, viewer_id, prompt, messages } = await c.req.json<
    ChatRequestBody
  >();
  console.log("================= body ============", {
    candidate_id,
    viewer_id,
    prompt,
    messages,
  });
  if (!viewer_id) {
    return c.json({ message: "viewer id should be provided" }, 400);
  }
  if (!candidate_id) {
    return c.json({ message: "candidate id should be provided" }, 400);
  }

  const supabaseClient = createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_KEY") ?? "",
  );
  await viewerRateLimit({ c, kv, sb: supabaseClient, viewer_id });
  const chat_res = await chatWithVercelSDK({
    messages,
    candidate_id,
    sb: supabaseClient,
    viewer_id,
  });
  return chat_res.toDataStreamResponse();
});

Deno.serve(app.fetch);
