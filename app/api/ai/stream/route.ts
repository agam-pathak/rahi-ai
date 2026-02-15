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
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`ai:stream:${clientId}`, { limit: 15, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  const startedAt = Date.now();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

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

  logAiRequest("ai/stream", clientId, {
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
  const dataClient = supabaseAdmin ?? supabase;
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(streamController) {
      const send = (obj: any) => {
        streamController.enqueue(
          encoder.encode(JSON.stringify(obj) + "\n")
        );
      };

      try {
        const prompt = buildTripPrompt({
          destination,
          days: daysNum,
          budget: budgetNum,
          interests,
          profile: profile ?? null,
        });

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 18_000);
        let aiRes: Response;
        try {
          aiRes = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
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
              signal: abortController.signal,
            }
          );
        } catch (err: any) {
          if (err?.name === "AbortError") {
            send({ type: "error", message: "AI request timed out" });
            streamController.close();
            return;
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }

        if (!aiRes.ok) throw new Error("AI failed");

        const aiJson = await aiRes.json();
        const rawText = aiJson.choices?.[0]?.message?.content || "";

        let parsed: any;
        try {
          parsed = JSON.parse(extractJSON(rawText));
        } catch {
          send({ type: "error", message: "AI returned invalid JSON" });
          console.warn(`[ai] stream fail ms=${Date.now() - startedAt} reason=parse`);
          streamController.close();
          return;
        }

        const normalized = normalizeTripData(parsed);
        const withSystemFields = injectSystemFields(
          normalized,
          destination,
          daysNum
        );
        const finalNormalized = normalizeTripData(withSystemFields);
        const validation = TripSchema.safeParse(finalNormalized);

        if (!validation.success) {
          send({ type: "error", message: "Trip validation failed" });
          console.warn(`[ai] stream fail ms=${Date.now() - startedAt} reason=validation`);
          streamController.close();
          return;
        }

        const finalTrip = {
          ...validation.data,
          meta: {
            ...validation.data.meta,
            revision: 0,
            last_saved_at: new Date().toISOString(),
          },
        };
        const isShareCodeAvailable = async (code: string) => {
          const { data, error } = await dataClient
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
          const { data, error } = await dataClient
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
          send({
            type: "error",
            message: dbError?.message || "Failed to save trip",
          });
          console.warn(
            `[ai] stream fail ms=${Date.now() - startedAt} reason=db code=${dbError?.code ?? "n/a"} msg=${dbError?.message ?? "unknown"}`
          );
          streamController.close();
          return;
        }

        for (const day of finalTrip.days) {
          send({
            type: "day",
            payload: day,
          });
        }

        send({
          type: "meta",
          payload: finalTrip.meta,
        });

        send({
          type: "share_code",
          payload: share_code,
        });

        if (inserted?.id) {
          send({
            type: "trip_id",
            payload: inserted.id,
          });
        }

        send({ type: "done" });
        console.info(
          `[ai] stream success ms=${Date.now() - startedAt} days=${finalTrip.days.length}`
        );
        streamController.close();

      } catch (err) {
        console.error("Stream AI error:", err);
        console.warn(`[ai] stream fail ms=${Date.now() - startedAt} reason=exception`);
        send({ type: "error", message: "Failed to generate trip" });
        streamController.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
      ...rlHeaders,
    },
  });
}
