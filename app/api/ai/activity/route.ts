import { NextResponse } from "next/server";
import { ActivitySchema } from "@/lib/schemas/trip.schema";
import { extractJSON, normalizeTripData } from "@/lib/ai/trip-utils";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const uuidv4 = () => globalThis.crypto.randomUUID();

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`ai:activity:${clientId}`, { limit: 20, windowMs: 60_000 });
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
  const current_title =
    typeof body?.current_title === "string"
      ? body.current_title.trim().slice(0, 140)
      : "";
  const day_number = body?.day_number;
  const budget = body?.budget;
  const order_index = body?.order_index;
  const avoid_titles = body?.avoid_titles;

  const dayNum = Number(day_number);
  const budgetNum = Number(budget);
  const orderIndexNum = Number(order_index);

  if (
    !destination ||
    !interests ||
    !Number.isFinite(dayNum) ||
    dayNum <= 0 ||
    !Number.isFinite(budgetNum) ||
    budgetNum <= 0
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400, headers: rlHeaders }
    );
  }

  const avoidList = Array.isArray(avoid_titles)
    ? avoid_titles.map((t: string) => String(t).slice(0, 80)).slice(0, 40)
    : [];

  logAiRequest("ai/activity", clientId, {
    destination,
    day: dayNum,
    budget: budgetNum,
    orderIndex: Number.isFinite(orderIndexNum) ? orderIndexNum : null,
  });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "AI key missing" },
      { status: 500, headers: rlHeaders }
    );
  }

  const prompt = `
You are a backend API that outputs JSON.

Generate ONE replacement activity for DAY ${dayNum} in ${destination}.
Total budget (INR): ${budgetNum}
Interests: ${interests}

Replace this activity title:
${current_title || "Unknown"}

Avoid repeating these activity titles (if possible):
${avoidList.map((t: string) => `- ${t}`).join("\n")}

STRICT RULES:
- Return ONLY valid JSON
- Do NOT include markdown, comments, or explanations
- Costs must be realistic numbers (INR)

OUTPUT JSON SHAPE:
{
  "title": "Activity name",
  "type": "sightseeing | food | transit | rest | experience",
  "location": { "name": "Place name", "lat": 0, "lng": 0 },
  "estimated_cost": 500,
  "duration_minutes": 90,
  "verification": "ai_estimated",
  "tags": ["cultural"],
  "order_index": ${Number.isFinite(orderIndexNum) ? orderIndexNum : 0}
}

Return ONLY JSON.
`;

  try {
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
      console.error("AI ACTIVITY ERROR:", errText);
      console.warn(`[ai] activity fail ms=${Date.now() - startedAt} reason=ai_error`);
      return NextResponse.json(
        { error: "AI service failed" },
        { status: 500, headers: rlHeaders }
      );
    }

    const aiJson = await aiRes.json();
    const rawText = aiJson.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      parsed = JSON.parse(extractJSON(rawText));
    } catch (err) {
      console.error("AI ACTIVITY PARSE ERROR:", rawText);
      console.warn(`[ai] activity fail ms=${Date.now() - startedAt} reason=parse`);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500, headers: rlHeaders }
      );
    }

    const normalizedTrip = normalizeTripData({
      days: [{ activities: [parsed] }],
    });
    const activity = normalizedTrip.days?.[0]?.activities?.[0] ?? parsed;
    activity.id = uuidv4();
    if (Number.isFinite(orderIndexNum)) {
      activity.order_index = orderIndexNum;
    }

    const validation = ActivitySchema.safeParse(activity);
    if (!validation.success) {
      console.error("AI ACTIVITY VALIDATION ERROR:", validation.error.flatten());
      console.warn(`[ai] activity fail ms=${Date.now() - startedAt} reason=validation`);
      return NextResponse.json(
        { error: "Activity schema validation failed" },
        { status: 400, headers: rlHeaders }
      );
    }

    console.info(
      `[ai] activity success ms=${Date.now() - startedAt} day=${dayNum}`
    );
    return NextResponse.json(validation.data, { headers: rlHeaders });
  } catch (err) {
    console.error("AI ACTIVITY ERROR:", err);
    console.warn(`[ai] activity fail ms=${Date.now() - startedAt} reason=exception`);
    return NextResponse.json(
      { error: "AI service failed" },
      { status: 500, headers: rlHeaders }
    );
  }
}
