import { getConnInfo } from "https://jsr.io/@hono/hono/4.5.3/src/adapter/deno/conninfo.ts";
import { Context } from "https://jsr.io/@hono/hono/4.5.3/src/context.ts";
import SupabaseClient from "https://jsr.io/@supabase/supabase-js/2.44.4/src/SupabaseClient.ts";
import { BlankEnv, BlankInput } from "jsr:@hono/hono@^4.5.3/types";
import { Database } from "../supabase/db-types.ts";

interface RateLimitprops {
  c: Context<BlankEnv, "/chat", BlankInput>;
  kv: Deno.Kv;
  viewer_id: string;
  sb: SupabaseClient<Database>;
  viewer_visit_count: number;
}

export async function ipRateLimit({ c, kv }: Pick<RateLimitprops,"c"|"kv">) {
  try {
    const {
      remote: { address },
    } = getConnInfo(c);
    if (!address) {
      return c.text( "address should be provided" , 400);
    }
    const address_visit_count = await kv.get<number>([address, "ip-address-visit-count"]);
    if (address_visit_count?.value && address_visit_count?.value > 4) {
      return c.text( "Too many requests" , 429);
    }
    await kv.set([address, "ip-address-visit-count"], (address_visit_count?.value || 0) + 1, {
      expireIn: 24 * 60 * 60 * 1000 * 3,
    });
  } catch (error) {
    return c.text( "Something went wrong: " + error.message , 500);
  }
}
export async function viewerRateLimit({ c, kv, sb, viewer_id, viewer_visit_count }: RateLimitprops) {
  try {
    // check if viewer has visited
    if (!viewer_visit_count) {
      const { error } = await sb.from("users").select("*").eq("id", viewer_id).single();
      if (error) {
        return c.text("Unauthorized" , 401);
      }
      await kv.set([viewer_id, "visit-count"], 0, {
        expireIn: 24 * 60 * 60 * 1000 * 3, // 3 day,
      });
    }
    //   check if viewer has visited 5 times in the last 5 dayss
    if (viewer_visit_count === 5) {
      return c.text("Try again tommorow" , 429);
    }
  } catch (error) {
    return c.text("Something went wrong: " + error.message , 500);
  }
}
