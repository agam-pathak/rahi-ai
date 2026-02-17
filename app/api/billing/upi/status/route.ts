import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

const isPaidStatus = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase() === "paid";

const amountInrFromPaise = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric / 100 : 0;
};

export async function GET(req: Request) {
  if (!isUpiEnabled()) {
    return NextResponse.json(
      { error: "UPI billing is not enabled yet." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("payment_id")?.trim() ?? "";

  if (!paymentId) {
    return NextResponse.json(
      { error: "payment_id is required" },
      { status: 400 }
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

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  let providerRes: Response;
  try {
    providerRes = await fetch(
      `https://api.razorpay.com/v1/payment_links/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch payment status from provider." },
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
        : "Unable to fetch payment status.";
    return NextResponse.json({ error: details }, { status: 502 });
  }

  const ownerId =
    typeof data?.notes?.user_id === "string" ? data.notes.user_id : null;

  if (ownerId && ownerId !== user.id) {
    return NextResponse.json(
      { error: "This payment does not belong to your account." },
      { status: 403 }
    );
  }

  const paidByStatus = isPaidStatus(data?.status);
  const amount = Number(data?.amount ?? 0);
  const amountPaid = Number(data?.amount_paid ?? 0);
  const paidByAmount =
    Number.isFinite(amount) &&
    Number.isFinite(amountPaid) &&
    amount > 0 &&
    amountPaid >= amount;
  const paid = paidByStatus || paidByAmount;

  if (paid) {
    const dataClient = supabaseAdmin ?? supabase;
    const { error } = await dataClient
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email ?? null,
        is_premium: true,
      });

    if (error) {
      return NextResponse.json(
        { error: "Payment captured, but profile update failed." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    paymentId: typeof data?.id === "string" ? data.id : paymentId,
    status: typeof data?.status === "string" ? data.status : "created",
    paid,
    amountInr: amountInrFromPaise(data?.amount),
    amountPaidInr: amountInrFromPaise(data?.amount_paid),
    method:
      typeof data?.payments?.[0]?.method === "string"
        ? data.payments[0].method
        : null,
  });
}
