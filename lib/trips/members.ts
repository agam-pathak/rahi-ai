import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getTripWithMembers(tripId: string) {
  const supabase = await createClient();
  const dataClient = supabaseAdmin ?? supabase;

  const { data: trip, error: tripError } = await dataClient
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (tripError) throw tripError;

  const { data: members, error: membersError } = await dataClient
    .from("trip_members")
    .select("user_id, role, created_at")
    .eq("trip_id", tripId);

  if (membersError) throw membersError;

  const memberList = members ?? [];
  let profilesMap = new Map<string, { id: string; name: string | null; email: string | null }>();

  if (memberList.length > 0) {
    const userIds = memberList.map((member) => member.user_id);
    const { data: profiles } = await dataClient
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    profilesMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  }

  return {
    ...trip,
    trip_members: memberList.map((member) => ({
      ...member,
      profiles: profilesMap.get(member.user_id) ?? null,
    })),
  };
}

export async function addTripMember(
  tripId: string,
  userId: string,
  role: "editor" | "viewer" = "viewer"
) {
  const supabase = await createClient();
  const dataClient = supabaseAdmin ?? supabase;

  const { error } = await dataClient.from("trip_members").insert({
    trip_id: tripId,
    user_id: userId,
    role,
  });

  if (error) throw error;
}

export async function removeTripMember(tripId: string, userId: string) {
  const supabase = await createClient();
  const dataClient = supabaseAdmin ?? supabase;

  const { error } = await dataClient
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
