import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/* ----------------------------- */
/* GET: fetch public trip        */
/* ----------------------------- */
export async function GET(
  req: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  const supabase = await createClient();
  const dataClient = supabaseAdmin ?? supabase;

  const { data, error } = await dataClient
    .from("trips")
    .select("id, destination, days, budget, interests, result, share_code, is_public")
    .eq("share_code", id)
    .eq("is_public", true)
    .single();

  if (error || !data) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(data);
}

/* ----------------------------- */
/* POST: add member              */
/* ----------------------------- */
export async function POST(
  req: Request,
  { params }: RouteContext
) {
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
      .eq("share_code", id)
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

    const { error } = await dataClient.from("trip_members").insert({
      trip_id: trip.id,
      user_id: userId,
      role: "viewer",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
