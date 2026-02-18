import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanTier, type PlanTier } from "@/lib/billing/tier";

const isPaidTier = (tier: PlanTier) => tier === "premium" || tier === "pro";

const getTierFromSubscription = (subscription: Stripe.Subscription): PlanTier => {
  const proPriceId = process.env.STRIPE_PRICE_ID_PRO;
  if (!proPriceId) return "premium";
  const hasProItem = subscription.items.data.some(
    (item) => item.price?.id === proPriceId
  );
  return hasProItem ? "pro" : "premium";
};

const upsertProfilePlan = async ({
  userId,
  customerId,
  tier,
}: {
  userId: string;
  customerId: string | null;
  tier: PlanTier;
}) => {
  const basePayload = {
    id: userId,
    is_premium: isPaidTier(tier),
    stripe_customer_id: customerId,
  };
  const { error } = await supabaseAdmin!
    .from("profiles")
    .upsert({
      ...basePayload,
      plan_tier: tier,
    });
  if (!error) return;
  await supabaseAdmin!.from("profiles").upsert(basePayload);
};

const updateProfilePlanByCustomer = async ({
  customerId,
  tier,
}: {
  customerId: string;
  tier: PlanTier;
}) => {
  const basePayload = {
    is_premium: isPaidTier(tier),
  };
  const { error } = await supabaseAdmin!
    .from("profiles")
    .update({
      ...basePayload,
      plan_tier: tier,
    })
    .eq("stripe_customer_id", customerId);
  if (!error) return;
  await supabaseAdmin!
    .from("profiles")
    .update(basePayload)
    .eq("stripe_customer_id", customerId);
};

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing signature");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const requestedTier = normalizePlanTier(session.metadata?.requested_plan);
      const tier: PlanTier = requestedTier === "pro" ? "pro" : "premium";
      if (userId) {
        await upsertProfilePlan({
          userId,
          customerId,
          tier,
        });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await updateProfilePlanByCustomer({
          customerId,
          tier: getTierFromSubscription(subscription),
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await updateProfilePlanByCustomer({
          customerId,
          tier: "free",
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Webhook failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
