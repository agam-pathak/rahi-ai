import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import {
  type PlanTier,
  computeTrialWindow,
  getPlanCapabilities,
  normalizePlanTier,
  resolvePlanTier,
  tierAtLeast,
} from "@/lib/billing/tier";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const ProfileUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  travel_style: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().max(500).optional(),
});

const parseEnvSet = (raw?: string | null) =>
  new Set(
    String(raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

const getSubscriptionItemProductId = (item: Stripe.SubscriptionItem) => {
  const product = item.price?.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) {
    return String((product as { id?: string }).id ?? "");
  }
  return "";
};

const getTierFromSubscription = (subscription: Stripe.Subscription): PlanTier => {
  const requestedTier = normalizePlanTier(subscription.metadata?.requested_plan);
  if (requestedTier === "pro") return "pro";

  const proPriceIds = parseEnvSet(process.env.STRIPE_PRICE_ID_PRO);
  const proProductIds = parseEnvSet(process.env.STRIPE_PRODUCT_ID_PRO);

  const hasProItem = subscription.items.data.some((item) => {
    const priceId = item.price?.id ?? "";
    const lookupKey = item.price?.lookup_key?.toLowerCase() ?? "";
    const nickname = item.price?.nickname?.toLowerCase() ?? "";
    const productId = getSubscriptionItemProductId(item);
    return (
      (priceId && proPriceIds.has(priceId)) ||
      (productId && proProductIds.has(productId)) ||
      lookupKey.includes("pro") ||
      nickname.includes("pro")
    );
  });

  return hasProItem ? "pro" : "premium";
};

const resolveStripeTier = async ({
  stripe,
  customerId,
  email,
}: {
  stripe: Stripe;
  customerId: string | null;
  email: string | null;
}): Promise<{ tier: PlanTier | null; customerId: string | null }> => {
  const customerCandidates = new Set<string>();
  if (customerId) customerCandidates.add(customerId);

  if (!customerId && email) {
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const customer of customers.data) {
      if (customer.id) customerCandidates.add(customer.id);
    }
  }

  if (customerCandidates.size === 0) {
    return { tier: null as PlanTier | null, customerId: null as string | null };
  }

  let bestTier: PlanTier | null = null;
  let bestCustomerId: string | null = null;

  for (const candidateId of customerCandidates) {
    const subscriptions = await stripe.subscriptions.list({
      customer: candidateId,
      status: "all",
      limit: 10,
    });

    for (const subscription of subscriptions.data) {
      if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;
      const tier = getTierFromSubscription(subscription);
      if (tier === "pro") {
        return { tier: "pro", customerId: candidateId };
      }
      if (!bestTier) {
        bestTier = tier;
        bestCustomerId = candidateId;
      }
    }
  }

  return { tier: bestTier, customerId: bestCustomerId };
};

export async function GET(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`ai:profile:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  const responseHeaders = {
    ...rlHeaders,
    "Cache-Control": "no-store",
  };
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: responseHeaders }
    );
  }

  const supabase = await createClient();

  const user = await getRequestUser(req, supabase);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: responseHeaders }
    );
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
  let planTier = resolvePlanTier({
    explicitTier: (profile as any)?.plan_tier,
    isPremium: Boolean((profile as any)?.is_premium),
    trialActive: trial.trialActive,
  });
  let resolvedStripeCustomerId =
    typeof (profile as any)?.stripe_customer_id === "string"
      ? String((profile as any).stripe_customer_id)
      : null;

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-06-20",
      });
      const stripeState = await resolveStripeTier({
        stripe,
        customerId: resolvedStripeCustomerId,
        email: user.email ?? null,
      });

      if (stripeState.tier) {
        planTier = stripeState.tier;
        if (stripeState.customerId) {
          resolvedStripeCustomerId = stripeState.customerId;
        }

        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email,
            plan_tier: planTier,
            is_premium: tierAtLeast(planTier, "premium"),
            stripe_customer_id: resolvedStripeCustomerId,
          });
      }
    } catch {
      // Ignore Stripe reconciliation issues and fall back to profile state.
    }
  }

  const capabilities = getPlanCapabilities(planTier);

  return NextResponse.json(
    {
      ...profile,
      plan_tier: planTier,
      is_premium: tierAtLeast(planTier, "premium"),
      stripe_customer_id: resolvedStripeCustomerId,
      trial_status: trial.trialStatus,
      trial_active: trial.trialActive,
      trial_days_left: trial.trialDaysLeft,
      trial_ends_at: trial.trialEndsAt,
      capabilities,
    },
    { headers: responseHeaders }
  );
}

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`ai:profile:${clientId}`, { limit: 30, windowMs: 60_000 });
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

