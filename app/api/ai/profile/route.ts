import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const ProfileUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  travel_style: z.string().max(100).optional(),
  budget_range: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`ai:profile:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: rlHeaders });
  }

  // Try fetch profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If not exists, create it
  if (!profile) {
      const { data: inserted } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          name: user.email?.split("@")[0],
          email: user.email,
        })
        .select()
        .single();

    profile = inserted;
  }

  return NextResponse.json(profile, { headers: rlHeaders });
}

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`ai:profile:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: rlHeaders }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rlHeaders }
    );
  }

  const parsed = ProfileUpdateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile data" },
      { status: 400, headers: rlHeaders }
    );
  }

  const update: Record<string, string> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.travel_style !== undefined) {
    update.travel_style = parsed.data.travel_style;
  }
  if (parsed.data.budget_range !== undefined) {
    update.budget_range = parsed.data.budget_range;
  }
  if (parsed.data.bio !== undefined) update.bio = parsed.data.bio;

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      ...update,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500, headers: rlHeaders }
    );
  }

  return NextResponse.json(data, { headers: rlHeaders });
}

