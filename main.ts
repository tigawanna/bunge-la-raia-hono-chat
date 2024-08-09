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
  return c.text("nice   balls", 500);
});

app.get("/candidate/chat", (c) => {
  return c.json({ message: "candidate chat route" });
});

app.post("/candidate/chat", async (c) => {
  const { candidate_id, viewer_id, messages } = await c.req.json<ChatRequestBody>();
  const kv = await Deno.openKv();
  const viewer_visit_count = await kv.get<number>([viewer_id, "visit-count"]);
  await ipRateLimit({ c, kv });
  if (!viewer_id) {
    return c.text("viewer id should be provided", 400);
  }
  if (!candidate_id) {
    return c.text("candidate id should be provided", 400);
  }

  const supabaseClient = createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_KEY") ?? ""
  );
  await viewerRateLimit({ c, kv, sb: supabaseClient, viewer_id,viewer_visit_count: viewer_visit_count.value??0 });
  const chat_res = await chatWithVercelSDK({
    messages,
    candidate_id,
    sb: supabaseClient,
    viewer_id,
  });
  await kv.set([viewer_id, "visit-count"], (viewer_visit_count.value || 0) + 1, {
    expireIn: 24 * 60 * 60 * 1000 * 3,
  });

  return chat_res.toDataStreamResponse();
});

Deno.serve(app.fetch);
