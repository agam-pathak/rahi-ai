import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sendInviteEmail = async ({
  apiKey,
  from,
  to,
  inviteUrl,
  destination,
  role,
}: {
  apiKey: string;
  from: string;
  to: string;
  inviteUrl: string;
  destination: string;
  role: string;
}) => {
  const subject = `You're invited to plan ${destination} on Rahi.AI`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px">Rahi.AI Trip Invite</h2>
      <p>You have been invited as a <strong>${role}</strong> to collaborate on a trip to <strong>${destination}</strong>.</p>
      <p>
        <a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background:#14b8a6;color:#0b0d12;text-decoration:none;border-radius:6px">
          Accept Invite
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">If the button doesn't work, copy and paste this link: ${inviteUrl}</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = typeof data?.message === "string" ? data.message : "Email send failed";
    return { ok: false, error: message };
  }

  return { ok: true };
};

export async function POST(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`trips:invite:${clientId}`, { limit: 12, windowMs: 60_000 });
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
    const user = await getRequestUser(req, supabase);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: trip, error: tripError } = await dataClient
      .from("trips")
      .select("id, user_id, destination")
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

    const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
      .replace(/-/g, "");

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { data: inviteRow, error } = await dataClient
      .from("trip_invites")
      .insert({
        trip_id: trip.id,
        token,
        role,
        email: email || null,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("id, created_at, accepted_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: rlHeaders }
      );
    }

    const origin = new URL(req.url).origin;
    const inviteUrl = `${origin}/invite/${token}`;

    let emailSent = false;
    let emailError: string | null = null;
    if (mode === "email" && email) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        emailError = "Email service not configured.";
      } else {
        const from =
          process.env.RESEND_FROM_EMAIL || "Rahi.AI <noreply@rahi.ai>";
        const result = await sendInviteEmail({
          apiKey,
          from,
          to: email,
          inviteUrl,
          destination: trip.destination || "your trip",
          role,
        });
        emailSent = result.ok;
        emailError = result.ok ? null : result.error;
      }
    }

    return NextResponse.json(
      {
        inviteUrl,
        invite: {
          id: inviteRow?.id ?? "",
          token,
          role,
          email: email || null,
          created_at: inviteRow?.created_at ?? new Date().toISOString(),
          expires_at: expiresAt,
          accepted_at: inviteRow?.accepted_at ?? null,
        },
        emailSent,
        emailError,
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

export async function GET(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`trips:invite:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  try {
    const { id } = await params;
    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;
    const user = await getRequestUser(req, supabase);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: trip } = await dataClient
      .from("trips")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!trip) {
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

    const { data: invites, error: invitesError } = await dataClient
      .from("trip_invites")
      .select("id, token, role, email, created_at, expires_at, accepted_at")
      .eq("trip_id", id)
      .order("created_at", { ascending: false });

    if (invitesError) {
      return NextResponse.json(
        { error: "Unable to load invites." },
        { status: 500, headers: rlHeaders }
      );
    }

    const origin = new URL(req.url).origin;
    const responseInvites =
      invites?.map((invite) => ({
        ...invite,
        inviteUrl: `${origin}/invite/${invite.token}`,
      })) ?? [];

    return NextResponse.json({ invites: responseInvites }, { headers: rlHeaders });
  } catch (err) {
    console.error("Invite list error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rlHeaders }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`trips:invite:${clientId}`, { limit: 20, windowMs: 60_000 });
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
    const inviteId = body?.inviteId as string | undefined;
    const token = body?.token as string | undefined;

    if (!inviteId && !token) {
      return NextResponse.json(
        { error: "inviteId required" },
        { status: 400, headers: rlHeaders }
      );
    }

    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;
    const user = await getRequestUser(req, supabase);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: trip } = await dataClient
      .from("trips")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!trip) {
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

    let query = dataClient
      .from("trip_invites")
      .delete()
      .eq("trip_id", id);

    if (inviteId) {
      query = query.eq("id", inviteId);
    } else if (token) {
      query = query.eq("token", token);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: rlHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: rlHeaders });
  } catch (err) {
    console.error("Invite revoke error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rlHeaders }
    );
  }
}

