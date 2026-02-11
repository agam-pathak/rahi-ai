import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`invites:accept:${clientId}`, { limit: 20, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Invite service unavailable" },
      { status: 500, headers: rlHeaders }
    );
  }

  try {
    const { token } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("trip_invites")
      .select("id, trip_id, role, email, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404, headers: rlHeaders }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invite expired" },
        { status: 410, headers: rlHeaders }
      );
    }

    const emailMatch =
      !invite.email || invite.email.toLowerCase() === (user.email ?? "").toLowerCase();
    if (!emailMatch) {
      return NextResponse.json(
        { error: "This invite is for another email address." },
        { status: 403, headers: rlHeaders }
      );
    }

    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("id, user_id, share_code")
      .eq("id", invite.trip_id)
      .single();

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404, headers: rlHeaders }
      );
    }

    if (!invite.accepted_at && trip.user_id !== user.id) {
      const { data: existing } = await supabaseAdmin
        .from("trip_members")
        .select("user_id")
        .eq("trip_id", invite.trip_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabaseAdmin
          .from("trip_members")
          .insert({
            trip_id: invite.trip_id,
            user_id: user.id,
            role: invite.role === "editor" ? "editor" : "viewer",
          });

        if (insertError) {
          return NextResponse.json(
            { error: insertError.message },
            { status: 400, headers: rlHeaders }
          );
        }
      }
    }

    if (!invite.accepted_at) {
      await supabaseAdmin
        .from("trip_invites")
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq("id", invite.id);
    }

    return NextResponse.json(
      {
        status: invite.accepted_at ? "already_accepted" : "accepted",
        share_code: trip.share_code,
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("Invite accept error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rlHeaders }
    );
  }
}
