import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import { normalizePlanTier } from "@/lib/billing/tier";
import { headers } from "next/headers";

const getNonEmptyEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
};

export async function POST(req: Request) {
  const premiumEnabled = process.env.PREMIUM_ENABLED === "true";
  if (!premiumEnabled) {
    return NextResponse.json(
      { error: "Premium billing is not enabled yet" },
      { status: 503 }
    );
  }
  const secretKey = getNonEmptyEnv("STRIPE_SECRET_KEY");
  const premiumPriceId = getNonEmptyEnv("STRIPE_PRICE_ID_PREMIUM", "STRIPE_PRICE_ID");
  const proPriceId = getNonEmptyEnv("STRIPE_PRICE_ID_PRO");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const requestedTier = normalizePlanTier(body?.plan);
  const checkoutTier = requestedTier === "pro" ? "pro" : "premium";
  const priceId = checkoutTier === "pro" ? proPriceId : premiumPriceId;

  if (!secretKey || !priceId) {
    const missing = [
      !secretKey ? "STRIPE_SECRET_KEY" : null,
      checkoutTier === "pro"
        ? !proPriceId
          ? "STRIPE_PRICE_ID_PRO"
          : null
        : !premiumPriceId
          ? "STRIPE_PRICE_ID_PREMIUM or STRIPE_PRICE_ID"
          : null,
    ].filter(Boolean);

    return NextResponse.json(
      {
        error:
          checkoutTier === "pro"
            ? "Pro billing is not configured"
            : "Stripe not configured",
        details: missing.length
          ? `Missing env: ${missing.join(", ")}`
          : undefined,
      },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const user = await getRequestUser(req, supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (host ? `${proto}://${host}` : "http://localhost:3000");

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        requested_plan: checkoutTier,
      },
      subscription_data: {
        metadata: {
          requested_plan: checkoutTier,
        },
      },
      success_url: `${baseUrl}/planner?billing=success&tier=${checkoutTier}`,
      cancel_url: `${baseUrl}/planner?billing=cancel&tier=${checkoutTier}`,
    });

    return NextResponse.json({ url: session.url, tier: checkoutTier });
  } catch (error: any) {
    const details =
      typeof error?.message === "string" ? error.message : "Stripe checkout failed";
    console.error("[billing] checkout error", {
      tier: checkoutTier,
      details,
    });
    return NextResponse.json(
      { error: "Unable to start checkout", details },
      { status: 500 }
    );
  }
}
