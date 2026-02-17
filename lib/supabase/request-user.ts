import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CookieSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const extractBearerToken = (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
};

export async function getRequestUser(
  req: Request,
  supabase: CookieSupabaseClient
): Promise<User | null> {
  const cookieUserResult = await supabase.auth.getUser();
  if (cookieUserResult.data.user) {
    return cookieUserResult.data.user;
  }

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return null;

  if (supabaseAdmin) {
    const adminUserResult = await supabaseAdmin.auth.getUser(bearerToken);
    if (adminUserResult.data.user) {
      return adminUserResult.data.user;
    }
  }

  const anonUserResult = await supabase.auth.getUser(bearerToken);
  return anonUserResult.data.user ?? null;
}
