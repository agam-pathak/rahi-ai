import { createClient } from "@/lib/supabase/server";

export async function getTripWithMembers(tripId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trips")
    .select(`
      *,
      trip_members (
        user_id,
        role,
        created_at,
        profiles (
          id,
          name,
          email
        )
      )
    `)
    .eq("id", tripId)
    .single();

  if (error) throw error;

  return data;
}

export async function addTripMember(
  tripId: string,
  userId: string,
  role: "editor" | "viewer" = "viewer"
) {
  const supabase = await createClient();

  const { error } = await supabase.from("trip_members").insert({
    trip_id: tripId,
    user_id: userId,
    role,
  });

  if (error) throw error;
}

export async function removeTripMember(tripId: string, userId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getMyTripRole(tripId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("user_id")
    .eq("id", tripId)
    .single();

  if (!tripError && trip?.user_id === user.id) {
    return "owner";
  }

  const { data, error } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (error) return null;

  return data.role as "owner" | "editor" | "viewer";
}
