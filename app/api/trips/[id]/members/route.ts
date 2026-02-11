import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:member:${clientId}`, { limit: 15, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  try {
    const { id } = await params;
    const { userId, role } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }
    if (role && role !== "viewer" && role !== "editor") {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
        { status: 404 }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { error } = await dataClient
      .from("trip_members")
      .insert({
        trip_id: trip.id,
        user_id: userId,
        role: role === "editor" ? "editor" : "viewer",
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Add member error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:member:${clientId}`, { limit: 30, windowMs: 60_000 });
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

    let role: "owner" | "editor" | "viewer" | null = null;
    if (trip.user_id === user.id) {
      role = "owner";
    } else {
      const { data: member } = await dataClient
        .from("trip_members")
        .select("role")
        .eq("trip_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      role = (member?.role as "editor" | "viewer") ?? null;
    }

    if (!role) {
      return NextResponse.json(
        { role: null, members: [], owner_id: trip.user_id ?? null },
        { headers: rlHeaders }
      );
    }

    const { data: members, error: membersError } = await dataClient
      .from("trip_members")
      .select("user_id, role, created_at")
      .eq("trip_id", id);

    if (membersError) {
      return NextResponse.json(
        { error: "Failed to load members" },
        { status: 500, headers: rlHeaders }
      );
    }

    const memberList = members ?? [];
    let profilesMap = new Map<string, { id: string; name: string | null; email: string | null }>();
    if (memberList.length > 0) {
      const userIds = memberList.map((member) => member.user_id);
      const { data: profiles } = await dataClient
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      profilesMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    }

    return NextResponse.json(
      {
        role,
        owner_id: trip.user_id ?? null,
        members: memberList.map((member) => ({
          ...member,
          profiles: profilesMap.get(member.user_id) ?? null,
        })),
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("Trip members GET error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: rlHeaders }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:member:${clientId}`, { limit: 15, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  try {
    const { id } = await params;
    const { userId, role } = await req.json();
    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role required" },
        { status: 400 }
      );
    }
    if (role !== "viewer" && role !== "editor") {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
        { status: 404 }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { error } = await dataClient
      .from("trip_members")
      .update({ role })
      .eq("trip_id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update member role error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:member:${clientId}`, { limit: 15, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  try {
    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const dataClient = supabaseAdmin ?? supabase;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
        { status: 404 }
      );
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { error } = await dataClient
      .from("trip_members")
      .delete()
      .eq("trip_id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove member error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
