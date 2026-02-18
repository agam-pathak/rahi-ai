import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import {
  computeTrialWindow,
  getPlanCapabilities,
  resolvePlanTier,
  tierAtLeast,
} from "@/lib/billing/tier";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const ProfileUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  travel_style: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().max(500).optional(),
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

  const user = await getRequestUser(req, supabase);

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

  const createdAt =
    (typeof profile?.created_at === "string" ? profile.created_at : null) ??
    (typeof (user as any)?.created_at === "string" ? (user as any).created_at : null);
  const trialDays = Number(process.env.BASIC_TRIAL_DAYS ?? "14");
  const trial = computeTrialWindow(createdAt, trialDays);
  const planTier = resolvePlanTier({
    explicitTier: (profile as any)?.plan_tier,
    isPremium: Boolean((profile as any)?.is_premium),
    trialActive: trial.trialActive,
  });
  const capabilities = getPlanCapabilities(planTier);

  return NextResponse.json(
    {
      ...profile,
      plan_tier: planTier,
      is_premium: tierAtLeast(planTier, "premium"),
      trial_status: trial.trialStatus,
      trial_active: trial.trialActive,
      trial_days_left: trial.trialDaysLeft,
      trial_ends_at: trial.trialEndsAt,
      capabilities,
    },
    { headers: rlHeaders }
  );
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

  const user = await getRequestUser(req, supabase);

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
  if (parsed.data.bio !== undefined) update.bio = parsed.data.bio;
  if (parsed.data.avatar_url !== undefined) update.avatar_url = parsed.data.avatar_url;

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
