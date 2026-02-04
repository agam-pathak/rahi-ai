import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TripSchema } from "@/lib/schemas/trip.schema";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { id, days, meta } = body || {};
    if (!id || (!Array.isArray(days) && !meta)) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { data: trip, error: tripError } = await supabase
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
      result.meta = { ...result.meta, ...meta };
    }

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

    const { error: updateError } = await supabase
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
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Trip update error:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
