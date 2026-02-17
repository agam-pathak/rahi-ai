import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/supabase/request-user";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`users:lookup:${clientId}`, { limit: 20, windowMs: 60_000 });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }
  const supabase = await createClient();
  const user = await getRequestUser(req, supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json(
      { error: "Email required" },
      { status: 400 }
    );
  }

  if (supabaseAdmin) {
    const perPage = 1000;
    let page = 1;
    let found: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;

    while (!found) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return NextResponse.json({ error: "User lookup failed" }, { status: 500 });
      }

      const users = data?.users ?? [];
      found = users.find(
        (candidate) => (candidate.email ?? "").toLowerCase() === email
      ) ?? null;

      if (found || users.length < perPage) break;
      page += 1;
    }

    if (!found) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const displayName =
      (found.user_metadata?.name as string | undefined) ||
      (found.user_metadata?.full_name as string | undefined) ||
      (found.email ? found.email.split("@")[0] : null);

    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: found.id,
          email: found.email ?? email,
          name: displayName,
        },
        { onConflict: "id" }
      );

    return NextResponse.json({ id: found.id, email: found.email ?? email });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .limit(1);

  if (error) {
    return NextResponse.json(
      { error: "Lookup unavailable. Configure SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const match = data?.[0];
  if (!match) {
    return NextResponse.json(
      { error: "User not found. Ask them to sign in once or share their user ID." },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: match.id, email: match.email });
}
