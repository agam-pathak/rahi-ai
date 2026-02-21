import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanTier, type PlanTier } from "@/lib/billing/tier";

const isPaidTier = (tier: PlanTier) => tier === "premium" || tier === "pro";

const parseEnvSet = (raw?: string | null) =>
  new Set(
    String(raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

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

  const hasProItem = subscription.items.data.some(
    (item) => {
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
    }
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

const findProfileIdByCustomer = async (customerId: string) => {
  const { data } = await supabaseAdmin!
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
};

const findProfileIdByCustomerEmail = async ({
  stripe,
  customerId,
}: {
  stripe: Stripe;
  customerId: string;
}) => {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return null;
  const email = typeof customer.email === "string" ? customer.email.trim() : "";
  if (!email) return null;

  const { data } = await supabaseAdmin!
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
};

const syncProfilePlanByCustomer = async ({
  stripe,
  customerId,
  tier,
}: {
  stripe: Stripe;
  customerId: string;
  tier: PlanTier;
}) => {
  let userId = await findProfileIdByCustomer(customerId);
  if (!userId) {
    userId = await findProfileIdByCustomerEmail({ stripe, customerId });
  }
  if (!userId) return;

  await upsertProfilePlan({
    userId,
    customerId,
    tier,
  });
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

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await syncProfilePlanByCustomer({
          stripe,
          customerId,
          tier: getTierFromSubscription(subscription),
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await syncProfilePlanByCustomer({
          stripe,
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
