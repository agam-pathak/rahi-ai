import { NextResponse } from "next/server";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";

type ChatContext = {
  destination: string | null;
  days: number | null;
  budget: number | null;
  interests: string | null;
  stage: string | null;
  mode: string | null;
};

const normalizeChatContext = (value: unknown): ChatContext | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;

  const destination =
    typeof source.destination === "string"
      ? source.destination.trim().slice(0, 80)
      : "";
  const interests =
    typeof source.interests === "string"
      ? source.interests.trim().slice(0, 300)
      : "";
  const stage = typeof source.stage === "string" ? source.stage.trim().slice(0, 24) : "";
  const mode = typeof source.mode === "string" ? source.mode.trim().slice(0, 24) : "";

  const daysRaw = Number(source.days);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : null;
  const budgetRaw = Number(source.budget);
  const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.round(budgetRaw) : null;

  if (!destination && !interests && !stage && !mode && !days && !budget) {
    return null;
  }

  return {
    destination: destination || null,
    interests: interests || null,
    stage: stage || null,
    mode: mode || null,
    days,
    budget,
  };
};

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`ai:chat:${clientId}`, { limit: 30, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
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

  const message =
    typeof body?.message === "string" ? body.message.trim().slice(0, 800) : "";
  const history = body?.history;
  const context = normalizeChatContext(body?.context);
  if (!message) {
    return NextResponse.json(
      { error: "Message required" },
      { status: 400, headers: rlHeaders }
    );
  }

  const supabase = await createClient();
  const user = await getRequestUser(req, supabase);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: rlHeaders }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, travel_style")
    .eq("id", user.id)
    .maybeSingle();

  const historyMessages = Array.isArray(history)
    ? history.slice(-6).map((entry: unknown) => {
        const text = typeof entry === "string" ? entry : String(entry ?? "");
        const trimmed = text.trim().slice(0, 500);
        if (trimmed.startsWith("You:")) {
          return { role: "user", content: trimmed.replace(/^You:\s*/, "") };
        }
        if (trimmed.startsWith("Rahi.AI:")) {
          return { role: "assistant", content: trimmed.replace(/^Rahi\.AI:\s*/, "") };
        }
        return { role: "user", content: trimmed };
      })
    : [];

  const contextLines: string[] = [];
  if (context?.destination) contextLines.push(`destination: ${context.destination}`);
  if (context?.days) contextLines.push(`trip_days: ${context.days}`);
  if (context?.budget) contextLines.push(`budget_inr: ${context.budget}`);
  if (context?.interests) contextLines.push(`interests: ${context.interests}`);
  if (context?.stage) contextLines.push(`planner_stage: ${context.stage}`);
  if (context?.mode) contextLines.push(`planner_mode: ${context.mode}`);
  if (typeof profile?.travel_style === "string" && profile.travel_style.trim()) {
    contextLines.push(`user_travel_style: ${profile.travel_style.trim().slice(0, 60)}`);
  }
  if (typeof profile?.name === "string" && profile.name.trim()) {
    contextLines.push(`user_name: ${profile.name.trim().slice(0, 40)}`);
  }

  logAiRequest("ai/chat", clientId, {
    messageLength: String(message).length,
    hasContext: contextLines.length > 0,
    userId: user.id,
  });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "AI key missing" },
      { status: 500, headers: rlHeaders }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are Rahi.AI, a smart Indian travel assistant. Give concise, practical, India-first travel guidance. If itinerary details are requested, prefer a day-wise structure with budget awareness.",
            },
            ...(contextLines.length
              ? [
                  {
                    role: "system" as const,
                    content: `Current planner context:\n${contextLines.join("\n")}\nUse this context unless the user asks to change it.`,
                  },
                ]
              : []),
            ...historyMessages,
            { role: "user", content: message },
          ],
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

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI CHAT ERROR:", errText);
      return NextResponse.json(
        { error: "AI service failed" },
        { status: 500, headers: rlHeaders }
      );
    }

    const data = await res.json();

    return NextResponse.json(
      {
        reply: data.choices?.[0]?.message?.content || "Sorry, I couldn't respond.",
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("AI CHAT ERROR:", err);
    return NextResponse.json(
      { error: "AI service failed" },
      { status: 500, headers: rlHeaders }
    );
  }
}
