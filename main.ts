import "jsr:@std/dotenv/load";
import { Hono } from "hono";
import { createClient } from "jsr:@supabase/supabase-js@2.44.4";
import { chatWith } from "./helpers/chat-with.ts";
import { ipRateLimit, viewerRateLimit } from "./helpers/rate-limit.ts";
import { Database } from "./supabase/db-types.ts";
import {streamText } from "hono/streaming";
import { getCandidateContextFromID } from "./helpers/supabase_stuff.ts";
const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono caht server");
});

interface ChatRequestBody {
  viewer_id: string;
  candidate_id: string;
  prompt: string;
}
app.get("/candidate/chat", (c) => {
  return c.json({ message: "candidate chat route" });
});
app.post("/candidate/chat", async (c) => {
  const kv = await Deno.openKv();
  await ipRateLimit({ c, kv });
  const { candidate_id, viewer_id, prompt } = await c.req.json<ChatRequestBody>();
  if (!viewer_id) {
    return c.json({ message: "viewer id should be provided" }, 400);
  }
  if (!candidate_id) {
    return c.json({ message: "candidate id should be provided" }, 400);
  }

 
  const supabaseClient = createClient<Database>(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_KEY") ?? ""
  );
  const context_text =  await getCandidateContextFromID({
    candidate_id,sb:supabaseClient
  })
  await viewerRateLimit({ c, kv, sb: supabaseClient, viewer_id });
  const chat_res = await chatWith({ context_text, prompt });
  const res_stream = chat_res.stream
  
  return streamText(c,async (stream)=>{
    for await(const chunk of res_stream) {
      stream.write(chunk.text());
    }
  });
});

Deno.serve(app.fetch);
