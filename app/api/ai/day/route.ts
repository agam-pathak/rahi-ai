import { NextResponse } from "next/server";
import { DaySchema } from "@/lib/schemas/trip.schema";
import { extractJSON, normalizeTripData } from "@/lib/ai/trip-utils";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const uuidv4 = () => globalThis.crypto.randomUUID();

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`ai:day:${clientId}`, { limit: 10, windowMs: 60_000 });
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
  const days = body?.days;
  const day_number = body?.day_number;
  const budget = body?.budget;
  const avoid_titles = body?.avoid_titles;

  const daysNum = Number(days);
  const dayNum = Number(day_number);
  const budgetNum = Number(budget);

  if (
    !destination ||
    !interests ||
    !Number.isFinite(daysNum) ||
    daysNum <= 0 ||
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

  logAiRequest("ai/day", clientId, {
    destination,
    day: dayNum,
    days: daysNum,
    budget: budgetNum,
    avoidCount: avoidList.length,
  });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "AI key missing" },
      { status: 500, headers: rlHeaders }
    );
  }

  const prompt = `
You are a backend API that outputs JSON.

Generate DAY ${dayNum} for a ${daysNum}-day trip to ${destination}.
Total budget (INR): ${budgetNum}
Interests: ${interests}

Avoid repeating these activity titles (if possible):
${avoidList.map((t: string) => `- ${t}`).join("\n")}

STRICT RULES:
- Return ONLY valid JSON
- Do NOT include markdown, comments, or explanations
- Each day MUST have 3-6 activities
- Costs must be realistic numbers (INR)

OUTPUT JSON SHAPE:
{
  "day_number": ${dayNum},
  "summary": "Brief summary of the day",
  "activities": [
    {
      "title": "Activity name",
      "type": "sightseeing | food | transit | rest | experience",
      "location": { "name": "Place name", "lat": 0, "lng": 0 },
      "estimated_cost": 500,
      "duration_minutes": 90,
      "verification": "ai_estimated",
      "tags": ["cultural"],
      "order_index": 0
    }
  ]
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
      console.error("AI DAY ERROR:", errText);
      console.warn(`[ai] day fail ms=${Date.now() - startedAt} reason=ai_error`);
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
      console.error("AI DAY PARSE ERROR:", rawText);
      console.warn(`[ai] day fail ms=${Date.now() - startedAt} reason=parse`);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500, headers: rlHeaders }
      );
    }

    const normalizedTrip = normalizeTripData({ days: [parsed] });
    const day = normalizedTrip.days?.[0] ?? { day_number: dayNum, activities: [] };
    day.day_number = dayNum;
    day.summary ??= `Day ${dayNum} in ${destination}`;

    day.activities.forEach((activity: any, index: number) => {
      activity.id = uuidv4();
      activity.order_index = Number.isFinite(activity.order_index)
        ? activity.order_index
        : index;
    });

    const validation = DaySchema.safeParse(day);
    if (!validation.success) {
      console.error("AI DAY VALIDATION ERROR:", validation.error.flatten());
      console.warn(`[ai] day fail ms=${Date.now() - startedAt} reason=validation`);
      return NextResponse.json(
        { error: "Day schema validation failed" },
        { status: 400, headers: rlHeaders }
      );
    }

    console.info(
      `[ai] day success ms=${Date.now() - startedAt} day=${dayNum}`
    );
    return NextResponse.json(validation.data, { headers: rlHeaders });
  } catch (err) {
    console.error("AI DAY ERROR:", err);
    console.warn(`[ai] day fail ms=${Date.now() - startedAt} reason=exception`);
    return NextResponse.json(
      { error: "AI service failed" },
      { status: 500, headers: rlHeaders }
    );
  }
}

