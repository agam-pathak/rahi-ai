import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TripSchema } from "@/lib/schemas/trip.schema";
import { buildTripPrompt } from "@/lib/ai/buildTripPrompt";
import {
  extractJSON,
  generateUniqueShareCode,
  injectSystemFields,
  normalizeTripData,
} from "@/lib/ai/trip-utils";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

/* ---------------- API ROUTE ---------------- */

export async function POST(req: Request) {
  try {
    const clientId = getClientId(req);
    const rl = rateLimit(`ai:trip:${clientId}`, { limit: 20, windowMs: 60_000 });
    const rlHeaders = rateLimitHeaders(rl);
    const startedAt = Date.now();
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rlHeaders }
      );
    }

    /* ---------- 1. Validate Input ---------- */
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: rlHeaders }
      );
    }
    const destination =
      typeof body?.destination === "string" ? body.destination.trim().slice(0, 80) : "";
    const interests =
      typeof body?.interests === "string" ? body.interests.trim().slice(0, 400) : "";
    const daysNum = Number(body?.days);
    const budgetNum = Number(body?.budget);

    if (
      !destination ||
      !interests ||
      !Number.isFinite(daysNum) ||
      daysNum <= 0 ||
      !Number.isFinite(budgetNum) ||
      budgetNum <= 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: rlHeaders }
      );
    }

    logAiRequest("ai/route", clientId, {
      destination,
      days: daysNum,
      budget: budgetNum,
      interestsLength: String(interests).length,
    });

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "AI key missing" },
        { status: 500, headers: rlHeaders }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: rlHeaders }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, travel_style, budget_range, bio")
      .eq("id", user.id)
      .maybeSingle();

    /* ---------- 2. STRICT PROMPT ---------- */
    const prompt = buildTripPrompt({
      destination,
      days: daysNum,
      budget: budgetNum,
      interests,
      profile: profile ?? null,
    });

    /* ---------- 3. Call AI ---------- */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    let aiRes: Response;
    try {
      aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a strict JSON generator." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return NextResponse.json(
          { error: "AI request timed out" },
          { status: 504, headers: rlHeaders }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI ERROR:", errText);
      console.warn(`[ai] trip fail ms=${Date.now() - startedAt} reason=ai_error`);
      return NextResponse.json(
        { error: "AI service failed" },
        { status: 500, headers: rlHeaders }
      );
    }

    const aiJson = await aiRes.json();
    const rawText = aiJson.choices?.[0]?.message?.content || "";

    /* ---------- 4. Parse JSON ---------- */
    let parsedData: any;
    try {
      parsedData = JSON.parse(extractJSON(rawText));
    } catch (err) {
      console.error("JSON PARSE ERROR:", rawText);
      console.warn(`[ai] trip fail ms=${Date.now() - startedAt} reason=parse`);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500, headers: rlHeaders }
      );
    }

    /* ---------- 5. Normalize + Inject Fields ---------- */
    const normalized = normalizeTripData(parsedData);
    const withSystemFields = injectSystemFields(
      normalized,
      destination,
      daysNum
    );
    const finalNormalized = normalizeTripData(withSystemFields);

    /* ---------- 6. Zod Validation ---------- */
    const validation = TripSchema.safeParse(finalNormalized);

    if (!validation.success) {
      console.error(
        "ZOD VALIDATION ERROR:",
        validation.error.flatten()
      );
      console.warn(`[ai] trip fail ms=${Date.now() - startedAt} reason=validation`);
      return NextResponse.json(
        { error: "Trip schema validation failed" },
        { status: 400, headers: rlHeaders }
      );
    }

    const finalTrip = {
      ...validation.data,
      meta: {
        ...validation.data.meta,
        revision: 0,
        last_saved_at: new Date().toISOString(),
      },
    };

    /* ---------- 7. Save to Supabase ---------- */
    const isShareCodeAvailable = async (code: string) => {
      const { data, error } = await supabase
        .from("trips")
        .select("id")
        .eq("share_code", code)
        .limit(1);
      if (error) {
        console.warn("Share code availability check failed:", error);
        return true;
      }
      return (data?.length ?? 0) === 0;
    };

    let share_code = await generateUniqueShareCode(isShareCodeAvailable);
    let inserted: { id: string } | null = null;
    let dbError: any = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          destination,
          days: String(daysNum),
          budget: String(budgetNum),
          interests,
          result: finalTrip,
          share_code,
          is_public: true,
        })
        .select("id")
        .single();

      if (!error) {
        inserted = data;
        dbError = null;
        break;
      }

      dbError = error;
      if (error?.code === "23505") {
        share_code = await generateUniqueShareCode(isShareCodeAvailable);
        continue;
      }
      break;
    }

    if (dbError) {
      console.error("DB ERROR:", dbError);
      console.warn(`[ai] trip fail ms=${Date.now() - startedAt} reason=db`);
      return NextResponse.json(
        { error: "Failed to save trip" },
        { status: 500, headers: rlHeaders }
      );
    }

    /* ---------- 8. Success ---------- */
    console.info(
      `[ai] trip success ms=${Date.now() - startedAt} days=${finalTrip.days.length}`
    );
    return NextResponse.json(
      {
        result: finalTrip,
        share_code,
        trip_id: inserted?.id ?? null,
      },
      { headers: rlHeaders }
    );

  } catch (err: any) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
