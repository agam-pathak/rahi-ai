import { NextResponse } from "next/server";
import { getClientId, logAiRequest, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

export async function POST(req: Request) {
  try {
    const clientId = getClientId(req);
    const rl = await rateLimit(`ai:weather:${clientId}`, { limit: 20, windowMs: 60_000 });
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = await req.json();
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const days = Number(body.days || 5);

    if (!city) {
      return NextResponse.json(
        { error: "City required" },
        { status: 400, headers: rlHeaders }
      );
    }

    const API_KEY = process.env.WEATHER_API_KEY;

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Weather API key missing" },
        { status: 500, headers: rlHeaders }
      );
    }

    logAiRequest("ai/weather", clientId, { city, days });

    const fetchForecast = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false as const, errText };
      }
      const data = await res.json();
      return { ok: true as const, data };
    };

    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
      city
    )}&appid=${API_KEY}&units=metric`;

    let forecast = await fetchForecast(url);
    let lastError = "";

    if (!forecast.ok) {
      lastError = forecast.errText;
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        city
      )}&limit=1&appid=${API_KEY}`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          const { lat, lon } = geoData[0];
          const fallbackUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
          forecast = await fetchForecast(fallbackUrl);
          if (!forecast.ok) lastError = forecast.errText;
        } else {
          lastError = "Geocoding returned no results.";
        }
      } else {
        lastError = await geoRes.text();
      }
    }

    if (!forecast.ok) {
      console.error("OpenWeather Error:", lastError);
      return NextResponse.json(
        { error: "Weather not available for this location", details: lastError },
        { status: 502, headers: rlHeaders }
      );
    }

    const data = forecast.data;

    if (!data.list) {
      return NextResponse.json(
        { error: "Malformed weather response" },
        { status: 500, headers: rlHeaders }
      );
    }

    const dailyMap: any = {};

    data.list.forEach((item: any) => {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = item;
      }
    });

    const dailyForecast = Object.values(dailyMap).slice(0, days);

    return NextResponse.json(dailyForecast, { headers: rlHeaders });
  } catch (err) {
    console.error("Weather Route Crash:", err);
    return NextResponse.json(
      { error: "Weather fetch crashed" },
      { status: 500 }
    );
  }
}

