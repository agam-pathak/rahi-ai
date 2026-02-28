import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

const buildAuthClient = async () => {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) return null;

  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options: any) {
        cookieStore.set(name, "", { ...options, maxAge: 0 });
      },
    },
  });
};

const sanitizeNext = (raw: string | null) => {
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : "/";
};

export async function GET(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`auth:google:${clientId}`, {
    limit: 20,
    windowMs: 60_000,
  });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429, headers: rlHeaders }
    );
  }

  const requestUrl = new URL(req.url);
  const nextPath = sanitizeNext(requestUrl.searchParams.get("next"));
  const origin = requestUrl.origin;

  const supabase = await buildAuthClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500, headers: rlHeaders }
    );
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}${nextPath}`,
      },
    });
    if (error || !data?.url) {
      return NextResponse.json(
        { error: error?.message || "Unable to start Google sign in." },
        { status: 400, headers: rlHeaders }
      );
    }
    return NextResponse.json(
      {
        success: true,
        url: data.url,
      },
      { headers: rlHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "Authentication service is temporarily unavailable." },
      { status: 503, headers: rlHeaders }
    );
  }
}
