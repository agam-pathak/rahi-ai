import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export async function POST(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:invite:${clientId}`, { limit: 12, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const role = body?.role === "editor" ? "editor" : "viewer";
    const mode = body?.mode === "email" ? "email" : "link";
    const email = mode === "email" ? normalizeEmail(body?.email) : "";

    if (mode === "email" && (!email || !email.includes("@"))) {
      return NextResponse.json(
        { error: "Email required for email invites" },
        { status: 400, headers: rlHeaders }
      );
    }

    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: trip, error: tripError } = await dataClient
      .from("trips")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404, headers: rlHeaders }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: rlHeaders }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Invite service unavailable" },
        { status: 500, headers: rlHeaders }
      );
    }

    const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
      .replace(/-/g, "");

    const { error } = await supabaseAdmin
      .from("trip_invites")
      .insert({
        trip_id: trip.id,
        token,
        role,
        email: email || null,
        created_by: user.id,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: rlHeaders }
      );
    }

    const origin = new URL(req.url).origin;
    return NextResponse.json(
      {
        token,
        role,
        email: email || null,
        inviteUrl: `${origin}/invite/${token}`,
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("Invite create error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rlHeaders }
    );
  }
}
