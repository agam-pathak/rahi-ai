import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TripSchema } from "@/lib/schemas/trip.schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`trips:update:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const dataClient = supabaseAdmin ?? supabase;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { id, days, meta, expectedRevision, force } = body || {};
    if (!id || (!Array.isArray(days) && !meta)) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }
    if (
      expectedRevision !== undefined &&
      (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 0)
    ) {
      return NextResponse.json(
        { error: "Invalid expectedRevision" },
        { status: 400 }
      );
    }

    const { data: trip, error: tripError } = await dataClient
      .from("trips")
      .select("id, user_id, result")
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

    let result = trip.result;
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch {
        return NextResponse.json(
          { error: "Stored trip is invalid" },
          { status: 500 }
        );
      }
    }

    if (!result || typeof result !== "object") {
      return NextResponse.json(
        { error: "Stored trip is invalid" },
        { status: 500 }
      );
    }

    const currentRevision =
      Number.isInteger(result?.meta?.revision) && Number(result.meta.revision) >= 0
        ? Number(result.meta.revision)
        : 0;

    const shouldForce = force === true;
    if (!shouldForce && expectedRevision !== undefined && expectedRevision !== currentRevision) {
      return NextResponse.json(
        {
          error: "Trip changed in another session.",
          code: "SYNC_CONFLICT",
          serverRevision: currentRevision,
          serverTrip: result,
        },
        { status: 409 }
      );
    }

    if (Array.isArray(days)) {
      const normalizedDays = [...days]
        .sort((a: any, b: any) => (a.day_number ?? 0) - (b.day_number ?? 0))
        .map((day: any, index: number) => ({
          ...day,
          day_number: index + 1,
        }));
      result.days = normalizedDays;
      result.days_count = normalizedDays.length;
    }

    if (meta && typeof meta === "object") {
      const {
        revision: _ignoredRevision,
        last_saved_at: _ignoredLastSavedAt,
        ...safeMeta
      } = meta;
      result.meta = { ...result.meta, ...safeMeta };
    }

    const nextRevision = currentRevision + 1;
    const savedAt = new Date().toISOString();
    result.meta = {
      ...result.meta,
      revision: nextRevision,
      last_saved_at: savedAt,
    };

    const validation = TripSchema.safeParse(result);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Trip schema validation failed" },
        { status: 400 }
      );
    }

    const activityCount = validation.data.days.reduce(
      (sum, day) => sum + day.activities.length,
      0
    );

    const { error: updateError } = await dataClient
      .from("trips")
      .update({ result: validation.data })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update trip" },
        { status: 500 }
      );
    }

    console.info(
      `[trip] update id=${id} days=${validation.data.days.length} activities=${activityCount}`
    );
    return NextResponse.json({
      success: true,
      revision: nextRevision,
      saved_at: savedAt,
    });
  } catch (err) {
    console.error("Trip update error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
