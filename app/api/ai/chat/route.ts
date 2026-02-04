import { NextResponse } from "next/server";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

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
  if (!message) {
    return NextResponse.json(
      { error: "Message required" },
      { status: 400, headers: rlHeaders }
    );
  }

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

  logAiRequest("ai/chat", clientId, { messageLength: String(message).length });

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
                "You are Rahi.AI, a smart Indian travel assistant. You can answer travel questions, generate itineraries, modify trips, optimize budgets and guide users.",
            },
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
