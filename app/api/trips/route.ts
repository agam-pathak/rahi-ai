import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

export async function GET(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`trips:list:${clientId}`, { limit: 60, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  const supabase = await createClient();
  const user = await getRequestUser(req, supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataClient = supabaseAdmin ?? supabase;
  const { data, error } = await dataClient
    .from("trips")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

