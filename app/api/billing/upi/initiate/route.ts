import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";

const isTruthy = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const isUpiEnabled = () =>
  isTruthy(process.env.UPI_ENABLED) ||
  isTruthy(process.env.PREMIUM_UPI_ENABLED) ||
  isTruthy(process.env.NEXT_PUBLIC_UPI_ENABLED);

const getPlanAmountPaise = () => {
  const raw = Number(process.env.UPI_PLAN_AMOUNT_INR ?? "99");
  if (!Number.isFinite(raw) || raw <= 0) return 9900;
  return Math.round(raw * 100);
};

export async function POST(req: Request) {
  if (!isUpiEnabled()) {
    return NextResponse.json(
      { error: "UPI billing is not enabled yet." },
      { status: 503 }
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "UPI provider is not configured." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const user = await getRequestUser(req, supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planAmountPaise = getPlanAmountPaise();
  const planName = process.env.UPI_PLAN_NAME?.trim() || "Rahi.AI Premium";

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (host ? `${proto}://${host}` : "http://localhost:3000");

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const payload = {
    amount: planAmountPaise,
    currency: "INR",
    accept_partial: false,
    upi_link: true,
    description: `${planName} subscription`,
    customer: {
      name: fullName ?? undefined,
      email: user.email ?? undefined,
    },
    callback_url: `${baseUrl}/planner?upi=return`,
    callback_method: "get",
    notes: {
      user_id: user.id,
      source: "planner",
      plan: "premium",
    },
  };

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  let providerRes: Response;
  try {
    providerRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "UPI provider request failed." },
      { status: 502 }
    );
  }

  let data: any = null;
  try {
    data = await providerRes.json();
  } catch {
    data = null;
  }

  if (!providerRes.ok) {
    const details =
      typeof data?.error?.description === "string"
        ? data.error.description
        : "Unable to start UPI payment.";
    return NextResponse.json({ error: details }, { status: 502 });
  }

  const paymentId =
    typeof data?.id === "string" ? data.id : null;
  const url =
    typeof data?.short_url === "string"
      ? data.short_url
      : typeof data?.shortUrl === "string"
        ? data.shortUrl
        : typeof data?.url === "string"
          ? data.url
          : null;

  if (!paymentId || !url) {
    return NextResponse.json(
      { error: "UPI payment link response was incomplete." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    paymentId,
    url,
    amountInr: planAmountPaise / 100,
    status: typeof data?.status === "string" ? data.status : "created",
  });
}
