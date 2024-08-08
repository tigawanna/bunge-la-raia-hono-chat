import "jsr:@std/dotenv/load";
import { Hono } from "hono";
import { createClient } from "jsr:@supabase/supabase-js@2.44.4";
import { chatWith } from "./helpers/chat-with.ts";
import { ipRateLimit, viewerRateLimit } from "./helpers/rate-limit.ts";
import { Database } from "./supabase/db-types.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

interface ChatRequestBody {
  viewer_id: string;
  prompt: string;
  context_text: string; // this should be info about the candidate's most recent spirations together with any chat history if vailabe
}
app.get("/candidate/chat", (c) => {
  return c.json({ message: "candidate chat route" });
});
app.post("/candidate/chat", async (c) => {
  const kv = await Deno.openKv();
  await ipRateLimit({ c, kv });
  const { context_text, viewer_id, prompt } = await c.req.json<ChatRequestBody>();
  if (!viewer_id) {
    return c.json({ message: "viewer id should be provided" }, 400);
  }
  if (!context_text) {
    return c.json({ message: "context text should be provided" }, 400);
  }
  const supabaseClient = createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_KEY") ?? ""
  );
  await viewerRateLimit({ c, kv, sb: supabaseClient, viewer_id });
  const chat_res = await chatWith({ context_text, prompt });
  chat_res.response.text();
  return c.json({ message: chat_res.response.text() }, 200);
});

Deno.serve(app.fetch);
