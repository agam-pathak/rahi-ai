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

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = await rateLimit(`auth:signup:${clientId}`, {
    limit: 10,
    windowMs: 60_000,
  });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429, headers: rlHeaders }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rlHeaders }
    );
  }

  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400, headers: rlHeaders }
    );
  }

  const supabase = await buildAuthClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500, headers: rlHeaders }
    );
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message || "Signup failed." },
        { status: 400, headers: rlHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
            }
          : null,
        requires_email_verification: !data.session,
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
