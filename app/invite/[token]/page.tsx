import RahiBackground from "@/components/RahiBackground";
import TripInviteAccept from "@/components/trips/TripInviteAccept";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  if (!supabaseAdmin) {
    return (
      <div className="relative min-h-screen text-white px-4 sm:px-6 py-10">
        <RahiBackground />
        <div className="relative z-10 max-w-xl mx-auto rahi-panel px-6 py-8 text-center">
          <h1 className="text-xl font-display font-bold text-white">Invite unavailable</h1>
          <p className="text-sm text-gray-400 mt-2">
            Invite service is not configured on this deployment.
          </p>
        </div>
      </div>
    );
  }

  const { data: invite } = await supabaseAdmin
    .from("trip_invites")
    .select("trip_id, role, email, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="relative min-h-screen text-white px-4 sm:px-6 py-10">
        <RahiBackground />
        <div className="relative z-10 max-w-xl mx-auto rahi-panel px-6 py-8 text-center">
          <h1 className="text-xl font-display font-bold text-white">Invite not found</h1>
          <p className="text-sm text-gray-400 mt-2">
            This invite link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("destination, share_code")
    .eq("id", invite.trip_id)
    .single();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen text-white px-4 sm:px-6 py-10">
      <RahiBackground />
      <div className="relative z-10 max-w-xl mx-auto rahi-panel px-6 py-8 space-y-4">
        <h1 className="text-2xl font-display font-bold text-white">Trip Invite</h1>
        <TripInviteAccept
          invite={{
            token,
            destination: trip?.destination ?? "your trip",
            role: invite.role === "editor" ? "editor" : "viewer",
            email: invite.email,
            expiresAt: invite.expires_at,
            acceptedAt: invite.accepted_at,
            shareCode: trip?.share_code,
          }}
          isAuthed={Boolean(user)}
          userEmail={user?.email ?? null}
        />
      </div>
    </div>
  );
}
